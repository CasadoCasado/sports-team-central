/**
 * Configuración de Vite de la web.
 *
 * Hasta octubre de 2026 la ponía `@lovable.dev/vite-tanstack-config`; al dejar
 * Lovable (C13) se escribió aquí lo mismo que hacía aquel paquete fuera de su
 * sandbox, en el mismo orden, para que la compilación salga igual:
 *
 * - plugins: Tailwind, los alias de `tsconfig.json`, TanStack Start (con la
 *   protección que impide importar código de servidor en el navegador), Nitro
 *   solo al compilar (para Cloudflare Workers) y React;
 * - las variables `VITE_*` también en el código del servidor;
 * - el alias `@` a `src/`, una sola copia de React y de React Query, y el
 *   servidor de desarrollo en el puerto 8080.
 *
 * Lo que solo servía dentro de Lovable (su vista previa, sus registros de
 * errores, las variables de Supabase) no se ha traído.
 */
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, type Plugin, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * `VITE_API_URL` se hornea en el bundle en tiempo de compilación.
 *
 * Si falta, `src/lib/auth.ts` deduce la API del mismo host en el puerto 8000.
 * En desarrollo es justo lo que se quiere; en Cloudflare Workers ese host no
 * existe, así que la app se despliega "bien", carga, y no llama a ninguna
 * parte. Es un fallo silencioso y caro de diagnosticar, así que aquí se
 * convierte en un error de compilación.
 *
 * Para compilar en local sin definirla (probar el bundle de producción, por
 * ejemplo): `TEAMSUP_ALLOW_NO_API_URL=1 npm run build`.
 */
function requireApiUrl(): Plugin {
  return {
    name: "teamsup:require-api-url",
    apply: "build",
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      const apiUrl = env["VITE_API_URL"] || process.env["VITE_API_URL"];
      const optOut = env["TEAMSUP_ALLOW_NO_API_URL"] || process.env["TEAMSUP_ALLOW_NO_API_URL"];
      if (apiUrl || optOut) return;
      throw new Error(
        "Falta VITE_API_URL: sin ella la app compilada no sabe a qué API llamar.\n" +
          "  En el despliegue:  VITE_API_URL=https://api.teamsup.es/api\n" +
          "  Solo para probar:  TEAMSUP_ALLOW_NO_API_URL=1 npm run build",
      );
    },
  };
}

/**
 * El service worker sale de la compilación del navegador, y solo de esa.
 *
 * La compilación tiene tres pasadas (navegador, SSR y servidor de Nitro) y el
 * plugin de la PWA se metía en las tres. Además apuntaba a `dist/client`, que
 * no es la carpeta que se despliega: el navegador se compila en
 * `.output/public`. Resultado: `sw.js` no llegaba a Cloudflare —ni app
 * instalable ni notificaciones push— y el que se generaba no precargaba nada,
 * porque buscaba los ficheros en una carpeta vacía.
 *
 * El plugin solo ve la carpeta general (`dist`), no la de cada pasada, así que
 * la del navegador se le da a mano; `comprobarCarpetaDelNavegador` rompe la
 * compilación si Nitro la cambia algún día.
 */
const CARPETA_DEL_NAVEGADOR = ".output/public";

function soloEnElCliente(plugins: PluginOption[]): Plugin[] {
  return (plugins.flat() as Plugin[]).map((plugin) => ({
    ...plugin,
    applyToEnvironment: (entorno) => entorno.name === "client",
  }));
}

function comprobarCarpetaDelNavegador(): Plugin {
  return {
    name: "teamsup:carpeta-del-navegador",
    apply: "build",
    configResolved(config) {
      const real = config.environments["client"]?.build.outDir;
      if (real && resolve(config.root, real) !== resolve(config.root, CARPETA_DEL_NAVEGADOR)) {
        throw new Error(
          `El navegador se compila en ${real} y el service worker va a ${CARPETA_DEL_NAVEGADOR}: ` +
            "cambia CARPETA_DEL_NAVEGADOR en vite.config.ts.",
        );
      }
    },
  };
}

/** Las `VITE_*` también en el código del servidor (SSR y el Worker). */
function variablesVite(mode: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(loadEnv(mode, process.cwd(), "VITE_")).map(([clave, valor]) => [
      `import.meta.env.${clave}`,
      JSON.stringify(valor),
    ]),
  );
}

export default defineConfig(({ command, mode }) => ({
  define: variablesVite(mode),
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "::",
    port: 8080,
    // Esperar a que el editor termine de escribir antes de recargar.
    watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Lo de `server/` y `server-only` no puede acabar en el navegador.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // La entrada del servidor es src/server.ts (envuelve los errores de SSR).
      server: { entry: "server" },
    }),
    // Cloudflare Workers, salvo que NITRO_PRESET diga otra cosa.
    command === "build" && nitro({ defaultPreset: "cloudflare-module" }),
    viteReact(),
    requireApiUrl(),
    comprobarCarpetaDelNavegador(),
    ...soloEnElCliente(
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        // Registration happens only through src/lib/register-sw.ts (guarded wrapper).
        injectRegister: null,
        devOptions: { enabled: false },
        // We ship our own public/manifest.webmanifest.
        manifest: false,
        filename: "sw.js",
        outDir: CARPETA_DEL_NAVEGADOR,
        includeAssets: ["favicon.png", "icon-512.png", "manifest.webmanifest"],
        workbox: {
          // Keeps web-push handling inside the single service worker registration.
          importScripts: ["/sw-push.js"],
          globPatterns: ["**/*.{js,css,woff2,png,svg,ico}"],
          globIgnores: ["**/sw-push.js", "**/_server/**"],
          navigateFallback: undefined,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // HTML navigations must never be served cache-first.
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "teamsup-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ url }: { url: URL }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: {
                cacheName: "teamsup-fonts",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ),
  ],
}));
