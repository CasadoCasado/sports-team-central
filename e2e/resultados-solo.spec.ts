import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * En Resultados solo hay resultados: al abrir un partido desde ahí no sale la
 * convocatoria, ni la química, ni el reparto de pistas, ni editar el partido.
 * Desde el calendario, la ficha sigue entera.
 */
test("un partido abierto desde Resultados solo enseña su resultado", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "res-solo");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 2",
      rival: "Club Náutico",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };

  await loginAs(page, capitana);
  await page.goto("/resultados");
  await expect(async () => {
    await page
      .getByRole("link", { name: /club náutico/i })
      .first()
      .click();
    await expect(page).toHaveURL(/vista=resultado/, { timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  await expect(page.getByRole("heading", { name: /^resultados$/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: /^convocatorias$/i })).toHaveCount(0);
  await expect(page.locator('[data-drop="1"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /ajustes del evento/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /volver a resultados/i })).toBeVisible();

  // Desde el calendario la ficha sigue siendo la de siempre.
  await page.goto(`/eventos/${id}`);
  await expect(page.getByRole("heading", { name: /^convocatorias$/i })).toBeVisible({
    timeout: 20_000,
  });
});
