import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Entre el teléfono y el ordenador (tableta, ventana estrecha) la fila de un
 * enfrentamiento ponía los botones al lado del título y no les dejaba encoger:
 * con la química y la asignación de pistas, el título se quedaba en una letra
 * por línea. Ahora decide el ancho de la tarjeta, y el título conserva sitio.
 */
for (const width of [650, 820]) {
  test(`a ${width} px el título del enfrentamiento se lee`, async ({ page, request }) => {
    const { session: capitana, team } = await seedCaptainWithTeam(request, `ancho-${width}`);
    const ev = await request.post(`${API_URL}/events/`, {
      headers: bearer(capitana),
      data: {
        team_id: team.id,
        tipo: "partido",
        titulo: "Cuarto enfrentamiento de liga regional",
        rival: "Club de Tenis y Pádel Montealto",
        fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
        requiere_convocatoria: true,
        padel_num_pistas: 2,
      },
    });
    const { id } = (await ev.json()) as { id: string };
    await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(capitana),
      data: { event_id: id, status: "confirmado" },
    });

    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, capitana);
    await page.goto("/enfrentamientos");
    const titulo = page.getByText("Cuarto enfrentamiento de liga regional");
    await expect(titulo).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /con quién/i })).toBeVisible();
    const caja = await titulo.boundingBox();
    expect(caja!.width).toBeGreaterThan(240);
    // Y la página no se sale de lado.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });
}
