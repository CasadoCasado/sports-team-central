import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * La mano dominante se elige entre diestro y zurdo; lo que alguien escribió a
 * mano cuando era texto libre se sigue leyendo bien.
 */
test("la mano se elige de un desplegable y lo escrito a mano se entiende", async ({
  page,
  request,
}) => {
  const { session } = await seedCaptainWithTeam(request, "mano");
  const antes = await request.patch(`${API_URL}/profiles/me/`, {
    headers: bearer(session),
    data: { mano_dominante: "Diestra" },
  });
  expect(antes.ok(), await antes.text()).toBe(true);

  await loginAs(page, session);
  await page.goto("/perfil");
  const mano = page.getByRole("combobox", { name: /mano dominante/i });
  await expect(mano).toHaveText(/diestro/i, { timeout: 20_000 });

  await mano.click();
  const opciones = page.getByRole("option");
  await expect(opciones).toHaveText(["Diestro", "Zurdo"]);
  await page.getByRole("option", { name: "Zurdo" }).click();
  // El botón de enviar el formulario; la foto tiene su propio «Guardar».
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText(/perfil actualizado/i).first()).toBeVisible();

  const despues = await request.get(`${API_URL}/profiles/me/`, { headers: bearer(session) });
  expect(((await despues.json()) as { mano_dominante: string }).mano_dominante).toBe("zurdo");
});
