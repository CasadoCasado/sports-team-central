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
 * Módulos que sólo deben ser visibles con sesión iniciada.
 * Coinciden con las etiquetas de navegación de la app (es-ES).
 */
const MODULE_LABELS = [
  "Mi Equipo",
  "Miembros",
  "Calendario",
  "Convocatorias",
  "Comunicaciones",
  "Estadísticas",
];

test.describe("Homepage pública (sin sesión)", () => {
  test("sólo muestra el hero con crear cuenta e iniciar sesión", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /crear cuenta/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /iniciar sesión/i }).first()).toBeVisible();

    // No hay barra lateral ni navegación de la app.
    await expect(page.locator("aside")).toHaveCount(0);
    for (const label of MODULE_LABELS) {
      await expect(page.getByRole("link", { name: label, exact: true })).toHaveCount(0);
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
