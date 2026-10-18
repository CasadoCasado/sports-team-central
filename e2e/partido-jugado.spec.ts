import { test, expect } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  pasarAlPasado,
  seedCaptainWithTeam,
  seedPlayerInTeam,
} from "./session";

/**
 * Un enfrentamiento ya jugado no cambia su convocatoria ni sus parejas: la
 * zona del reparto no aparece, el ★ no se puede marcar y el servidor tampoco
 * lo deja por su cuenta.
 */
test("en un partido jugado no se toca la convocatoria", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "jugado");
  const sara = await seedPlayerInTeam(request, "jugado-sara", team.id, capitana, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 1",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  const { id } = (await ev.json()) as { id: string };
  const r = await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(sara),
    data: { event_id: id, status: "confirmado" },
  });
  const { id: respId } = (await r.json()) as { id: string };
  await request.patch(`${API_URL}/event-responses/${respId}/`, {
    headers: bearer(capitana),
    data: { padel_pista: 1, es_convocado: true },
  });
  await pasarAlPasado(request, capitana, id);

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(page.getByRole("heading", { name: /^convocatorias$/i })).toBeVisible({
    timeout: 20_000,
  });
  // Plegada de inicio: solo la cabecera, sin la lista ni el reparto.
  await expect(page.getByText("Sara Lago")).toHaveCount(0);
  await expect(page.locator('[data-drop="1"]')).toHaveCount(0);
  const ver = page.getByRole("button", { name: /ver convocatoria/i });
  await expect(ver).toHaveAttribute("aria-expanded", "false");

  // Desplegada, la lista de siempre, sin nada que tocar.
  await ver.click();
  await expect(page.getByText("Sara Lago").first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /convocar a/i })).toHaveCount(0);
  await expect(page.getByTitle(/convocado: jugó este partido/i)).toBeVisible();
  await page.getByRole("button", { name: /ocultar/i }).click();
  await expect(page.getByText("Sara Lago")).toHaveCount(0);

  const res = await request.patch(`${API_URL}/event-responses/${respId}/`, {
    headers: bearer(capitana),
    data: { padel_pista: 2 },
  });
  expect(res.status()).toBe(400);

  // El resultado dice quién jugó cada pista, y ya no hay lista aparte.
  await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: id,
      results: [{ pista: 1, set1_local: 6, set1_visitante: 3, set2_local: 6, set2_visitante: 2 }],
    },
  });
  await page.reload();
  await expect(page.getByTitle("Sara L.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTitle("Club Náutico").first()).toBeVisible();
  await expect(page.getByText(/jugadores participantes/i)).toHaveCount(0);

  // Guardado, el marcador es fijo; «Modificar» lo vuelve editable.
  const guardados = page.locator("[data-resultados-guardados]");
  await expect(guardados).toContainText(/resultados guardados/i);
  await expect(page.locator("input[data-casilla]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /guardar resultados/i })).toHaveCount(0);
  await guardados.getByRole("button", { name: /modificar/i }).click();
  await expect(page.locator("input[data-casilla]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /guardar resultados/i })).toBeVisible();
});

test("en pádel no hay casilla: convocado es estar en pista", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "estrella");
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 2",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  const { id } = (await ev.json()) as { id: string };
  const resp = await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(capitana),
    data: { event_id: id, status: "confirmado" },
  });
  const { id: respId } = (await resp.json()) as { id: string };

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(page.getByText(/marta casado/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("checkbox", { name: /convocar a/i })).toHaveCount(0);

  // En pista queda convocada; sacarla de la pista la desconvoca.
  const poner = (pista: number | null) =>
    request.patch(`${API_URL}/event-responses/${respId}/`, {
      headers: bearer(capitana),
      data: { padel_pista: pista },
    });
  await poner(1);
  await page.reload();
  await expect(page.getByText(/★ pista 1/i)).toBeVisible({ timeout: 20_000 });
  await poner(null);
  const sinPista = await request.get(`${API_URL}/event-responses/`, {
    headers: bearer(capitana),
    params: { event_id: id },
  });
  const [r] = (await sinPista.json()) as { es_convocado: boolean }[];
  expect(r.es_convocado).toBe(false);
});
