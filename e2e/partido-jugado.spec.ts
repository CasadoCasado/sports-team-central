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
  await expect(page.getByText("Sara Lago").first()).toBeVisible();
  await expect(page.locator('[data-drop="1"]')).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /convocar a/i })).toHaveCount(0);
  await expect(page.getByTitle(/convocado: jugó este partido/i)).toBeVisible();

  const res = await request.patch(`${API_URL}/event-responses/${respId}/`, {
    headers: bearer(capitana),
    data: { padel_pista: 2 },
  });
  expect(res.status()).toBe(400);
});

test("el ★ dice para qué sirve", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "estrella");
  await seedPlayerInTeam(request, "estrella-sara", team.id, capitana, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 2",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
      requiere_convocatoria: true,
    },
  });
  const { id } = (await ev.json()) as { id: string };
  await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(capitana),
    data: { event_id: id, status: "confirmado" },
  });

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  const casilla = page.getByRole("checkbox", { name: /convocar a marta casado/i });
  await expect(casilla).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTitle(/convocar a marta casado: entra en el partido/i)).toBeVisible();
  // Además se lee al lado, y al pasar el ratón sale la explicación enseguida.
  await expect(page.getByText(/^convocar$/i).first()).toBeVisible();
  await page.getByTitle(/convocar a marta casado: entra en el partido/i).hover();
  await expect(page.getByRole("tooltip")).toContainText(/entra en el partido/i);
});
