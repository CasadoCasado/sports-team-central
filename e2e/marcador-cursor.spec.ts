import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Al meter el resultado el cursor va set a set: local y visitante del mismo
 * set, luego el siguiente set y luego la siguiente pista. Solo admite números
 * y abre el teclado numérico.
 */
test("el marcador salta de casilla en casilla, set a set", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "marcador");
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 3",
      rival: "Club Rival",
      es_local: true,
      fecha_inicio: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };

  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}?vista=resultado`);
  const casillas = page.locator("input[data-casilla]");
  await expect(casillas).toHaveCount(12, { timeout: 20_000 });
  await expect(casillas.first()).toHaveAttribute("inputmode", "numeric");

  await casillas.first().click();
  // Las letras no entran; cada cifra salta a la siguiente casilla.
  await page.keyboard.type("x6");
  await page.keyboard.type("3");
  await page.keyboard.type("6");
  await page.keyboard.type("4");
  await page.keyboard.type("7");
  await page.keyboard.type("5");
  await page.keyboard.type("6");

  const valores = await casillas.evaluateAll((els) =>
    els.map((el) => (el as HTMLInputElement).value),
  );
  // Orden en el DOM: pista 1 set1 L/V, set2 L/V, set3 L/V, pista 2 set1 L/V…
  expect(valores).toEqual(["6", "3", "6", "4", "7", "5", "6", "", "", "", "", ""]);
  await expect(casillas.nth(7)).toBeFocused();
});
