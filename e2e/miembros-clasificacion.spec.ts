import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import { loginAs, seedCaptainWithTeam, seedPlayerInTeam, type Session } from "./session";

/**
 * La pantalla de Miembros como una clasificación: podio y tabla.
 *
 * Lo delicado son los tres momentos de un equipo, y los tres se prueban:
 * sin ningún partido, con partidos pero sin nadie que llegue al mínimo del
 * podio, y con el podio a medio llenar.
 *
 * Los miembros son de verdad; el balance de `/stats/players/` se sirve a mano.
 * Montar partidos reales —evento, convocatoria, pistas, sets— para cada caso
 * haría el test lento y frágil, y lo que se prueba aquí es cómo se pinta ese
 * balance, no cómo se calcula (eso ya lo cubren los tests del backend).
 */

type Plantilla = {
  captain: Session;
  sara: Session;
  diego: Session;
  lucia: Session;
};

async function montarEquipo(request: APIRequestContext): Promise<Plantilla> {
  const { session: captain, team } = await seedCaptainWithTeam(request, "clasif");
  const sara = await seedPlayerInTeam(request, "clasif-sara", team.id, captain, {
    nombre: "Sara",
    apellidos: "Lago",
  });
  const diego = await seedPlayerInTeam(request, "clasif-diego", team.id, captain, {
    nombre: "Diego",
    apellidos: "Otero",
  });
  const lucia = await seedPlayerInTeam(request, "clasif-lucia", team.id, captain, {
    nombre: "Lucía",
    apellidos: "Ferreiro",
    role: "entrenador",
  });
  return { captain, sara, diego, lucia };
}

type Balance = { pj: number; v: number };

/** Sirve el balance del equipo: `pj` partidos jugados y `v` ganados por persona. */
async function servirBalance(page: Page, filas: [Session, Balance][]) {
  const cuerpo = filas.map(([s, { pj, v }]) => ({
    user_id: s.userId,
    team_id: "",
    convocado: pj,
    disputados: pj,
    victorias: v,
    derrotas: pj - v,
    win_pct: pj ? Math.round((100 * v) / pj) : 0,
    ultima_convocatoria: "2026-09-20",
    ultimo_partido: pj ? "2026-09-20" : null,
  }));
  await page.route(/\/api\/stats\/players\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cuerpo) }),
  );
}

const podio = (page: Page) => page.getByRole("region", { name: /quién más gana/i });
const tabla = (page: Page) => page.getByRole("table");

