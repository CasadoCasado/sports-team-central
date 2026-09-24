import { test, expect, type APIRequestContext } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, type Session } from "./session";

/**
 * Convocatorias enseña las de todos tus equipos a la vez. Con más de uno, cada
 * equipo va en su bloque; con uno solo, una lista sin más, y sin selector de
 * equipo, que solo sale cuando hay entre qué elegir.
 */

async function convocatoria(
  request: APIRequestContext,
  quien: Session,
  teamId: string,
  titulo: string,
  dias: number,
) {
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(quien),
    data: {
      team_id: teamId,
      tipo: "entrenamiento",
      titulo,
      fecha_inicio: new Date(Date.now() + dias * 86_400_000).toISOString(),
      requiere_convocatoria: true,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

test.describe("Convocatorias de varios equipos", () => {
  test("con dos equipos, cada uno en su bloque", async ({ page, request }) => {
    const { session: yo, team: a } = await seedCaptainWithTeam(request, "conv-a");
    const res = await request.post(`${API_URL}/teams/`, {
      headers: bearer(yo),
      data: { nombre: "Los del martes", deporte: "padel" },
    });
    const b = (await res.json()) as { id: string; nombre: string };

    await convocatoria(request, yo, a.id, "Entreno de A", 3);
    await convocatoria(request, yo, b.id, "Entreno de B", 1);
    await convocatoria(request, yo, b.id, "Otro de B", 5);

    await loginAs(page, yo);
    await page.goto("/convocatorias");

    const bloqueA = page.getByRole("region", { name: a.nombre });
    const bloqueB = page.getByRole("region", { name: b.nombre });
    await expect(bloqueA).toBeVisible({ timeout: 20_000 });
    await expect(bloqueA.getByRole("listitem")).toHaveCount(1);
    await expect(bloqueA).toContainText("Entreno de A");
    await expect(bloqueB.getByRole("listitem")).toHaveCount(2);
    await expect(bloqueB).toContainText("Otro de B");

    // Primero el equipo con la convocatoria más cercana.
    const cajaA = await bloqueA.boundingBox();
    const cajaB = await bloqueB.boundingBox();
    expect(cajaB!.y).toBeLessThan(cajaA!.y);
  });

  test("con un equipo, una lista sin bloques", async ({ page, request }) => {
    const { session: yo, team } = await seedCaptainWithTeam(request, "conv-uno");
    await convocatoria(request, yo, team.id, "Entreno único", 2);

    await loginAs(page, yo);
    await page.goto("/convocatorias");

    await expect(page.getByText("Entreno único")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("region", { name: team.nombre })).toHaveCount(0);
  });
});
