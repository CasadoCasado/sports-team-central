import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Competition } from "@/lib/types";

/**
 * Qué clasificación se mira en Miembros: los enfrentamientos, los entrenos o
 * una competición (`c:<id>`).
 */
export type Vista = "partidos" | "entrenos" | `c:${string}`;

export type OpcionVista = {
  vista: Vista;
  /** Solo en las competiciones: su nombre y si ya está cerrada. */
  competition?: Competition;
};

type Disponibles = { partidos: boolean; entrenos: boolean; competiciones: string[] };

/**
 * Las clasificaciones que se pueden elegir: solo las que ya tienen algún
 * resultado. Una opción que sale vacía no sirve de nada, así que un equipo
 * sin partidos no tiene selector, y uno con un solo tipo tampoco: se enseña
 * ese directamente.
 *
 * Cuáles tienen algo lo dice el servidor de una vez (`/stats/rankings/`), con
 * el mismo cálculo que luego pinta cada clasificación. Las competiciones van
 * en el orden de su pantalla, de la más reciente a la más antigua.
 */
export function useVistasClasificacion(teamId: string | null) {
  const disponibles = useQuery({
    queryKey: ["ranking-views", teamId],
    enabled: !!teamId,
    queryFn: () => api.get<Disponibles>("/stats/rankings/", { team_id: teamId! }),
  });
  const competitions = useQuery({
    queryKey: ["team-competitions", teamId],
    enabled: !!teamId,
    queryFn: () =>
      api.get<Competition[]>("/competitions/", { team_id: teamId!, order: "-created_at" }),
  });

  const d = disponibles.data;
  const opciones: OpcionVista[] = [];
  if (d?.partidos) opciones.push({ vista: "partidos" });
  if (d?.entrenos) opciones.push({ vista: "entrenos" });
  for (const c of competitions.data ?? []) {
    if (d?.competiciones.includes(c.id)) opciones.push({ vista: `c:${c.id}`, competition: c });
  }

  return { opciones, isLoading: disponibles.isLoading || competitions.isLoading };
}
