import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RegistrationStatus = Database["public"]["Enums"]["registration_status"];

export type OfficialCompetition = {
  id: string;
  code: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  reglas?: string | null;
  inscripciones_abiertas?: boolean;
  temporada_actual?: string | null;
  orden?: number;
};

const COMPETITION_SELECT =
  "id, code, nombre, descripcion, activa, reglas, inscripciones_abiertas, temporada_actual, orden";

/** Catálogo completo (incluidas inactivas) para la pantalla de administración. */
export const adminCompetitionsQuery = {
  queryKey: ["official-competitions-admin"],
  queryFn: async (): Promise<OfficialCompetition[]> => {
    const { data, error } = await supabase
      .from("official_competitions")
      .select(COMPETITION_SELECT)
      .order("orden");
    if (error) throw error;
    return (data ?? []) as OfficialCompetition[];
  },
};

export type CatalogItem = {
  id: string;
  competition_id: string;
  code: string;
  nombre: string;
  orden: number;
};

export type TeamRegistration = {
  id: string;
  team_id: string;
  competition_id: string;
  category_id: string;
  division_id: string;
  temporada: string | null;
  status: RegistrationStatus;
  registered_at: string;
  official_competitions: { id: string; code: string; nombre: string } | null;
  official_competition_categories: { id: string; code: string; nombre: string } | null;
  official_competition_divisions: { id: string; code: string; nombre: string } | null;
};

/** Estados que cuentan como "inscripción abierta o activa". */
export const OPEN_REGISTRATION_STATUSES: RegistrationStatus[] = ["abierta", "activa"];

export const competitionsCatalogQuery = {
  queryKey: ["official-competitions"],
  queryFn: async (): Promise<OfficialCompetition[]> => {
    const { data, error } = await supabase
      .from("official_competitions")
      .select(COMPETITION_SELECT)
      .eq("activa", true)
      .order("orden");
    if (error) throw error;
    return (data ?? []) as OfficialCompetition[];
  },
};

export const categoriesCatalogQuery = {
  queryKey: ["official-competition-categories"],
  queryFn: async (): Promise<CatalogItem[]> => {
    const { data, error } = await supabase
      .from("official_competition_categories")
      .select("id, competition_id, code, nombre, orden")
      .order("orden");
    if (error) throw error;
    return data ?? [];
  },
};

export const divisionsCatalogQuery = {
  queryKey: ["official-competition-divisions"],
  queryFn: async (): Promise<CatalogItem[]> => {
    const { data, error } = await supabase
      .from("official_competition_divisions")
      .select("id, competition_id, code, nombre, orden")
      .order("orden");
    if (error) throw error;
    return data ?? [];
  },
};

const REGISTRATION_SELECT =
  "id, team_id, competition_id, category_id, division_id, temporada, status, registered_at, official_competitions(id, code, nombre), official_competition_categories(id, code, nombre), official_competition_divisions(id, code, nombre)";

export function teamRegistrationsQuery(teamId: string | undefined) {
  return {
    queryKey: ["competition-registrations", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<TeamRegistration[]> => {
      const { data, error } = await supabase
        .from("competition_registrations")
        .select(REGISTRATION_SELECT)
        .eq("team_id", teamId!)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TeamRegistration[];
    },
  };
}

/** Inscripciones abiertas/activas, opcionalmente filtradas por competición y categoría. */
export function openRegistrationsQuery(opts: {
  competitionId?: string;
  categoryId?: string;
  enabled?: boolean;
}) {
  return {
    queryKey: ["open-registrations", opts.competitionId ?? "all", opts.categoryId ?? "all"],
    enabled: opts.enabled ?? true,
    queryFn: async (): Promise<TeamRegistration[]> => {
      let query = supabase
        .from("competition_registrations")
        .select(REGISTRATION_SELECT)
        .in("status", OPEN_REGISTRATION_STATUSES);
      if (opts.competitionId) query = query.eq("competition_id", opts.competitionId);
      if (opts.categoryId) query = query.eq("category_id", opts.categoryId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as TeamRegistration[];
    },
  };
}
