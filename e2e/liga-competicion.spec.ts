import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Una liga enseña sus enfrentamientos y la clasificación de equipos, que sale
 * de nuestros partidos y de los que la gestión mete a mano entre otros
 * equipos. Las cuentas finas están en `apps/competitions/tests_liga.py`.
 */
test("la liga enseña sus enfrentamientos y la tabla de equipos", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "liga");
  const comp = await request.post(`${API_URL}/competitions/`, {
    headers: bearer(capitana),
    // Con formato de entreno puesto, como la del equipo que lo encontró: sin
    // entrenos, no debe salir la clasificación de jugadores.
    data: {
      team_id: team.id,
      nombre: "SNP",
      tipo: "liga",
      puntos_pista: [3, 2, 1],
      formato: "partidos",
    },
  });
  expect(comp.ok(), await comp.text()).toBe(true);
  const { id: compId } = (await comp.json()) as { id: string };

  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      competition_id: compId,
      tipo: "partido",
      titulo: "Tercer enfrentamiento SNP",
      rival: "MEJORADORA",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 86_400_000).toISOString(),
      padel_num_pistas: 3,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id: eventId } = (await res.json()) as { id: string };
  // Ganamos la 1 y la 2 (3 + 2), perdemos la 3 (1): 5 – 1.
  const bulk = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: eventId,
      results: [
        { pista: 1, set1_local: 6, set1_visitante: 2, set2_local: 6, set2_visitante: 2 },
        { pista: 2, set1_local: 6, set1_visitante: 3, set2_local: 6, set2_visitante: 3 },
        { pista: 3, set1_local: 2, set1_visitante: 6, set2_local: 2, set2_visitante: 6 },
      ],
    },
  });
  expect(bulk.ok(), await bulk.text()).toBe(true);

  // Antes, contra el Náutico: perdemos la 1 (3) y ganamos la 3 (1): 1 – 3.
  const antes = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      competition_id: compId,
      tipo: "partido",
      titulo: "Primer enfrentamiento SNP",
      rival: "Club Náutico",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 8 * 86_400_000).toISOString(),
      padel_num_pistas: 3,
    },
  });
  const { id: antesId } = (await antes.json()) as { id: string };
  await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: antesId,
      results: [
        { pista: 1, set1_local: 2, set1_visitante: 6, set2_local: 2, set2_visitante: 6 },
        { pista: 3, set1_local: 6, set1_visitante: 2, set2_local: 6, set2_visitante: 2 },
      ],
    },
  });

  await loginAs(page, capitana);
  await page.goto(`/competiciones/${compId}`);
  const tabla = page.getByRole("region", { name: /clasificación de la liga/i });
  await expect(tabla).toBeVisible({ timeout: 20_000 });
  await expect(tabla.getByRole("row", { name: new RegExp(team.nombre, "i") })).toContainText("6");

  // La racha, del más antiguo al más reciente: perdido y ganado.
  const racha = page.getByRole("region", { name: /últimos resultados/i });
  await expect(racha.getByRole("listitem")).toHaveText(["L", "W"]);
  await expect(racha.getByRole("listitem").last()).toHaveAttribute("title", /mejoradora · 5 – 1/i);

  // Sin entrenos, nada de la clasificación de jugadores ni de entrenos.
  await expect(page.getByRole("heading", { name: /^clasificación$/i })).toHaveCount(0);
  await expect(page.getByRole("main").getByText(/^entrenamientos$/i)).toHaveCount(0);
  await expect(tabla.getByRole("row", { name: /mejoradora/i })).toBeVisible();

  const partidos = page.getByRole("region", { name: /^enfrentamientos$/i });
  await expect(partidos.getByRole("link", { name: /mejoradora/i })).toContainText(/5\s*–\s*1/);

  // Un resultado entre otros dos equipos, a mano.
  await partidos.getByRole("button", { name: /resultado de otros equipos/i }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel(/^local$/i).fill("Mejoradora");
  await dialogo.getByLabel(/^visitante$/i).fill("Club Náutico");
  await dialogo.locator("#liga-pl").fill("6");
  await dialogo.locator("#liga-pv").fill("0");
  await dialogo.getByRole("button", { name: /guardar resultado/i }).click();
  await expect(dialogo).toHaveCount(0);

  // Mejoradora suma 1 + 6 y pasa por delante.
  await expect(tabla.getByRole("row").nth(1)).toContainText(/mejoradora/i);
  await expect(tabla.getByRole("row").nth(1)).toContainText("7");
  await expect(tabla.getByRole("row", { name: /club náutico/i })).toBeVisible();
  await expect(partidos.getByText(/entre otros equipos/i)).toBeVisible();
});
