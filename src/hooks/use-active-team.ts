import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
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

export function useActiveTeam() {
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["active-team-memberships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ActiveTeamMembership[]> => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        mine: 1,
        status: "activo",
      });
      return rows
        .filter((m) => m.team)
        .map((m) => ({ team_id: m.team_id, role: m.role, team: m.team }));
    },
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
