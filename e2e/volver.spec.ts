import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * «Volver» en la ficha de un evento lleva a donde se estaba, no siempre al
 * Calendario. Sin origen (un aviso, un enlace), a lo lógico para el evento.
 */
test("la ficha de un evento vuelve a donde se estaba", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "volver");
  const crear = async (data: Record<string, unknown>) => {
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(capitana),
      data: {
        team_id: team.id,
        fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        ...data,
      },
    });
    expect(res.ok(), await res.text()).toBe(true);
    return ((await res.json()) as { id: string }).id;
  };
  const comp = await request.post(`${API_URL}/competitions/`, {
    headers: bearer(capitana),
    data: { team_id: team.id, nombre: "SNP", tipo: "liga" },
  });
  const { id: compId } = (await comp.json()) as { id: string };
  const partido = await crear({
    tipo: "partido",
    titulo: "Jornada 3",
    rival: "Club Náutico",
    competition_id: compId,
  });
  const entreno = await crear({ tipo: "entrenamiento", titulo: "Entreno del martes" });

  await loginAs(page, capitana);

  // Desde Enfrentamientos, de vuelta a Enfrentamientos.
  await page.goto("/enfrentamientos");
  await page
    .getByRole("link", { name: /club náutico/i })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${partido}`));
  await page.getByRole("link", { name: /volver a enfrentamientos/i }).click();
  await expect(page).toHaveURL(/\/enfrentamientos/);

  // Desde la ficha de la competición, de vuelta a ella.
  await page.goto(`/competiciones/${compId}`);
  await page
    .getByRole("link", { name: /club náutico/i })
    .first()
    .click();
  await page.getByRole("link", { name: /volver a snp/i }).click();
  await expect(page).toHaveURL(new RegExp(`/competiciones/${compId}`));

  // Sin origen: un partido vuelve a Enfrentamientos y un entreno a
  // Entrenamientos.
  await page.goto(`/eventos/${partido}`);
  await expect(page.getByRole("link", { name: /volver a enfrentamientos/i })).toBeVisible();
  await page.goto(`/eventos/${entreno}`);
  await page.getByRole("link", { name: /volver a entrenamientos/i }).click();
  await expect(page).toHaveURL(/\/entrenamientos/);

  // Y desde el Calendario, al Calendario.
  await page.goto(`/eventos/${entreno}?desde=calendario`);
  await page.getByRole("link", { name: /volver a calendario/i }).click();
  await expect(page).toHaveURL(/\/calendario/);
});
