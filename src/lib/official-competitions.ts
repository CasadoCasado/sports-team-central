/**
 * El catálogo de competiciones oficiales y las inscripciones de los equipos.
 *
 * Son consultas compartidas por varias pantallas, así que viven aquí como
 * objetos de consulta de react-query listos para pasarle a `useQuery`.
 */

import { api } from "@/lib/api";
import type {
  CompetitionRegistration,
  OfficialCompetition,
  OfficialCompetitionItem,
  RegistrationStatus,
} from "@/lib/types";

export type { OfficialCompetition, RegistrationStatus };
export type CatalogItem = OfficialCompetitionItem;
export type TeamRegistration = CompetitionRegistration;

/** Estados que cuentan como "inscripción abierta o activa". */
export const OPEN_REGISTRATION_STATUSES: RegistrationStatus[] = ["abierta", "activa"];

/** Catálogo completo, incluidas las inactivas: es el de la pantalla de administración. */
export const adminCompetitionsQuery = {
  queryKey: ["official-competitions-admin"],
  queryFn: () => api.get<OfficialCompetition[]>("/official-competitions/", { order: "orden" }),
};

export const competitionsCatalogQuery = {
  queryKey: ["official-competitions"],
  queryFn: () =>
    api.get<OfficialCompetition[]>("/official-competitions/", {
      activa: true,
      order: "orden",
    }),
};

export const categoriesCatalogQuery = {
  queryKey: ["official-competition-categories"],
  queryFn: () => api.get<CatalogItem[]>("/official-categories/", { order: "orden" }),
};

export const divisionsCatalogQuery = {
  queryKey: ["official-competition-divisions"],
  queryFn: () => api.get<CatalogItem[]>("/official-divisions/", { order: "orden" }),
};

export function teamRegistrationsQuery(teamId: string | undefined) {
  return {
    queryKey: ["competition-registrations", teamId],
    enabled: !!teamId,
    queryFn: () =>
      api.get<TeamRegistration[]>("/competition-registrations/", {
        team_id: teamId,
        order: "-registered_at",
      }),
  };
}

/**
 * Inscripciones abiertas o activas de cualquier equipo.
 *
 * Es lo único del dominio que se ve fuera del propio equipo: sirve para saber
 * quién compite en qué, en la pantalla de descubrimiento.
 */
export function openRegistrationsQuery(opts: {
  competitionId?: string;
  categoryId?: string;
  enabled?: boolean;
}) {
  return {
    queryKey: ["open-registrations", opts.competitionId ?? "all", opts.categoryId ?? "all"],
    enabled: opts.enabled ?? true,
    queryFn: () =>
      api.get<TeamRegistration[]>("/competition-registrations/", {
        open: 1,
        status__in: OPEN_REGISTRATION_STATUSES,
        competition_id: opts.competitionId,
        category_id: opts.categoryId,
      }),
  };
}