test.describe("Miembros: podio y clasificación", () => {
  test("sin partidos: ni podio ni tabla, la plantilla y qué va a salir aquí", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, []);
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await expect(page.getByRole("heading", { name: /aún no hay partidos/i })).toBeVisible();
    await expect(podio(page)).toHaveCount(0);
    await expect(tabla(page)).toHaveCount(0);

    const plantilla = page.getByRole("region", { name: /plantilla/i });
    await expect(plantilla.getByText("Sara Lago")).toBeVisible();
    await expect(plantilla.getByText("Diego Otero")).toBeVisible();
    // Quien entrena y no juega va aparte, no en la plantilla.
    await expect(plantilla.getByText("Lucía Ferreiro")).toHaveCount(0);
    await expect(page.getByText("Lucía Ferreiro")).toBeVisible();
  });

  test("con partidos pero nadie en el mínimo: tabla sí, el podio espera", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, [
      [e.sara, { pj: 3, v: 2 }],
      [e.diego, { pj: 2, v: 2 }],
    ]);
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await expect(page.getByText(/el podio se estrena.*sara, con 3/i)).toBeVisible();
    await expect(podio(page)).toHaveCount(0);
    await expect(tabla(page)).toBeVisible();
    await expect(tabla(page).getByText("Sara Lago")).toBeVisible();
  });

  test("con dos en el mínimo: podio con un hueco libre, centrado en escritorio", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, [
      [e.sara, { pj: 6, v: 5 }],
      [e.captain, { pj: 8, v: 5 }],
      // El 100 % de Diego no cuenta: con dos partidos no llega al mínimo.
      [e.diego, { pj: 2, v: 2 }],
    ]);
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    const p = podio(page);
    await expect(p).toBeVisible();
    await expect(p.getByRole("listitem").nth(1)).toContainText("Sara");
    await expect(p.getByRole("listitem").nth(1)).toContainText("83%");
    await expect(p.getByRole("listitem").nth(0)).toContainText("Marta");
    await expect(p.getByRole("listitem").nth(2)).toContainText(/libre/i);

    // La tabla, por % de victorias: Diego detrás, aunque tenga un 100 %.
    const filas = tabla(page).locator("tbody tr");
    await expect(filas.nth(0)).toContainText("Sara Lago");
    await expect(filas.nth(2)).toContainText("Diego Otero");

    // Y se reordena tocando la cabecera.
    await tabla(page).getByRole("button", { name: /^pj$/i }).click();
    await expect(filas.nth(0)).toContainText("Marta Casado");

    // El podio, centrado en la columna de contenido.
    const lista = await p.getByRole("list").boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(lista && main).toBeTruthy();
    const centroPodio = lista!.x + lista!.width / 2;
    const centroMain = main!.x + main!.width / 2;
    expect(Math.abs(centroPodio - centroMain)).toBeLessThan(4);
  });

  test("el capitán cambia roles y quita gente desde el menú de cada fila", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, [[e.sara, { pj: 6, v: 5 }]]);
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await expect(async () => {
      await page.getByRole("button", { name: /opciones de sara lago/i }).click();
      await expect(page.getByRole("menuitemradio", { name: /co-capitán/i })).toBeVisible({
        timeout: 1_500,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("menuitemradio", { name: /co-capitán/i }).click();
    await expect(page.getByText(/rol actualizado/i)).toBeVisible();
    await expect(tabla(page).getByText(/co-capitán/i)).toBeVisible();

    // Quitar pide confirmación.
    await page.getByRole("button", { name: /opciones de diego otero/i }).click();
    await page.getByRole("menuitem", { name: /quitar del equipo/i }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toContainText(/quitar a diego otero/i);
    await dialogo.getByRole("button", { name: /quitar del equipo/i }).click();
    await expect(page.getByText("Diego Otero")).toHaveCount(0);

    // Y sobre uno mismo no hay menú.
    await expect(page.getByRole("button", { name: /opciones de marta casado/i })).toHaveCount(0);
  });

  test("abrir el menú de una fila no descoloca la barra lateral", async ({ page, request }) => {
    // Con la página bajada, abrir un menú o un diálogo de Radix subía la barra
    // lateral y la dejaba cortada: el bloqueo de scroll convertía el <body> en
    // contenedor de desplazamiento y el `sticky` dejaba de pegarse a la ventana.
    const e = await montarEquipo(request);
    await servirBalance(page, [[e.sara, { pj: 6, v: 5 }]]);
    await page.setViewportSize({ width: 1280, height: 520 });
    await loginAs(page, e.captain);
    await page.goto("/miembros");
    await expect(tabla(page)).toBeVisible();

    const barra = page.locator("#main-sidebar");
    const pegada = async () => {
      const caja = await barra.boundingBox();
      expect(caja).not.toBeNull();
      expect(Math.round(caja!.y)).toBe(0);
      expect(Math.round(caja!.height)).toBe(520);
    };

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const anchoAntes = await page
      .locator("main")
      .evaluate((el) => el.getBoundingClientRect().width);
    await pegada();

    await expect(async () => {
      await page.getByRole("button", { name: /opciones de diego otero/i }).click();
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    await pegada();
    // Y la página no salta a un lado para dejar el hueco de la barra de scroll.
    expect(await page.locator("main").evaluate((el) => el.getBoundingClientRect().width)).toBe(
      anchoAntes,
    );

    // Y el fondo sigue sin moverse con la rueda mientras el menú está abierto.
    const y = await page.evaluate(() => window.scrollY);
    await page.mouse.move(640, 200);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);

    // Lo mismo con el diálogo de confirmación, que bloquea el scroll igual.
    await page.getByRole("menuitem", { name: /quitar del equipo/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await pegada();
  });

  test("un jugador ve la clasificación pero no puede gestionar", async ({ page, request }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, [[e.sara, { pj: 6, v: 5 }]]);
    await loginAs(page, e.diego);
    await page.goto("/miembros");

    await expect(podio(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /opciones de/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^invitar$/i })).toHaveCount(0);
  });

  test.describe("en móvil", () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test("nada se sale de la pantalla", async ({ page, request }) => {
      const e = await montarEquipo(request);
      await servirBalance(page, [
        [e.sara, { pj: 6, v: 5 }],
        [e.captain, { pj: 8, v: 5 }],
        [e.diego, { pj: 5, v: 1 }],
      ]);
      await loginAs(page, e.captain);
      await page.goto("/miembros");
      await expect(podio(page)).toBeVisible();

      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(desborda).toBe(false);
    });
  });
});
