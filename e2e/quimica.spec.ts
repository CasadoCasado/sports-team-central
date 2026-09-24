import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  type Session,
} from "./session";

/**
 * Química: con quién le gusta jugar a cada apuntado de una convocatoria.
 *
 * El jugador la da al apuntarse (desde Enfrentamientos se abre el panel
 * solo) o desde la ficha del partido; solo la ve quien reparte las pistas,
 * que junta las parejas mutuas, arrastra a cada uno a su pista y confirma la
 * convocatoria. Confirmada, la química se cierra.
 *
 * Las reglas finas —privacidad, una por persona, solo entre apuntados— las
 * cubren los tests del backend (`apps/events/tests_quimica.py`); aquí se mira
 * que las pantallas las cuenten bien.
 */

type Equipo = {
  capitana: Session;
  sara: Session;
  diego: Session;
  noa: Session;
  eventId: string;
};

async function montar(request: APIRequestContext): Promise<Equipo> {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "quim");
  const sara = await seedPlayerInTeam(request, "quim-sara", team.id, capitana, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const diego = await seedPlayerInTeam(request, "quim-diego", team.id, capitana, {
    nombre: "Diego",
    apellidos: "Otero",
  });
  const noa = await seedPlayerInTeam(request, "quim-noa", team.id, capitana, {
    nombre: "Noa",
    apellidos: "Vilar",
  });
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 5",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id: eventId } = (await res.json()) as { id: string };
  for (const s of [diego, noa]) await apuntar(request, s, eventId);
  return { capitana, sara, diego, noa, eventId };
}

async function apuntar(request: APIRequestContext, s: Session, eventId: string) {
  const res = await request.post(`${API_URL}/event-responses/respond/`, {
    headers: bearer(s),
    data: { event_id: eventId, status: "confirmado" },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function darQuimica(request: APIRequestContext, de: Session, a: Session, eventId: string) {
  const res = await request.post(`${API_URL}/quimicas/`, {
    headers: bearer(de),
    data: { event_id: eventId, target_user_id: a.userId },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Pulsa un botón con reintento: la página llega renderizada antes de hidratar. */
async function pulsar(
  page: Page,
  boton: ReturnType<Page["getByRole"]>,
  luego: ReturnType<Page["getByRole"]>,
) {
  await expect(async () => {
    await boton.click();
    await expect(luego).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
}

test.describe("Química en una convocatoria", () => {
  test("al apuntarse desde Enfrentamientos, se pregunta con quién", async ({ page, request }) => {
    const e = await montar(request);
    await loginAs(page, e.sara);
    await page.goto("/enfrentamientos");

    const panel = page.getByRole("dialog");
    await pulsar(page, page.getByRole("button", { name: /^apuntarme$/i }).first(), panel);
    await expect(panel).toContainText(/te has apuntado a vs club náutico/i);
    await expect(panel).toContainText(/con quién tienes química/i);

    await panel.getByRole("button", { name: /química con diego otero/i }).click();
    await expect(panel.getByRole("button", { name: /química con diego otero/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await panel.getByRole("button", { name: /^listo$/i }).click();
    await expect(panel).toHaveCount(0);

    // En la tarjeta queda con quién, y se puede cambiar.
    const linea = page.getByRole("button", { name: /química con diego otero · cambiar/i });
    await expect(linea).toBeVisible();

    // Y la cambia a Noa desde el mismo panel.
    await linea.click();
    await panel.getByRole("button", { name: /química con noa vilar/i }).click();
    await expect(panel.getByRole("button", { name: /química con noa vilar/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(panel.getByRole("button", { name: /química con diego otero/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("un jugador no ve la química de los demás", async ({ page, request }) => {
    const e = await montar(request);
    await apuntar(request, e.sara, e.eventId);
    await darQuimica(request, e.sara, e.diego, e.eventId);
    await darQuimica(request, e.noa, e.diego, e.eventId);

    // Diego recibe dos, pero no ve ninguna: solo tendría la suya.
    await loginAs(page, e.diego);
    await page.goto(`/eventos/${e.eventId}`);
    await expect(page.getByText(/con quién tienes química/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/química del equipo/i)).toHaveCount(0);
    for (const nombre of ["Sara Lago", "Noa Vilar"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`química con ${nombre}`, "i") }),
      ).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("la capitana junta a los mutuos, arrastra al resto y confirma", async ({
    page,
    request,
  }) => {
    const e = await montar(request);
    await apuntar(request, e.sara, e.eventId);
    await darQuimica(request, e.sara, e.diego, e.eventId);
    await darQuimica(request, e.diego, e.sara, e.eventId);
    await darQuimica(request, e.noa, e.sara, e.eventId);

    await loginAs(page, e.capitana);
    await page.goto(`/eventos/${e.eventId}`);

    // Diego y Sara son mutuos; Noa, de un lado.
    const juntar = page.getByRole("button", { name: /^juntar$/i });
    await expect(juntar).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/de un lado/i)).toBeVisible();
    await expect(async () => {
      await juntar.click();
      await expect(page.locator('[data-drop="1"]')).toContainText("Diego O.", { timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    await expect(page.locator('[data-drop="1"]')).toContainText("Sara L.");
    await expect(page.getByText(/en pista 1/i)).toBeVisible();

    // Noa, arrastrada con el ratón desde «Sin pista» a la pista 2.
    const noa = page.getByRole("button", { name: /^noa vilar\. arrástralo/i });
    const origen = (await noa.boundingBox())!;
    const pista2 = (await page.locator('[data-drop="2"]').boundingBox())!;
    await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
    await page.mouse.down();
    await page.mouse.move(origen.x + 30, origen.y + 20, { steps: 4 });
    await page.mouse.move(pista2.x + pista2.width / 2, pista2.y + pista2.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
    await expect(page.locator('[data-drop="2"]')).toContainText("Noa V.");

    // Y se guardó: al recargar sigue ahí.
    await page.reload();
    await expect(page.locator('[data-drop="2"]')).toContainText("Noa V.", { timeout: 20_000 });

    await page.getByRole("button", { name: /^confirmar convocatoria$/i }).click();
    await expect(page.getByText(/convocatoria confirmada\./i)).toBeVisible();
    // Confirmada, ya no se arrastra.
    await expect(page.getByRole("button", { name: /arrástralo/i })).toHaveCount(0);
  });

  test("confirmada, la química se cierra y el jugador ve su pista", async ({ page, request }) => {
    const e = await montar(request);
    await apuntar(request, e.sara, e.eventId);
    await darQuimica(request, e.sara, e.diego, e.eventId);
    const resp = await request.get(`${API_URL}/event-responses/?event_id=${e.eventId}`, {
      headers: bearer(e.capitana),
    });
    const suya = ((await resp.json()) as { id: string; user_id: string }[]).find(
      (r) => r.user_id === e.sara.userId,
    )!;
    await request.patch(`${API_URL}/event-responses/${suya.id}/`, {
      headers: bearer(e.capitana),
      data: { padel_pista: 1, es_convocado: true },
    });
    await request.post(`${API_URL}/events/${e.eventId}/confirmar/`, {
      headers: bearer(e.capitana),
      data: { confirmada: true },
    });

    await loginAs(page, e.sara);
    await page.goto(`/eventos/${e.eventId}`);
    await expect(page.getByText(/la química está cerrada/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/tú se la diste a diego otero/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /química con noa vilar/i })).toBeDisabled();

    await page.goto("/enfrentamientos");
    await expect(page.getByText(/convocado · pista 1 · química cerrada/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
