import { test, expect } from "@playwright/test";

import { fillForm, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Mientras se graba un evento sale la pelota de «Guardando…», y se va al
 * terminar. El servidor se frena a propósito para que se vea.
 */
test("al crear un evento sale la pelota mientras se guarda", async ({ page, request }) => {
  const { session: captain } = await seedCaptainWithTeam(request, "guardando");
  await page.route(/\/api\/events\/$/, async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });

  await loginAs(page, captain);
  await page.goto("/calendario");
  const dia = page.getByRole("button", { name: /^crear evento el .*\b15\b/i }).first();
  await expect(dia).toBeVisible({ timeout: 20_000 });
  await dia.click();
  const dialogo = page.getByRole("dialog");
  await fillForm([[dialogo.getByRole("textbox").first(), "Entreno con pelota"]]);
  await dialogo.getByRole("button", { name: /^crear$/i }).click();

  const pelota = page.locator("[data-guardando]");
  await expect(pelota).toBeVisible();
  await expect(pelota).toContainText(/guardando/i);
  await expect(pelota).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText(/evento creado/i).first()).toBeVisible();
});

/**
 * Aunque el servidor conteste al momento, al crear la pelota sale enseguida
 * y se queda como mínimo un segundo (`DURACION_MINIMA_CREAR`).
 */
test("al crear un evento la pelota dura al menos un segundo", async ({ page, request }) => {
  const { session: captain } = await seedCaptainWithTeam(request, "guardando-min");

  await loginAs(page, captain);
  await page.goto("/calendario");
  const dia = page.getByRole("button", { name: /^crear evento el .*\b15\b/i }).first();
  await expect(dia).toBeVisible({ timeout: 20_000 });
  await dia.click();
  const dialogo = page.getByRole("dialog");
  await fillForm([[dialogo.getByRole("textbox").first(), "Entreno rápido"]]);
  const pelota = page.locator("[data-guardando]");
  const inicio = Date.now();
  await dialogo.getByRole("button", { name: /^crear$/i }).click();

  await expect(pelota).toBeVisible({ timeout: 300 });
  await expect(pelota).toHaveCount(0, { timeout: 10_000 });
  expect(Date.now() - inicio).toBeGreaterThanOrEqual(1000);
  await expect(page.getByText(/evento creado/i).first()).toBeVisible();
});
