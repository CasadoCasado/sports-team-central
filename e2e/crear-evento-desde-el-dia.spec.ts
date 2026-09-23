import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Tocar un día del calendario abre el formulario con esa fecha puesta.
 *
 * Lo que de verdad hay que comprobar aquí no es que el botón exista, sino que
 * no se ha comido los clics de lo que ya había: dentro de cada casilla hay
 * enlaces a los eventos de ese día, y el botón de crear ocupa la casilla
 * entera por debajo. Si se invierte el orden —o se olvida el
 * `pointer-events-auto` de los enlaces—, tocar un evento dejaría de llevar a
 * su detalle y abriría el formulario, que es un fallo que no se ve mirando la
 * pantalla quieta.
 *
 * Que al jugador no se le ofrezca nada de esto se comprueba en
 * `role-permissions.spec.ts`, que es donde vive lo que ve cada rol.
 */

/** El día de un mes, sin depender de en qué mes caiga hoy. */
function diaDelMesActual(dia: number) {
  const d = new Date();
  d.setDate(dia);
  d.setHours(12, 0, 0, 0);
  return d;
}

test.describe("Crear un evento desde el día del calendario", () => {
  test("la gestión toca un día y el formulario llega con esa fecha", async ({
    page,
    request,
  }) => {
    const { session: captain } = await seedCaptainWithTeam(request, "dia-cap");
    await loginAs(page, captain);

    await page.goto("/calendario");

    // El día 15 siempre cae dentro del mes que se está mirando, así que el
    // botón existe sin tener que navegar a otro mes.
    const quince = diaDelMesActual(15);
    const etiqueta = new RegExp(`^Crear evento el .*\\b15\\b`, "i");
    const dia = page.getByRole("button", { name: etiqueta }).first();
    await expect(dia).toBeVisible({ timeout: 20_000 });
    await dia.click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: /crear evento/i })).toBeVisible();

    // La fecha llega puesta; la hora la elige quien crea, así que solo se
    // comprueba el día.
    const inicio = dialogo.locator('input[type="datetime-local"]').first();
    const esperado = `${quince.getFullYear()}-${String(quince.getMonth() + 1).padStart(2, "0")}-15`;
    await expect(inicio).toHaveValue(new RegExp(`^${esperado}T\\d{2}:\\d{2}$`));
  });

  test("tocar un evento sigue llevando a su detalle, no a crear", async ({
    page,
    request,
  }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "dia-ev");
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(captain),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "Entreno de mañana",
        fecha_inicio: manana,
      },
    });
    const event = (await res.json()) as { id: string };

    await loginAs(page, captain);
    await page.goto("/calendario");

    const enlace = page.locator(`a[href="/eventos/${event.id}"]:visible`).first();
    await expect(enlace).toBeVisible({ timeout: 20_000 });
    await enlace.click();

    await expect(page).toHaveURL(new RegExp(`/eventos/${event.id}`));
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
