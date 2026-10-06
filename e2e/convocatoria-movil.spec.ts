import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * La convocatoria del capitán en el móvil: su propia respuesta en una línea,
 * chips de estado que filtran la lista y «Confirmar» en una barra fija abajo,
 * con cuántos hay ya en pista.
 */
test("en el móvil, el capitán filtra por estado y confirma desde la barra fija", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "conv-movil");
  const iria = await seedPlayerInTeam(request, "conv-movil-iria", team.id, capitana, {
    nombre: "Iria",
    apellidos: "Souto",
  });
  const brais = await seedPlayerInTeam(request, "conv-movil-brais", team.id, capitana, {
    nombre: "Brais",
    apellidos: "Lema",
  });
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 4",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 1,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id: eventId } = (await res.json()) as { id: string };
  for (const [quien, status] of [
    [capitana, "confirmado"],
    [iria, "confirmado"],
    [brais, "duda"],
  ] as const) {
    const r = await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(quien),
      data: { event_id: eventId, status },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, capitana);
  await page.goto(`/eventos/${eventId}`);

  // Su respuesta, plegada: se abre si la quiere cambiar.
  const miRespuesta = page.getByRole("button", { name: /mi respuesta/i });
  await expect(miRespuesta).toContainText(/confirmado/i, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^reserva$/i })).toHaveCount(0);
  await miRespuesta.click();
  await expect(page.getByRole("button", { name: /^reserva$/i })).toBeVisible();

  // Los chips filtran: «Duda» deja solo a Brais.
  const filtros = page.getByRole("group", { name: /filtrar apuntados/i });
  await expect(filtros.getByRole("button", { name: /todos\s*3/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await filtros.getByRole("button", { name: /duda\s*1/i }).click();
  await expect(page.getByText("Brais Lema")).toBeVisible();
  await expect(page.getByText("Iria Souto")).toHaveCount(0);
  await filtros.getByRole("button", { name: /todos/i }).click();
  await expect(page.getByText("Iria Souto")).toBeVisible();

  // Una línea por jugador; al tocarla, la hoja para ponerlo en una pista.
  await page.getByRole("button", { name: /iria souto/i }).click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: /^pista 1/i }).click();
  await expect(hoja).toHaveCount(0);
  await expect(page.getByRole("button", { name: /iria souto/i })).toContainText("P1");

  // En Pistas, el resto espera en el banquillo: se toca y luego la pista.
  await page.getByRole("tab", { name: /pistas/i }).click();
  const banquillo = page.locator("[data-banquillo]");
  await banquillo.getByRole("button", { name: /brais/i }).click();
  await page.getByRole("button", { name: /brais l\. aquí/i }).click();
  await expect(page.getByRole("tab", { name: /pistas/i })).toContainText("2/2");
  await page.getByRole("tab", { name: /apuntados/i }).click();

  // La barra fija, abajo del todo de la pantalla.
  const barra = page.locator("[data-barra-confirmar]");
  await expect(barra).toContainText(/2 de 2 en pista/i);
  const caja = await barra.boundingBox();
  expect(caja && Math.round(caja.y + caja.height)).toBe(844);

  await barra.getByRole("button", { name: /confirmar/i }).click();
  await expect(barra).toHaveCount(0);
  await expect(page.getByText(/convocatoria confirmada/i).first()).toBeVisible();
});

test("en el ordenador no hay barra fija: Confirmar sigue en el tablero", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "conv-pc");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 5",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 1,
    },
  });
  const { id: eventId } = (await res.json()) as { id: string };
  await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(capitana),
    data: { event_id: eventId, status: "confirmado" },
  });

  await loginAs(page, capitana);
  await page.goto(`/eventos/${eventId}`);
  await expect(page.getByRole("button", { name: /^confirmar convocatoria$/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("[data-barra-confirmar]")).toBeHidden();
});

test("desde Enfrentamientos, en el teléfono «Asignar pistas» abre la ficha en Pistas", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "conv-enfr");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 7",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  const { id: eventId } = (await res.json()) as { id: string };
  await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(capitana),
    data: { event_id: eventId, status: "confirmado" },
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, capitana);
  await page.goto("/enfrentamientos");
  await page.getByRole("link", { name: /asignación de pistas/i }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventId}\\?pestana=pistas`));
  await expect(page.getByRole("tab", { name: /pistas/i })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 20_000 },
  );

  // En el ordenador, como siempre: se despliega ahí mismo.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/enfrentamientos");
  await page.getByRole("button", { name: /asignación de pistas/i }).click();
  await expect(page.getByRole("button", { name: /^confirmar convocatoria$/i })).toBeVisible();
  await expect(page).toHaveURL(/\/enfrentamientos/);
});
