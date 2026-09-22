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
async function seedCompetition(api: APIRequestContext, captain: Session, teamId: string) {
  const res = await api.post(`${API_URL}/competitions/`, {
    headers: bearer(captain),
    data: { team_id: teamId, nombre: "Liga interna", tipo: "liga", temporada: "2025/26" },
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
    await seedPlayerInTeam(request, "entreno-jug", team.id, captain);
    const competition = await seedCompetition(request, captain, team.id);
    const training = await seedTraining(request, captain, team.id, competition.id);

    await loginAs(page, captain);
    await page.goto(`/eventos/${training.id}`);

    const results = page.getByRole("heading", { name: /cómo quedó el entreno/i });
    await expect(results).toBeVisible({ timeout: 20_000 });

    // Una pista: la capitana la aguanta y su jugador reta.
    await page.getByRole("button", { name: /añadir pista/i }).click();
    const addPlayer = page.getByRole("combobox").last();
    for (const nombre of [/marta/i, /iván/i]) {
      await addPlayer.click();
      await page.getByRole("option", { name: nombre }).click();
    }
    await page.getByRole("button", { name: /marcar como pareja que aguanta la pista/i }).first().click();
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
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /finalizar competición/i }).click();
    await expect(page.getByRole("heading", { name: /^podio$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /reabrir competición/i })).toBeVisible();
  });

  test("el jugador ve el resultado del entreno pero no lo edita", async ({
    page,
    request,
  }) => {
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

  test("un entreno fuera de una competición avisa a quien lo gestiona", async ({
    page,
    request,
  }) => {
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
    await expect(page.getByText(/no está dentro de ninguna competición/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
