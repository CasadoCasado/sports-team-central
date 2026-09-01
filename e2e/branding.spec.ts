import { test, expect, type Page } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * Que las imágenes de marca carguen de verdad.
 *
 * El logo venía de un `.asset.json` que apuntaba al CDN de Lovable y daba 404
 * fuera de su infraestructura: el `<img>` estaba en el DOM, así que un test que
 * solo comprobara su presencia habría pasado con el logo roto en pantalla. Por
 * eso aquí se mira `naturalWidth`, que es 0 cuando la imagen no llegó a cargar.
 */

async function logosCargados(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>('img[alt="TeamUp"]')).map((i) => ({
      src: new URL(i.src).pathname,
      cargada: i.complete && i.naturalWidth > 0,
      natural: i.naturalWidth,
    })),
  );
}

test("el logo carga en las pantallas públicas", async ({ page }) => {
  const fallos: string[] = [];
  page.on("response", (r) => {
    if (r.status() === 404 && !r.url().includes("favicon")) fallos.push(r.url());
  });

  for (const ruta of ["/", "/auth"]) {
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    const logos = await logosCargados(page);
    expect(logos.length, `${ruta} debe pintar el logo`).toBeGreaterThan(0);
    for (const l of logos) expect(l.cargada, `${ruta} -> ${l.src}`).toBe(true);
  }
  expect(fallos, "no debe quedar ningún 404").toEqual([]);
});

test("el logo carga dentro de la app", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "logo");
  await loginAs(page, session);
  await page.goto("/inicio");
  await expect(page.locator('a[href="/calendario"]').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");

  const logos = await logosCargados(page);
  expect(logos.length).toBeGreaterThan(0);
  for (const l of logos) expect(l.cargada, l.src).toBe(true);
});
