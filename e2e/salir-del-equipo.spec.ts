import { test, expect, type Page } from "@playwright/test";

import { loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * Salirse de un equipo desde la rueda de su tarjeta. Antes no había forma:
 * quien entraba en un equipo por error se quedaba dentro, y si era el único
 * que tenía, sin salida posible.
 */

async function abrirAjustes(page: Page, opcion: RegExp) {
  const rueda = page.getByRole("button", { name: /ajustes del equipo/i });
  const item = page.getByRole("menuitem", { name: opcion });
  // La página llega renderizada antes de hidratar: el primer clic puede perderse.
  await expect(async () => {
    await rueda.click();
    await expect(item).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  return item;
}

test("un jugador sale de su único equipo y se queda sin equipo", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "salir");
  const jugador = await seedPlayerInTeam(request, "salir-p", team.id, capitana);
  await loginAs(page, jugador);
  await page.goto("/mi-equipo");

  page.once("dialog", (d) => d.accept());
  await (await abrirAjustes(page, /salir del equipo/i)).click();

  await expect(page.getByText(/has salido de equipo salir/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /aún no tienes ningún equipo/i })).toBeVisible();

  // Y se guardó.
  await page.reload();
  await expect(page.getByRole("heading", { name: /aún no tienes ningún equipo/i })).toBeVisible({
    timeout: 20_000,
  });
});

test("cancelar el aviso no le saca del equipo", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "salir-no");
  const jugador = await seedPlayerInTeam(request, "salir-no-p", team.id, capitana);
  await loginAs(page, jugador);
  await page.goto("/mi-equipo");

  page.once("dialog", (d) => d.dismiss());
  await (await abrirAjustes(page, /salir del equipo/i)).click();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Equipo salir-no" })).toBeVisible({
    timeout: 20_000,
  });
});

test("la dueña no tiene «salir»: lo suyo es borrar el equipo", async ({ page, request }) => {
  const { session: capitana } = await seedCaptainWithTeam(request, "salir-duena");
  await loginAs(page, capitana);
  await page.goto("/mi-equipo");

  await expect(await abrirAjustes(page, /borrar equipo/i)).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /salir del equipo/i })).toHaveCount(0);
});
