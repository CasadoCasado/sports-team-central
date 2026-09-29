import { test, expect } from "@playwright/test";

import {
  completeOnboarding,
  fillForm,
  PASSWORD,
  seedCaptainWithTeam,
  signUp,
  uniqueEmail,
  loginAs,
} from "./session";

/**
 * Rutas de la app que sólo deben enlazarse con sesión iniciada. Se mira el
 * destino y no el texto: la portada nombra los módulos («Convocatorias»,
 * «Estadísticas»…) en anclas que bajan a su propia sección.
 */
const MODULE_ROUTES = [
  "/mi-equipo",
  "/miembros",
  "/calendario",
  "/convocatorias",
  "/comunicaciones",
  "/estadisticas",
];

test.describe("Homepage pública (sin sesión)", () => {
  test("sólo muestra el hero con crear equipo y entrar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /crear mi equipo/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^entrar$/i }).first()).toBeVisible();

    // No hay barra lateral ni navegación de la app.
    await expect(page.locator("aside")).toHaveCount(0);
    for (const ruta of MODULE_ROUTES) {
      await expect(page.locator(`a[href="${ruta}"]`)).toHaveCount(0);
    }
  });

  test("no permite entrar a rutas privadas y redirige a /auth", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Alta y entrada desde la propia pantalla", () => {
  test("crear una cuenta lleva al onboarding", async ({ page }) => {
    const email = uniqueEmail("signup-ui");

    await page.goto("/auth?mode=signup");
    await fillForm([
      [page.getByLabel(/nombre/i), "Marta"],
      [page.getByLabel(/apellidos/i), "Casado"],
      [page.getByLabel(/correo/i), email],
      [page.getByLabel(/^contraseña$/i), PASSWORD],
      [page.getByLabel(/confirmar|repetir/i), PASSWORD],
    ]);
    await page.getByRole("button", { name: /crear cuenta|registrarse/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });

  test("entrar con una cuenta ya creada lleva a inicio", async ({ page, request }) => {
    const session = await signUp(request, uniqueEmail("login-ui"));
    await completeOnboarding(request, session);

    await page.goto("/auth");
    await fillForm([
      [page.getByLabel(/correo/i), session.email],
      [page.getByLabel(/^contraseña$/i), PASSWORD],
    ]);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    await expect(page).toHaveURL(/\/inicio/, { timeout: 20_000 });
  });
});

test.describe("Homepage con sesión iniciada", () => {
  test("redirige al dashboard y muestra los accesos a módulos", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "home-cap");
    await loginAs(page, session);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/inicio/);

    // La barra lateral con los módulos de la app.
    await expect(page.locator('a[href="/calendario"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('a[href="/mi-equipo"]').first()).toBeVisible();
    await expect(page.locator('a[href="/comunicaciones"]').first()).toBeVisible();
  });

  test("una cuenta sin onboarding va a /onboarding", async ({ page, request }) => {
    const session = await signUp(request, uniqueEmail("onb"));
    await loginAs(page, session);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
  });
});
