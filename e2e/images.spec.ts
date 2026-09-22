import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * El escudo del equipo y la foto de perfil.
 *
 * Son las dos únicas imágenes que la web guarda; la galería y los documentos
 * siguen cerrados. Lo que se comprueba aquí es que se suben, se ven, se
 * cambian y se quitan, y que la imagen se sirve de verdad —no basta con que la
 * URL aparezca en el HTML, que es como estaba antes y se veía rota—.
 */

/** Un PNG de 1x1, en el disco del navegador que corre el test. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Escudo del equipo y foto de perfil", () => {
  test("el escudo se sube, se ve, se cambia y se quita", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "img-cap");
    await loginAs(page, session);
    await page.goto("/mi-equipo");

    // De entrada no hay escudo: sale el botón de subir, no el de quitar.
    await expect(page.getByRole("button", { name: /subir imagen/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /^quitar$/i })).toHaveCount(0);

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "escudo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(/imagen guardada/i)).toBeVisible();

    // La imagen se sirve de verdad, no solo aparece en el HTML.
    const img = page.locator("main img").first();
    await expect(img).toBeVisible();
    const src = await img.getAttribute("src");
    expect(src, "la ruta se resuelve contra la API").toContain("/media/team-logos/");
    const servida = await request.get(src!);
    expect(servida.status(), "la imagen tiene que cargar").toBe(200);

    // Cambiarla y quitarla.
    await expect(page.getByRole("button", { name: /^cambiar$/i }).first()).toBeVisible();
    await page
      .getByRole("button", { name: /^quitar$/i })
      .first()
      .click();
    await expect(page.getByText(/imagen quitada/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /subir imagen/i }).first()).toBeVisible();
  });

  test("un jugador no puede tocar el escudo", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "img-c2");
    const { seedPlayerInTeam } = await import("./session");
    const player = await seedPlayerInTeam(request, "img-jug", team.id, captain);

    await loginAs(page, player);
    await page.goto("/mi-equipo");
    await expect(page.getByText(team.nombre).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /subir imagen/i })).toHaveCount(0);
  });

  test("la foto de perfil se sube y se quita", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "img-perfil");
    await loginAs(page, session);
    await page.goto("/perfil");

    await expect(page.getByRole("button", { name: /subir imagen/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "cara.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(/imagen guardada/i)).toBeVisible();

    const src = await page.locator("main img").first().getAttribute("src");
    expect(src).toContain("/media/avatars/");
    expect((await request.get(src!)).status()).toBe(200);

    await page
      .getByRole("button", { name: /^quitar$/i })
      .first()
      .click();
    await expect(page.getByText(/imagen quitada/i)).toBeVisible();
  });

  test("un fichero que no es imagen se rechaza antes de subir", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "img-tipo");
    await loginAs(page, session);
    await page.goto("/perfil");
    await expect(page.getByRole("button", { name: /subir imagen/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    page.once("dialog", (d) => {
      expect(d.message()).toMatch(/tiene que ser una imagen/i);
      d.accept();
    });
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
    await expect(page.getByText(/imagen guardada/i)).toHaveCount(0);
  });
});

test.describe("Una imagen guardada que ya no carga", () => {
  test("se avisa y se deja quitar, en vez del icono de imagen rota", async ({ page, request }) => {
    const { session } = await seedCaptainWithTeam(request, "img-rota");
    await loginAs(page, session);
    await page.goto("/mi-equipo");
    await expect(page.getByRole("button", { name: /subir imagen/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "escudo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(/imagen guardada/i)).toBeVisible();

    // Se borra el fichero por detrás: es lo que le pasa a una subida vieja,
    // que la fila sigue apuntando a algo que ya no está.
    const src = await page.locator("main img").first().getAttribute("src");
    const ruta = new URL(src!).pathname.replace("/media/", "");
    const { unlinkSync } = await import("node:fs");
    unlinkSync(new URL(`../../backend/media/${ruta}`, import.meta.url));

    await page.reload();
    // Ni icono de rota ni callejón sin salida: se avisa y se puede quitar.
    await expect(page.getByText(/no carga/i)).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole("button", { name: /^quitar$/i })
      .first()
      .click();
    await expect(page.getByText(/imagen quitada/i)).toBeVisible();
  });
});
