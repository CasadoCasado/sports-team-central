import { test, expect } from "@playwright/test";

import {
  API_URL,
  bearer,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  signUp,
  uniqueEmail,
} from "./session";

/**
 * Que la API rechace lo que no toca.
 *
 * Es la traducción de las políticas RLS que protegían estas tablas en
 * Supabase: ahora que Django conecta como dueño de las tablas, lo que no
 * compruebe la vista queda abierto, así que conviene comprobarlo desde fuera.
 */

const PRIVATE = [
  "/inicio",
  "/mi-equipo",
  "/miembros",
  "/calendario",
  "/entrenamientos",
  "/enfrentamientos",
  "/convocatorias",
  "/encuestas",
  "/estadisticas",
  "/galeria",
  "/documentos",
  "/pagos",
  "/comunicaciones",
  "/notificaciones",
  "/admin/competiciones",
];

test.describe("Rutas privadas sin sesión", () => {
  for (const route of PRIVATE) {
    test(`${route} redirige a /auth sin sesión`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth/);
    });
  }
});

test.describe("La API rechaza lo que la RLS rechazaba", () => {
  test("sin token no se lee nada", async ({ request }) => {
    const res = await request.get(`${API_URL}/events/`);
    expect(res.status()).toBe(401);
  });

  test("no se ven los datos de un equipo ajeno", async ({ request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "priv-cap");
    const outsider = await signUp(request, uniqueEmail("priv-out"));

    const list = await request.get(`${API_URL}/events/?team_id=${team.id}`, {
      headers: bearer(outsider),
    });
    expect(list.status()).toBe(403);

    // Y tampoco a través de las estadísticas.
    const stats = await request.get(`${API_URL}/stats/team/?team_id=${team.id}`, {
      headers: bearer(outsider),
    });
    expect(stats.status()).toBe(403);

    // La capitana sí.
    const own = await request.get(`${API_URL}/events/?team_id=${team.id}`, {
      headers: bearer(captain),
    });
    expect(own.ok()).toBeTruthy();
  });

  test("no se pueden crear eventos en equipos ajenos", async ({ request }) => {
    const { team } = await seedCaptainWithTeam(request, "ev-cap");
    const outsider = await signUp(request, uniqueEmail("ev-out"));

    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(outsider),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "no permitido",
        fecha_inicio: new Date().toISOString(),
      },
    });
    expect(res.ok()).toBeFalsy();
    expect([403, 404]).toContain(res.status());
  });

  test("un jugador no puede crear eventos en su propio equipo", async ({ request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "evp-cap");
    const player = await seedPlayerInTeam(request, "evp-jug", team.id, captain);

    const res = await request.post(`${API_URL}/events/`, {
      headers: bearer(player),
      data: {
        team_id: team.id,
        tipo: "entrenamiento",
        titulo: "no permitido",
        fecha_inicio: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(403);
  });

  test("no se pueden alterar equipos ajenos", async ({ request }) => {
    const { team } = await seedCaptainWithTeam(request, "team-cap");
    const outsider = await signUp(request, uniqueEmail("team-out"));

    const res = await request.patch(`${API_URL}/teams/${team.id}/`, {
      headers: bearer(outsider),
      data: { nombre: "hackeado" },
    });
    expect(res.ok()).toBeFalsy();
    expect([403, 404]).toContain(res.status());
  });

  test("la bandeja de notificaciones es privada", async ({ request }) => {
    const mine = await signUp(request, uniqueEmail("notif-a"));
    const theirs = await signUp(request, uniqueEmail("notif-b"));

    // Nadie puede escribir en la bandeja de nadie: crear notificaciones es
    // cosa del servidor.
    const write = await request.post(`${API_URL}/notifications/`, {
      headers: bearer(mine),
      data: { user_id: theirs.userId, tipo: "spoof", titulo: "hack" },
    });
    expect(write.status()).toBe(405);

    const list = await request.get(`${API_URL}/notifications/`, { headers: bearer(theirs) });
    expect(await list.json()).toEqual([]);
  });

  test("no se puede uno concederse el rol de admin", async ({ request }) => {
    const user = await signUp(request, uniqueEmail("admin-try"));

    // No hay endpoint de user_roles, así que el intento directo no existe...
    const res = await request.post(`${API_URL}/official-competitions/`, {
      headers: bearer(user),
      data: { code: "E2E", nombre: "E2E" },
    });
    expect(res.status()).toBe(403);

    // ...y el propio /auth/me/ confirma que no es admin.
    const me = await request.get(`${API_URL}/auth/me/`, { headers: bearer(user) });
    expect(((await me.json()) as { is_admin: boolean }).is_admin).toBe(false);
  });

  test("no se lee el chat de un equipo al que no perteneces", async ({ request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "chat-cap");
    const outsider = await signUp(request, uniqueEmail("chat-out"));

    const channel = await request.post(`${API_URL}/chat-channels/`, {
      headers: bearer(captain),
      data: { team_id: team.id, nombre: "General", scope: "general" },
    });
    const { id } = (await channel.json()) as { id: string };

    const res = await request.get(`${API_URL}/chat-messages/?channel_id=${id}`, {
      headers: bearer(outsider),
    });
    expect(res.status()).toBe(404);
  });

  test("un jugador no ve el canal de staff", async ({ request }) => {
    const { session: captain, team } = await seedCaptainWithTeam(request, "staff-cap");
    const player = await seedPlayerInTeam(request, "staff-jug", team.id, captain);

    await request.post(`${API_URL}/chat-channels/`, {
      headers: bearer(captain),
      data: { team_id: team.id, nombre: "Staff", scope: "staff" },
    });

    const asPlayer = await request.get(`${API_URL}/chat-channels/?team_id=${team.id}`, {
      headers: bearer(player),
    });
    const visible = (await asPlayer.json()) as { scope: string }[];
    expect(visible.map((c) => c.scope)).not.toContain("staff");

    const asCaptain = await request.get(`${API_URL}/chat-channels/?team_id=${team.id}`, {
      headers: bearer(captain),
    });
    expect(((await asCaptain.json()) as { scope: string }[]).map((c) => c.scope)).toContain(
      "staff",
    );
  });
});
