/**
 * Los errores de la web, hacia Sentry y sin datos de nadie.
 *
 * Solo se activa con `VITE_SENTRY_DSN` (variable de compilación, como la URL de
 * la API): sin ella no se carga nada y no sale nada. El SDK se carga aparte y
 * después de arrancar, para no engordar lo que baja cada visita.
 *
 * Lo que sale: el error, la traza, la pantalla y el navegador. Lo que no: la
 * IP, lo que se escribe, ni los secretos que viajan en las direcciones —el
 * `token` de recuperar la contraseña, los códigos de los enlaces de invitación
 * y la firma de las descargas—. El backend hace lo mismo con lo suyo
 * (`apps/core/errores.py`).
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/react";

type Sentry = typeof import("@/lib/sentry-carga");

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let cargando: Promise<Sentry | null> | null = null;

/** Las partes de una ruta que abren algo a quien las tenga. */
const SECRETOS_EN_LA_RUTA = /(\/(?:unirse|descarga)\/)[^/?#]+/g;

/** Sin query ni fragmento, y con los secretos de la ruta tapados. */
export function limpiarUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.split(/[?#]/, 1)[0].replace(SECRETOS_EN_LA_RUTA, "$1[secreto]");
}

export function limpiarEvento(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.url = limpiarUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
    // Solo el navegador: ni cookies ni referer (que lleva la URL anterior).
    const agente = event.request.headers?.["User-Agent"];
    event.request.headers = agente ? { "User-Agent": agente } : {};
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  if (event.transaction) event.transaction = limpiarUrl(event.transaction);
  event.breadcrumbs = event.breadcrumbs?.map(limpiarMiga);
  return event;
}

export function limpiarMiga(miga: Breadcrumb): Breadcrumb {
  const datos = miga.data;
  if (datos) {
    for (const clave of ["url", "from", "to"]) {
      if (typeof datos[clave] === "string") datos[clave] = limpiarUrl(datos[clave]);
    }
  }
  return miga;
}

/** Arranca Sentry si hay DSN. Se llama una vez, en el navegador. */
export function iniciarErrores() {
  if (!DSN || typeof window === "undefined" || cargando) return;
  cargando = import("@/lib/sentry-carga")
    .then((sentry) => {
      sentry.init({
        dsn: DSN,
        environment:
          (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
        // Nada de lo que recoge por defecto, que es todo: ni usuario, ni
        // cookies, ni cuerpos, ni parámetros de la URL, ni variables locales.
        // De las cabeceras, solo el navegador. (La IP no depende de esto: se
        // apaga en el proyecto, «Prevent Storing of IP Addresses».)
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: { request: { allow: ["User-Agent"] }, response: false },
          httpBodies: [],
          urlQueryParams: false,
          stackFrameVariables: false,
        },
        // Solo errores: ni rendimiento ni grabaciones de pantalla.
        tracesSampleRate: 0,
        beforeSend: limpiarEvento,
        beforeBreadcrumb: limpiarMiga,
      });
      return sentry;
    })
    .catch(() => null);
}

/** Un error que la web ha recogido ella misma (la pantalla de error, por ejemplo). */
export function reportarError(error: unknown, contexto: Record<string, unknown> = {}) {
  void cargando?.then((sentry) => sentry?.captureException(error, { extra: contexto }));
}
