import { test, expect, type APIRequestContext } from "@playwright/test";

import {
  API_URL,
  bearer,
  completeOnboarding,
  loginAs,
  seedCaptainWithTeam,
  signUp,
  uniqueEmail,
  type Session,
} from "./session";

/**
 * Crear un canal sin marcar a la gente de una en una.
 *
 * Se comprueban las dos cosas que lo hacen rápido: elegir para qué equipo es
 * —sin tener que cambiar de equipo antes— y los atajos por rol, que solo
 * salen si ese rol existe en el equipo.
 */

/** Alguien dentro de un equipo, con el rol que se le diga. */
async function seedMember(
  api: APIRequestContext,
  prefix: string,
  teamId: string,
  captain: Session,
  role: string,
) {
  const session = await signUp(api, uniqueEmail(prefix), prefix, "Prueba");
  await completeOnboarding(api, session, "jugador");
  const invite = await api.post(`${API_URL}/team-invitations/`, {
    headers: bearer(captain),
    data: { team_id: teamId, invited_user_id: session.userId, role },
  });
  const { id } = (await invite.json()) as { id: string };
  await api.post(`${API_URL}/team-invitations/${id}/accept/`, { headers: bearer(session) });
  return session;
}

test.describe("Canal nuevo: equipo y atajos por rol", () => {
  test("solo salen los grupos que existen, y marcan de golpe", async ({ page, request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "chg-cap");
    await seedMember(request, "chgco", team.id, captain, "co_capitan");
    await seedMember(request, "chgjug", team.id, captain, "jugador");
    // A propósito no hay entrenador ni delegado.

    await loginAs(page, captain);
    await page.goto("/comunicaciones");
    await page
      .getByRole("button", { name: /nuevo canal/i })
      .first()
      .click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible({ timeout: 20_000 });

    // Capitanes son dos —capitán y co-capitán— y jugadores uno.
    await expect(dialogo.getByRole("button", { name: /^capitanes \(2\)$/i })).toBeVisible();
    await expect(dialogo.getByRole("button", { name: /^jugadores \(1\)$/i })).toBeVisible();
    await expect(dialogo.getByRole("button", { name: /^todos \(3\)$/i })).toBeVisible();
    // Sin entrenador ni delegado, esos botones no se pintan.
    await expect(dialogo.getByRole("button", { name: /entrenadores/i })).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: /delegados/i })).toHaveCount(0);

    // Marcar el grupo marca a su gente; volver a pulsarlo la desmarca.
    const marcadas = () => dialogo.locator('[role="checkbox"][data-state="checked"]').count();
    const antes = await marcadas(); // la propia capitana va siempre marcada
    await dialogo.getByRole("button", { name: /^capitanes \(2\)$/i }).click();
    expect(await marcadas()).toBe(antes + 1);
    await dialogo.getByRole("button", { name: /^capitanes \(2\)$/i }).click();
    expect(await marcadas()).toBe(antes);

    // Y "Todos" deja marcado a todo el mundo.
    await dialogo.getByRole("button", { name: /^todos \(3\)$/i }).click();
    expect(await marcadas()).toBe(3);
  });

  test("con un solo equipo no se pregunta por el equipo", async ({ page, request }) => {
    const { session: captain } = await seedCaptainWithTeam(request, "chg-uno");
    await loginAs(page, captain);
    await page.goto("/comunicaciones");
    await page
      .getByRole("button", { name: /nuevo canal/i })
      .first()
      .click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible({ timeout: 20_000 });
    await expect(dialogo.getByText("Equipo", { exact: true })).toHaveCount(0);
  });

  test("se puede crear el canal para otro equipo donde gestionas", async ({ page, request }) => {
    const { session: captain, team: A } = await seedCaptainWithTeam(request, "chg-a");
    const segundo = await request.post(`${API_URL}/teams/`, {
      headers: bearer(captain),
      data: { nombre: "Equipo chg-b", deporte: "padel" },
    });
    expect(segundo.ok(), await segundo.text()).toBeTruthy();
    const B = (await segundo.json()) as { id: string };
    await seedMember(request, "chgb", B.id, captain, "jugador");

    await loginAs(page, captain);
    await page.goto("/comunicaciones");
    await page
      .getByRole("button", { name: /nuevo canal/i })
      .first()
      .click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible({ timeout: 20_000 });

    // Con dos equipos sí se pregunta, y arranca en el activo.
    const equipo = dialogo.getByRole("combobox").first();
    await expect(equipo).toContainText(A.nombre);
    await equipo.click();
    await page.getByRole("option", { name: "Equipo chg-b" }).click();

    await dialogo.getByLabel(/nombre/i).fill("Solo la gestión");
    // Aquí lo que se prueba es el selector de equipo, no los atajos: basta
    // con marcar a alguien de la lista.
    await dialogo.locator('[role="checkbox"][data-state="unchecked"]').first().click();
    await dialogo.getByRole("button", { name: /^crear$/i }).click();

    // Se cambia solo al equipo del canal: si no, no se vería el que acabas de crear.
    await expect(page.getByText(/canal creado/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Solo la gestión" }).first()).toBeVisible({
      timeout: 20_000,
    });
    // Y el selector ha pasado al equipo del canal.
    await expect(page.getByRole("button", { name: /Equipo chg-b/ }).first()).toBeVisible();
  });
});
