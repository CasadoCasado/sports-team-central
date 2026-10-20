import { test, expect } from "@playwright/test";

import { enlaceDe } from "./correos";
import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * Confirmar el email: al darse de alta llega un enlace; hasta abrirlo, una
 * franja lo recuerda y los avisos por correo no salen. En el perfil se
 * pueden quitar.
 */
test("la capitana confirma su email con el enlace y la franja se va", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "verificar");

  await loginAs(page, session);
  await page.goto("/inicio");
  const franja = page.getByRole("status").filter({ hasText: /confirma tu email/i });
  await expect(franja).toContainText(session.email);

  // En el perfil se ve que no llegarán hasta confirmarlo.
  await page.goto("/perfil");
  const seccion = page.getByRole("region", { name: /avisos por correo/i });
  await expect(seccion).toContainText(/no te llegarán hasta que confirmes/i);

  let enlace: string | null = null;
  await expect(async () => {
    enlace = enlaceDe(session.email, /https?:\/\/\S+\/verificar-email\?token=\S+/);
    expect(enlace).not.toBeNull();
  }).toPass({ timeout: 10_000 });
  const url = new URL(enlace!);
  await page.goto(url.pathname + url.search);
  await expect(page.getByText(/tu email está confirmado/i)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: /ir a mi perfil/i }).click();
  await expect(page).toHaveURL(/\/perfil/);
  await expect(page.getByText(/confirma tu email/i)).toHaveCount(0);
  await expect(seccion).not.toContainText(/no te llegarán/i);

  // Quitarlos y volver a ponerlos.
  const interruptor = seccion.getByRole("switch");
  await expect(interruptor).toBeChecked();
  await interruptor.click();
  await expect(page.getByText(/ya no te llegarán avisos por correo/i)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: /avisos por correo/i }).getByRole("switch"),
  ).not.toBeChecked();
});

test("un enlace tocado no confirma nada", async ({ page }) => {
  await page.goto("/verificar-email?token=no-vale");
  await expect(page.getByText(/este enlace no vale/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /entrar en teamsup/i })).toBeVisible();
});
