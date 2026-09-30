import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * El histórico de parejas de Estadísticas: sale de la pista de cada uno en la
 * convocatoria y del marcador de esa pista, sin apuntar nada más.
 */

test("el jugador ve con quién ha jugado y el marcador de su pista", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "parejas");
  const jugador = await seedPlayerInTeam(request, "parejas-p", team.id, capitana);

  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 1",
      rival: "Club Náutico",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    },
  });
  expect(ev.ok(), await ev.text()).toBe(true);
  const eventId = ((await ev.json()) as { id: string }).id;

  // Los dos, en la pista 1.
  for (const s of [capitana, jugador]) {
    const r = await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(s),
      data: { event_id: eventId, status: "confirmado" },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }
  const respuestas = (await (
    await request.get(`${API_URL}/event-responses/?event_id=${eventId}`, {
      headers: bearer(capitana),
    })
  ).json()) as { id: string }[];
  for (const r of respuestas) {
    await request.patch(`${API_URL}/event-responses/${r.id}/`, {
      headers: bearer(capitana),
      data: { padel_pista: 1, es_convocado: true },
    });
  }
  const res = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: eventId,
      results: [{ pista: 1, set1_local: 6, set1_visitante: 3, set2_local: 6, set2_visitante: 4 }],
    },
  });
  expect(res.ok(), await res.text()).toBe(true);

  await loginAs(page, jugador);
  await page.goto("/estadisticas");

  const mias = page.locator(".surface-card", { hasText: "Mis parejas" });
  const fila = mias.getByRole("button", { name: /con marta casado/i });
  await expect(fila).toBeVisible({ timeout: 20_000 });
  await expect(fila).toContainText("1 partido · 1 G · 0 P");
  await expect(fila).toContainText("100%");

  await fila.click();
  const partido = mias.getByRole("link", { name: /vs club náutico/i });
  await expect(partido).toContainText("6-3 6-4");
  await expect(partido).toContainText("Ganado");

  // Y la del equipo la enseña con los dos nombres.
  const equipo = page.locator(".surface-card", { hasText: "Parejas del equipo" });
  await expect(equipo.getByRole("button", { name: /marta casado/i })).toContainText(/iván ruiz/i);
});
