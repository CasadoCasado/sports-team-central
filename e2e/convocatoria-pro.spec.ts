import { test, expect, type APIRequestContext, type Locator } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  type Session,
} from "./session";

/**
 * Convocatoria PRO: va por equipo, la activa el capitán y la ve toda la
 * gestión, nunca los jugadores. Es una capa sobre la misma convocatoria: lo
 * que se reparte en PRO es lo que se ve en Normal, y al revés.
 *
 * Las reglas finas —quién la activa, los datos, las pistas llenas o
 * confirmadas— las cubren los tests del backend (`apps/events/tests_pro.py`).
 */

type Equipo = {
  capitana: Session;
  cocap: Session;
  sara: Session;
  noa: Session;
  ivan: Session;
  teamId: string;
  eventId: string;
};

async function partido(request: APIRequestContext, quien: Session, teamId: string, dias: number) {
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(quien),
    data: {
      team_id: teamId,
      tipo: "partido",
      titulo: "Jornada",
      rival: "Club Náutico",
      es_local: true,
      fecha_inicio: new Date(Date.now() + dias * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

async function apuntar(request: APIRequestContext, s: Session, eventId: string) {
  const res = await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(s),
    data: { event_id: eventId, status: "confirmado" },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function montar(request: APIRequestContext): Promise<Equipo> {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "pro");
  const cocap = await seedPlayerInTeam(request, "pro-cocap", team.id, capitana, {
    nombre: "Diego",
    apellidos: "Otero",
    role: "co_capitan",
  });
  const sara = await seedPlayerInTeam(request, "pro-sara", team.id, capitana, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const noa = await seedPlayerInTeam(request, "pro-noa", team.id, capitana, {
    nombre: "Noa",
    apellidos: "Vilar",
  });
  const ivan = await seedPlayerInTeam(request, "pro-ivan", team.id, capitana, {
    nombre: "Iván",
    apellidos: "Ruiz",
  });

  // Hace una semana contra el mismo rival: Sara y Noa ganaron la pista 1;
  // Iván y Diego perdieron la 2.
  const antes = await partido(request, capitana, team.id, -7);
  for (const s of [sara, noa, ivan, cocap]) await apuntar(request, s, antes);
  const resp = (await (
    await request.get(`${API_URL}/event-responses/?event_id=${antes}`, {
      headers: bearer(capitana),
    })
  ).json()) as { id: string; user_id: string }[];
  for (const [s, pista] of [
    [sara, 1],
    [noa, 1],
    [ivan, 2],
    [cocap, 2],
  ] as const) {
    const r = resp.find((x) => x.user_id === s.userId)!;
    const res = await request.patch(`${API_URL}/event-responses/${r.id}/`, {
      headers: bearer(capitana),
      data: { padel_pista: pista, es_convocado: true },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }
  const res = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: antes,
      results: [
        { pista: 1, set1_local: 6, set1_visitante: 3, set2_local: 6, set2_visitante: 4 },
        { pista: 2, set1_local: 2, set1_visitante: 6, set2_local: 3, set2_visitante: 6 },
      ],
    },
  });
  expect(res.ok(), await res.text()).toBe(true);

  const eventId = await partido(request, capitana, team.id, 3);
  for (const s of [sara, noa, ivan, cocap]) await apuntar(request, s, eventId);
  return { capitana, cocap, sara, noa, ivan, teamId: team.id, eventId };
}

/** Pulsa con reintento: la página llega renderizada antes de hidratar. */
async function pulsar(boton: Locator, luego: Locator) {
  await expect(async () => {
    await boton.click();
    await expect(luego).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
}

test.describe("Convocatoria PRO", () => {
  test("la capitana activa PRO y la co-capitana reparte con propuestas", async ({
    page,
    request,
    browser,
  }) => {
    const e = await montar(request);

    // Sin PRO, el tablero es el de siempre.
    await loginAs(page, e.cocap);
    await page.goto(`/eventos/${e.eventId}`);
    await expect(page.locator('[data-drop="1"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("group", { name: /modo del tablero/i })).toHaveCount(0);

    // La capitana lo activa desde Mi Equipo.
    const ctx = await browser.newContext({ locale: "es-ES" });
    const suya = await ctx.newPage();
    await loginAs(suya, e.capitana);
    await suya.goto("/mi-equipo");
    const interruptor = suya.getByRole("switch", { name: /activar pro/i });
    await pulsar(interruptor, suya.getByRole("switch", { name: /quitar pro/i }));
    await expect(suya.getByText(/pro activado/i)).toBeVisible();
    await ctx.close();

    // La co-capitana lo ve en el partido, con lo que pasó contra el rival.
    await page.reload();
    const modo = page.getByRole("group", { name: /modo del tablero/i });
    await expect(modo).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/contra club náutico/i)).toBeVisible();
    await expect(page.getByText(/0 ganados · 1 empatados · 0 perdidos/i)).toBeVisible();
    await expect(
      page.getByText(/(sara l\. y noa v\.|noa v\. y sara l\.): 1-0 contra ellos/i),
    ).toBeVisible();

    // Propuestas: la de la victoria junta a Sara y Noa en la pista 1.
    const dialogo = page.getByRole("dialog");
    await pulsar(page.getByRole("button", { name: /sugerir parejas/i }), dialogo);
    const victoria = dialogo.getByRole("article", { name: /a por la victoria/i });
    await expect(victoria.getByRole("listitem").first()).toContainText(
      /sara l\. · noa v\.|noa v\. · sara l\./i,
    );
    await victoria.getByRole("button", { name: /usar esta/i }).click();
    await expect(dialogo).toHaveCount(0);

    const pista1 = page.locator('[data-drop="1"]');
    await expect(pista1).toContainText("Sara L.");
    await expect(pista1).toContainText("Noa V.");
    await expect(pista1).toContainText(/juntos 1-0/i);

    // En Normal se ve el mismo reparto, sin los datos.
    await modo.getByRole("button", { name: /^normal$/i }).click();
    await expect(pista1).toContainText("Sara L.");
    await expect(pista1).not.toContainText(/juntos/i);
    await expect(page.getByText(/contra club náutico/i)).toHaveCount(0);

    // Y desde Normal se confirma como siempre; en PRO ya no se sugiere.
    await page.getByRole("button", { name: /^confirmar convocatoria$/i }).click();
    await expect(page.getByText(/convocatoria confirmada\./i)).toBeVisible();
    await modo.getByRole("button", { name: /^pro$/i }).click();
    await expect(page.getByRole("button", { name: /sugerir parejas/i })).toBeDisabled();
  });

  test("los jugadores no ven PRO aunque el equipo lo tenga", async ({ page, request }) => {
    const e = await montar(request);
    const res = await request.post(`${API_URL}/teams/${e.teamId}/pro/`, {
      headers: bearer(e.capitana),
      data: { activo: true },
    });
    expect(res.ok(), await res.text()).toBe(true);

    const datos = await request.get(`${API_URL}/events/${e.eventId}/pro/`, {
      headers: bearer(e.sara),
    });
    expect(datos.status()).toBe(403);

    await loginAs(page, e.sara);
    await page.goto(`/eventos/${e.eventId}`);
    await expect(page.getByText(/apuntados/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("group", { name: /modo del tablero/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sugerir parejas/i })).toHaveCount(0);
  });
});
