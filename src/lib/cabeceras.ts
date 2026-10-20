/**
 * Las cabeceras de seguridad de cada página que sirve el Worker (`server.ts`).
 *
 * La importante es la CSP: si alguna vez se cuela HTML ajeno en una página
 * (un nombre de equipo mal escapado, una librería comprometida), el navegador
 * no ejecuta ningún script que no hayamos puesto nosotros, ni manda datos a
 * ninguna parte que no sea la API o Sentry.
 *
 * Los scripts van con `nonce`: un valor al azar distinto en cada petición que
 * llevan los `<script>` del HTML (TanStack se lo pone a los suyos con
 * `ssr.nonce`, en `router.tsx`). Con `'strict-dynamic'`, lo que esos scripts
 * cargan después —los trozos de la app, Turnstile, Sentry— también vale.
 *
 * Solo en producción: Vite, en desarrollo, mete scripts sin nonce para
 * recargar en caliente. Las demás cabeceras van siempre.
 */

/** La cabecera interna con la que `server.ts` le pasa el nonce al router. */
export const CABECERA_NONCE = "x-teamsup-nonce";

export function nuevoNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** El origen (`https://host`) de una URL, o nada si no es una URL. */
function origen(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

type Entorno = {
  apiUrl?: string;
  sentryDsn?: string;
  produccion: boolean;
};

export function politicaDeContenido(nonce: string, entorno: Entorno): string {
  const api = origen(entorno.apiUrl);
  // El DSN es https://clave@o123.ingest.de.sentry.io/456; los errores van a ese host.
  const sentry = origen(entorno.sentryDsn);
  const directivas: Record<string, (string | null)[]> = {
    "default-src": ["'self'"],
    "script-src": [
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Para navegadores sin `strict-dynamic`, que ignoran lo de arriba.
      "'self'",
      "https://challenges.cloudflare.com",
    ],
    // Los `style={…}` de React y de Radix son estilos en línea.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    // Las fotos llegan de la API en local y del bucket de R2 en producción,
    // con un dominio que aún no está decidido.
    "img-src": ["'self'", "data:", "blob:", "https:", api],
    "connect-src": ["'self'", api, sentry],
    // El reto de Turnstile va en un iframe de Cloudflare.
    "frame-src": ["https://challenges.cloudflare.com"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // Nadie puede meter la app en un iframe (para engañar a quien hace clic).
    "frame-ancestors": ["'none'"],
  };
  const partes = Object.entries(directivas).map(([nombre, valores]) =>
    [nombre, ...new Set(valores.filter(Boolean))].join(" "),
  );
  if (entorno.produccion) partes.push("upgrade-insecure-requests");
  return partes.join("; ");
}

/** Las que no dependen de la página: van en todas las respuestas. */
export const CABECERAS_FIJAS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  // Fuera, solo el dominio: las direcciones de restablecer la contraseña y
  // de las invitaciones llevan secretos.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** HTTPS obligatorio durante un año; solo tiene sentido servido por HTTPS. */
export const HSTS = "max-age=31536000";

export function conCabeceras(
  respuesta: Response,
  nonce: string | null,
  entorno: Entorno,
): Response {
  // Las respuestas de `fetch` pueden traer las cabeceras inmutables.
  const salida = new Response(respuesta.body, respuesta);
  for (const [nombre, valor] of Object.entries(CABECERAS_FIJAS)) {
    salida.headers.set(nombre, valor);
  }
  if (entorno.produccion) {
    salida.headers.set("Strict-Transport-Security", HSTS);
    const html = salida.headers.get("content-type")?.includes("text/html");
    if (html && nonce) {
      salida.headers.set("Content-Security-Policy", politicaDeContenido(nonce, entorno));
    }
  }
  return salida;
}
