/**
 * Sesión del usuario contra la API de Django.
 *
 * Sustituye a `supabase.auth`. Guarda el par de tokens JWT, renueva el de
 * acceso cuando caduca y avisa a quien esté suscrito cuando la sesión cambia,
 * que es lo que hacía `onAuthStateChange`.
 *
 * Los tokens viven en `localStorage`: la app es una SPA con SSR desactivado en
 * las rutas autenticadas, así que el servidor nunca los necesita.
 */

const STORAGE_KEY = "teamup:auth";

export type Tokens = { access: string; refresh: string };

export type Profile = {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  avatar_url: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  ciudad: string | null;
  descripcion: string | null;
  deporte: string | null;
  posicion: string | null;
  nivel: string | null;
  mano_dominante: string | null;
  preferred_role: "capitan" | "jugador" | null;
  idioma: string;
  onboarding_completed: boolean;
  reminder_hours: number[];
};

export type AuthUser = {
  id: string;
  email: string;
  profile: Profile;
  is_admin: boolean;
};

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "TOKEN_REFRESHED";

/** Puerto en el que escucha la API en desarrollo. */
const API_PORT = 8000;

/**
 * Dónde vive la API cuando no se ha configurado `VITE_API_URL`.
 *
 * Se deduce del propio navegador en vez de fijar "localhost", porque el
 * frontend se ejecuta en el dispositivo de quien mira: abriendo la app desde el
 * móvil, "localhost" sería el móvil y no habría API a la que llamar. Usando el
 * mismo host desde el que se sirvió la página, funciona igual en el portátil
 * (`localhost:8080`) que en el móvil (`192.168.1.x:8080`) sin tocar nada.
 */
function defaultApiUrl(): string {
  // Durante el render en servidor no hay `window`, pero tampoco se llama a la
  // API desde ahí: todas las peticiones salen del navegador.
  if (typeof window === "undefined") return `http://localhost:${API_PORT}/api`;
  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
}

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || defaultApiUrl();

let tokens: Tokens | null = null;
let cachedUser: AuthUser | null = null;
let loaded = false;

const listeners = new Set<(event: AuthEvent) => void>();

function emit(event: AuthEvent) {
  for (const listener of listeners) listener(event);
}

function load(): Tokens | null {
  if (loaded) return tokens;
  loaded = true;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tokens = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

function store(next: Tokens | null) {
  tokens = next;
  loaded = true;
  if (typeof window === "undefined") return;
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else localStorage.removeItem(STORAGE_KEY);
}

export function getTokens(): Tokens | null {
  return load();
}

export function getAccessToken(): string | null {
  return load()?.access ?? null;
}

/** True si hay tokens guardados; no garantiza que sigan siendo válidos. */
export function hasSession(): boolean {
  return !!load();
}

export function onAuthStateChange(listener: (event: AuthEvent) => void) {
  listeners.add(listener);
  return { unsubscribe: () => listeners.delete(listener) };
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new AuthError(res.status, data);
  return data;
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(messageFrom(status, body));
    this.name = "AuthError";
  }
}

function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    const first = Object.entries(record)[0];
    if (first) {
      const [field, value] = first;
      const text = Array.isArray(value) ? String(value[0]) : String(value);
      return field === "non_field_errors" ? text : `${field}: ${text}`;
    }
  }
  return status === 401 ? "Credenciales incorrectas" : `Error ${status}`;
}

/**
 * Renovación del token de acceso.
 *
 * Se guarda la promesa en curso para que varias peticiones que fallen con 401
 * a la vez compartan una sola renovación en lugar de lanzar una cada una.
 */
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  const current = load();
  if (!current?.refresh) return Promise.resolve(null);

  refreshing = post("/auth/refresh/", { refresh: current.refresh })
    .then((data: { access: string; refresh?: string }) => {
      store({ access: data.access, refresh: data.refresh ?? current.refresh });
      emit("TOKEN_REFRESHED");
      return data.access;
    })
    .catch(() => {
      // El refresh también ha caducado: la sesión se acabó.
      store(null);
      cachedUser = null;
      emit("SIGNED_OUT");
      return null;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

export async function signInWithPassword(email: string, password: string) {
  const data = (await post("/auth/login/", { email, password })) as Tokens;
  store({ access: data.access, refresh: data.refresh });
  cachedUser = null;
  emit("SIGNED_IN");
  return data;
}

export async function signUp(input: {
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
}) {
  await post("/auth/register/", input);
  // El alta no devuelve tokens: se entra con las mismas credenciales.
  return signInWithPassword(input.email, input.password);
}

export function signOut() {
  store(null);
  cachedUser = null;
  emit("SIGNED_OUT");
}

/**
 * El usuario actual, con su perfil.
 *
 * Antes hacían falta dos llamadas —`auth.getUser()` y una consulta a
 * `profiles`—; ahora `/auth/me/` devuelve las dos cosas.
 */
export async function fetchUser(force = false): Promise<AuthUser | null> {
  if (!load()) return null;
  if (cachedUser && !force) return cachedUser;

  const { api } = await import("./api");
  try {
    cachedUser = await api.get<AuthUser>("/auth/me/");
    return cachedUser;
  } catch {
    return null;
  }
}

/** Olvida el usuario cacheado; la próxima lectura vuelve a pedirlo. */
export function invalidateUser() {
  cachedUser = null;
  emit("USER_UPDATED");
}

export function getCachedUser(): AuthUser | null {
  return cachedUser;
}
