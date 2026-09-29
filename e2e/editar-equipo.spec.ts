import { test, expect, type Page } from "@playwright/test";

import { fillForm, loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * Editar un equipo: corregir el nombre, cambiar de ciudad o de club. Lo hace
 * cualquier gestor desde la rueda de la tarjeta; un jugador no la ve.
 */

async function abrirAjustes(page: Page) {
  const rueda = page.getByRole("button", { name: /ajustes del equipo/i });
  const editar = page.getByRole("menuitem", { name: /editar equipo/i });
  // La página llega renderizada antes de hidratar: el primer clic puede perderse.
  await expect(async () => {
    await rueda.click();
    await expect(editar).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  return editar;
}

test("la capitana corrige el nombre y cambia la ciudad", async ({ page, request }) => {
  const { session: capitana } = await seedCaptainWithTeam(request, "editar");
  await loginAs(page, capitana);
  await page.goto("/mi-equipo");

  await (await abrirAjustes(page)).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByLabel(/nombre del equipo/i)).toHaveValue("Equipo editar");
  await expect(dialogo.getByLabel(/^ciudad$/i)).toHaveValue("Vigo");

  await fillForm([
    [dialogo.getByLabel(/nombre del equipo/i), "Pádel Coruña"],
    [dialogo.getByLabel(/^ciudad$/i), "A Coruña"],
    [dialogo.getByLabel(/instalación habitual/i), "Club Sportia"],
  ]);
  await dialogo.getByRole("button", { name: /guardar cambios/i }).click();
  await expect(page.getByText(/equipo actualizado/i)).toBeVisible();
  await expect(dialogo).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Pádel Coruña" })).toBeVisible();
  await expect(page.getByText("A Coruña").first()).toBeVisible();
  await expect(page.getByText("Club Sportia")).toBeVisible();

  // Y se guardó.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pádel Coruña" })).toBeVisible({
    timeout: 20_000,
  });
});

test("sin nombre no se puede guardar", async ({ page, request }) => {
  const { session: capitana } = await seedCaptainWithTeam(request, "editar-vacio");
  await loginAs(page, capitana);
  await page.goto("/mi-equipo");

  await (await abrirAjustes(page)).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel(/nombre del equipo/i).fill("   ");
  await expect(dialogo.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();
});

test("un jugador no puede editar el equipo", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "editar-jug");
  const jugador = await seedPlayerInTeam(request, "editar-jug-p", team.id, capitana);
  await loginAs(page, jugador);
  await page.goto("/mi-equipo");

  await expect(page.getByRole("heading", { name: "Equipo editar-jug" })).toBeVisible({
    timeout: 20_000,
  });
  // La rueda la ve, pero solo para salirse.
  const rueda = page.getByRole("button", { name: /ajustes del equipo/i });
  const salir = page.getByRole("menuitem", { name: /salir del equipo/i });
  await expect(async () => {
    await rueda.click();
    await expect(salir).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("menuitem", { name: /editar equipo/i })).toHaveCount(0);
});

test("un co-capitán edita, pero borrar sigue siendo solo del dueño", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "editar-co");
  const co = await seedPlayerInTeam(request, "editar-co-c", team.id, capitana, {
    role: "co_capitan",
  });
  await loginAs(page, co);
  await page.goto("/mi-equipo");

  await expect(await abrirAjustes(page)).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /borrar equipo/i })).toHaveCount(0);
});
