import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Las imágenes están cerradas: ni escudo de equipo ni foto de perfil.
 *
 * El interruptor es `VITE_ENABLE_IMAGES` (ver `lib/feature-flags.ts`). Apagado
 * —que es como va— no se puede subir ninguna, y tampoco se enseñan las que ya
 * estuvieran guardadas: en su hueco va siempre el mismo dibujo.
 *
 * Eso segundo es lo que de verdad hay que comprobar. Quitar el botón de subir
 * pero seguir pintando una URL vieja que no carga deja el icono de imagen rota
 * en pantalla, que es el problema del que se viene.
 */

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Las imágenes están cerradas", () => {
  test("no hay forma de subir el escudo del equipo", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "sin-img");
    await loginAs(page, session);
    await page.goto("/mi-equipo");

    await expect(page.getByText(team.nombre).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /subir imagen/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^cambiar$/i })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("no hay forma de subir la foto de perfil", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "sin-img-p");
    await loginAs(page, session);
    await page.goto("/perfil");

    await expect(page.getByText(/mi perfil/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /subir imagen/i })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("una imagen ya guardada tampoco se enseña", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "guardada");

    // La API sigue aceptándola, igual que con la galería y los documentos: lo
    // que está cerrado es la pantalla. Así que se puede dejar una guardada.
    const subida = await request.post(`${API_URL}/teams/${team.id}/logo/`, {
      headers: { Authorization: bearer(session).Authorization },
      multipart: { file: { name: "escudo.png", mimeType: "image/png", buffer: PNG } },
    });
    expect(subida.status(), await subida.text()).toBe(200);

    await loginAs(page, session);
    for (const ruta of ["/mi-equipo", "/inicio", "/calendario"]) {
      await page.goto(ruta);
      await expect(page.getByText(team.nombre).first()).toBeVisible({ timeout: 20_000 });
      // Ni la imagen ni, sobre todo, el icono de rota del navegador.
      await expect(page.locator('main img[src*="/media/"]')).toHaveCount(0);
    }
  });
});
