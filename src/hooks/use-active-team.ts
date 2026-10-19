import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { pedirMisEquipos } from "@/lib/query-keys";
import { MANAGER_ROLES, type TeamMember, type TeamRole } from "@/lib/types";

const STORAGE_KEY = "vestuario:active-team";

export type ActiveTeamMembership = {
  team_id: string;
  role: TeamRole;
  team: TeamMember["team"];
};

/**
 * El equipo elegido, compartido por toda la pantalla.
 *
 * Antes esto era un `useState` dentro del hook, y como el hook se llama en
 * varios sitios a la vez —el selector de equipo y la página que pinta sus
 * datos son componentes distintos— cada uno tenía su propia copia. Cambiar de
 * equipo actualizaba el selector y nada más: la página seguía enseñando el
 * equipo anterior hasta recargar.
 *
 * Con `useSyncExternalStore` el valor vive fuera de React, en una sola
 * variable, y todos los que lo leen se enteran del cambio. Además arregla la
 * hidratación: el servidor no tiene `localStorage`, así que devuelve null y
 * React se encarga de la segunda pasada.
 */
const listeners = new Set<() => void>();

function leer(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Ventana privada o almacenamiento bloqueado: se trabaja sin recordar.
    return null;
  }
}

function suscribir(fn: () => void) {
  listeners.add(fn);
  // Y si se cambia de equipo en otra pestaña, esta se entera también.
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

/** Cambia el equipo elegido desde cualquier sitio, aviso incluido. */
export function setActiveTeamId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Sin almacenamiento no se recuerda entre visitas, pero sí en esta.
  }
  listeners.forEach((fn) => fn());
}

function aPertenencias(filas: TeamMember[]): ActiveTeamMembership[] {
  return filas
    .filter((m) => m.team)
    .map((m) => ({ team_id: m.team_id, role: m.role, team: m.team }));
}

async function misPertenencias(qc: QueryClient, userId: string | undefined) {
  return aPertenencias(await pedirMisEquipos(qc, userId));
}

/**
 * Trae los equipos de quien acaba de entrar antes de ir a la app y los deja
 * donde los buscan Inicio (`my-teams`) y el equipo activo: así Inicio aparece
 * ya con su equipo, sin volver a pedirlos. Es una sola petición. Ver
 * «Preparando tu equipo…» en `routes/auth.tsx`.
 */
export async function prepararEquipos(qc: QueryClient, userId: string) {
  const filas = await pedirMisEquipos(qc, userId);
  qc.setQueryData(["my-teams", userId], filas);
  qc.setQueryData(["active-team-memberships", userId], aPertenencias(filas));
}

export function useActiveTeam() {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["active-team-memberships", user?.id],
    enabled: !!user,
    queryFn: () => misPertenencias(qc, user?.id),
  });

  const activeId = useSyncExternalStore(suscribir, leer, () => null);

  const memberships = query.data ?? [];
  const active = memberships.find((m) => m.team_id === activeId) ?? memberships[0] ?? null;
  const isManager = !!active && MANAGER_ROLES.includes(active.role);

  return {
    memberships,
    active,
    setActiveId: setActiveTeamId,
    isManager,
    isLoading: query.isLoading,
  };
}
