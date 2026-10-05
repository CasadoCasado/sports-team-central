import { test, expect, type Page } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * «Inscribir equipo» solo sale si hay una competición oficial con las
 * inscripciones abiertas en la que el equipo aún no esté. El catálogo es
 * global y la base de pruebas lo comparte, así que aquí se le da uno fijo.
 */
const catalogo = (abiertas: boolean) => [
  {
    id: "00000000-0000-0000-0000-0000000000aa",
    code: "SNP",
    nombre: "Series Nacionales",
    descripcion: null,
    reglas: null,
    temporada_actual: "2026/27",
    activa: true,
    inscripciones_abiertas: abiertas,
    orden: 0,
    categories: [],
    divisions: [],
  },
];

async function conCatalogo(page: Page, abiertas: boolean, inscritos: object[] = []) {
  await page.route(/\/api\/official-competitions\//, (r) =>
    r.fulfill({ json: catalogo(abiertas) }),
  );
  await page.route(/\/api\/competition-registrations\/\?/, (r) => r.fulfill({ json: inscritos }));
}

test("inscribir solo con inscripciones abiertas y si no estamos ya", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "inscribir");
  await loginAs(page, session);
  const boton = page.getByRole("button", { name: /inscribir equipo/i });
  const seccion = page.getByRole("heading", { name: /inscripciones en competiciones/i });

  // Nada abierto y sin inscripciones: ni botón ni sección, que solo decía
  // «no está inscrito en ninguna» debajo de las competiciones del equipo.
  await conCatalogo(page, false);
  await page.goto("/competiciones");
  await expect(page.getByRole("button", { name: /nueva competición/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(seccion).toHaveCount(0);
  await expect(boton).toHaveCount(0);

  await page.unrouteAll();
  await conCatalogo(page, true);
  await page.reload();
  await expect(boton).toBeVisible({ timeout: 20_000 });

  await page.unrouteAll();
  await conCatalogo(page, true, [
    {
      id: "00000000-0000-0000-0000-0000000000bb",
      competition_id: "00000000-0000-0000-0000-0000000000aa",
      team_id: session.userId,
      category_id: null,
      division_id: null,
      created_by_id: null,
      status: "activa",
      temporada: "2026/27",
      registered_at: new Date().toISOString(),
      competition_nombre: "Series Nacionales",
      category_nombre: "Masculino",
      division_nombre: "Primera",
      team_nombre: "Equipo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
  await page.reload();
  // Inscritos: la sección sale con su inscripción, pero sin botón.
  await expect(page.getByText(/series nacionales · 2026\/27/i)).toBeVisible({ timeout: 20_000 });
  await expect(seccion).toBeVisible();
  await expect(boton).toHaveCount(0);
});

test("«Ver clasificación» va abajo en todas las tarjetas", async ({ page, request }) => {
  const { session, team } = await seedCaptainWithTeam(request, "tarjetas");
  for (const data of [
    { nombre: "SNP", tipo: "liga", descripcion: "Series Nacionales Padel" },
    { nombre: "Rey de los Niños", tipo: "torneo" },
  ]) {
    const res = await request.post(`${API_URL}/competitions/`, {
      headers: bearer(session),
      data: { team_id: team.id, ...data },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }
  await loginAs(page, session);
  await page.goto("/competiciones");
  const enlaces = page.getByRole("link", { name: /ver clasificación/i });
  await expect(enlaces).toHaveCount(2, { timeout: 20_000 });
  const [a, b] = await Promise.all([enlaces.nth(0).boundingBox(), enlaces.nth(1).boundingBox()]);
  expect(Math.round(a!.y)).toBe(Math.round(b!.y));
});
