import { test, expect, type APIRequestContext } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  pasarAlPasado,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  type Session,
} from "./session";

/**
 * La ficha de un jugador: se pulsa su nombre en Miembros y sale una hoja con
 * su balance, sus partidos y sus parejas.
 */

/** Un partido jugado con los dos en la pista 1 y su marcador. */
async function jugar(
  request: APIRequestContext,
  capitana: Session,
  jugador: Session,
  teamId: string,
  rival: string,
  sets: [number, number][],
) {
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: teamId,
      tipo: "partido",
      titulo: `Jornada contra ${rival}`,
      rival,
      es_local: true,
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
  expect(ev.ok(), await ev.text()).toBe(true);
  const eventId = ((await ev.json()) as { id: string }).id;
  for (const s of [capitana, jugador]) {
    const r = await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(s),
      data: { event_id: eventId, status: "confirmado" },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }
  const respuestas = (await (
    await request.get(`${API_URL}/event-responses/?event_id=${eventId}`, {
      headers: bearer(capitana),
    })
  ).json()) as { id: string }[];
  for (const r of respuestas) {
    await request.patch(`${API_URL}/event-responses/${r.id}/`, {
      headers: bearer(capitana),
      data: { padel_pista: 1, es_convocado: true },
    });
  }
  await pasarAlPasado(request, capitana, eventId);
  const result: Record<string, number> = { pista: 1 };
  sets.forEach(([a, b], i) => {
    result[`set${i + 1}_local`] = a;
    result[`set${i + 1}_visitante`] = b;
  });
  const res = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: { event_id: eventId, results: [result] },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

test("pulsar a un compañero en Miembros abre su ficha", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "ficha");
  const jugador = await seedPlayerInTeam(request, "ficha-p", team.id, capitana);
  const perfil = await request.patch(`${API_URL}/profiles/me/`, {
    headers: bearer(capitana),
    data: { posicion: "reves", nivel: "4,5", mano_dominante: "Diestra" },
  });
  expect(perfil.ok(), await perfil.text()).toBe(true);

  await jugar(request, capitana, jugador, team.id, "Club Náutico", [
    [6, 3],
    [6, 4],
  ]);
  await jugar(request, capitana, jugador, team.id, "Padel Norte", [
    [4, 6],
    [6, 7],
  ]);

  await loginAs(page, jugador);
  await page.goto("/miembros");
  await page
    .getByRole("button", { name: /marta casado/i })
    .first()
    .click();

  const ficha = page.getByRole("dialog");
  await expect(ficha.getByRole("heading", { name: /marta casado/i })).toBeVisible();
  await expect(ficha).toContainText("Revés");
  await expect(ficha).toContainText("Diestra");
  await expect(ficha).toContainText("4,5");
  await expect(ficha.getByRole("img", { name: "50 % de victorias" })).toBeVisible();
  await expect(ficha).toContainText("Pista 1");
  await expect(ficha).toContainText("Mejor pareja");
  await expect(ficha).toContainText("vs Padel Norte");
  await page.waitForTimeout(600); // Que la hoja termine de entrar.
  await page.screenshot({ path: "test-results/ficha-escritorio.png" });

  await ficha.getByRole("tab", { name: /partidos/i }).click();
  await expect(ficha).toContainText("vs Club Náutico");
  await expect(ficha).toContainText("6-3 6-4");

  await ficha.getByRole("tab", { name: /parejas/i }).click();
  await expect(ficha).toContainText(/2 partidos juntos|Mejor pareja/);

  await ficha.getByRole("button", { name: "Cerrar" }).click();
  await expect(ficha).toBeHidden();
});

test("en el móvil la ficha ocupa la pantalla y vuelve a Miembros", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "ficha-m");
  const jugador = await seedPlayerInTeam(request, "ficha-mp", team.id, capitana);

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, capitana);
  await page.goto("/miembros");
  await page
    .getByRole("button", { name: /iván ruiz/i })
    .first()
    .click();

  const ficha = page.getByRole("dialog");
  await expect(ficha).toContainText("Aún no ha jugado ningún partido");
  await page.waitForTimeout(600); // Que la hoja termine de entrar.
  const caja = await ficha.boundingBox();
  expect(caja?.width).toBe(390);
  await page.screenshot({ path: "test-results/ficha-movil.png" });

  await ficha.getByRole("button", { name: "Miembros" }).click();
  await expect(ficha).toBeHidden();
  void jugador;
});
