import { networkInterfaces } from "node:os";

import { test, expect } from "@playwright/test";

/**
 * Abrir la app desde otro dispositivo de la red.
 *
 * El frontend se ejecuta en el navegador de quien mira, así que la dirección de
 * la API no puede ser "localhost": desde un móvil, localhost es el propio
 * móvil. `src/lib/auth.ts` la deduce del host desde el que se sirvió la página,
 * y esto lo comprueba entrando por la IP en vez de por localhost.
 */

/** La primera IPv4 de red local de esta máquina, sea cual sea. */
function localAddress(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return null;
}

test("entrando por la IP de red, la app no llama a localhost", async ({ page }) => {
  const host = localAddress();
  test.skip(!host, "Esta máquina no tiene una IP de red local");

  const origenes = new Set<string>();
  page.on("request", (r) => {
    if (r.url().includes(":8000")) origenes.add(new URL(r.url()).origin);
  });

  await page.goto(`http://${host}:8080/auth`);
  await page.waitForLoadState("networkidle");

  // Un intento de acceso basta para que salga una llamada real a la API.
  const email = page.getByLabel(/correo/i);
  const password = page.getByLabel(/^contraseña$/i);
  await expect(async () => {
    await email.click();
    await email.pressSequentially("nadie@teamup.test", { delay: 5 });
    await password.click();
    await password.pressSequentially("loquesea123", { delay: 5 });
    await page.waitForTimeout(300);
    await expect(email).toHaveValue("nadie@teamup.test", { timeout: 250 });
  }).toPass({ timeout: 30_000 });

  await page.getByRole("button", { name: /^iniciar sesión$/i }).click();
  await expect(async () => {
    expect(origenes.size, "la app debe haber llamado a la API").toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });

  expect([...origenes]).toEqual([`http://${host}:8000`]);
});
