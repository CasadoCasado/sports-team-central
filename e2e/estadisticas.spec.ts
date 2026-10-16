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
 * Estadísticas en dos pestañas —primero lo de quien mira y luego lo del
 * equipo— y, en cada una, una competición por separado, los partidos sin
 * competición y todos los entrenos juntos.
 */

type Pista = { pareja: [Session, Session]; ganada: boolean };

/** Un enfrentamiento jugado hace `dias`, con cada pareja en su pista. */
async function jugar(
  request: APIRequestContext,
  capitana: Session,
  teamId: string,
  {
    dias,
    rival,
    pistas,
    competitionId,
  }: { dias: number; rival: string; pistas: Pista[]; competitionId?: string },
) {
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: teamId,
      tipo: "partido",
      titulo: `Contra ${rival}`,
      rival,
      es_local: true,
      competition_id: competitionId ?? null,
      fecha_inicio: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
  expect(ev.ok(), await ev.text()).toBe(true);
  const eventId = ((await ev.json()) as { id: string }).id;
  for (const [i, p] of pistas.entries()) {
    for (const s of p.pareja) {
      const r = await request.post(`${API_URL}/event-responses/respond/`, {
        headers: bearer(s),
        data: { event_id: eventId, status: "confirmado" },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const { id } = (await r.json()) as { id: string };
      await request.patch(`${API_URL}/event-responses/${id}/`, {
        headers: bearer(capitana),
        data: { padel_pista: i + 1, es_convocado: true },
      });
    }
  }
  await pasarAlPasado(request, capitana, eventId, dias);
  const res = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: eventId,
      results: pistas.map((p, i) =>
        p.ganada
          ? { pista: i + 1, set1_local: 6, set1_visitante: 3, set2_local: 6, set2_visitante: 4 }
          : { pista: i + 1, set1_local: 3, set1_visitante: 6, set2_local: 4, set2_visitante: 6 },
      ),
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Una noche de rey de pista ya jugada: una pista, reyes contra retadores. */
async function reyDePista(
  request: APIRequestContext,
  capitana: Session,
  teamId: string,
  reyes: [Session, Session],
  retadores: [Session, Session],
) {
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: teamId,
      tipo: "entrenamiento",
      titulo: "Rey de pista",
      formato_entreno: "rey_pista",
      fecha_inicio: new Date(Date.now() - 86_400_000).toISOString(),
    },
  });
  expect(ev.ok(), await ev.text()).toBe(true);
  const eventId = ((await ev.json()) as { id: string }).id;
  for (const s of [...reyes, ...retadores]) {
    const r = await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(s),
      data: { event_id: eventId, status: "confirmado" },
    });
    const { id } = (await r.json()) as { id: string };
    await request.patch(`${API_URL}/event-responses/${id}/`, {
      headers: bearer(capitana),
      data: { es_convocado: true },
    });
  }
  const res = await request.post(`${API_URL}/training-courts/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: eventId,
      courts: [
        {
          pista: 1,
          posicion: 1,
          players: [
            ...reyes.map((s) => ({ user_id: s.userId, ganador: true })),
            ...retadores.map((s) => ({ user_id: s.userId, ganador: false })),
          ],
        },
      ],
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/**
 * Iván juega dos partidos de liga (pierde con Marta y gana con Sara), uno sin
 * competición y una noche de rey de pista con Pablo.
 */
async function sembrar(request: APIRequestContext, prefijo: string) {
  const { session: marta, team } = await seedCaptainWithTeam(request, prefijo);
  const ivan = await seedPlayerInTeam(request, `${prefijo}-i`, team.id, marta);
  const sara = await seedPlayerInTeam(request, `${prefijo}-s`, team.id, marta, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const pablo = await seedPlayerInTeam(request, `${prefijo}-p`, team.id, marta, {
    nombre: "Pablo",
    apellidos: "Gil",
  });
  const liga = await request.post(`${API_URL}/competitions/`, {
    headers: bearer(marta),
    data: { team_id: team.id, nombre: "Liga de otoño", tipo: "liga" },
  });
  expect(liga.ok(), await liga.text()).toBe(true);
  const ligaId = ((await liga.json()) as { id: string }).id;

  await jugar(request, marta, team.id, {
    dias: 9,
    rival: "Club Náutico",
    competitionId: ligaId,
    pistas: [
      { pareja: [ivan, marta], ganada: false },
      { pareja: [sara, pablo], ganada: true },
    ],
  });
  await jugar(request, marta, team.id, {
    dias: 6,
    rival: "Las Encinas",
    competitionId: ligaId,
    pistas: [
      { pareja: [ivan, sara], ganada: true },
      { pareja: [marta, pablo], ganada: true },
    ],
  });
  await jugar(request, marta, team.id, {
    dias: 3,
    rival: "Amistoso",
    pistas: [{ pareja: [ivan, marta], ganada: false }],
  });
  await reyDePista(request, marta, team.id, [ivan, pablo], [marta, sara]);
  return ivan;
}

test("cada competición, los partidos sueltos y los entrenos van aparte", async ({
  page,
  request,
}) => {
  const ivan = await sembrar(request, "stats-ambitos");
  await loginAs(page, ivan);
  await page.goto("/estadisticas");

  const ambitos = page.getByRole("group", { name: /qué ver/i });
  await expect(ambitos.getByRole("button")).toHaveText(
    ["Liga de otoño", "Sin competición", "Entrenos"],
    { timeout: 20_000 },
  );
  await expect(ambitos.getByRole("button", { name: "Liga de otoño" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Lo mío, en la liga: 1 ganado y 1 perdido, y Sara (100 %) antes que Marta (0 %).
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("img", { name: /50 %|50%/ })).toBeVisible();
  await expect(panel.getByRole("heading", { name: /mis 2 convocatorias/i })).toBeVisible();
  const mias = panel.locator(".surface-card", { hasText: "Mis parejas" });
  await expect(mias.getByRole("button", { name: /^con /i })).toHaveText([
    /sara lago/i,
    /marta casado/i,
  ]);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/estadisticas-mio.png", fullPage: true });

  // Sin competición: solo el amistoso.
  await ambitos.getByRole("button", { name: "Sin competición" }).click();
  await expect(panel.getByRole("heading", { name: /mi convocatoria/i })).toBeVisible();
  await expect(panel.getByRole("img", { name: /0 %|0%/ })).toBeVisible();

  // El equipo, en la liga: 3 pistas ganadas y 1 perdida; las parejas que
  // ganan todo primero y la que lo perdió, al final.
  await ambitos.getByRole("button", { name: "Liga de otoño" }).click();
  await page.getByRole("tab", { name: /el equipo/i }).click();
  await expect(page.getByRole("img", { name: /3 pistas ganadas y 1 perdidas/i })).toBeVisible();
  const delEquipo = panel.locator(".surface-card", { hasText: "Parejas del equipo" });
  const filas = delEquipo.locator("li");
  await expect(filas).toHaveCount(4);
  await expect(filas.last()).toContainText(/marta casado/i);
  await expect(filas.last()).toContainText(/iván ruiz/i);
  await expect(filas.last()).toContainText("0%");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/estadisticas-equipo.png", fullPage: true });

  // Entrenos: la clasificación y las parejas del rey de pista, reyes primero.
  await ambitos.getByRole("button", { name: "Entrenos" }).click();
  await expect(
    panel.getByRole("heading", { name: /clasificación de los entrenos/i }),
  ).toBeVisible();
  await expect(panel.locator("ol li")).toHaveCount(4);
  const parejasEntreno = panel
    .locator(".surface-card", { hasText: "Parejas del equipo" })
    .locator("li");
  await expect(parejasEntreno.first()).toContainText(/pablo gil/i);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/estadisticas-entrenos-equipo.png", fullPage: true });

  await page.getByRole("tab", { name: /lo mío/i }).click();
  await expect(panel.getByRole("heading", { name: /mi convocatoria/i })).toBeVisible();
  await expect(panel.getByText(/puesto de 4/i)).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/estadisticas-entrenos-mio.png", fullPage: true });
});

test.describe("en el móvil", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("pestañas y competiciones caben sin arrastre lateral", async ({ page, request }) => {
    const ivan = await sembrar(request, "stats-movil");
    await loginAs(page, ivan);
    await page.goto("/estadisticas");
    await expect(page.getByRole("heading", { name: /mis 2 convocatorias/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(1800);
    const ancho = () => page.evaluate(() => document.documentElement.scrollWidth);
    expect(await ancho()).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "test-results/estadisticas-mio-movil.png", fullPage: true });

    await page.getByRole("tab", { name: /el equipo/i }).click();
    await expect(page.getByText(/pista a pista/i)).toBeVisible();
    await page.waitForTimeout(1800);
    expect(await ancho()).toBeLessThanOrEqual(390);
    await page.screenshot({ path: "test-results/estadisticas-equipo-movil.png", fullPage: true });
  });
});
