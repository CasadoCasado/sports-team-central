/**
 * Cliente de la API de Django.
 *
 * Sustituye a las consultas PostgREST que hacía `supabase.from(...)`. Los
 * filtros que allí eran `.eq()`, `.in()`, `.gte()`, `.order()` y `.limit()`
 * viajan ahora como parámetros de consulta con el mismo nombre:
 *
 *     supabase.from("events").select("*").eq("team_id", id).order("fecha_inicio")
 *     api.get("/events/", { team_id: id, order: "fecha_inicio" })
 */

import { API_URL, getAccessToken, refreshAccessToken, signOut } from "./auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Saca un mensaje legible del cuerpo de error de DRF. */
async function errorMessage(res: Response): Promise<[string, unknown]> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return [body.detail, body];
    const first = Object.entries(body ?? {})[0];
    if (first) {
      const [field, value] = first;
      const text = Array.isArray(value) ? String(value[0]) : String(value);
      return [field === "non_field_errors" ? text : `${field}: ${text}`, body];
    }
    return [res.statusText || `Error ${res.status}`, body];
  } catch {
    return [res.statusText || `Error ${res.status}`, undefined];
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | (string | number)[]
>;

/** Construye la cadena de consulta, omitiendo lo vacío y uniendo las listas. */
export function toQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function send(path: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // FormData trae su propio Content-Type con el separador; ponerlo a mano lo
  // rompería.
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init, getAccessToken());

  // Un 401 casi siempre es el token de acceso caducado: se renueva y se
  // reintenta una vez. Si la renovación tampoco vale, se cierra la sesión.
  if (res.status === 401 && getAccessToken()) {
    const token = await refreshAccessToken();
    if (!token) {
      signOut();
      throw new ApiError(401, "La sesión ha caducado");
    }
    res = await send(path, init, token);
  }

  if (!res.ok) {
    const [message, body] = await errorMessage(res);
    throw new ApiError(res.status, message, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>(`${path}${toQuery(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? "{}" : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
  /** Subida de ficheros: el cuerpo es `multipart/form-data`. */
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};

/**
 * La dirección de una imagen subida, lista para un `<img src>`.
 *
 * El servidor guarda la ruta —`/media/team-logos/...`— y no una URL entera, a
 * propósito: con el host dentro, un escudo subido desde `localhost` deja de
 * verse en cuanto abres la web desde el móvil por la IP de la red, porque esa
 * URL apunta al `localhost` del móvil. La resolución se hace aquí, contra la
 * API que esta pestaña esté usando, que es la que sirve los ficheros.
 *
 * Si ya viene absoluta —un bucket S3— se devuelve tal cual.
 */
export function mediaUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.includes("://")) return value;
  try {
    return new URL(value, API_URL).toString();
  } catch {
    return undefined;
  }
}
