import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { CABECERA_NONCE } from "./lib/cabeceras";
import { migrarClavesLocales } from "./lib/claves-locales";
import { routeTree } from "./routeTree.gen";

/**
 * El nonce de la CSP para los scripts de esta página (ver `lib/cabeceras.ts`).
 * En el navegador lo lee TanStack de `<meta property="csp-nonce">`.
 */
const nonceDeLaPeticion = createIsomorphicFn()
  .server(() => getRequestHeader(CABECERA_NONCE) || undefined)
  .client(() => undefined);

export const getRouter = () => {
  // Antes de que nada lea del navegador (tema, guía, barra…): las claves del
  // nombre viejo pasan al nuevo. En el servidor no hace nada.
  migrarClavesLocales();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    ssr: { nonce: nonceDeLaPeticion() },
  });

  return router;
};
