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

  // Sin zoom con doble toque, también dentro de lo que tiene scroll propio.
  const gesto = await page.evaluate(() => {
    const caja = document.createElement("div");
    caja.style.overflowY = "auto";
    const boton = document.createElement("button");
    caja.append(boton);
    document.body.append(caja);
    return getComputedStyle(boton).touchAction;
  });
  expect(gesto).toBe("manipulation");
});

test("en el móvil la modal es la pantalla entera y no se arrastra", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "movil-modal");
  await loginAs(page, session);
  await page.goto("/competiciones");
  const crear = page.getByRole("button", { name: /crear competición|nueva competición/i }).first();
  await expect(crear).toBeVisible({ timeout: 20_000 });
  await crear.click();

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const vista = page.viewportSize()!;
  await expect
    .poll(async () => {
      const caja = await modal.boundingBox();
      return (
        caja && [
          Math.round(caja.x),
          Math.round(caja.y),
          Math.round(caja.width),
          Math.round(caja.height),
        ]
      );
    })
    .toEqual([0, 0, vista.width, vista.height]);
  await page.screenshot({
    path: "/tmp/claude-1000/-home-mdc-proyectos-teamup/cf351afe-4f9d-4793-9a37-7a8548c59a72/scratchpad/modal.png",
  });
  await page.getByRole("button", { name: /close/i }).click();
  await expect(modal).toHaveCount(0);

  // La hoja del menú de cuenta no tiene asa: no se arrastra con el dedo.
  await page
    .getByRole("button", { name: /tu cuenta/i })
    .first()
    .click();
  const hoja = page.getByRole("dialog");
  await expect(hoja).toBeVisible();
  await page.waitForTimeout(800); // que acabe de subir
  const arriba = (await hoja.boundingBox())!.y;
  await page.mouse.move(vista.width / 2, arriba + 20);
  await page.mouse.down();
  await page.mouse.move(vista.width / 2, arriba + 250, { steps: 10 });
  expect(Math.round((await hoja.boundingBox())!.y)).toBe(Math.round(arriba));
  await page.mouse.up();
  await page.screenshot({
    path: "/tmp/claude-1000/-home-mdc-proyectos-teamup/cf351afe-4f9d-4793-9a37-7a8548c59a72/scratchpad/hoja.png",
  });
});
