/**
 * Los errores que devuelve el servidor al subir una imagen, en castellano.
 *
 * Viajan como códigos —`image_too_large`— y no como frases, para que el idioma
 * lo ponga quien pinta la pantalla y no el servidor.
 */
export function traducirErrorDeImagen(mensaje: string, t: (key: string) => string): string {
  if (mensaje.includes("image_too_large")) return t("images.errSize");
  if (mensaje.includes("image_type_not_allowed")) return t("images.errType");
  return mensaje || t("common.error");
}
