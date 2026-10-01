import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * La barra lateral en escritorio: plegada en una franja de iconos, se abre
 * por encima del contenido sin moverlo y se puede fijar abierta. En móvil
 * sigue siendo el cajón de siempre.
 */

const anchoDe = (page: import("@playwright/test").Page, sel: string) =>
  page.locator(sel).evaluate((el) => Math.round(el.getBoundingClientRect().width));

test("plegada, abierta por encima y fijada", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "barra");
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, session);
  await page.goto("/inicio");

  const barra = page.locator("#main-sidebar");
  await expect(barra.getByRole("link", { name: /^calendario$/i })).toBeVisible({ timeout: 20_000 });
  expect(await anchoDe(page, "#main-sidebar")).toBe(72);
  const main = await anchoDe(page, "main");

  // Abierta: por encima, la página no se mueve.
  const abrir = barra.getByRole("button", { name: /abrir menú/i });
  await expect(async () => {
    await abrir.click();
    await expect(barra.getByRole("button", { name: /^fijar$/i })).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await expect.poll(() => anchoDe(page, "#main-sidebar")).toBe(256);
  expect(await anchoDe(page, "main")).toBe(main);
  await page.keyboard.press("Escape");
  await page.mouse.move(1000, 500);
  await expect.poll(() => anchoDe(page, "#main-sidebar")).toBe(72);

  // Con el ratón encima también se abre, y al salir se pliega.
  await page.mouse.move(36, 400);
  await expect.poll(() => anchoDe(page, "#main-sidebar")).toBe(256);
  expect(await anchoDe(page, "main")).toBe(main);
  await page.mouse.move(1000, 500);
  await expect.poll(() => anchoDe(page, "#main-sidebar")).toBe(72);

  // Fijada: ocupa su sitio y se recuerda al volver.
  await barra.getByRole("button", { name: /abrir menú/i }).click();
  await barra.getByRole("button", { name: /^fijar$/i }).click();
  await expect.poll(() => anchoDe(page, "main")).toBe(main - 256 + 72);
  await page.reload();
  await expect.poll(() => anchoDe(page, "#main-sidebar")).toBe(256);

  // Plegarla otra vez.
  await barra.getByRole("button", { name: /^plegar$/i }).click();
  await expect.poll(() => anchoDe(page, "#main-sidebar")).toBe(72);
});

test("en móvil sigue siendo el cajón", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "barra-m");
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, session);
  await page.goto("/inicio");
  const abrir = page.getByRole("button", { name: /^abrir menú$/i }).first();
  await expect(async () => {
    await abrir.click();
    await expect(
      page.locator("#main-sidebar").getByRole("link", { name: /^calendario$/i }),
    ).toBeInViewport({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
});
