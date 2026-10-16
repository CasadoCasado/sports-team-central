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
 * Estadísticas en dos pestañas: primero lo de quien mira y luego lo del
 * equipo, pista a pista.
 */

/** Un enfrentamiento jugado hace `dias`, con los dos en la pista 1 y tres pistas. */
async function jugar(
  request: APIRequestContext,
  capitana: Session,
  jugador: Session,
  teamId: string,
  { dias, rival, ganadas }: { dias: number; rival: string; ganadas: boolean[] },
) {
  const ev = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: teamId,
      tipo: "partido",
      titulo: `Contra ${rival}`,
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
  await pasarAlPasado(request, capitana, eventId, dias);
  const res = await request.post(`${API_URL}/match-results/bulk/`, {
    headers: bearer(capitana),
    data: {
      event_id: eventId,
      results: ganadas.map((g, i) =>
        g
          ? { pista: i + 1, set1_local: 6, set1_visitante: 3, set2_local: 6, set2_visitante: 4 }
          : { pista: i + 1, set1_local: 3, set1_visitante: 6, set2_local: 4, set2_visitante: 6 },
      ),
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function sembrar(request: APIRequestContext, prefijo: string) {
  const { session: capitana, team } = await seedCaptainWithTeam(request, prefijo);
  const jugador = await seedPlayerInTeam(request, `${prefijo}-p`, team.id, capitana);
  await jugar(request, capitana, jugador, team.id, {
    dias: 6,
    rival: "Club Náutico",
    ganadas: [false, true, false],
  });
  await jugar(request, capitana, jugador, team.id, {
    dias: 3,
    rival: "Las Encinas",
    ganadas: [true, true, false],
  });
  return jugador;
}

test("primero lo mío y, en su pestaña, el equipo pista a pista", async ({ page, request }) => {
  const jugador = await sembrar(request, "stats-tabs");
  await loginAs(page, jugador);
  await page.goto("/estadisticas");

  const mio = page.getByRole("tab", { name: /lo mío/i });
  await expect(mio).toHaveAttribute("aria-selected", "true", { timeout: 20_000 });
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("img", { name: /50 % de victorias|50%/i })).toBeVisible();
  await expect(panel.getByRole("heading", { name: /mis 2 convocatorias/i })).toBeVisible();
  await expect(panel.getByText(/ganaste el último/i)).toBeVisible();
  await expect(page.locator(".surface-card", { hasText: "Mis parejas" })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/estadisticas-mio.png", fullPage: true });

  await page.getByRole("tab", { name: /el equipo/i }).click();
  await expect(page.getByRole("tab", { name: /el equipo/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const pistas = page.getByRole("img", { name: /3 pistas ganadas y 3 perdidas/i });
  await expect(pistas).toBeVisible();
  await expect(pistas.locator("span.stats-pop")).toHaveCount(6);
  await expect(page.getByText(/últimos 2/i)).toBeVisible();
  await expect(page.locator(".surface-card", { hasText: "Parejas del equipo" })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/estadisticas-equipo.png", fullPage: true });
});

test.describe("en el móvil", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("las dos pestañas caben sin arrastre lateral", async ({ page, request }) => {
    const jugador = await sembrar(request, "stats-movil");
    await loginAs(page, jugador);
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
