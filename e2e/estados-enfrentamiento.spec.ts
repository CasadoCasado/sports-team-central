import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, seedPlayerInTeam } from "./session";

/**
 * Los tres momentos de un enfrentamiento con convocatoria: abierta (se apunta
 * y se reparten pistas), cerrada sin jugar (solo las pistas, en orden) y
 * jugado. Aquí, el paso de abierta a cerrada y vuelta con «Reabrir». Las
 * reglas (quién cambia qué en cada momento) las cubren los tests del backend
 * (`apps/events/tests_estados.py`).
 */
test("cerrada la convocatoria solo se ven las pistas, y reabrir vuelve al reparto", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "estados");
  const nombres = [
    ["Sara", "Lago"],
    ["Diego", "Otero"],
    ["Noa", "Vilar"],
    ["Iago", "Rey"],
  ];
  const jugadores = [];
  for (const [i, [nombre, apellidos]] of nombres.entries()) {
    jugadores.push(
      await seedPlayerInTeam(request, `estados-${i}`, team.id, capitana, { nombre, apellidos }),
    );
  }
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 7",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id } = (await res.json()) as { id: string };
  for (const s of jugadores) {
    const r = await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(s),
      data: { event_id: id, status: "confirmado" },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }
  const [sara, diego, noa, iago] = jugadores;
  const parejas = await request.post(`${API_URL}/events/${id}/parejas/`, {
    headers: bearer(capitana),
    data: {
      pistas: [
        [sara.userId, diego.userId],
        [noa.userId, iago.userId],
      ],
    },
  });
  expect(parejas.ok(), await parejas.text()).toBe(true);

  // Abierta: la lista de apuntados y el botón de confirmar.
  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await expect(page.getByRole("heading", { name: /apuntados/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /confirmar convocatoria/i }).click();

  // Cerrada: solo las pistas, en orden.
  const pistas = page.locator("[data-pistas-cerradas]");
  await expect(pistas).toBeVisible();
  await expect(pistas.getByRole("listitem")).toHaveCount(2);
  await expect(pistas.getByRole("listitem").nth(0)).toContainText("Sara Lago · Diego Otero");
  await expect(pistas.getByRole("listitem").nth(1)).toContainText("Noa Vilar · Iago Rey");
  await expect(page.getByRole("heading", { name: /apuntados/i })).toHaveCount(0);
  await expect(page.getByText(/química del equipo/i)).toHaveCount(0);

  // El jugador ve lo mismo, con su pista marcada, y ya no puede borrarse.
  await loginAs(page, noa);
  await page.goto(`/eventos/${id}`);
  await expect(pistas.getByRole("listitem").nth(1)).toContainText(/tu pista/i, {
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: /apuntados/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^borrarme$|desapuntarme/i })).toHaveCount(0);

  // Reabrir vuelve al reparto con la lista.
  await loginAs(page, capitana);
  await page.goto(`/eventos/${id}`);
  await page.getByRole("button", { name: /reabrir convocatoria/i }).click();
  await expect(pistas).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /apuntados/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /confirmar convocatoria/i })).toBeVisible();
});
