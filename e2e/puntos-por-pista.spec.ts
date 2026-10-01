import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Lo que vale cada pista: en un partido de cinco pistas donde las dos
 * primeras valen 3 y el resto 2, ganar solo la primera es un 3-9. Se pone
 * desde el formulario del partido, y cada pista dice lo que vale al apuntar
 * el resultado.
 */
test("las pistas que valen 3 y 2 dan un 3-9", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "puntos");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 4",
      rival: "Club Náutico",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 86_400_000).toISOString(),
      padel_num_pistas: 5,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };
  const sets = [
    [6, 2, 7, 5, null, null],
    [7, 6, 6, 7, 5, 7],
    [2, 6, 2, 6, null, null],
    [4, 6, 2, 6, null, null],
    [3, 6, 0, 6, null, null],
  ];
  const guardar = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: id,
      results: sets.map(([a, b, c, d, e, f], i) => ({
        pista: i + 1,
        set1_local: a,
        set1_visitante: b,
        set2_local: c,
        set2_visitante: d,
        set3_local: e,
        set3_visitante: f,
      })),
    },
  });
  expect(guardar.ok(), await guardar.text()).toBe(true);

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(page.getByText(/^1\s*–\s*4$/).first()).toBeVisible({ timeout: 20_000 });

  // Editar el partido: las dos primeras valen 3 y el resto 2.
  await expect(async () => {
    await page.getByRole("button", { name: /ajustes del evento/i }).click();
    await page.getByRole("menuitem", { name: /editar/i }).click({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel(/puntos por pista/i).fill("3, 3, 2, 2, 2");
  await dialogo.getByRole("button", { name: /guardar/i }).click();
  await expect(dialogo).toHaveCount(0);

  await expect(page.getByText(/^3\s*–\s*9$/).first()).toBeVisible();
  await expect(page.getByText(/vale 3 puntos/i).first()).toBeVisible();
  await expect(page.getByText(/vale 2 puntos/i).first()).toBeVisible();
});

test("los puntos se ponen en la competición y valen para sus partidos", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "puntos-liga");
  const liga = await request.post(`${API_URL}/competitions/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      nombre: "Liga de Málaga",
      tipo: "liga",
      puntos_pista: [3, 3, 2, 2, 2],
    },
  });
  expect(liga.ok(), await liga.text()).toBe(true);
  const { id: ligaId } = (await liga.json()) as { id: string };
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      competition_id: ligaId,
      tipo: "partido",
      titulo: "Jornada 5",
      rival: "Club Náutico",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 86_400_000).toISOString(),
      padel_num_pistas: 5,
    },
  });
  const { id } = (await res.json()) as { id: string };
  await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: id,
      results: [
        { pista: 1, set1_local: 6, set1_visitante: 2, set2_local: 7, set2_visitante: 5 },
        { pista: 2, set1_local: 2, set1_visitante: 6, set2_local: 2, set2_visitante: 6 },
        { pista: 3, set1_local: 2, set1_visitante: 6, set2_local: 2, set2_visitante: 6 },
        { pista: 4, set1_local: 2, set1_visitante: 6, set2_local: 2, set2_visitante: 6 },
        { pista: 5, set1_local: 2, set1_visitante: 6, set2_local: 2, set2_visitante: 6 },
      ],
    },
  });

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(page.getByText(/^3\s*–\s*9$/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/vale 3 puntos/i).first()).toBeVisible();

  // Y se ve y se cambia en el formulario de la competición.
  await page.goto("/competiciones");
  await expect(async () => {
    await page
      .getByRole("button", { name: /editar/i })
      .first()
      .click();
    await expect(page.getByLabel(/puntos por pista/i)).toHaveValue("3, 3, 2, 2, 2", {
      timeout: 1_500,
    });
  }).toPass({ timeout: 20_000 });
});
