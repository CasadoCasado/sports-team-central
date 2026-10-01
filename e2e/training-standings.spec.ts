import { test, expect, type APIRequestContext } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  type Session,
} from "./session";

/**
 * Un entrenamiento dentro de una competición, a rey de pista: se cierra con el
 * orden en que quedaron las pistas y quién aguantaba cada una, y de ahí sale la
 * clasificación de la competición hasta que se da por terminada y hay podio.
 */

/** Una competición del equipo, creada por la API. */
async function seedCompetition(
  api: APIRequestContext,
  captain: Session,
  teamId: string,
  formato: "rey_pista" | "partidos" | "americano" = "rey_pista",
) {
  const res = await api.post(`${API_URL}/competitions/`, {
    headers: bearer(captain),
    data: {
      team_id: teamId,
      nombre: "Liga interna",
      tipo: "liga",
      temporada: "2025/26",
      formato,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as { id: string; nombre: string };
}

/** Un entrenamiento ya empezado, para que admita resultados. */
async function seedTraining(
  api: APIRequestContext,
  captain: Session,
  teamId: string,
  competitionId: string,
) {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await api.post(`${API_URL}/events/`, {
    headers: bearer(captain),
    data: {
      team_id: teamId,
      competition_id: competitionId,
      tipo: "entrenamiento",
      titulo: "Americano del jueves",
      fecha_inicio: ayer,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as { id: string };
}

test.describe("Entrenamientos dentro de una competición", () => {
  test("la gestión cierra el entreno y la competición acaba en podio", async ({
    page,
    request,
  }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "entreno-cap");
    const ivan = await seedPlayerInTeam(request, "entreno-jug", team.id, captain);
    const sara = await seedPlayerInTeam(request, "entreno-sara", team.id, captain, {
      nombre: "Sara",
      apellidos: "Lago",
    });
    const competition = await seedCompetition(request, captain, team.id);
    const training = await seedTraining(request, captain, team.id, competition.id);

    // Fueron tres: la capitana, Iván y Sara. Se apuntan y se marca que asistieron.
    for (const s of [captain, ivan, sara]) {
      const r = await request.post(`${API_URL}/event-responses/respond/`, {
        headers: bearer(s),
        data: { event_id: training.id, status: "confirmado" },
      });
      const { id } = (await r.json()) as { id: string };
      await request.patch(`${API_URL}/event-responses/${id}/`, {
        headers: bearer(captain),
        data: { es_convocado: true },
      });
    }

    await loginAs(page, captain);
    await page.goto(`/eventos/${training.id}`);

    const results = page.getByRole("heading", { name: /cómo quedó el entreno/i });
    await expect(results).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/asistieron 3/i)).toBeVisible();

    // Tres para una pista de cuatro: ofrece crear el invitado que falta.
    const aviso = page.getByRole("alertdialog");
    await expect(async () => {
      await page.getByRole("button", { name: /repartir 1 pista/i }).click();
      await expect(aviso).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    await expect(aviso).toContainText(/falta 1 jugador/i);
    await aviso.getByRole("button", { name: /crear 1 invitado/i }).click();

    const pista = page.locator('[data-pista-entreno="1"]');
    await expect(pista).toBeVisible();
    await expect(page.getByRole("button", { name: /^invitado 1\. arrástralo/i })).toBeVisible();

    // Tocar al jugador y luego el hueco: la capitana y el invitado ganaron.
    const colocar = async (quien: RegExp, ganador: boolean) => {
      await page.getByRole("button", { name: quien }).click();
      const lado = pista.locator("[data-hueco]").filter({
        hasText: ganador ? /ganadores/i : /perdedores/i,
      });
      await lado
        .getByRole("button", { name: /poner a .* aquí/i })
        .first()
        .click();
    };
    await colocar(/^marta casado\. arrástralo/i, true);
    await colocar(/^invitado 1\. arrástralo/i, true);
    await colocar(/^iván ruiz\. arrástralo/i, false);
    await colocar(/^sara lago\. arrástralo/i, false);
    await expect(page.getByText(/todos colocados/i)).toBeVisible();

    await page.getByRole("button", { name: /guardar resultados/i }).click();
    await expect(page.getByText(/resultados del entreno guardados/i)).toBeVisible();

    // La clasificación de la competición ya cuenta ese puesto.
    await page.goto(`/competiciones/${competition.id}`);
    await expect(page.getByRole("heading", { name: /clasificación/i })).toBeVisible({
      timeout: 20_000,
    });
    const primera = page.locator("tbody tr").first();
    await expect(primera).toContainText(/marta/i);
    await expect(page.getByRole("heading", { name: /^podio$/i })).toHaveCount(0);

    // Al finalizarla aparece el podio.
    await page.getByRole("button", { name: /finalizar competición/i }).click();
    const fin = page.getByRole("alertdialog");
    await expect(fin.getByText(/dar por terminada la competición/i)).toBeVisible();
    await fin.getByRole("button", { name: /^finalizar$/i }).click();
    await expect(page.getByRole("heading", { name: /^podio$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /reabrir competición/i })).toBeVisible();
  });

  test("el jugador ve el resultado del entreno pero no lo edita", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "entreno-ro-cap");
    const player = await seedPlayerInTeam(request, "entreno-ro-jug", team.id, captain);
    const competition = await seedCompetition(request, captain, team.id);
    const training = await seedTraining(request, captain, team.id, competition.id);

    const saved = await request.post(`${API_URL}/training-courts/bulk/`, {
      headers: bearer(captain),
      data: {
        event_id: training.id,
        courts: [
          {
            pista: 1,
            posicion: 1,
            players: [
              { user_id: captain.userId, ganador: true },
              { user_id: player.userId, ganador: false },
            ],
          },
        ],
      },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();

    await loginAs(page, player);
    await page.goto(`/eventos/${training.id}`);
    await expect(page.getByRole("heading", { name: /cómo quedó el entreno/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/marta casado/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /guardar resultados/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /añadir pista/i })).toHaveCount(0);

    await page.goto(`/competiciones/${competition.id}`);
    await expect(page.locator("tbody tr").first()).toContainText(/marta/i);
    await expect(page.getByRole("button", { name: /finalizar competición/i })).toHaveCount(0);
  });

  test("un entreno sin formato avisa a quien lo gestiona", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "entreno-sin-cap");
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(captain),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "Entreno suelto",
        fecha_inicio: ayer,
      },
    });
    const training = (await res.json()) as { id: string };

    await loginAs(page, captain);
    await page.goto(`/eventos/${training.id}`);
    await expect(page.getByText(/no tiene formato/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe("Otros formatos de entrenamiento", () => {
  test("un americano se cierra contando juegos y sale en la clasificación", async ({
    page,
    request,
  }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "ame-cap");
    await seedPlayerInTeam(request, "ame-jug", team.id, captain);
    const competition = await seedCompetition(request, captain, team.id, "americano");
    const training = await seedTraining(request, captain, team.id, competition.id);

    await loginAs(page, captain);
    await page.goto(`/eventos/${training.id}`);
    await expect(page.getByText(/los juegos a favor y en contra/i)).toBeVisible({
      timeout: 20_000,
    });

    // No hay pistas que ordenar: se apunta lo que hizo cada uno.
    await expect(page.getByRole("button", { name: /añadir pista/i })).toHaveCount(0);
    const addPlayer = page.getByRole("combobox").last();
    await addPlayer.click();
    await page.getByRole("option", { name: /marta/i }).click();
    await page.getByRole("spinbutton", { name: /juegos a favor/i }).fill("18");
    await page.getByRole("spinbutton", { name: /juegos en contra/i }).fill("6");
    await page.getByRole("button", { name: /guardar resultados/i }).click();
    await expect(page.getByText(/resultados del entreno guardados/i)).toBeVisible();

    await page.goto(`/competiciones/${competition.id}`);
    const primera = page.locator("tbody tr").first();
    await expect(primera).toContainText(/marta/i);
    await expect(primera).toContainText("18");
  });

  test("una competición sin formato no saca clasificación", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "sinf-cap");
    const res = await request.post(`${API_URL}/competitions/`, {
      headers: bearer(captain),
      data: { team_id: team.id, nombre: "Solo partidos", tipo: "copa" },
    });
    const competition = (await res.json()) as { id: string };

    await loginAs(page, captain);
    await page.goto(`/competiciones/${competition.id}`);
    await expect(page.getByText(/no tiene formato/i)).toBeVisible({ timeout: 20_000 });
  });
});
