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
  teamId: string;
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
  return { teamId: team.id, captain, sara, diego, lucia };
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
  // Y, a juego, qué clasificaciones tienen algo: la de los partidos si hay.
  await servirVistas(page, { partidos: filas.some(([, b]) => b.pj > 0) });
}

type Vistas = { partidos?: boolean; entrenos?: boolean; competiciones?: string[] };

/**
 * Qué clasificaciones tienen resultados, que es lo que ofrece el selector.
 * Playwright mira antes las rutas registradas después, así que llamarla tras
 * `servirBalance` sustituye lo que puso esa.
 */
async function servirVistas(page: Page, vistas: Vistas) {
  await servirJson(page, /\/api\/stats\/rankings\//, {
    partidos: false,
    entrenos: false,
    competiciones: [],
    ...vistas,
  });
}

const podio = (page: Page) => page.getByRole("region", { name: /quién más gana/i });
const tabla = (page: Page) => page.getByRole("table");

type Noche = { nota: number; entrenos: number; clasificado?: boolean };

/**
 * Una clasificación por notas, con la forma de la de una competición.
 * El orden de `filas` es el puesto: como en el servidor, que es quien decide.
 */
function clasificacion(filas: [Session, Noche][], minimo = 1) {
  return {
    formato: null,
    entrenamientos: 6,
    media: 50,
    minimo_podio: minimo,
    margen: 5,
    standings: filas.map(([s, n], i) => ({
      user_id: s.userId,
      profile: null,
      puesto: i + 1,
      entrenamientos: n.entrenos,
      nota: n.nota,
      clasificado: n.clasificado ?? n.entrenos >= minimo,
    })),
  };
}

async function servirJson(page: Page, url: RegExp, cuerpo: unknown) {
  await page.route(url, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cuerpo) }),
  );
}

