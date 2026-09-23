import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * La tarjeta del equipo, después de rehacerla.
 *
 * Dos cosas que se rompen sin hacer ruido:
 *
 * 1. El rol se pintaba crudo (`{role}`), así que salía «capitan» —en mayúsculas
 *    por CSS, y sin tilde— y en inglés habría seguido en español. Como la
 *    diferencia entre el valor de la base de datos y el traducido es
 *    exactamente la tilde, basta con buscarla.
 * 2. «Crear equipo» dejó de ser un botón y vive dentro del menú de la rueda.
 *    Si el menú deja de abrirse, la única forma de crear un equipo desde esta
 *    pantalla desaparece, y eso no se ve mirando la captura.
 */

test.describe("Tarjeta de equipo", () => {
  test("el rol sale traducido, no el valor de la base de datos", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "tarj-rol");
    await loginAs(page, session);
    await page.goto("/mi-equipo");

    const tarjeta = page.getByRole("article").filter({ hasText: team.nombre }).first();
    await expect(tarjeta).toBeVisible({ timeout: 20_000 });

    // Con tilde es la traducción; sin ella sería el valor que guarda Django.
    await expect(tarjeta.getByText("Capitán", { exact: true })).toBeVisible();
    await expect(tarjeta.getByText("capitan", { exact: true })).toHaveCount(0);
  });

  test("la rueda de la cabecera abre el menú y lleva a crear equipo", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "tarj-menu");
    await loginAs(page, session);
    await page.goto("/mi-equipo");

    const rueda = page.getByRole("button", { name: /acciones de equipos/i });
    await expect(rueda).toBeVisible({ timeout: 20_000 });

    // Cerrado no hay menú: si el desplegable se quedara abierto siempre, el
    // test pasaría igual sin que la rueda hiciera nada.
    await expect(page.getByRole("menuitem", { name: /crear equipo/i })).toHaveCount(0);

    await rueda.click();
    const crear = page.getByRole("menuitem", { name: /crear equipo/i });
    await expect(crear).toBeVisible();

    await crear.click();
    await expect(page.getByRole("heading", { name: /crear equipo/i })).toBeVisible();
  });
});
