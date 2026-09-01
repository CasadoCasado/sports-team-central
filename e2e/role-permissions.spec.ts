import { test, expect } from "@playwright/test";

import { API_URL, bearer, seedCaptainWithTeam, seedPlayerInTeam, loginAs } from "./session";

/**
 * Lo que ve cada rol dentro de la app.
 *
 * La diferencia entre capitán y jugador la decide `is_team_manager()`, portada
 * a `apps/teams/permissions.py`. Aquí se comprueba que la UI la respeta.
 */

const NAV_COMMON = [
  "/inicio",
  "/calendario",
  "/convocatorias",
  "/encuestas",
  "/estadisticas",
  "/comunicaciones",
];

test.describe("Permisos por rol en rutas privadas", () => {
  test("ambos roles ven la navegación común de módulos", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "nav-cap");
    const player = await seedPlayerInTeam(request, "nav-jug", team.id, captain);

    for (const session of [captain, player]) {
      await loginAs(page, session);
      await page.goto("/inicio");
      await expect(page.locator('a[href="/calendario"]').first()).toBeVisible({
        timeout: 20_000,
      });
      for (const href of NAV_COMMON) {
        await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
      }
    }
  });

  test("crear evento sólo aparece para la gestión", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "act-cap");
    const player = await seedPlayerInTeam(request, "act-jug", team.id, captain);

    await loginAs(page, captain);
    await page.goto("/calendario");
    await expect(page.getByRole("button", { name: /crear evento/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    await loginAs(page, player);
    await page.goto("/calendario");
    await expect(page.locator('a[href="/calendario"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /crear evento/i })).toHaveCount(0);
  });

  test("el jugador conserva acceso de lectura y participación", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "read-cap");
    const player = await seedPlayerInTeam(request, "read-jug", team.id, captain);

    await loginAs(page, player);
    for (const route of ["/convocatorias", "/encuestas", "/estadisticas", "/comunicaciones"]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route));
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("la administración de competiciones sólo es visible para admin", async ({
    page,
    request,
  }) => {
    const { session: captain } = await seedCaptainWithTeam(request, "adm-cap");
    await loginAs(page, captain);

    await page.goto("/inicio");
    await expect(page.locator('a[href="/calendario"]').first()).toBeVisible({
      timeout: 20_000,
    });
    // Sin rol admin no aparece el enlace...
    await expect(page.locator('a[href="/admin/competiciones"]')).toHaveCount(0);

    // ...y la API tampoco deja escribir en el catálogo.
    const res = await request.post(`${API_URL}/official-competitions/`, {
      headers: bearer(captain),
      data: { code: "E2E-ADM", nombre: "E2E" },
    });
    expect(res.status()).toBe(403);
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
