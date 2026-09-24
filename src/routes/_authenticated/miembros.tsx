import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Search, UserPlus, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import type { PlayerStats, Profile, TeamInvitation, TeamMember, TeamRole } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MembersRanking } from "@/components/members-ranking";

export const Route = createFileRoute("/_authenticated/miembros")({
  head: () => ({
    meta: [
      { title: "Miembros | TeamUp" },
      {
        name: "description",
        content:
          "Gestiona los jugadores del equipo, sus roles y las solicitudes de unión pendientes.",
      },
      { property: "og:title", content: "Miembros | TeamUp" },
      {
        property: "og:description",
        content:
          "Gestiona los jugadores del equipo, sus roles y las solicitudes de unión pendientes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Miembros,
});

function Miembros() {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();

  // Load ALL teams the user belongs to (any role). Manager-only UI is gated below.
  const { data: myTeams } = useQuery({
    queryKey: ["my-teams-any-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        mine: 1,
        status: "activo",
      });
      return rows.map((r) => ({ team_id: r.team_id, role: r.role, team: r.team }));
    },
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedTeamId && myTeams && myTeams.length > 0) {
      setSelectedTeamId(myTeams[0].team_id);
    }
  }, [myTeams, selectedTeamId]);

  const { data: members } = useQuery({
    queryKey: ["team-members-list", selectedTeamId],
    enabled: !!selectedTeamId,
    queryFn: () =>
      api.get<TeamMember[]>("/team-members/", {
        team_id: selectedTeamId!,
        status: "activo",
      }),
  });

  // El balance de cada jugador: con él se pintan el podio y la tabla.
  const { data: stats } = useQuery({
    queryKey: ["team-player-stats", selectedTeamId],
    enabled: !!selectedTeamId,
    queryFn: () => api.get<PlayerStats[]>("/stats/players/", { team_id: selectedTeamId! }),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchBy, setSearchBy] = useState<"nombre" | "email">("nombre");
  const [query, setQuery] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "jugador" | "co_capitan" | "entrenador" | "delegado"
  >("jugador");
  const debounced = useDebounced(query, 300);

  const currentUserRole = myTeams?.find((mt) => mt.team_id === selectedTeamId)?.role;
  const canManageRoles = currentUserRole === "capitan";
  const isManagerOfSelected =
    !!currentUserRole &&
    ["capitan", "co_capitan", "entrenador", "delegado"].includes(currentUserRole);

  async function changeRole(memberId: string, newRole: TeamRole) {
    try {
      await api.patch(`/team-members/${memberId}/`, { role: newRole });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      return;
    }
    toast.success(t("members.roleUpdated"));
    qc.invalidateQueries({ queryKey: ["team-members-list"] });
  }

  async function removeMember(memberId: string) {
    try {
      await api.delete(`/team-members/${memberId}/`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      return;
    }
    toast.success(t("members.removed"));
    qc.invalidateQueries({ queryKey: ["team-members-list"] });
  }

  const { data: joinRequests } = useQuery({
    queryKey: ["team-join-requests", selectedTeamId],
    enabled: !!selectedTeamId,
    queryFn: () =>
      api.get<TeamInvitation[]>("/team-invitations/", {
        team_id: selectedTeamId!,
        es_solicitud: true,
        status: "pendiente",
      }),
  });

  async function respondRequest(invId: string, accept: boolean) {
    try {
      await api.post(`/team-invitations/${invId}/${accept ? "accept" : "reject"}/`);
      toast.success(accept ? t("notifications.accepted") : t("notifications.rejected"));
      qc.invalidateQueries({ queryKey: ["team-join-requests"] });
      qc.invalidateQueries({ queryKey: ["team-members-list"] });
      qc.invalidateQueries({ queryKey: ["join-requests"] });
      qc.invalidateQueries({ queryKey: ["shell-unread"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search", searchBy, debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      // Por email hace falta el correo completo: es la única forma de llegar a
      // alguien con quien todavía no compartes equipo.
      const rows = await api.get<Profile[]>("/profiles/", {
        search: debounced,
        limit: 20,
      });
      return rows.filter((u) => u.id !== user?.id);
    },
  });

  async function invite(userId: string) {
    if (!selectedTeamId || !user) return;
    try {
      // La notificación al invitado la escribe el servidor al crear la
      // invitación; aquí ya no hay que acordarse.
      await api.post("/team-invitations/", {
        team_id: selectedTeamId,
        invited_user_id: userId,
        role: inviteRole,
      });
      toast.success(t("members.invited"));
      qc.invalidateQueries({ queryKey: ["team-members-list"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error");
      if (msg.includes("duplicate")) {
        toast.error(t("members.pending"));
      } else {
        toast.error(msg);
      }
    }
  }

  if (!myTeams || myTeams.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
          <Users className="size-10 text-muted-foreground" />
          <h2 className="text-display text-xl font-bold">{t("members.empty")}</h2>
          <p className="text-sm text-muted-foreground">{t("team.noTeamJugador")}</p>
        </div>
      </div>
    );
  }

  const selectedTeam = myTeams.find((mt) => mt.team_id === selectedTeamId)?.team;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
            {t("members.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[selectedTeam?.nombre, t("members.count", { count: members?.length ?? 0 })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {myTeams.length > 1 && (
            <select
              value={selectedTeamId ?? ""}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              aria-label={t("team.switchTeam")}
              className="min-h-10 min-w-0 max-w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {myTeams.map((mt) => (
                <option key={mt.team_id} value={mt.team_id}>
                  {mt.team?.nombre}
                </option>
              ))}
            </select>
          )}
          {isManagerOfSelected && (
            <Button
              onClick={() => setInviteOpen((v) => !v)}
              aria-expanded={inviteOpen}
              className="min-h-10 bg-primary text-2xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"
            >
              <UserPlus className="mr-1.5 size-4" aria-hidden="true" />
              {t("members.invite")}
            </Button>
          )}
        </div>
      </div>

      {/* Las solicitudes, arriba: al final de la página pasaban desapercibidas. */}
      {canManageRoles && (joinRequests?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/[0.06]">
          <h2 className="px-4 pb-1 pt-3 text-2xs font-bold uppercase tracking-widest text-primary">
            {t("members.joinRequests", { defaultValue: "Solicitudes de unión" })} (
            {joinRequests!.length})
          </h2>
          <div className="divide-y divide-primary/15">
            {joinRequests!.map((req) => {
              const p = req.invited_user_profile;
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(p?.nombre?.[0] ?? "") + (p?.apellidos?.[0] ?? "")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold break-words">
                        {p?.nombre} {p?.apellidos}
                      </p>
                      <EmailCell email={p?.email} />
                      {req.mensaje && (
                        <p className="mt-1 text-xs text-muted-foreground italic">"{req.mensaje}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => respondRequest(req.id, true)}
                      className="flex-1 bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90 sm:flex-none"
                    >
                      <Check className="mr-1 size-3.5" />
                      {t("notifications.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={() => respondRequest(req.id, false)}
                    >
                      <X className="mr-1 size-3.5" />
                      {t("notifications.reject")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search — only managers can invite */}
      {isManagerOfSelected && inviteOpen && (
        <div className="surface-card p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-display text-xl font-bold">
              <UserPlus className="mr-2 inline size-5 text-primary" />
              {t("members.search")}
            </h2>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("common.close")}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
            <span className="text-muted-foreground">{t("members.searchBy")}:</span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={searchBy === "nombre"}
                onChange={() => setSearchBy("nombre")}
                className="accent-primary"
              />
              {t("members.byName")}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={searchBy === "email"}
                onChange={() => setSearchBy("email")}
                className="accent-primary"
              />
              {t("members.byEmail")}
            </label>
            <div className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
              <span className="shrink-0 text-muted-foreground">{t("members.inviteAs")}:</span>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value as "jugador" | "co_capitan" | "entrenador" | "delegado",
                  )
                }
                className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs sm:flex-none"
              >
                <option value="jugador">{t("roles.jugador")}</option>
                <option value="entrenador">{t("roles.entrenador")}</option>
                <option value="delegado">{t("roles.delegado")}</option>
                {canManageRoles && <option value="co_capitan">{t("roles.co_capitan")}</option>}
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder={t("common.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="mt-4 space-y-2">
            {debounced.length < 2 && (
              <p className="text-xs text-muted-foreground">{t("members.typeToSearch")}</p>
            )}
            {isFetching && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
            {results?.length === 0 && debounced.length >= 2 && !isFetching && (
              <p className="text-xs text-muted-foreground">{t("members.noResults")}</p>
            )}
            {(results ?? []).map((r) => (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-background/50 p-3 sm:flex",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border">
                  {(r.nombre?.[0] ?? "") + (r.apellidos?.[0] ?? "")}
                </div>
                <div className="min-w-0 sm:flex-1">
                  <p className="text-sm font-medium break-words">
                    {r.nombre} {r.apellidos}
                  </p>
                  <EmailCell email={r.email} />
                </div>
                <Button
                  size="sm"
                  onClick={() => invite(r.id)}
                  className="col-span-2 w-full bg-primary text-primary-foreground uppercase tracking-widest text-2xs font-bold hover:opacity-90 sm:col-auto sm:w-auto"
                >
                  {t("members.sendInvite")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hasta tener los dos, nada: con la plantilla sin el balance, asomaría un
          instante el estado de «aún no hay partidos». */}
      {!members || !stats ? null : members.length === 0 ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">
          {t("members.empty")}
        </div>
      ) : (
        <MembersRanking
          members={members}
          stats={stats}
          currentUserId={user?.id}
          canManage={canManageRoles}
          onChangeRole={changeRole}
          onRemove={removeMember}
        />
      )}
    </div>
  );
}

/**
 * El correo de un usuario, cortado con «…» cuando no cabe en su columna.
 *
 * Los correos no llevan espacios, así que sin `truncate` ensanchan la fila
 * entera y sacan los controles fuera de la tarjeta.
 *
 * Para leerlo completo hay dos caminos porque hay dos tipos de dispositivo: en
 * escritorio, el tooltip nativo del `title`; en el móvil, donde no existe el
 * hover, tocarlo lo despliega. `break-all` es lo que parte un correo largo en
 * varias líneas en vez de dejarlo desbordar otra vez al expandirse.
 */
function EmailCell({ email }: { email: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  if (!email) return null;
  return (
    <button
      type="button"
      title={email}
      onClick={() => setExpanded((open) => !open)}
      className={cn(
        "block max-w-full py-1 text-left text-xs text-muted-foreground",
        expanded ? "break-all" : "truncate",
      )}
    >
      {email}
    </button>
  );
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