async function crearCompeticion(
  request: APIRequestContext,
  e: Plantilla,
  nombre: string,
  formato: string | null,
) {
  const res = await request.post(`${API_URL}/competitions/`, {
    headers: bearer(e.captain),
    data: { team_id: e.teamId, nombre, tipo: "liga", formato },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { id: string };
}

async function ponerLado(request: APIRequestContext, s: Session, posicion: string) {
  const res = await request.patch(`${API_URL}/profiles/me/`, {
    headers: bearer(s),
    data: { posicion },
  });
  expect(res.ok()).toBe(true);
}

const selector = (page: Page) => page.getByLabel(/^clasificación$/i);

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
    // Sin resultados de nada, no hay nada que elegir.
    await expect(selector(page)).toHaveCount(0);

    const plantilla = page.getByRole("region", { name: /plantilla/i });
    await expect(plantilla.getByText("Sara Lago")).toBeVisible();
    await expect(plantilla.getByText("Diego Otero")).toBeVisible();
    // Siempre en orden de equipo: la dueña (y capitana) delante, con su
    // etiqueta; luego los jugadores, por nombre.
    const filas = plantilla.getByRole("listitem");
    await expect(filas.nth(0)).toContainText("Marta Casado");
    await expect(filas.nth(0)).toContainText(/dueño/i);
    await expect(filas.nth(1)).toContainText("Diego Otero");
    await expect(filas.nth(2)).toContainText("Sara Lago");
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

  test("el selector cambia a los entrenos, medidos por nota", async ({ page, request }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, [[e.diego, { pj: 6, v: 5 }]]);
    await servirVistas(page, { partidos: true, entrenos: true });
    await servirJson(
      page,
      /\/api\/stats\/trainings\//,
      clasificacion(
        [
          [e.sara, { nota: 71.4, entrenos: 4 }],
          [e.captain, { nota: 58, entrenos: 5 }],
          [e.diego, { nota: 40, entrenos: 1 }],
        ],
        2,
      ),
    );
    await loginAs(page, e.captain);
    await page.goto("/miembros");
    await expect(podio(page)).toBeVisible();

    await selector(page).selectOption({ label: "Entrenos" });

    const p = page.getByRole("region", { name: /quién va mejor/i });
    await expect(p).toBeVisible();
    await expect(p.getByRole("listitem").nth(1)).toContainText("Sara");
    await expect(p.getByRole("listitem").nth(1)).toContainText("71,4");
    await expect(p.getByRole("listitem").nth(1)).toContainText("4 entrenos");
    // Diego no llega al mínimo de 2 entrenos: fuera del podio.
    await expect(p.getByRole("listitem").nth(2)).toContainText(/libre/i);
    await expect(p).toContainText(/han ido a 2 entrenos o más/i);

    // La tabla: sin victorias ni derrotas, con la nota, y en el orden del servidor.
    await expect(tabla(page).getByRole("button", { name: /^nota$/i })).toBeVisible();
    await expect(tabla(page).getByRole("button", { name: /^v$/i })).toHaveCount(0);
    await expect(tabla(page).locator("tbody tr").nth(0)).toContainText("Sara Lago");
  });

  test("con resultados de un solo tipo, se ve ese y sin selector", async ({ page, request }) => {
    const e = await montarEquipo(request);
    // Ningún partido, pero sí entrenos.
    await servirBalance(page, []);
    await servirVistas(page, { entrenos: true });
    await servirJson(
      page,
      /\/api\/stats\/trainings\//,
      clasificacion([[e.sara, { nota: 66, entrenos: 2 }]]),
    );
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await expect(page.getByRole("region", { name: /quién va mejor/i })).toBeVisible();
    await expect(tabla(page).getByRole("button", { name: /^nota$/i })).toBeVisible();
    await expect(selector(page)).toHaveCount(0);
  });

  test("el selector solo ofrece lo que tiene resultados", async ({ page, request }) => {
    const e = await montarEquipo(request);
    const liga = await crearCompeticion(request, e, "Liga con algo", "partidos");
    await crearCompeticion(request, e, "Liga vacía", "partidos");
    await servirBalance(page, [[e.sara, { pj: 6, v: 5 }]]);
    // Partidos y una liga; los entrenos, nada.
    await servirVistas(page, { partidos: true, competiciones: [liga.id] });
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await expect(selector(page)).toBeVisible();
    const opciones = await selector(page).locator("option").allTextContents();
    expect(opciones).toEqual(["Enfrentamientos", "Liga con algo"]);
  });

  test("una competición con formato enseña su clasificación", async ({ page, request }) => {
    const e = await montarEquipo(request);
    const liga = await crearCompeticion(request, e, "Liga de invierno", "partidos");
    await servirBalance(page, []);
    await servirVistas(page, { partidos: true, competiciones: [liga.id] });
    await servirJson(
      page,
      new RegExp(`/api/competitions/${liga.id}/standings/`),
      clasificacion([
        [e.diego, { nota: 64, entrenos: 3 }],
        [e.sara, { nota: 52, entrenos: 3 }],
      ]),
    );
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await selector(page).selectOption({ label: "Liga de invierno" });
    const p = page.getByRole("region", { name: /quién va mejor/i });
    await expect(p.getByRole("listitem").nth(1)).toContainText("Diego");
    await expect(tabla(page).locator("tbody tr").nth(0)).toContainText("Diego Otero");
  });

  test("una competición sin formato enseña sus partidos", async ({ page, request }) => {
    const e = await montarEquipo(request);
    const copa = await crearCompeticion(request, e, "Copa", null);
    await servirVistas(page, { partidos: true, competiciones: [copa.id] });
    // Los partidos de todo el equipo, y los de la copa aparte.
    let pedidoDeLaCopa = false;
    await page.route(/\/api\/stats\/players\//, (route) => {
      const deLaCopa =
        new URL(route.request().url()).searchParams.get("competition_id") === copa.id;
      pedidoDeLaCopa ||= deLaCopa;
      const filas = deLaCopa ? [{ s: e.sara, pj: 5, v: 4 }] : [{ s: e.diego, pj: 9, v: 2 }];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          filas.map(({ s, pj, v }) => ({
            user_id: s.userId,
            team_id: "",
            convocado: pj,
            disputados: pj,
            victorias: v,
            derrotas: pj - v,
            win_pct: Math.round((100 * v) / pj),
            ultima_convocatoria: null,
            ultimo_partido: "2026-09-20",
          })),
        ),
      });
    });
    await loginAs(page, e.captain);
    await page.goto("/miembros");
    await expect(tabla(page).locator("tbody tr").nth(0)).toContainText("Diego Otero");

    await selector(page).selectOption({ label: "Copa" });
    await expect(podio(page).getByRole("listitem").nth(1)).toContainText("Sara");
    await expect(tabla(page).getByRole("button", { name: /^pj$/i })).toBeVisible();
    expect(pedidoDeLaCopa).toBe(true);
  });

  test("se ve en qué lado juega cada uno, aunque lo escribiera a mano", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    await ponerLado(request, e.sara, "reves");
    // Un valor de cuando el campo era texto libre.
    await ponerLado(request, e.diego, "Juego de drive");
    await servirBalance(page, [[e.sara, { pj: 6, v: 5 }]]);
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    const filas = tabla(page).locator("tbody tr");
    await expect(filas.filter({ hasText: "Sara Lago" })).toContainText("Revés");
    await expect(filas.filter({ hasText: "Diego Otero" })).toContainText("Derecha");
    await expect(podio(page).getByRole("listitem").nth(1)).toContainText("Revés");
  });

  test("en el perfil se elige revés, derecha o los dos", async ({ page, request }) => {
    const e = await montarEquipo(request);
    await loginAs(page, e.sara);
    await page.goto("/perfil");

    await expect(async () => {
      await page.getByRole("combobox", { name: /posición/i }).click();
      await expect(page.getByRole("option", { name: /^derecha$/i })).toBeVisible({
        timeout: 1_500,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("option", { name: /^derecha$/i }).click();
    // Hay otro «Guardar» más abajo, el de los recordatorios: este es el primero.
    await page
      .getByRole("button", { name: /^guardar$/i })
      .first()
      .click();

    await expect
      .poll(async () => {
        const res = await request.get(`${API_URL}/profiles/me/`, { headers: bearer(e.sara) });
        return ((await res.json()) as { posicion: string | null }).posicion;
      })
      .toBe("derecha");
  });

  test("con un equipo, la descripción lleva el nombre, la ciudad y cuántos son", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    await servirBalance(page, []);
    await servirVistas(page, { partidos: true, entrenos: true });
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    await expect(page.getByText("Equipo clasif · Vigo · 4 miembros")).toBeVisible();
    // Con un solo equipo no hay selector de equipo: no hay entre qué elegir.
    await expect(page.getByRole("button", { name: /equipo clasif/i })).toHaveCount(0);

    // Y el de la clasificación va debajo de «Invitar», a su derecha.
    const invitar = await page.getByRole("button", { name: /^invitar$/i }).boundingBox();
    const clasif = await selector(page).boundingBox();
    expect(clasif!.y).toBeGreaterThan(invitar!.y + invitar!.height - 1);
    expect(Math.abs(clasif!.x + clasif!.width - (invitar!.x + invitar!.width))).toBeLessThan(2);
  });

  test("con varios equipos, el selector va bajo el título y cambia los miembros", async ({
    page,
    request,
  }) => {
    const e = await montarEquipo(request);
    const res = await request.post(`${API_URL}/teams/`, {
      headers: bearer(e.captain),
      data: { nombre: "Los Otros", deporte: "padel", ciudad: "Ourense" },
    });
    expect(res.ok(), await res.text()).toBe(true);
    await servirBalance(page, []);
    await loginAs(page, e.captain);
    await page.goto("/miembros");

    const titulo = page.getByRole("heading", { level: 1, name: /^miembros$/i });
    const picker = page.getByRole("button", { name: /equipo clasif|los otros/i }).first();
    await expect(picker).toBeVisible();
    const cajaTitulo = await titulo.boundingBox();
    const cajaPicker = await picker.boundingBox();
    expect(cajaPicker!.y).toBeGreaterThan(cajaTitulo!.y + cajaTitulo!.height - 1);

    // Cambiar al otro equipo cambia la ciudad y la plantilla.
    const otro = (await picker.textContent())?.includes("Los Otros")
      ? "Equipo clasif"
      : "Los Otros";
    await expect(async () => {
      await picker.click();
      await expect(page.getByRole("menuitem", { name: new RegExp(otro, "i") })).toBeVisible({
        timeout: 1_500,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("menuitem", { name: new RegExp(otro, "i") }).click();

    if (otro === "Los Otros") {
      await expect(page.getByText("Ourense · 1 miembro")).toBeVisible();
      await expect(page.getByText("Sara Lago")).toHaveCount(0);
    } else {
      await expect(page.getByText("Vigo · 4 miembros")).toBeVisible();
      await expect(page.getByText("Sara Lago")).toBeVisible();
    }
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
      await servirVistas(page, { partidos: true, entrenos: true });
      await loginAs(page, e.captain);
      await page.goto("/miembros");
      await expect(podio(page)).toBeVisible();

      // «Invitar» y el selector, a la derecha también aquí.
      const invitar = await page.getByRole("button", { name: /^invitar$/i }).boundingBox();
      const clasif = await selector(page).boundingBox();
      const derecha = (c: { x: number; width: number }) => c.x + c.width;
      expect(Math.abs(derecha(clasif!) - derecha(invitar!))).toBeLessThan(2);
      expect(derecha(invitar!)).toBeGreaterThan(375 - 24);
      expect(clasif!.y).toBeGreaterThan(invitar!.y + invitar!.height - 1);

      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(desborda).toBe(false);
    });
  });
});
