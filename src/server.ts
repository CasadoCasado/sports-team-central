import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { CABECERA_NONCE, conCabeceras, nuevoNonce } from "./lib/cabeceras";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const ENTORNO = {
  apiUrl: import.meta.env.VITE_API_URL as string | undefined,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  produccion: import.meta.env.PROD,
};

/**
 * Las páginas se piden con GET: solo ahí hace falta nonce. Se le pasa al
 * router en una cabecera de la petición, puesta aquí siempre (`set`, no
 * `append`), así que la que pudiera mandar el navegador no cuenta.
 */
function conNonce(request: Request): [Request, string | null] {
  if (request.method !== "GET") return [request, null];
  const nonce = nuevoNonce();
  const headers = new Headers(request.headers);
  headers.set(CABECERA_NONCE, nonce);
  // Desde la URL y no copiando `request`: en desarrollo es de otra clase que
  // el `Request` de aquí y no se deja copiar. Un GET no lleva cuerpo.
  return [new Request(request.url, { method: "GET", headers, signal: request.signal }), nonce];
}

export default {
  async fetch(original: Request, env: unknown, ctx: unknown) {
    const [request, nonce] = conNonce(original);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return conCabeceras(await normalizeCatastrophicSsrResponse(response), nonce, ENTORNO);
    } catch (error) {
      console.error(error);
      const response = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
      return conCabeceras(response, nonce, ENTORNO);
    }
  },
};
