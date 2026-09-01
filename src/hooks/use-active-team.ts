import { useEffect, useState } from "react";
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
 * El equipo con el que se está trabajando.
 *
 * Un usuario puede estar en varios; el elegido se recuerda en el navegador y,
 * si no hay ninguno guardado, se usa el primero.
 */
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

  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setActiveIdState(saved);
  }, []);

  const memberships = query.data ?? [];
  const active = memberships.find((m) => m.team_id === activeId) ?? memberships[0] ?? null;

  const setActiveId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveIdState(id);
  };

  const isManager = !!active && MANAGER_ROLES.includes(active.role);

  return {
    memberships,
    active,
    setActiveId,
    isManager,
    isLoading: query.isLoading,
  };
}
