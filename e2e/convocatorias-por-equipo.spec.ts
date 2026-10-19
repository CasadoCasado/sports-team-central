import { test, expect, type APIRequestContext } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam, type Session } from "./session";

/**
 * Convocatorias enseña las de todos tus equipos a la vez. Con más de uno, cada
 * equipo va en su bloque y hay un selector para mirar uno solo; con uno solo,
 * una lista sin más, y sin selector, que solo sale cuando hay entre qué elegir.
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

    // Elegir un equipo deja solo sus convocatorias, sin bloques.
    await page.getByRole("button", { name: /todos los equipos/i }).click();
    await page.getByRole("menuitem", { name: b.nombre }).click();
    await expect(page.getByText("Otro de B")).toBeVisible();
    await expect(page.getByText("Entreno de A")).toHaveCount(0);
    await expect(page.getByRole("region", { name: b.nombre })).toHaveCount(0);

    // Y se mantiene al volver de un evento.
    await page.getByText("Otro de B").click();
    await page.goBack();
    await expect(page.getByText("Otro de B")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Entreno de A")).toHaveCount(0);

    // «Todos los equipos» vuelve a enseñarlas todas.
    await page.getByRole("button", { name: b.nombre }).click();
    await page.getByRole("menuitem", { name: /todos los equipos/i }).click();
    await expect(page.getByText("Entreno de A")).toBeVisible();
  });

  test("con un equipo, una lista sin bloques", async ({ page, request }) => {
    const { session: yo, team } = await seedCaptainWithTeam(request, "conv-uno");
    await convocatoria(request, yo, team.id, "Entreno único", 2);

    await loginAs(page, yo);
    await page.goto("/convocatorias");

    await expect(page.getByText("Entreno único")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("region", { name: team.nombre })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /todos los equipos/i })).toHaveCount(0);
  });
});
