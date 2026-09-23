import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * La cabecera del detalle de un evento, ahora que es un marcador.
 *
 * Lo que se rompe sin hacer ruido es **de qué lado va cada tanteo**. La API
 * guarda `resultado_local` y `resultado_visitante` desde el punto de vista del
 * campo, no del equipo: jugando fuera, el nuestro es el de visitante. Si
 * alguien invierte eso, la tarjeta enseña un 3–1 donde hubo un 1–3 y nadie se
 * entera mirando, porque los dos números existen y el diseño sigue cuadrando.
 *
 * Y que la tarjeta siga sirviendo para lo que no es un enfrentamiento: un
 * entrenamiento no tiene contra quién, así que ahí manda el título.
 */

const manana = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

test.describe("Cabecera de un enfrentamiento", () => {
  test("jugando en casa, el marcador va en nuestro orden", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "marc-casa");
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(session),
      data: {
        team_id: team.id,
        tipo: "partido",
        titulo: "Jornada 8",
        rival: "Club Náutico",
        es_local: true,
        fecha_inicio: manana(),
      },
    });
    const event = (await res.json()) as { id: string };
    await request.patch(`${API_URL}/events/${event.id}/`, {
      headers: bearer(session),
      data: { resultado_local: 3, resultado_visitante: 1 },
    });

    await loginAs(page, session);
    await page.goto(`/eventos/${event.id}`);

    const cabecera = page.getByRole("article").first();
    await expect(cabecera).toBeVisible({ timeout: 20_000 });
    await expect(cabecera.getByText(team.nombre, { exact: true })).toBeVisible();
    await expect(cabecera.getByText("Club Náutico", { exact: true })).toBeVisible();
    // Somos locales y ganamos 3–1.
    await expect(cabecera.getByText(/3\s*–\s*1/)).toBeVisible();
    await expect(cabecera.getByText(/^ganado$/i)).toBeVisible();
  });

  test("jugando fuera, el marcador se da la vuelta", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "marc-fuera");
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(session),
      data: {
        team_id: team.id,
        tipo: "partido",
        titulo: "Jornada 9",
        rival: "Padel Indoor",
        es_local: false,
        fecha_inicio: manana(),
      },
    });
    const event = (await res.json()) as { id: string };
    // El local metió 3 y nosotros 1: para nosotros es un 1–3 y una derrota.
    await request.patch(`${API_URL}/events/${event.id}/`, {
      headers: bearer(session),
      data: { resultado_local: 3, resultado_visitante: 1 },
    });

    await loginAs(page, session);
    await page.goto(`/eventos/${event.id}`);

    const cabecera = page.getByRole("article").first();
    await expect(cabecera).toBeVisible({ timeout: 20_000 });
    await expect(cabecera.getByText(/1\s*–\s*3/)).toBeVisible();
    await expect(cabecera.getByText(/^perdido$/i)).toBeVisible();
    await expect(cabecera.getByText(/^visitante$/i)).toBeVisible();
  });

  test("un entrenamiento no tiene marcador: manda el título", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "marc-entreno");
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(session),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "Entrenamiento de volea",
        fecha_inicio: manana(),
      },
    });
    const event = (await res.json()) as { id: string };

    await loginAs(page, session);
    await page.goto(`/eventos/${event.id}`);

    const cabecera = page.getByRole("article").first();
    await expect(
      cabecera.getByRole("heading", { name: "Entrenamiento de volea" }),
    ).toBeVisible({ timeout: 20_000 });
    // El antetítulo es el tipo, no el título otra vez.
    await expect(cabecera.getByText("Entrenamiento", { exact: true })).toBeVisible();
    await expect(cabecera.getByText(/^vs$/i)).toHaveCount(0);
  });

  test("un título largo no se mete debajo de la rueda en el móvil", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "marc-largo");
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(session),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "Entreno pinares - Rey de pista - Los niños",
        fecha_inicio: manana(),
      },
    });
    const event = (await res.json()) as { id: string };

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, session);
    await page.goto(`/eventos/${event.id}`);

    const titulo = page.getByRole("heading", { name: /Entreno pinares/ });
    const rueda = page.getByRole("button", { name: /ajustes del evento/i });
    await expect(titulo).toBeVisible({ timeout: 20_000 });
    await expect(rueda).toBeVisible();

    const r = (await rueda.boundingBox())!;
    // Se mide el texto, línea a línea, y no la caja del título: esa ocupa
    // todo el ancho y tocaría la rueda aunque las letras no lo hagan.
    const lineas = await titulo.evaluate((h1) => {
      const rango = document.createRange();
      rango.selectNodeContents(h1);
      return [...rango.getClientRects()].map(({ x, y, width, height }) => ({
        x,
        y,
        width,
        height,
      }));
    });
    expect(lineas.length).toBeGreaterThan(0);
    for (const t of lineas) {
      const seCruzan =
        t.x < r.x + r.width && t.x + t.width > r.x && t.y < r.y + r.height && t.y + t.height > r.y;
      expect(seCruzan).toBe(false);
    }
  });

  test("editar y borrar viven en la rueda, y no para un jugador", async ({ page, request }) => {
    const { session, team } = await seedCaptainWithTeam(request, "marc-rueda");
    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(session),
      data: {
        team_id: team.id,
        tipo: "partido",
        titulo: "Jornada 10",
        rival: "Ourensana",
        es_local: true,
        fecha_inicio: manana(),
      },
    });
    const event = (await res.json()) as { id: string };

    await loginAs(page, session);
    await page.goto(`/eventos/${event.id}`);

    const rueda = page.getByRole("button", { name: /ajustes del evento/i });
    await expect(rueda).toBeVisible({ timeout: 20_000 });
    // Ya no son dos botones sueltos bajo el título.
    await expect(page.getByRole("button", { name: /^editar$/i })).toHaveCount(0);

    await rueda.click();
    await expect(page.getByRole("menuitem", { name: /editar evento/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /borrar evento/i })).toBeVisible();
  });
});
