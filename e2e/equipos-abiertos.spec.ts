import { test, expect } from "@playwright/test";

import { completeOnboarding, loginAs, seedCaptainWithTeam, signUp, uniqueEmail } from "./session";

/**
 * El panel «Equipos con inscripciones abiertas», en «Mi equipo».
 *
 * Con equipo llega plegado y sin equipo abierto, que es justo al revés de como
 * se comportaba: era un bloque de treinta equipos ocupando la pantalla por
 * debajo del equipo propio, cuando ya no hace falta.
 *
 * Lo que de verdad se rompe aquí sin hacer ruido es el atajo: «Buscar equipos»
 * vive en el menú de la rueda y, si deja de abrir el panel, lleva a una
 * cabecera cerrada donde no se ve ni un equipo. Por eso se comprueba el
 * recorrido entero y no solo que el panel exista.
 */

test.describe("Equipos con inscripciones abiertas", () => {
  test("teniendo equipo llega plegado, y la cabecera lo abre", async ({ page, request }) => {
    // Otro equipo para que haya algo que descubrir cuando se abra.
    await seedCaptainWithTeam(request, "abiertos-otro");
    const { session } = await seedCaptainWithTeam(request, "abiertos-cap");

    await loginAs(page, session);
    await page.goto("/mi-equipo");

    const cabecera = page.getByRole("button", { name: /equipos con inscripciones abiertas/i });
    await expect(cabecera).toBeVisible({ timeout: 20_000 });
    await expect(cabecera).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: /solicitar unirse/i })).toHaveCount(0);

    await cabecera.click();
    await expect(cabecera).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: /solicitar unirse/i }).first()).toBeVisible();
  });

  test("«Buscar equipos» del menú abre el panel, no solo baja hasta él", async ({
    page,
    request,
  }) => {
    await seedCaptainWithTeam(request, "abiertos-menu-otro");
    const { session } = await seedCaptainWithTeam(request, "abiertos-menu");

    await loginAs(page, session);
    await page.goto("/mi-equipo");

    const cabecera = page.getByRole("button", { name: /equipos con inscripciones abiertas/i });
    await expect(cabecera).toHaveAttribute("aria-expanded", "false", { timeout: 20_000 });

    await page.getByRole("button", { name: /acciones de equipos/i }).click();
    await page.getByRole("menuitem", { name: /buscar equipos/i }).click();

    await expect(cabecera).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: /solicitar unirse/i }).first()).toBeVisible();
  });

  test("sin equipo llega abierto y sin nada que desplegar", async ({ page, request }) => {
    await seedCaptainWithTeam(request, "abiertos-sin-otro");
    const solo = await signUp(request, uniqueEmail("abiertos-sin"), "Sin", "Equipo");
    await completeOnboarding(request, solo, "jugador");

    await loginAs(page, solo);
    await page.goto("/mi-equipo");

    await expect(page.getByRole("button", { name: /solicitar unirse/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    // Abierto de par en par: aquí no hay cabecera que plegar.
    await expect(
      page.getByRole("button", { name: /equipos con inscripciones abiertas/i }),
    ).toHaveCount(0);
  });
});
