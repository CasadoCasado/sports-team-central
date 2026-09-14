// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv, type Plugin } from "vite";

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
 * ejemplo): `TEAMUP_ALLOW_NO_API_URL=1 npm run build`.
 */
function requireApiUrl(): Plugin {
  return {
    name: "teamup:require-api-url",
    apply: "build",
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      const apiUrl = env["VITE_API_URL"] || process.env["VITE_API_URL"];
      const optOut = env["TEAMUP_ALLOW_NO_API_URL"] || process.env["TEAMUP_ALLOW_NO_API_URL"];
      if (apiUrl || optOut) return;
      throw new Error(
        "Falta VITE_API_URL: sin ella la app compilada no sabe a qué API llamar.\n" +
          "  En el despliegue:  VITE_API_URL=https://teamup-api.onrender.com/api\n" +
          "  Solo para probar:  TEAMUP_ALLOW_NO_API_URL=1 npm run build",
      );
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      requireApiUrl(),
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        // Registration happens only through src/lib/register-sw.ts (guarded wrapper).
        injectRegister: null,
        devOptions: { enabled: false },
        // We ship our own public/manifest.webmanifest.
        manifest: false,
        filename: "sw.js",
        outDir: "dist/client",
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
                cacheName: "teamup-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ url }: { url: URL }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: {
                cacheName: "teamup-fonts",
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
