import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Verifica que las acciones y endpoints no permitidos para Capitán o Jugador
 * devuelven 403/401 (o redirect en rutas de UI) y NO modifican datos.
 */

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const ANON_KEY =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  process.env["VITE_SUPABASE_ANON_KEY"] ??
  process.env["SUPABASE_PUBLISHABLE_KEY"] ??
  "";

function session(): { access_token: string; user: { id: string } } | null {
  const raw = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function authHeaders(token: string) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function count(api: APIRequestContext, table: string, query: string, token: string) {
  const res = await api.get(`${SUPABASE_URL}/rest/v1/${table}?${query}&select=id`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return -1;
  return ((await res.json()) as unknown[]).length;
}

async function restoreSession(page: Page): Promise<boolean> {
  const storageKey = process.env["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"];
  const sessionJson = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
  if (!storageKey || !sessionJson) return false;
  await page.goto("/");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, sessionJson] as const,
  );
  return true;
}

test.describe("Rutas privadas sin sesión", () => {
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

  for (const route of PRIVATE) {
    test(`${route} redirige a /auth sin sesión`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth/);
    });
  }
});

test.describe("Escrituras no permitidas por RLS", () => {
  test.skip(
    !SUPABASE_URL || !ANON_KEY || !session(),
    "Faltan credenciales o sesión inyectada en el entorno",
  );

  test("un usuario anónimo no puede leer ni escribir datos privados", async ({ request }) => {
    const res = await request.get(`${SUPABASE_URL}/rest/v1/notifications?select=id`, {
      headers: { apikey: ANON_KEY },
    });
    // Sin sesión: o bien 401/403, o bien lista vacía por RLS.
    if (res.ok()) {
      expect(await res.json()).toEqual([]);
    } else {
      expect([401, 403]).toContain(res.status());
    }

    const write = await request.post(`${SUPABASE_URL}/rest/v1/notifications`, {
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      data: { user_id: "00000000-0000-0000-0000-000000000000", tipo: "test", titulo: "hack" },
    });
    expect(write.ok()).toBeFalsy();
    expect([401, 403, 400, 404, 409, 422, 42501]).toContain(write.status());
  });

  test("no se pueden crear notificaciones para otros usuarios", async ({ request }) => {
    const s = session()!;
    const other = "00000000-0000-0000-0000-000000000000";
    const before = await count(request, "notifications", `user_id=eq.${other}`, s.access_token);

    const res = await request.post(`${SUPABASE_URL}/rest/v1/notifications`, {
      headers: authHeaders(s.access_token),
      data: { user_id: other, tipo: "test", titulo: "spoof" },
    });
    expect(res.ok(), "insertar notificaciones debe estar prohibido").toBeFalsy();
    expect([401, 403]).toContain(res.status());

    const after = await count(request, "notifications", `user_id=eq.${other}`, s.access_token);
    expect(after).toBe(before);
  });

  test("no se pueden borrar notificaciones ajenas", async ({ request }) => {
    const s = session()!;
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/notifications?user_id=neq.${s.user.id}`,
      { headers: { ...authHeaders(s.access_token), Prefer: "return=representation" } },
    );
    // RLS: o falla, o no afecta a ninguna fila.
    if (res.ok()) {
      expect(await res.json()).toEqual([]);
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test("no se pueden crear eventos en equipos ajenos", async ({ request }) => {
    const s = session()!;
    const fakeTeam = "00000000-0000-0000-0000-000000000000";
    const res = await request.post(`${SUPABASE_URL}/rest/v1/events`, {
      headers: authHeaders(s.access_token),
      data: {
        team_id: fakeTeam,
        tipo: "entrenamiento",
        titulo: "no permitido",
        fecha_inicio: new Date().toISOString(),
        created_by: s.user.id,
      },
    });
    expect(res.ok()).toBeFalsy();
    expect(await count(request, "events", `team_id=eq.${fakeTeam}`, s.access_token)).toBeLessThanOrEqual(0);
  });

  test("no se pueden alterar equipos ajenos ni auto-asignarse roles", async ({ request }) => {
    const s = session()!;
    const fakeTeam = "00000000-0000-0000-0000-000000000000";

    const team = await request.patch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${fakeTeam}`, {
      headers: { ...authHeaders(s.access_token), Prefer: "return=representation" },
      data: { nombre: "hackeado" },
    });
    if (team.ok()) expect(await team.json()).toEqual([]);
    else expect([401, 403]).toContain(team.status());

    const role = await request.post(`${SUPABASE_URL}/rest/v1/user_roles`, {
      headers: authHeaders(s.access_token),
      data: { user_id: s.user.id, role: "admin" },
    });
    expect(role.ok(), "no debe poder concederse el rol admin").toBeFalsy();
    expect([401, 403]).toContain(role.status());
  });

  test("no se pueden gestionar competiciones oficiales sin rol admin", async ({ request, page }) => {
    const s = session()!;
    const res = await request.post(`${SUPABASE_URL}/rest/v1/official_competitions`, {
      headers: authHeaders(s.access_token),
      data: { code: "E2E", nombre: "E2E test" },
    });

    const restored = await restoreSession(page);
    if (restored) {
      await page.goto("/admin/competiciones");
      await page.waitForLoadState("networkidle");
      const isAdmin =
        (await page.getByRole("button", { name: /nueva competición/i }).count()) > 0;
      if (!isAdmin) {
        expect(res.ok()).toBeFalsy();
        expect([401, 403]).toContain(res.status());
      }
    }

    // Limpieza si la cuenta sí era admin.
    if (res.ok()) {
      await request.delete(`${SUPABASE_URL}/rest/v1/official_competitions?code=eq.E2E`, {
        headers: authHeaders(s.access_token),
      });
    }
  });
});
