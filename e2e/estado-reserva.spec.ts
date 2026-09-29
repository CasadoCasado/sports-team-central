import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * Reserva y duda no son lo mismo: reserva es que puede, pero solo si falta
 * alguien; duda, que todavía no lo sabe. Al pasar por encima de cada botón y
 * de cada etiqueta se explica la diferencia.
 */
test("un jugador se apunta como reserva y se explica qué significa", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "reserva");
  const jugador = await seedPlayerInTeam(request, "reserva-iria", team.id, capitana, {
    nombre: "Iria",
    apellidos: "Souto",
  });
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 6",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id: eventId } = (await res.json()) as { id: string };
  const apuntar = await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(jugador),
    data: { event_id: eventId, status: "confirmado" },
  });
  expect(apuntar.ok(), await apuntar.text()).toBe(true);

  await loginAs(page, jugador);
  await page.goto(`/eventos/${eventId}`);

  const reserva = page.getByRole("button", { name: /^reserva$/i });
  const duda = page.getByRole("button", { name: /^duda$/i });
  await expect(reserva).toHaveAttribute("title", /solo si falta alguien/i, { timeout: 20_000 });
  await expect(duda).toHaveAttribute("title", /todavía no sé/i);

  const etiqueta = page.locator("span[title]").filter({ hasText: /^reserva$/i });
  await expect(async () => {
    await reserva.click();
    await expect(etiqueta).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await expect(etiqueta).toHaveAttribute("title", /puede ir, pero solo si falta alguien/i);

  // Y se guardó.
  await page.reload();
  await expect(etiqueta).toBeVisible({ timeout: 20_000 });
});
