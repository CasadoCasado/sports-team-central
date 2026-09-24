/**
 * Utilidades para los tests end-to-end.
 *
 * Antes la sesión se inyectaba desde variables de entorno con un token de
 * Supabase (`LOVABLE_BROWSER_SUPABASE_*`), así que los tests con sesión solo
 * corrían en el entorno de Lovable y aquí se saltaban siempre. Ahora se crea
 * una cuenta de verdad contra la API de Django y se guarda su token donde lo
 * busca la app, así que corren en cualquier máquina con los dos servidores
 * levantados.
 */

import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:8000/api";

/** La misma clave que usa `src/lib/auth.ts` para guardar los tokens. */
const STORAGE_KEY = "teamup:auth";

export const PASSWORD = "Abrete-Sesamo-9";

export type Session = {
  access: string;
  refresh: string;
  userId: string;
  email: string;
};

/** Un correo distinto por test, para que los que corren en paralelo no choquen. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
}

/** Crea la cuenta y devuelve su sesión. */
export async function signUp(
  api: APIRequestContext,
  email: string,
  nombre = "Test",
  apellidos = "E2E",
): Promise<Session> {
  const res = await api.post(`${API_URL}/auth/register/`, {
    data: { email, password: PASSWORD, nombre, apellidos },
  });
  if (!res.ok()) {
    throw new Error(`No se pudo registrar ${email}: ${res.status()} ${await res.text()}`);
  }
  return logIn(api, email);
}

export async function logIn(api: APIRequestContext, email: string): Promise<Session> {
  const res = await api.post(`${API_URL}/auth/login/`, {
    data: { email, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`No se pudo entrar como ${email}: ${res.status()}`);
  }
  const { access, refresh } = (await res.json()) as { access: string; refresh: string };
  const me = await api.get(`${API_URL}/auth/me/`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const { id } = (await me.json()) as { id: string };
  return { access, refresh, userId: id, email };
}

export function bearer(session: Session) {
  return { Authorization: `Bearer ${session.access}`, "Content-Type": "application/json" };
}

/** Da por hecho el onboarding, para poder entrar directamente a la app. */
export async function completeOnboarding(
  api: APIRequestContext,
  session: Session,
  role: "capitan" | "jugador" = "jugador",
) {
  await api.patch(`${API_URL}/profiles/me/`, {
    headers: bearer(session),
    data: { preferred_role: role, onboarding_completed: true },
  });
}

/**
 * Deja la sesión guardada en el navegador, como si se hubiera hecho login.
 *
 * Marca además el tutorial guiado como visto: en la primera visita se abre
 * encima de todo y tapa la interfaz que los tests quieren mirar.
 *
 * Se guarda por dos vías a propósito. El `addInitScript` la reinyecta antes de
 * cada documento, y es la que de verdad aguanta: visitar "/" sin sesión
 * dispara la redirección a /auth, y si el `evaluate` cae mientras esa
 * navegación está en vuelo escribe en un documento que el navegador está a
 * punto de tirar, así que la sesión se pierde y el test acaba en la pantalla
 * de login. El `evaluate` se queda para el documento que ya está abierto,
 * porque `addInitScript` solo actúa en las cargas siguientes.
 */
export async function loginAs(page: Page, session: Session) {
  const entries = [
    [STORAGE_KEY, JSON.stringify({ access: session.access, refresh: session.refresh })],
    [`teamup:tour-done:${session.userId}`, "1"],
  ] as const;

  await page.addInitScript((pairs: readonly (readonly [string, string])[]) => {
    for (const [key, value] of pairs) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Ventana privada o almacenamiento bloqueado: el test lo dirá solo.
      }
    }
  }, entries);

  // Y se comprueba que cuajó. Contra el servidor de desarrollo, con varios
  // navegadores a la vez, una petición lenta puede acabar en 401 -> refresco
  // fallido -> `signOut()`, que vacía el almacenamiento y manda a /auth. Ahí
  // ya no vale el `addInitScript`, porque ese documento ya estaba cargado.
  // Reintentar es más barato que perseguirlo, y si no cuaja el test lo dice.
  await expect(async () => {
    await page.goto("/");
    await page.evaluate((pairs: readonly (readonly [string, string])[]) => {
      for (const [key, value] of pairs) window.localStorage.setItem(key, value);
    }, entries);
    await page.goto("/inicio");
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

/** Una capitana con equipo propio, lista para usar. */
export async function seedCaptainWithTeam(api: APIRequestContext, prefix: string) {
  const session = await signUp(api, uniqueEmail(prefix), "Marta", "Casado");
  await completeOnboarding(api, session, "capitan");
  const res = await api.post(`${API_URL}/teams/`, {
    headers: bearer(session),
    data: { nombre: `Equipo ${prefix}`, deporte: "padel", ciudad: "Vigo" },
  });
  const team = (await res.json()) as { id: string; nombre: string };
  return { session, team };
}

/** Un jugador ya dentro de un equipo existente. */
export async function seedPlayerInTeam(
  api: APIRequestContext,
  prefix: string,
  teamId: string,
  captain: Session,
  {
    nombre = "Iván",
    apellidos = "Ruiz",
    role = "jugador",
  }: { nombre?: string; apellidos?: string; role?: string } = {},
) {
  const session = await signUp(api, uniqueEmail(prefix), nombre, apellidos);
  await completeOnboarding(api, session, "jugador");
  const invite = await api.post(`${API_URL}/team-invitations/`, {
    headers: bearer(captain),
    data: { team_id: teamId, invited_user_id: session.userId, role },
  });
  const { id } = (await invite.json()) as { id: string };
  await api.post(`${API_URL}/team-invitations/${id}/accept/`, { headers: bearer(session) });
  return session;
}

/**
 * Rellena un formulario de la pantalla de acceso.
 *
 * Dos cosas hacen falta aquí y no son evidentes:
 *
 * 1. La pantalla se sirve renderizada en el servidor y en desarrollo Vite tarda
 *    un par de segundos en entregar todos los módulos. Si se escribe antes de
 *    que React hidrate, los inputs vuelven a estar vacíos al hidratar.
 * 2. `fill()` asigna el valor y lanza un evento `input`, pero con estos inputs
 *    controlados el estado de React no siempre se entera: el DOM enseña el
 *    texto y el formulario se envía vacío. Escribir tecla a tecla sí lo
 *    actualiza siempre.
 *
 * Por eso se teclea, se deja pasar un momento y se comprueba que el valor sigue
 * ahí; si la hidratación llegó en medio y lo borró, se repite.
 */
export async function fillForm(entries: [Locator, string][]) {
  await expect(async () => {
    for (const [field, value] of entries) {
      await field.click();
      await field.press("ControlOrMeta+a");
      await field.pressSequentially(value, { delay: 5 });
    }
    await entries[0][0].page().waitForTimeout(300);
    for (const [field, value] of entries) {
      await expect(field).toHaveValue(value, { timeout: 250 });
    }
  }).toPass({ timeout: 30_000 });
}
