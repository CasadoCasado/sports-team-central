/**
 * Invitados: gente de fuera que viene a jugar un entreno. No son del equipo,
 * así que no salen en la lista de miembros: se sacan de los apuntados al
 * entreno. Ver `apps.teams.models.Invitado` en el backend.
 */

import type { EventResponse, Profile } from "@/lib/types";

/** «Pablo "Pablete"» para un invitado; «Nombre Apellidos» para el resto. */
export function nombreVisible(profile: Profile | null | undefined): string {
  if (!profile) return "—";
  if (profile.es_invitado) {
    return profile.apodo ? `${profile.nombre} «${profile.apodo}»` : profile.nombre;
  }
  return `${profile.nombre} ${profile.apellidos}`.trim();
}

/** Los invitados apuntados a un entreno, con su nombre para mostrar. */
export function invitadosApuntados(responses: EventResponse[] | undefined) {
  return (responses ?? [])
    .filter((r) => r.profile?.es_invitado && r.status !== "rechazado")
    .map((r) => ({
      user_id: r.user_id,
      nombre: nombreVisible(r.profile),
      signedUp: true,
      invitado: true,
    }));
}
