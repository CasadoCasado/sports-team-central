import { test, expect } from "@playwright/test";

import { PASSWORD, seedCaptainWithTeam } from "./session";

/**
 * Al iniciar sesión, la pelota en la pista con lo que se está haciendo, en
 * lugar de un botón gris que no dice nada. Se nota sobre todo con el servidor
 * de la demo recién despertado, que aquí se imita retrasando las respuestas.
 */

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("al entrar se ve qué está pasando y se llega con el equipo ya cargado", async ({
  page,
  request,
}) => {
  const { session, team } = await seedCaptainWithTeam(request, "entrando");
  let pedidasDeEquipos = 0;
  await page.route(
    (url) => url.pathname.endsWith("/api/auth/login/"),
    async (route) => {
      await espera(1_500);
      await route.continue();
    },
  );
  await page.route(
    (url) => url.pathname.endsWith("/api/team-members/"),
    async (route) => {
      pedidasDeEquipos++;
      await espera(1_500);
      await route.continue();
    },
  );

  await page.goto("/auth");
  // La página llega pintada antes de hidratar: hasta entonces no se escribe.
  await expect(page.locator("#email")).toBeEnabled({ timeout: 20_000 });
  await page.locator("#email").fill(session.email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();

  const animacion = page.locator("[data-guardando]");
  await expect(animacion).toContainText("Entrando…");
  // Con la sesión abierta, todavía en /auth: el router no salta solo a Inicio.
  await expect(animacion).toContainText("Preparando tu equipo…");
  expect(new URL(page.url()).pathname).toBe("/auth");

  await expect(page).toHaveURL(/\/inicio/);
  await expect(animacion).toHaveCount(0);
  // Los equipos los trajo la animación: Inicio no los vuelve a pedir.
  await expect(page.getByText(team.nombre).first()).toBeVisible();
  expect(pedidasDeEquipos).toBe(1);
});

test("si tarda más de la cuenta, lo dice", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "entrando-lento");
  await page.route(
    (url) => url.pathname.endsWith("/api/auth/login/"),
    async (route) => {
      await espera(7_500);
      await route.continue();
    },
  );
  await page.goto("/auth");
  await expect(page.locator("#email")).toBeEnabled({ timeout: 20_000 });
  await page.locator("#email").fill(session.email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();

  await expect(page.locator("[data-guardando]")).toContainText(
    "Está tardando un poco más de lo normal…",
    { timeout: 10_000 },
  );
  await expect(page).toHaveURL(/\/inicio/, { timeout: 20_000 });
});

test("si la contraseña no vale, la animación se va y se puede volver a probar", async ({
  page,
  request,
}) => {
  const { session } = await seedCaptainWithTeam(request, "entrando-mal");
  await page.goto("/auth");
  await expect(page.locator("#email")).toBeEnabled({ timeout: 20_000 });
  await page.locator("#email").fill(session.email);
  await page.locator("#password").fill("no-es-esta-1234");
  await page.locator("form button[type=submit]").click();

  await expect(page.locator("[data-guardando]")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator("form button[type=submit]")).toBeEnabled();
  expect(new URL(page.url()).pathname).toBe("/auth");
});
