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

import { api } from "@/lib/api";
import type { TeamMember } from "@/lib/types";

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
  ["competition-liga"], // la liga: sus partidos y la tabla de equipos
] as const;

/** Lo que se pinta a partir de `/competitions/`. */
export const COMPETITION_QUERY_KEYS = [
  ["competitions"], // la lista del equipo
  ["competition"], // el detalle
  ["competition-standings"], // la clasificación, que depende del formato
  ["competition-liga"], // la tabla de equipos, que depende de los puntos por pista
  ["torneos"], // los torneos abiertos en otras sedes («fuera de casa»)
  ["torneo"], // uno de ellos, con sus equipos
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

/**
 * Peticiones que varias pantallas hacen a la vez con claves distintas: el
 * contador de avisos (barra lateral e Inicio, dos veces) y «mis equipos»
 * (Inicio, Mi equipo y el equipo activo). Cada una conserva su clave —y sus
 * invalidaciones—, pero si coinciden en el tiempo comparten una sola llamada
 * en vuelo. Sin `staleTime`: nunca devuelve algo más viejo que antes.
 */
export function compartida<T>(qc: QueryClient, clave: readonly unknown[], pedir: () => Promise<T>) {
  return qc.fetchQuery({ queryKey: ["compartida", ...clave], queryFn: pedir, staleTime: 0 });
}

/** `/notifications/badge/`: los contadores de la barra y de Inicio. */
export function pedirContadores(qc: QueryClient, userId: string | undefined) {
  return compartida(qc, ["badge", userId], () =>
    api.get<{ total: number; invitations: number; notifications: number }>("/notifications/badge/"),
  );
}

/** Mis pertenencias activas: Inicio, Mi equipo y el equipo activo. */
export function pedirMisEquipos(qc: QueryClient, userId: string | undefined) {
  return compartida(qc, ["mine", userId], () =>
    api.get<TeamMember[]>("/team-members/", { mine: 1, status: "activo" }),
  );
}
