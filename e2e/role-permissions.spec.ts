import { test, expect, type Page } from "@playwright/test";

/**
 * Verifica que Capitán (manager) y Jugador ven únicamente los módulos y
 * acciones permitidas en cada ruta privada.
 *
 * El rol se detecta en runtime a partir de la sesión inyectada: si el usuario
 * es capitán/co-capitán verá las acciones de gestión; si es jugador, no.
 * Las aserciones son simétricas, así que la misma suite valida ambos roles
 * según la cuenta con la que se ejecute.
 */

const NAV_COMMON = [
  "/inicio",
  "/mi-equipo",
  "/miembros",
  "/calendario",
  "/entrenamientos",
  "/enfrentamientos",
  "/convocatorias",
  "/encuestas",
  "/estadisticas",
  "/galeria",
  "/documentos",
  "/pagos",
  "/comunicaciones",
];

/** Acciones sólo disponibles para capitán / co-capitán. */
const MANAGER_ACTIONS: { route: string; name: RegExp }[] = [
  { route: "/calendario", name: /crear evento/i },
  { route: "/entrenamientos", name: /crear evento/i },
  { route: "/encuestas", name: /nueva encuesta/i },
  { route: "/pagos", name: /nueva cuota/i },
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

/** true si la cuenta actual gestiona el equipo activo. */
async function detectManager(page: Page): Promise<boolean> {
  await page.goto("/calendario");
  await page.waitForLoadState("networkidle");
  return (await page.getByRole("button", { name: /crear evento/i }).count()) > 0;
}

test.describe("Permisos por rol en rutas privadas", () => {
  test.beforeEach(async ({ page }) => {
    const restored = await restoreSession(page);
    test.skip(!restored, "No hay sesión de Supabase inyectada en el entorno");
    await page.goto("/inicio");
    test.skip(page.url().includes("/onboarding"), "La cuenta aún no completó el onboarding");
  });

  test("ambos roles ven la navegación común de módulos", async ({ page }) => {
    for (const href of NAV_COMMON) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });

  test("las acciones de gestión sólo aparecen para capitán/co-capitán", async ({ page }) => {
    const isManager = await detectManager(page);

    for (const { route, name } of MANAGER_ACTIONS) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const action = page.getByRole("button", { name });
      if (isManager) {
        await expect(action.first(), `capitán debe ver ${name} en ${route}`).toBeVisible();
      } else {
        await expect(action, `jugador no debe ver ${name} en ${route}`).toHaveCount(0);
      }
    }
  });

  test("el jugador conserva acceso de lectura y participación", async ({ page }) => {
    const isManager = await detectManager(page);
    test.skip(isManager, "La cuenta es gestora; caso cubierto por el test de capitán");

    // Rutas de sólo lectura / participación accesibles sin ser gestor.
    for (const route of ["/convocatorias", "/encuestas", "/estadisticas", "/comunicaciones"]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route));
      await expect(page.locator("main, body")).toBeVisible();
    }
  });

  test("la administración de competiciones sólo es visible para admin", async ({ page }) => {
    const adminLink = page.locator('a[href="/admin/competiciones"]');
    const isAdmin = (await adminLink.count()) > 0;

    await page.goto("/admin/competiciones");
    await page.waitForLoadState("networkidle");

    if (!isAdmin) {
      // Sin rol admin no debe mostrarse la gestión de competiciones oficiales.
      await expect(page.getByRole("button", { name: /nueva competición/i })).toHaveCount(0);
    }
  });

  test("las rutas privadas exigen sesión", async ({ browser }) => {
    const ctx = await browser.newContext();
    const anon = await ctx.newPage();
    for (const route of ["/miembros", "/pagos", "/admin/competiciones"]) {
      await anon.goto(route);
      await expect(anon).toHaveURL(/\/auth/);
    }
    await ctx.close();
  });
});
