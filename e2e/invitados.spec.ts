import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * Invitados en los entrenos: la gestión apunta a alguien de fuera con su
 * nombre y su apodo; sale en la lista con su etiqueta y se le puede quitar.
 * Las reglas (solo entrenos, solo la gestión, fuera de la clasificación) las
 * cubren los tests del backend (`apps/events/tests_invitados.py`).
 */
test("la capitana añade un invitado al entreno y lo quita", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "invitados");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "entrenamiento",
      titulo: "Entreno del jueves",
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
      requiere_convocatoria: true,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  const dialogo = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: /añadir invitado/i }).click();
    await expect(dialogo).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await dialogo.getByLabel(/^nombre$/i).fill("Pablo");
  await dialogo.getByLabel(/^apodo$/i).fill("Pablete");
  await dialogo.getByRole("button", { name: /añadir al entreno/i }).click();
  await expect(dialogo).toHaveCount(0);

  await expect(page.getByText("Pablo «Pablete»")).toBeVisible();
  await expect(page.getByText(/^invitado$/i)).toBeVisible();

  await page.getByRole("button", { name: /^quitar$/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^quitar$/i })
    .click();
  await expect(page.getByText("Pablo «Pablete»")).toHaveCount(0);
});

test("en un partido no se ofrece añadir invitados", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "invitados-p");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada",
      rival: "Club",
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
      requiere_convocatoria: true,
    },
  });
  const { id } = (await res.json()) as { id: string };
  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(page.getByRole("heading", { name: /^convocatorias$/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: /añadir invitado/i })).toHaveCount(0);
});

test("la capitana cierra la convocatoria del entreno y nadie más se apunta", async ({
  page,
  browser,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "cierre");
  const sara = await seedPlayerInTeam(request, "cierre-sara", team.id, capitana, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "entrenamiento",
      titulo: "Entreno del jueves",
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
      requiere_convocatoria: true,
    },
  });
  const { id } = (await res.json()) as { id: string };

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(async () => {
    await page.getByRole("button", { name: /^cerrar convocatoria$/i }).click();
    await expect(page.locator("[data-entreno-cerrado]")).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^reabrir convocatoria$/i })).toBeVisible();

  // Sara entra después: ve que está cerrada y no puede apuntarse.
  const ctx = await browser.newContext({ locale: "es-ES" });
  const suya = await ctx.newPage();
  await loginAs(suya, sara);
  await suya.goto(`/eventos/${id}`);
  await expect(suya.locator("[data-entreno-cerrado]")).toBeVisible({ timeout: 20_000 });
  await expect(suya.getByRole("button", { name: /^apuntarme$/i })).toHaveCount(0);
  const intento = await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(sara),
    data: { event_id: id, status: "confirmado" },
  });
  expect(intento.status()).toBe(400);
  await ctx.close();

  // Y la capitana la reabre.
  await page.getByRole("button", { name: /^reabrir convocatoria$/i }).click();
  await expect(page.locator("[data-entreno-cerrado]")).toHaveCount(0);
});
