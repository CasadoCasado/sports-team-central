/**
 * La alineación de un partido en texto, para pegarla en el grupo del equipo
 * (WhatsApp, Telegram): los asteriscos son negrita allí. La usan el tablero
 * normal y el PRO, así que los dos copian exactamente lo mismo.
 */

import { format } from "date-fns";
import { enUS, es as esLocale } from "date-fns/locale";
import type { TFunction } from "i18next";

type Evento = {
  titulo: string;
  rival?: string | null;
  fecha_inicio: string;
  ubicacion?: string | null;
};

/** Nombre y primer apellido: basta para no confundir a dos del mismo nombre. */
export function nombreParaCompartir(
  p: { nombre: string; apellidos?: string | null } | null | undefined,
) {
  return p ? `${p.nombre} ${p.apellidos?.split(" ")[0] ?? ""}`.trim() : "?";
}

/**
 * `parejas`: los nombres de cada pista, en orden de pista. Las vacías no
 * salen; a la que le falta uno se le dice.
 */
export function textoAlineacion(
  event: Evento,
  parejas: { pista: number; nombres: string[] }[],
  t: TFunction,
  idioma: string,
): string {
  const locale = idioma.startsWith("en") ? enUS : esLocale;
  const titulo = event.rival ? `${event.titulo} vs ${event.rival}` : event.titulo;
  const cuando = [
    format(new Date(event.fecha_inicio), "EEE d LLL · HH:mm", { locale }),
    event.ubicacion,
  ]
    .filter(Boolean)
    .join(" · ");
  const lineas = parejas.flatMap(({ pista, nombres: [a, b] }) => {
    if (!a) return [];
    const quienes = b
      ? t("quimica.compartirPareja", { a, b })
      : t("quimica.compartirFaltaPareja", { a });
    return [`*${t("callups.pista")} ${pista}:* ${quienes}`];
  });
  return `🎾 *${titulo}*\n${cuando}\n\n${lineas.join("\n")}`;
}
