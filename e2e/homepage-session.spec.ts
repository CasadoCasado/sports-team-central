import { test, expect, type Page } from "@playwright/test";

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

async function restoreSession(page: Page): Promise<boolean> {
  const storageKey = process.env["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"];
  const sessionJson = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
  if (!storageKey || !sessionJson) return false;

  const cookiesJson = process.env["LOVABLE_BROWSER_SUPABASE_COOKIES_JSON"];
  if (cookiesJson) {
    const base = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";
    const cookies = (JSON.parse(cookiesJson) as Record<string, unknown>[]).map((c) => ({
      ...c,
      url: base,
    }));
    await page.context().addCookies(cookies as never);
  }

  await page.goto("/");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, sessionJson] as const,
  );
  return true;
}

test.describe("Homepage pública (sin sesión)", () => {
  test("sólo muestra el hero con crear cuenta e iniciar sesión", async ({ page }) => {
    await page.goto("/");

    // El hero público con ambos CTA.
    await expect(page.getByRole("link", { name: /crear cuenta/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /iniciar sesión/i }).first()).toBeVisible();

    // No hay barra lateral ni navegación de la app.
    await expect(page.locator("aside")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /abrir menú|menu/i })).toHaveCount(0);

    // Ninguna tarjeta o acceso a módulos.
    for (const label of MODULE_LABELS) {
      await expect(
        page.getByText(new RegExp(`^\\s*${label}\\s*$`, "i")),
        `"${label}" no debe aparecer sin sesión`,
      ).toHaveCount(0);
    }
  });

  test("no permite entrar a rutas privadas y redirige a /auth", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("Homepage con sesión iniciada", () => {
  test("redirige al dashboard y muestra los accesos a módulos", async ({ page }) => {
    const restored = await restoreSession(page);
    test.skip(!restored, "No hay sesión de Supabase inyectada en el entorno");

    await page.goto("/");
    await expect(page).toHaveURL(/\/(inicio|onboarding)/);

    if (page.url().includes("/onboarding")) return;

    // Con sesión sí aparecen la navegación y los accesos a módulos.
    await expect(page.getByRole("link", { name: /mi equipo/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /calendario/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /convocatorias/i }).first()).toBeVisible();
  });
});
