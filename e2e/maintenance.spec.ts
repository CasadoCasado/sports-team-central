/**
 * Galería y documentos están en obras: se ven, pero no admiten subidas.
 *
 * El aviso y la ausencia del botón son lo que sostiene la decisión de no
 * contratar todavía una plataforma de almacenamiento, así que conviene que
 * salte un test el día que alguien reabra la subida sin querer.
 */
import { test, expect, request as pwRequest } from "@playwright/test";
import { API_URL, loginAs, seedCaptainWithTeam } from "./session";

test.describe("Secciones en obras", () => {
  test("la galería avisa y no deja subir fotos", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: API_URL });
    const { session } = await seedCaptainWithTeam(api, "obras-galeria");
    await loginAs(page, session);

    await page.goto("/galeria");

    await expect(page.getByText("La galería está en obras")).toBeVisible();
    await expect(page.getByRole("button", { name: /subir foto/i })).toHaveCount(0);
  });

  test("los documentos avisan y no dejan subir archivos", async ({ page }) => {
    const api = await pwRequest.newContext({ baseURL: API_URL });
    const { session } = await seedCaptainWithTeam(api, "obras-docs");
    await loginAs(page, session);

    await page.goto("/documentos");

    await expect(page.getByText("Los documentos están en obras")).toBeVisible();
    await expect(page.getByRole("button", { name: /subir documento/i })).toHaveCount(0);
  });
});
