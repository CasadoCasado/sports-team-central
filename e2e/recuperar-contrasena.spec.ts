import { test, expect } from "@playwright/test";

import { enlaceDe } from "./correos";
import { API_URL, loginAs, PASSWORD, seedCaptainWithTeam } from "./session";

/**
 * Recuperar la contraseña: «¿Has olvidado tu contraseña?», el enlace del
 * correo y la contraseña nueva. En desarrollo los correos se guardan como
 * ficheros en backend/correos/ (ver EMAIL_BACKEND en settings).
 */
test("quien olvida la contraseña la cambia con el enlace del correo y entra", async ({
  page,
  request,
}) => {
  const { session } = await seedCaptainWithTeam(request, "recuperar");
  const NUEVA = "Pala-de-carbono-77";

  await page.goto("/auth");
  // La página llega pintada antes de hidratar: lo escrito antes no cuenta.
  const olvidada = page.getByRole("link", { name: /has olvidado tu contraseña/i });
  await expect(async () => {
    await page.locator("#email").fill("");
    await page.locator("#email").fill(session.email);
    await expect(olvidada).toHaveAttribute("href", /email=/, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await olvidada.click();
  await expect(page).toHaveURL(/\/recuperar/);
  // El email ya viene puesto.
  await expect(page.locator("#email")).toHaveValue(session.email);
  await page.getByRole("button", { name: /mandarme el enlace/i }).click();
  await expect(page.getByRole("status")).toContainText(/te acabamos de mandar un enlace/i);

  let enlace: string | null = null;
  await expect(async () => {
    enlace = enlaceDe(session.email, /https?:\/\/\S+\/restablecer\?uid=\S+&token=\S+/);
    expect(enlace).not.toBeNull();
  }).toPass({ timeout: 10_000 });
  // El enlace apunta al frontend; se abre en el mismo que usan los tests.
  const url = new URL(enlace!);
  await page.goto(url.pathname + url.search);

  await page.getByLabel(/contraseña nueva/i).fill("1234");
  await page.getByLabel(/confirmar contraseña|repite/i).fill("1234");
  await page.getByRole("button", { name: /guardar y entrar/i }).click();
  await expect(page.getByRole("alert")).toContainText(/8 caracteres/i);

  await page.getByLabel(/contraseña nueva/i).fill(NUEVA);
  await page.getByLabel(/confirmar contraseña|repite/i).fill(NUEVA);
  await page.getByRole("button", { name: /guardar y entrar/i }).click();
  await expect(page).toHaveURL(/\/inicio/, { timeout: 20_000 });

  // La vieja ya no vale; la nueva, sí. Y el enlace no se puede reutilizar.
  const vieja = await request.post(`${API_URL}/auth/login/`, {
    data: { email: session.email, password: PASSWORD },
  });
  expect(vieja.status()).toBe(401);
  const nueva = await request.post(`${API_URL}/auth/login/`, {
    data: { email: session.email, password: NUEVA },
  });
  expect(nueva.ok()).toBe(true);
  await page.evaluate(() => localStorage.clear());
  await page.goto(url.pathname + url.search);
  await page.getByLabel(/contraseña nueva/i).fill("Otra-Distinta-88");
  await page.getByLabel(/confirmar contraseña|repite/i).fill("Otra-Distinta-88");
  await page.getByRole("button", { name: /guardar y entrar/i }).click();
  await expect(page.getByRole("alert")).toContainText(/ya no vale/i);
});

test("al cambiar la contraseña, la sesión abierta en otro sitio se cierra", async ({
  page,
  request,
}) => {
  const { session } = await seedCaptainWithTeam(request, "recuperar-cierra");
  await loginAs(page, session);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/inicio/);

  // Desde otro sitio (el móvil, por ejemplo) se cambia la contraseña.
  await request.post(`${API_URL}/auth/password-reset/`, { data: { email: session.email } });
  let enlace: string | null = null;
  await expect(async () => {
    enlace = enlaceDe(session.email, /https?:\/\/\S+\/restablecer\?uid=\S+&token=\S+/);
    expect(enlace).not.toBeNull();
  }).toPass({ timeout: 10_000 });
  const params = new URL(enlace!).searchParams;
  const cambio = await request.post(`${API_URL}/auth/password-reset/confirm/`, {
    data: { uid: params.get("uid"), token: params.get("token"), password: "Pala-de-carbono-77" },
  });
  expect(cambio.ok()).toBe(true);

  // Aquí la sesión de antes ya no vale, ni renovándola: de vuelta a entrar.
  await page.reload();
  await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
});
