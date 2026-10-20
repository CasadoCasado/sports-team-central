import { readFile } from "node:fs/promises";

import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * Descargar mis datos desde el perfil (RGPD): un JSON con la cuenta, el
 * perfil y lo de cada equipo, guardado como fichero.
 */
test("la capitana descarga sus datos desde el perfil", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "descargar");

  await loginAs(page, capitana);
  await page.goto("/perfil");
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: /descargar mis datos/i }).click();
  const fichero = await descarga;

  expect(fichero.suggestedFilename()).toMatch(/^teamsup-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  const datos = JSON.parse(await readFile(await fichero.path(), "utf8")) as {
    cuenta: { email: string };
    equipos_propios: { nombre: string }[];
  };
  expect(datos.cuenta.email).toBe(capitana.email);
  expect(datos.equipos_propios.map((e) => e.nombre)).toContain(team.nombre);
  await expect(page.getByText(/tus datos se han descargado/i)).toBeVisible();
});
