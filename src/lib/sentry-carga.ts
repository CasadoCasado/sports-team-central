/**
 * Lo único de Sentry que usa la web, en su propio trozo.
 *
 * `errores.ts` lo carga con `import()` solo si hay DSN. Importar aquí lo justo
 * deja que el compilador quite el resto del SDK: importado entero de forma
 * dinámica pesaba unos 150 KB comprimido, porque no sabía qué se iba a usar.
 */
export { captureException, init } from "@sentry/react";
