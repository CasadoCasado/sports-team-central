import { test, expect, type Page } from "@playwright/test";

import { completeOnboarding, loginAs, signUp, uniqueEmail } from "./session";

/**
 * El menú de la cuenta.
 *
 * Idioma, tema, ayuda y cerrar sesión eran botones sueltos en la cabecera, y
 * en un móvil se comían la barra entera. Ahora viven detrás del avatar: un
 * desplegable en escritorio y un panel que sube desde abajo en móvil.
 *
 * Lo que se vigila aquí es que sigan funcionando desde su sitio nuevo, que la
 * cabecera del móvil ya no se salga de la pantalla, y que cerrar sesión pida
 * confirmación en vez de salir al primer toque.
 */

const HTML_OSCURO = /(^|\s)dark(\s|$)/;

/**
 * Abre el menú. Con reintento, por lo mismo que `elegirTema` en `tema.spec.ts`:
 * el botón existe en el marcado del servidor antes de que React lo hidrate.
 */
async function abrirMenu(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: /^tu cuenta$/i }).click();
    await expect(page.getByRole("button", { name: /^cerrar sesión$/i })).toBeVisible({
      timeout: 1_500,
    });
  }).toPass({ timeout: 20_000 });
}

async function entrar(page: Page, request: import("@playwright/test").APIRequestContext) {
  const session = await signUp(request, uniqueEmail("menu-cuenta"), "Marta", "Casado");
  await completeOnboarding(request, session);
  await loginAs(page, session);
  return session;
}

test.describe("Menú de la cuenta", () => {
  test("en escritorio: la cabecera solo lleva campana y avatar", async ({ page, request }) => {
    await entrar(page, request);
    const cabecera = page.locator("header");

    await expect(cabecera.getByRole("button", { name: /^tu cuenta$/i })).toBeVisible();
    await expect(cabecera.getByRole("link", { name: /notificaciones/i })).toBeVisible();
    await expect(cabecera.getByRole("button", { name: /^tema$/i })).toHaveCount(0);
    await expect(cabecera.getByRole("button", { name: /cerrar sesión/i })).toHaveCount(0);
  });

  test("tema e idioma se cambian desde el menú", async ({ page, request }) => {
    await entrar(page, request);
    await abrirMenu(page);

    await page.getByRole("button", { name: /^oscuro$/i }).click();
    await expect(page.locator("html")).toHaveClass(HTML_OSCURO);
    await expect(page.getByRole("button", { name: /^oscuro$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: /^en$/i }).click();
    await expect(page.getByRole("button", { name: /^sign out$/i })).toBeVisible();
  });

  test("ayuda lleva a la sección de la pantalla en la que se está", async ({ page, request }) => {
    await entrar(page, request);
    await page.goto("/calendario");
    await abrirMenu(page);

    await page.getByRole("link", { name: /^ayuda$/i }).last().click();
    await expect(page).toHaveURL(/\/ayuda/);
    // Y el menú se ha cerrado al navegar.
    await expect(page.getByRole("button", { name: /^cerrar sesión$/i })).toHaveCount(0);
  });

  test("cerrar sesión pide confirmación", async ({ page, request }) => {
    await entrar(page, request);
    await abrirMenu(page);

    await page.getByRole("button", { name: /^cerrar sesión$/i }).click();
    await expect(page.getByText(/seguro que quieres cerrar sesión/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth/);

    // Cancelar vuelve a la lista sin salir.
    await page.getByRole("button", { name: /^cancelar$/i }).click();
    await expect(page.getByRole("button", { name: /^cerrar sesión$/i })).toBeVisible();

    await page.getByRole("button", { name: /^cerrar sesión$/i }).click();
    await page.getByRole("button", { name: /^cerrar sesión$/i }).click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test.describe("en móvil", () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test("la cabecera cabe y el menú sube desde abajo", async ({ page, request }) => {
      await entrar(page, request);

      // Nada se sale por la derecha: era el problema de los seis botones.
      const desborda = await page
        .locator("header")
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(desborda).toBe(false);

      await abrirMenu(page);
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Marta Casado")).toBeVisible();

      // El panel queda pegado abajo.
      const caja = await panel.boundingBox();
      expect(caja).not.toBeNull();
      expect(Math.round(caja!.y + caja!.height)).toBeGreaterThanOrEqual(810);

      await panel.getByRole("button", { name: /^cerrar sesión$/i }).click();
      await panel.getByRole("button", { name: /^cerrar sesión$/i }).click();
      await expect(page).toHaveURL(/\/auth/);
    });
  });
});
