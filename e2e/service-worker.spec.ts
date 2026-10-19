import { test, expect } from "@playwright/test";

/**
 * El service worker: app instalable, la app sin red y las notificaciones push.
 *
 * Solo existe en la compilación de producción (en desarrollo ni se genera ni
 * se registra, ver `src/lib/register-sw.ts`), así que con `npm run dev` se
 * salta. Para pasarlo, contra la web compilada: ver `e2e/cabeceras.spec.ts`.
 */

test.beforeEach(async ({ request }) => {
  // Se mira la CSP, que solo va en producción, y no si existe /sw.js: que
  // faltase en la web compilada es justo el fallo que este test vigila.
  const res = await request.get("/auth");
  test.skip(!res.headers()["content-security-policy"], "solo en la compilación de producción");
  expect((await request.get("/sw.js")).ok(), "falta /sw.js en la web compilada").toBe(true);
});

test("se registra, precarga la app y la abre sin red", async ({ page, context }) => {
  await page.goto("/");
  const activo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.scriptURL;
  });
  expect(activo).toMatch(/\/sw\.js$/);

  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(
    /\/sw\.js$/,
  );
  const precargados = await page.evaluate(async () => {
    const nombre = (await caches.keys()).find((k) => k.startsWith("workbox-precache"));
    return nombre ? (await (await caches.open(nombre)).keys()).length : 0;
  });
  // Los trozos de la app, el CSS y los iconos: decenas, no los 3 de cuando
  // buscaba en una carpeta vacía.
  expect(precargados).toBeGreaterThan(50);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/TeamUp/);
});

test("un aviso push se enseña con su texto y su enlace", async ({ page, context, baseURL }) => {
  const origen = new URL(baseURL!).origin;
  await context.grantPermissions(["notifications"], { origin: origen });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Un push como los del backend, entregado por DevTools.
  const cdp = await context.newCDPSession(page);
  let registro: string | undefined;
  cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    for (const r of registrations) if (r.scopeURL === `${origen}/`) registro = r.registrationId;
  });
  await cdp.send("ServiceWorker.enable");
  await expect.poll(() => registro).toBeTruthy();
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: origen,
    registrationId: registro!,
    data: JSON.stringify({ body: "Convocatoria del sábado", url: "/convocatorias" }),
  });

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const avisos = await (await navigator.serviceWorker.ready).getNotifications();
        return avisos.map((n) => ({ title: n.title, body: n.body, data: n.data as unknown }));
      }),
    )
    .toEqual([
      { title: "TeamUp", body: "Convocatoria del sábado", data: { url: "/convocatorias" } },
    ]);
});
