import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

const STORAGE_KEY = "vestuario:active-team";

export type ActiveTeamMembership = {
  team_id: string;
  role: "capitan" | "co_capitan" | "entrenador" | "delegado" | "jugador";
  team: {
    id: string;
    nombre: string;
    logo_url: string | null;
    owner_id: string;
  };
};

export function useActiveTeam() {
  const { user } = useSession();

  const query = useQuery({
    queryKey: ["active-team-memberships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ActiveTeamMembership[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, teams:team_id(id, nombre, logo_url, owner_id)")
        .eq("user_id", user!.id)
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        team_id: m.team_id,
        role: m.role as ActiveTeamMembership["role"],
        team: Array.isArray(m.teams) ? m.teams[0] : m.teams,
      })).filter((m) => m.team);
    },
  });

  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setActiveIdState(saved);
  }, []);

  const memberships = query.data ?? [];
  const active =
    memberships.find((m) => m.team_id === activeId) ?? memberships[0] ?? null;

  const setActiveId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveIdState(id);
  };

  const isManager =
    !!active && ["capitan", "co_capitan", "entrenador", "delegado"].includes(active.role);

  return {
    memberships,
    active,
    setActiveId,
    isManager,
    isLoading: query.isLoading,
  };
}
