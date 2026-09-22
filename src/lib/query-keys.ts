/**
 * Qué se queda viejo cuando cambia un evento o una competición.
 *
 * `invalidateQueries` compara **por prefijo**: `["events"]` alcanza a
 * `["events", teamId, "entrenamiento"]`, pero no a `["event", id]` ni a
 * `["dash-upcoming", …]`. Diez pantallas leen eventos y solo cuatro usan una
 * clave que empiece por `events`, así que invalidar solo esa dejaba el resto
 * con datos viejos.
 *
 * Y no se arregla solo con el tiempo: el `QueryClient` tiene `staleTime` de un
 * minuto (ver `router.tsx`), así que durante ese minuto ni siquiera cambiar de
 * pantalla vuelve a pedir nada. De ahí que hubiera que recargar a mano.
 *
 * La lista está aquí, en un sitio, para que al añadir una pantalla que lea
 * eventos se vea dónde apuntarla.
 */

import type { QueryClient } from "@tanstack/react-query";

/** Todo lo que se pinta a partir de `/events/`. */
export const EVENT_QUERY_KEYS = [
  ["events"], // listas por equipo: calendario, entrenamientos, enfrentamientos
  ["event"], // el detalle de un evento
  ["callup-detail"], // el evento dentro del diálogo de convocatoria
  ["stats-events"], // estadísticas
  ["results"], // resultados
  ["dash-upcoming"], // inicio: lo que viene
  ["dash-open-callups"], // inicio: convocatorias abiertas
  ["upcoming-callup-events"], // convocatorias
  ["competition-trainings"], // los entrenos de una competición
  ["competition-standings"], // su clasificación, que sale de esos entrenos
] as const;

/** Lo que se pinta a partir de `/competitions/`. */
export const COMPETITION_QUERY_KEYS = [
  ["competitions"], // la lista del equipo
  ["competition"], // el detalle
  ["competition-standings"], // la clasificación, que depende del formato
] as const;

function invalidateAll(qc: QueryClient, keys: readonly (readonly string[])[]) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })));
}

/** Tras crear, editar o borrar un evento. */
export function invalidateEventQueries(qc: QueryClient) {
  return invalidateAll(qc, EVENT_QUERY_KEYS);
}

/**
 * Tras crear, editar, borrar o finalizar una competición.
 *
 * Arrastra también lo de los eventos: cambiar el formato de una competición
 * cambia lo que sus entrenamientos piden por pantalla.
 */
export function invalidateCompetitionQueries(qc: QueryClient) {
  return invalidateAll(qc, [...COMPETITION_QUERY_KEYS, ...EVENT_QUERY_KEYS]);
}
