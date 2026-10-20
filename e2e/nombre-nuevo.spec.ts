import { test, expect } from "@playwright/test";

import { seedCaptainWithTeam } from "./session";

/**
 * La app pasó de llamarse TeamUp a Teamsup (octubre de 2026) y con ella las
 * claves que guarda en el navegador (`teamup:…` → `teamsup:…`). Quien ya tenía
 * la sesión y sus preferencias guardadas con el nombre viejo sigue dentro, sin
 * volver a ver la guía de bienvenida (`src/lib/claves-locales.ts`).
 */
test("con la sesión guardada con el nombre viejo se sigue dentro", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "nombre-nuevo");

  await page.goto("/");
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem("teamup:auth", JSON.stringify({ access: s.access, refresh: s.refresh }));
    localStorage.setItem(`teamup:tour-done:${s.userId}`, "1");
    localStorage.setItem("teamup:theme", "dark");
  }, session);

  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.getByRole("heading", { name: /bienvenid/i })).toBeVisible({ timeout: 20_000 });
  // Ni la guía de bienvenida ni el tema perdidos.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/dark/);

  const claves = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(claves).toContain("teamsup:auth");
  expect(claves).toContain(`teamsup:tour-done:${session.userId}`);
  expect(claves.filter((c) => c.startsWith("teamup:"))).toEqual([]);
});
