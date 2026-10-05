import { test, expect, devices } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * En el móvil, con el cajón abierto, la página de detrás no se desplaza (si
 * lo hacía, la barra del navegador se escondía y el cajón se quedaba corto con
 * un hueco en blanco). Y las casillas van a 16 px para que el iPhone no haga
 * zoom al tocarlas.
 */
const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
test.use(pixel);

test("con el cajón abierto la página no se mueve", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "movil-scroll");
  await loginAs(page, session);
  await page.goto("/ayuda");
  const abrir = page.getByRole("button", { name: /^abrir menú$/i }).first();
  await expect(abrir).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => window.scrollTo(0, 200));
  const antes = await page.evaluate(() => window.scrollY);
  expect(antes).toBeGreaterThan(0);

  await expect(async () => {
    await abrir.click();
    await expect(
      page.locator("#main-sidebar").getByRole("link", { name: /^calendario$/i }),
    ).toBeInViewport({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Desplazar por el lado derecho, fuera del cajón. (El gesto táctil
  // simulado no desplaza en Chromium sin pantalla; la rueda pasa por el
  // mismo bloqueo.)
  await page.mouse.move(370, 600);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
  const caja = await page.locator("#main-sidebar").boundingBox();
  expect(caja?.y).toBe(0);

  // Cerrado, la página vuelve a desplazarse.
  await page.touchscreen.tap(380, 400);

  await expect(
    page.locator("#main-sidebar").getByRole("link", { name: /^calendario$/i }),
  ).not.toBeInViewport();
  await page.mouse.move(200, 600);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(antes);
});

test("las casillas no provocan zoom en el móvil", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "movil-zoom");
  await loginAs(page, session);
  await page.goto("/inicio");
  await expect(page.getByRole("button", { name: /^abrir menú$/i }).first()).toBeVisible({
    timeout: 20_000,
  });
  const tam = await page.evaluate(() => {
    const el = document.createElement("input");
    el.className = "text-xs";
    document.body.append(el);
    return getComputedStyle(el).fontSize;
  });
  expect(tam).toBe("16px");
});
