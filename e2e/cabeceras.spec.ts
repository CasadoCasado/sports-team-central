import { test, expect, type Page } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * Las cabeceras de seguridad de la web (`src/lib/cabeceras.ts`).
 *
 * La CSP solo va en la compilación de producción: con `npm run dev` esos tests
 * se saltan. Para pasarlos, contra la web compilada:
 *
 *   NITRO_PRESET=node-server VITE_API_URL=http://localhost:8001/api npx vite build
 *   PORT=8081 node .output/server/index.mjs
 *   (en backend/) CORS_ALLOWED_ORIGINS=http://localhost:8081 python manage.py runserver 8001
 *   E2E_BASE_URL=http://localhost:8081 E2E_API_URL=http://localhost:8001/api npx playwright test
 *
 * Con `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` en la compilación (la
 * clave de prueba de Cloudflare) y `E2E_TURNSTILE=1`, comprueba también que el
 * reto del registro carga.
 */

/** Apunta las violaciones de la CSP que vea el navegador. */
async function vigilarCsp(page: Page): Promise<string[]> {
  const violaciones: string[] = [];
  await page.exposeFunction("__violacionCsp", (texto: string) => violaciones.push(texto));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const avisar = (window as unknown as { __violacionCsp: (t: string) => void }).__violacionCsp;
      avisar(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return violaciones;
}

test("todas las páginas llevan las cabeceras de seguridad", async ({ request }) => {
  const res = await request.get("/auth");
  const cabeceras = res.headers();
  expect(cabeceras["x-content-type-options"]).toBe("nosniff");
  expect(cabeceras["x-frame-options"]).toBe("DENY");
  expect(cabeceras["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(cabeceras["permissions-policy"]).toContain("camera=()");
});

test.describe("con la CSP de producción", () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get("/auth");
    test.skip(!res.headers()["content-security-policy"], "solo en la compilación de producción");
  });

  test("cada página trae un nonce nuevo y la app no choca con la CSP", async ({
    page,
    request,
  }) => {
    const politica = async () =>
      (await request.get("/")).headers()["content-security-policy"]!.match(/'nonce-([^']+)'/)![1];
    expect(await politica()).not.toBe(await politica());

    const violaciones = await vigilarCsp(page);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /crear mi equipo/i }).first()).toBeVisible();
    // El registro, con el reto de Turnstile si la compilación tiene su clave.
    await page.goto("/auth?mode=signup");
    await expect(page.locator("#email")).toBeVisible();
    if (process.env["E2E_TURNSTILE"]) {
      // El iframe va dentro de un shadow DOM cerrado: se mira entre los frames.
      await expect
        .poll(
          () => page.frames().some((f) => f.url().startsWith("https://challenges.cloudflare.com/")),
          {
            timeout: 15_000,
          },
        )
        .toBe(true);
    }

    const { session } = await seedCaptainWithTeam(request, "csp");
    await loginAs(page, session);
    // Con datos de la API, no solo el esqueleto de la página.
    await page.goto("/mi-equipo");
    await expect(page.getByText("Equipo csp").first()).toBeVisible();
    for (const ruta of ["/inicio", "/convocatorias", "/galeria", "/documentos"]) {
      await page.goto(ruta);
      await expect(page.locator("main")).toBeVisible();
    }
    // Lo que carga después de arrancar (trozos de la app, Turnstile, Sentry)
    // también tiene que pasar: se espera a que la red se calme.
    await page.waitForLoadState("networkidle");
    expect(violaciones).toEqual([]);
  });

  test("un script colado en el HTML sin nonce no se ejecuta", async ({ page }) => {
    // Lo que haría un XSS: HTML ajeno dentro de la página que sirve el
    // servidor, con la CSP de verdad de esa respuesta.
    await page.route("**/auth", async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(
        "</head>",
        "<script>window.__colado = true</script></head>",
      );
      await route.fulfill({ response: res, body: html });
    });
    const violaciones = await vigilarCsp(page);
    await page.goto("/auth");
    await expect(page.locator("#email")).toBeVisible();
    expect(await page.evaluate(() => "__colado" in window)).toBe(false);
    expect(violaciones.some((v) => v.startsWith("script-src"))).toBe(true);
  });
});
