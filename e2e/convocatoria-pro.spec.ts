import { test, expect, type APIRequestContext, type Locator } from "@playwright/test";

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
  // Se monta en el futuro y se lleva al pasado: un partido jugado ya no
  // cambia su convocatoria.
  const antes = await partido(request, capitana, team.id, 1);
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
  await pasarAlPasado(request, capitana, antes, 7);
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
    context,
    request,
    browser,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const e = await montar(request);

    // Sin PRO, la co-capitana ve el conmutador, pero activarlo es del capitán.
    await loginAs(page, e.cocap);
    await page.goto(`/eventos/${e.eventId}`);
    const modoSinPro = page.getByRole("group", { name: /modo del tablero/i });
    await pulsar(
      modoSinPro.getByRole("button", { name: /^pro$/i }),
      page.getByText(/lo activa el capitán/i),
    );
    await expect(page.getByRole("button", { name: /sugerir parejas/i })).toHaveCount(0);

    // La capitana lo activa desde el mismo conmutador, en el partido.
    const ctx = await browser.newContext({ locale: "es-ES" });
    const suya = await ctx.newPage();
    await loginAs(suya, e.capitana);
    await suya.goto(`/eventos/${e.eventId}`);
    const aviso = suya.getByRole("alertdialog");
    await pulsar(
      suya
        .getByRole("group", { name: /modo del tablero/i })
        .getByRole("button", { name: /^pro$/i }),
      aviso,
    );
    await aviso.getByRole("button", { name: /activar pro/i }).click();
    await expect(suya.getByText(/pro activado/i)).toBeVisible();
    await expect(suya.getByRole("button", { name: /sugerir parejas/i })).toBeVisible();
    await ctx.close();

    // Sara y Noa se eligen: química mutua.
    for (const [de, a] of [
      [e.sara, e.noa],
      [e.noa, e.sara],
    ] as const) {
      const q = await request.post(`${API_URL}/quimicas/`, {
        headers: bearer(de),
        data: { event_id: e.eventId, target_user_id: a.userId },
      });
      expect(q.ok(), await q.text()).toBe(true);
    }

    // La co-capitana lo ve en el partido, con lo que pasó contra el rival.
    await page.reload();
    const modo = page.getByRole("group", { name: /modo del tablero/i });
    await expect(modo).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/contra club náutico/i).first()).toBeVisible();
    await expect(page.getByText(/0 ganados · 1 empatados · 0 perdidos/i)).toBeVisible();
    await expect(page.getByText(/(sara y noa|noa y sara): 1-0 contra ellos/i)).toBeVisible();

    // En el tablero PRO se coloca tocando: Iván, y luego un hueco de la pista 2.
    const tablero = page.getByRole("tabpanel");
    await tablero
      .getByRole("button", { name: /iván ruiz/i })
      .first()
      .click();
    await tablero
      .getByRole("button", { name: /poner a iván ruiz en la pista 2/i })
      .first()
      .click();
    const pistaPro2 = page.locator('[data-pista-pro="2"]');
    await expect(pistaPro2).toContainText(/iván · falta pareja/i);

    // Y arrastrando: Diego, desde «Sin pista» al hueco que queda en la pista 2.
    // Se mide justo antes de arrastrar y se reintenta: tras el cambio de
    // antes la página se recoloca un instante.
    await expect(async () => {
      const diego = page.getByRole("button", { name: /^diego otero\. arrástralo/i });
      const origen = (await diego.boundingBox())!;
      const hueco = (await pistaPro2
        .getByRole("button", { name: /hueco libre|poner a/i })
        .boundingBox())!;
      await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
      await page.mouse.down();
      await page.mouse.move(origen.x + 30, origen.y + 20, { steps: 4 });
      await page.mouse.move(hueco.x + hueco.width / 2, hueco.y + hueco.height / 2, {
        steps: 10,
      });
      await page.mouse.up();
      await expect(pistaPro2).toContainText(/(iván y diego|diego e iván|diego y iván)/i, {
        timeout: 3_000,
      });
    }).toPass({ timeout: 20_000 });

    // La «×» sobre la ficha de la pista la devuelve a «Sin pista».
    await pistaPro2.getByRole("button", { name: /^diego otero$/i }).hover();
    await pistaPro2.getByRole("button", { name: /quitar a diego otero de la pista/i }).click();
    await expect(pistaPro2).toContainText(/iván · falta pareja/i);
    await expect(page.getByRole("button", { name: /^diego otero\. arrástralo/i })).toBeVisible();

    // Propuestas: la de la victoria junta a Sara y Noa en la pista 1. Como ya
    // hay alguien colocado, pregunta antes de cambiar el reparto.
    const dialogo = page.getByRole("dialog");
    await pulsar(page.getByRole("button", { name: /sugerir parejas/i }), dialogo);
    const victoria = dialogo.getByRole("article", { name: /a por la victoria/i });
    await expect(victoria.getByRole("listitem").first()).toContainText(
      /sara l\. · noa v\.|noa v\. · sara l\./i,
    );
    await victoria.getByRole("button", { name: /usar esta/i }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /usar esta/i })
      .click();
    await expect(dialogo).toHaveCount(0);

    // La química, siempre a la vista: Sara y Noa, ya juntas en la pista 1.
    const quimica = page.locator("[data-panel-quimica]");
    await expect(quimica).toContainText(/(sara ⇄ noa|noa ⇄ sara)/i);
    await expect(quimica).toContainText(/en pista 1/i);

    const pistaPro1 = page.locator('[data-pista-pro="1"]');
    await expect(pistaPro1).toContainText(/(sara y noa|noa y sara)/i);
    await expect(pistaPro1).toContainText(/juntos 1-0/i);

    // La matriz, en su pestaña: la casilla de Sara y Noa.
    await page.getByRole("tab", { name: /matriz de parejas/i }).click();
    await expect(
      page.getByRole("button", { name: /sara y noa: 1 ganadas, 0 perdidas/i }),
    ).toBeVisible();

    // En Normal se ve el mismo reparto, sin los datos.
    await modo.getByRole("button", { name: /^normal$/i }).click();
    const pista1 = page.locator('[data-drop="1"]');
    await expect(pista1).toContainText("Sara L.");
    await expect(pista1).toContainText("Noa V.");
    await expect(page.getByText(/contra club náutico/i)).toHaveCount(0);

    // Y desde Normal se confirma como siempre; en PRO ya no se sugiere.
    // Confirmada, ni Normal ni PRO: solo las pistas, y desde ahí se copia la
    // alineación para el grupo.
    await page.getByRole("button", { name: /^confirmar convocatoria$/i }).click();
    await expect(page.locator("[data-pistas-cerradas]")).toBeVisible();
    await expect(modo).toHaveCount(0);
    await page.getByRole("button", { name: /^copiar texto$/i }).click();
    await expect(page.getByText(/pistas copiadas/i)).toBeVisible();
    const texto = await page.evaluate(() => navigator.clipboard.readText());
    expect(texto).toMatch(/\*Pista 1:\* (Sara Lago y Noa Vilar|Noa Vilar y Sara Lago)/);
    // Reabrir vuelve al tablero, con su conmutador.
    await page.getByRole("button", { name: /reabrir convocatoria/i }).click();
    await modo.getByRole("button", { name: /^pro$/i }).click();
    await expect(page.locator('[data-pista-pro="1"]')).toBeVisible();

    // En Enfrentamientos, el mismo conmutador y la misma vista.
    await page.goto("/enfrentamientos");
    await pulsar(
      page.getByRole("button", { name: /asignación de pistas/i }).first(),
      page.getByRole("group", { name: /modo del tablero/i }),
    );
    await expect(
      page
        .getByRole("group", { name: /modo del tablero/i })
        .getByRole("button", { name: /^pro$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-pista-pro="1"]')).toContainText(/juntos 1-0/i);
    await expect(page.getByRole("tab", { name: /matriz de parejas/i })).toBeVisible();
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
