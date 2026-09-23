import { test, expect } from "@playwright/test";

import { API_URL, bearer, fillForm, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Editar un evento tiene que verse al instante, sin recargar.
 *
 * El `QueryClient` guarda un minuto (`staleTime` en `router.tsx`), así que si
 * al guardar no se invalida lo que toca, la pantalla se queda con lo de antes
 * durante ese minuto —y la de detalle, que es desde donde se edita, ni
 * siquiera se vuelve a montar—. Las claves que leen eventos están en
 * `lib/query-keys.ts`.
 */

test.describe("Editar un evento se ve sin recargar", () => {
  test("el detalle, el listado y el inicio enseñan el título nuevo", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "edit-cap");
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(captain),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "Entreno de siempre",
        fecha_inicio: manana,
      },
    });
    const event = (await res.json()) as { id: string };

    await loginAs(page, captain);

    // Se pasa antes por el inicio y el listado para que queden en caché: el
    // fallo era justamente que la caché no se enteraba del cambio.
    await page.goto("/inicio");
    await expect(page.getByText("Entreno de siempre").first()).toBeVisible({
      timeout: 20_000,
    });
    await page.goto("/entrenamientos");
    await expect(page.getByText("Entreno de siempre").first()).toBeVisible();

    await page.goto(`/eventos/${event.id}`);
    await expect(page.getByRole("heading", { name: "Entreno de siempre" })).toBeVisible();

    // Editar vive en la rueda de la cabecera desde que es un marcador: los
    // dos botones sueltos ocupaban justo el sitio del resultado.
    await page.getByRole("button", { name: /ajustes del evento/i }).click();
    await page.getByRole("menuitem", { name: /editar evento/i }).click();
    // Las etiquetas del diálogo no están asociadas a sus campos, así que no
    // vale `getByLabel`. El primer campo de texto del diálogo es el título.
    const titulo = page.getByRole("dialog").getByRole("textbox").first();
    await fillForm([[titulo, "Entreno del jueves"]]);
    await page.getByRole("button", { name: /^guardar$/i }).click();
    await expect(page.getByText(/evento actualizado/i)).toBeVisible();

    // Sin recargar: es el mismo documento, solo se ha cerrado el diálogo.
    await expect(page.getByRole("heading", { name: "Entreno del jueves" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entreno de siempre" })).toHaveCount(0);

    // Y lo que estaba en caché tampoco se queda viejo.
    await page.goto("/entrenamientos");
    await expect(page.getByText("Entreno del jueves").first()).toBeVisible();
    await expect(page.getByText("Entreno de siempre")).toHaveCount(0);

    await page.goto("/inicio");
    await expect(page.getByText("Entreno del jueves").first()).toBeVisible();
    await expect(page.getByText("Entreno de siempre")).toHaveCount(0);
  });
});
