/**
 * Interruptores de las partes de la web que todavía no están abiertas.
 *
 * Guardar fotos y documentos de los equipos obliga a tener una plataforma de
 * almacenamiento decidida (hoy todo acabaría en el `MEDIA_ROOT` del servidor,
 * que no aguanta el volumen ni sobrevive a un redespliegue). Hasta que esa
 * decisión esté tomada, la galería y los documentos se ven y se descargan,
 * pero no admiten subidas nuevas: la web se queda en lo que ya sostiene sin
 * depender de nadie —el equipo, el calendario y los partidos que se monten—.
 *
 * Para reabrir una sección basta con arrancar con su variable a `"true"`; no
 * hace falta tocar código:
 *
 *   VITE_ENABLE_GALLERY_UPLOADS=true npm run dev
 */
const enabled = (v: unknown) => v === "true";

export const FEATURES = {
  galleryUploads: enabled(import.meta.env.VITE_ENABLE_GALLERY_UPLOADS),
  documentUploads: enabled(import.meta.env.VITE_ENABLE_DOCUMENT_UPLOADS),
  /**
   * El escudo del equipo y la foto de perfil.
   *
   * Apagado, no se puede subir ninguna de las dos **y tampoco se enseñan las
   * que ya estuvieran guardadas**: en su hueco va siempre el mismo dibujo, el
   * escudo para un equipo y las iniciales para una persona. Las dos cosas van
   * juntas a propósito: dejar de poder cambiarlas pero seguir enseñando una
   * imagen vieja que no carga es el peor de los dos mundos, y es justo de
   * donde se viene.
   *
   * La API sigue aceptándolas, igual que con la galería y los documentos: lo
   * que está cerrado es la pantalla, no el servidor.
   */
  images: enabled(import.meta.env.VITE_ENABLE_IMAGES),
} as const;

/** Las secciones cuya subida está pausada salen marcadas en el menú. */
export const UNDER_MAINTENANCE: Record<string, boolean> = {
  "/galeria": !FEATURES.galleryUploads,
  "/documentos": !FEATURES.documentUploads,
};
