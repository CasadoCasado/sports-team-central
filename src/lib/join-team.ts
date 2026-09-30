/**
 * Entrar en un equipo con el enlace que manda un gestor (`/unirse/$codigo`).
 *
 * Lo usan la propia página del enlace y la de acceso, que después de crear la
 * cuenta o de entrar mete al usuario en el equipo sin pasar por ningún paso
 * más.
 */

import { api } from "./api";
import { fetchUser, invalidateUser } from "./auth";
import { setActiveTeamId } from "@/hooks/use-active-team";

/** Lo que enseña el enlace antes de unirse, también sin sesión. */
export type JoinPreview = {
  id: string | null;
  nombre: string;
  logo_url: string | null;
  deporte: string | null;
  ciudad: string | null;
  member_count: number;
  invita: string | null;
  ya_miembro: boolean;
};

export function getJoinPreview(codigo: string) {
  return api.get<JoinPreview>(`/unirse/${encodeURIComponent(codigo)}/`);
}

export async function joinTeamByCode(codigo: string) {
  const team = await api.post<{ id: string; nombre: string; nuevo: boolean }>(
    `/unirse/${encodeURIComponent(codigo)}/`,
  );

  // Quien llega por un enlace ya sabe a qué viene: jugar en ese equipo. La
  // pregunta del onboarding («¿unirte o crear?») sobra, y sin completarla el
  // guardián de la app le mandaría allí en vez de a su equipo.
  const user = await fetchUser(true);
  if (user && !user.profile?.onboarding_completed) {
    await api.patch("/profiles/me/", { preferred_role: "jugador", onboarding_completed: true });
  }
  invalidateUser();

  // Aterriza con su equipo nuevo elegido, aunque ya fuera de otros.
  setActiveTeamId(team.id);
  return team;
}
