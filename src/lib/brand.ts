/**
 * El logotipo de la marca.
 *
 * Antes venía de `src/assets/teamup-logo.png.asset.json`, que no era una imagen
 * sino un puntero al CDN de Lovable (`/__l5e/assets-v1/…`). Fuera de su
 * infraestructura esa ruta devuelve 404 y el logo salía roto en todas las
 * pantallas.
 *
 * Se usa el PNG que el propio repo ya sirve desde `public/`. Es el de 512 px y
 * no el favicon de 64 porque el logo se pinta hasta a 80 px, que en una
 * pantalla de densidad doble son 160 px reales: con el pequeño se vería
 * borroso. No cuesta ancho de banda extra, porque el service worker de la PWA
 * ya lo precachea de todas formas (ver `includeAssets` en vite.config.ts).
 */
export const LOGO_URL = "/icon-512.png";
