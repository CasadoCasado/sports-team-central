import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Una persona puede estar en varios equipos, y cambiar entre ellos tiene que
 * cambiar lo que se ve.
 *
 * El selector y la página que pinta los datos son componentes distintos y los
 * dos llaman a `useActiveTeam`. Cuando el equipo elegido vivía en un `useState`
 * dentro del hook, cada uno tenía su copia: el selector cambiaba de nombre y la
 * página seguía enseñando el equipo anterior hasta recargar.
 */

test.describe("Varios equipos a la vez", () => {
  test("cambiar de equipo cambia lo que se ve", async ({ page, request }) => {
    const { session: yo, team: A } = await seedCaptainWithTeam(request, "mt-a");
    const res = await request.post(`${API_URL}/teams/`, {
      headers: bearer(yo),
      data: { nombre: "Equipo mt-b", deporte: "padel" },
    });
    const B = (await res.json()) as { id: string };

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const [teamId, titulo] of [
      [A.id, "Entreno solo de A"],
      [B.id, "Entreno solo de B"],
    ] as const) {
      await request.post(`${API_URL}/events/`, {
        headers: bearer(yo),
        data: { team_id: teamId, tipo: "entrenamiento", titulo, fecha_inicio: manana },
      });
    }

    await loginAs(page, yo);
    await page.goto("/entrenamientos");
    await expect(page.getByText("Entreno solo de A")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Entreno solo de B")).toHaveCount(0);

    await page.locator(`button:has-text("${A.nombre}")`).first().click();
    await page.getByRole("menuitem", { name: /mt-b/i }).click();

    // Lo que importa: la página, no solo el rótulo del selector.
    await expect(page.getByText("Entreno solo de B")).toBeVisible();
    await expect(page.getByText("Entreno solo de A")).toHaveCount(0);
  });

  test("se puede ser capitán de uno y jugador de otro a la vez", async ({ request }) => {
    const { session: yo } = await seedCaptainWithTeam(request, "mt-cap");
    const { session: otro, team: B } = await seedCaptainWithTeam(request, "mt-otro");

    const inv = await request.post(`${API_URL}/team-invitations/`, {
      headers: bearer(otro),
      data: { team_id: B.id, invited_user_id: yo.userId, role: "jugador" },
    });
    const { id } = (await inv.json()) as { id: string };
    const acc = await request.post(`${API_URL}/team-invitations/${id}/accept/`, {
      headers: bearer(yo),
    });
    expect(acc.status(), await acc.text()).toBe(200);

    const mias = await request.get(`${API_URL}/team-members/?mine=1&status=activo`, {
      headers: bearer(yo),
    });
    const roles = ((await mias.json()) as { role: string }[]).map((m) => m.role).sort();
    expect(roles).toEqual(["capitan", "jugador"]);
  });
});
