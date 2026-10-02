import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * Pago individual: la gestión elige a alguien del equipo y le cobra solo a
 * él. Le llega un aviso y lo ve en Pagos; el resto del equipo no lo ve. Las
 * reglas (solo miembros, quién lo ve) las cubren los tests del backend
 * (`apps/payments/tests.py`).
 */
test("la capitana cobra a un jugador y a él le llega el aviso", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "pago-ind");
  const ivan = await seedPlayerInTeam(request, "pago-ind-i", team.id, capitana);
  const lucia = await seedPlayerInTeam(request, "pago-ind-l", team.id, capitana, {
    nombre: "Lucía",
    apellidos: "Gil",
  });

  await loginAs(page, capitana);
  await page.goto("/pagos");
  const dialogo = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: /nueva cuota/i }).click();
    await expect(dialogo).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await dialogo.getByRole("textbox").first().fill("Pista del jueves");
  await dialogo.getByRole("spinbutton").fill("8.50");
  await dialogo.getByRole("button", { name: /personas concretas/i }).click();
  // Se busca escribiendo: Lucía desaparece de la lista, e Intro marca a Iván.
  const buscador = dialogo.getByRole("textbox", { name: /buscar por nombre/i });
  await buscador.fill("ivan");
  await expect(dialogo.getByText("Lucía Gil")).toHaveCount(0);
  await buscador.press("Enter");
  await expect(buscador).toHaveValue("");
  await expect(dialogo.getByRole("button", { name: /quitar a iván ruiz/i })).toBeVisible();
  await dialogo.getByRole("button", { name: /^crear$/i }).click();
  await expect(dialogo).toHaveCount(0);

  await expect(page.getByText("Pista del jueves")).toBeVisible();
  await expect(page.getByText(/^individual$/i)).toBeVisible();
  await expect(page.getByText(/0 \/ 1 pagado/i)).toBeVisible();

  await loginAs(page, ivan);
  await page.goto("/notificaciones");
  await expect(page.getByText("Tienes un pago pendiente")).toBeVisible({ timeout: 20_000 });
  await page.goto("/pagos");
  await expect(page.getByText("Pista del jueves")).toBeVisible({ timeout: 20_000 });

  await loginAs(page, lucia);
  await page.goto("/pagos");
  await expect(page.getByText(/aún no hay cuotas/i)).toBeVisible({ timeout: 20_000 });
});
