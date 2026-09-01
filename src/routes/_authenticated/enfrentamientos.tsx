import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Check, Swords, MapPin, Plus, Users, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import type { EventResponse, Team, TeamMember } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { EventFormDialog } from "@/components/event-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/enfrentamientos")({
  head: () => ({
    meta: [
      { title: "Enfrentamientos | TeamUp" },
      { name: "description", content: "Organiza los enfrentamientos del equipo, pistas de pádel y jugadores convocados." },
      { property: "og:title", content: "Enfrentamientos | TeamUp" },
      { property: "og:description", content: "Organiza los enfrentamientos del equipo, pistas de pádel y jugadores convocados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Matches,
});

type MatchEvent = {
  id: string;
  titulo: string;
  fecha_inicio: string;
  ubicacion: string | null;
  rival: string | null;
  es_local: boolean | null;
  padel_num_pistas: number | null;
};

function Matches() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { user } = useSession();
  const { active, isManager } = useActiveTeam();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const now = useMemo(() => new Date().toISOString(), []);

  const { data: team } = useQuery({
    queryKey: ["team-sport", active?.team_id],
    enabled: !!active,
    queryFn: () => api.get<Team>(`/teams/${active!.team_id}/`),
  });
  const isPadel = team?.deporte === "padel";

  const { data } = useQuery({
    queryKey: ["events", active?.team_id, "partido"],
    enabled: !!active,
    queryFn: () =>
      api.get<MatchEvent[]>("/events/", {
        team_id: active!.team_id,
        tipo: "partido",
        order: "fecha_inicio",
      }),
  });

  const eventIds = (data ?? []).map((e) => e.id);
  const { data: responses } = useQuery({
    queryKey: ["match-responses", active?.team_id, eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: () =>
      api.get<EventResponse[]>("/event-responses/", { event_id__in: eventIds }),
  });

  const { data: members } = useQuery({
    queryKey: ["team-members-full", active?.team_id],
    enabled: !!active,
    queryFn: async () => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        team_id: active!.team_id,
        status: "activo",
      });
      return rows.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        profile: m.profile,
      }));
    },
  });

  const respByEvent = useMemo(() => {
    const m = new Map<string, typeof responses>();
    (responses ?? []).forEach((r) => {
      const arr = m.get(r.event_id) ?? [];
      arr.push(r);
      m.set(r.event_id, arr);
    });
    return m;
  }, [responses]);

  const signUp = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) return;
      await api.post("/event-responses/respond/", {
        event_id: eventId,
        status: "confirmado",
      });
    },
    onSuccess: () => {
      toast.success(t("callups.signedUp"));
      qc.invalidateQueries({ queryKey: ["match-responses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: (respId: string) => api.delete(`/event-responses/${respId}/`),
    onSuccess: () => {
      toast.success(t("callups.withdrawn"));
      qc.invalidateQueries({ queryKey: ["match-responses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePistas = useMutation({
    mutationFn: ({ eventId, num }: { eventId: string; num: number | null }) =>
      api.patch(`/events/${eventId}/`, { padel_num_pistas: num }),
    onSuccess: () => {
      toast.success(t("events.updated"));
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignCourt = useMutation({
    mutationFn: async ({ id, pista }: { id: string; pista: number | null }) => {
      const patch: { padel_pista: number | null; es_convocado?: boolean } = {
        padel_pista: pista,
      };
      // Asignar pista implica convocar.
      if (pista != null) patch.es_convocado = true;
      await api.patch(`/event-responses/${id}/`, patch);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match-responses"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!active) return <EmptyTeamState />;

  const upcoming = (data ?? []).filter((e) => e.fecha_inicio >= now);
  const past = (data ?? []).filter((e) => e.fecha_inicio < now).reverse();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
            {t("nav.enfrentamientos")}
          </h1>
          <div className="mt-1"><TeamPicker /></div>
        </div>
        {isManager && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            <Plus className="mr-1 size-4" />
            {t("events.create")}
          </Button>
        )}
      </div>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("events.upcoming")}
        </div>
        {upcoming.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("events.empty")}</p>
        )}
        <div className="divide-y divide-border">
          {upcoming.map((e) => {
            const resps = respByEvent.get(e.id) ?? [];
            const myResp = resps.find((r) => r.user_id === user?.id);
            const count = resps.length;
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className="p-4">
                <div className="flex items-center gap-4">
                  <Link
                    to="/eventos/$id"
                    params={{ id: e.id }}
                    className="flex flex-1 min-w-0 items-center gap-4"
                  >
                    <div className="flex size-10 items-center justify-center rounded-md bg-red-400/10 text-red-300 ring-1 ring-red-400/30">
                      <Swords className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {e.titulo}
                        {e.rival && (
                          <span className="text-muted-foreground"> · vs {e.rival}</span>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xxs text-muted-foreground">
                        <span>{format(new Date(e.fecha_inicio), "PPP HH:mm", { locale })}</span>
                        {e.ubicacion && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="size-3" /> {e.ubicacion}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" /> {count}
                        </span>
                      </div>
                    </div>
                  </Link>
                  {myResp ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => withdraw.mutate(myResp.id)}
                      className="uppercase text-2xs font-bold tracking-widest"
                    >
                      <Check className="mr-1 size-3" /> {t("callups.withdraw")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => signUp.mutate(e.id)}
                      className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                    >
                      {t("callups.signUp")}
                    </Button>
                  )}
                  {isPadel && isManager && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpanded(isOpen ? null : e.id)}
                      className="uppercase text-2xs font-bold tracking-widest"
                    >
                      {isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      <span className="ml-1">{t("callups.padelAssign")}</span>
                    </Button>
                  )}
                </div>

                {isPadel && isManager && isOpen && (
                  <PadelCourtsPanel
                    event={e}
                    responses={resps}
                    members={members ?? []}
                    onUpdatePistas={(num) => updatePistas.mutate({ eventId: e.id, num })}
                    onAssign={(id, pista) => assignCourt.mutate({ id, pista })}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {past.length > 0 && (
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("events.past")}
          </div>
          <div className="divide-y divide-border">
            {past.map((e) => (
              <Link
                key={e.id}
                to="/eventos/$id"
                params={{ id: e.id }}
                className="flex items-center gap-4 p-4 opacity-70 hover:bg-card hover:opacity-100"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-card ring-1 ring-border">
                  <Swords className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {e.titulo}
                    {e.rival && <span className="text-muted-foreground"> · vs {e.rival}</span>}
                  </p>
                  <p className="text-xxs text-muted-foreground">
                    {format(new Date(e.fecha_inicio), "PPP", { locale })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <EventFormDialog
          open={creating}
          onOpenChange={setCreating}
          teamId={active.team_id}
          initial={{ tipo: "partido" }}
        />
      )}
    </div>
  );
}

function PadelCourtsPanel({
  event,
  responses,
  members,
  onUpdatePistas,
  onAssign,
}: {
  event: MatchEvent;
  responses: Array<{
    id: string;
    user_id: string;
    es_convocado: boolean | null;
    padel_pista: number | null;
  }>;
  members: Array<{ user_id: string; profile: { nombre: string; apellidos: string } | null }>;
  onUpdatePistas: (num: number | null) => void;
  onAssign: (respId: string, pista: number | null) => void;
}) {
  const { t } = useTranslation();
  const [pistasDraft, setPistasDraft] = useState<string>(
    event.padel_num_pistas ? String(event.padel_num_pistas) : "",
  );
  const numPistas = event.padel_num_pistas ?? 0;

  const nameFor = (uid: string) => {
    const m = members.find((x) => x.user_id === uid);
    return m?.profile ? `${m.profile.nombre} ${m.profile.apellidos}` : "?";
  };

  return (
    <div className="mt-4 rounded-md border border-border bg-card/40 p-4">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("events.padelPistas")}
          </label>
          <Input
            type="number"
            min={1}
            max={20}
            value={pistasDraft}
            onChange={(ev) => setPistasDraft(ev.target.value)}
            className="mt-1 w-32"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onUpdatePistas(pistasDraft ? Number(pistasDraft) : null)}
          className="uppercase text-2xs font-bold tracking-widest"
        >
          {t("common.save")}
        </Button>
        <p className="ml-auto text-xxs text-muted-foreground">
          {responses.length} {t("callups.signedUpList").toLowerCase()}
        </p>
      </div>

      {numPistas === 0 && (
        <p className="text-xs text-muted-foreground">{t("events.padelPistasHint")}</p>
      )}

      {numPistas > 0 && (
        <div className="space-y-2">
          {Array.from({ length: numPistas }).map((_, i) => {
            const pistaNum = i + 1;
            const assigned = responses.filter((r) => r.padel_pista === pistaNum);
            const isFull = assigned.length >= 2;
            const available = responses.filter((r) => r.padel_pista == null);
            return (
              <div key={pistaNum} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between text-2xs font-bold uppercase tracking-widest">
                  <span>{t("callups.pista")} {pistaNum}</span>
                  <span className={cn(isFull ? "text-primary" : "text-muted-foreground")}>
                    {assigned.length}/2
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {assigned.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs"
                    >
                      <span>{nameFor(r.user_id)}</span>
                      <button
                        onClick={() => onAssign(r.id, null)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t("common.remove")}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {!isFull && available.length > 0 && (
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      value=""
                      onChange={(ev) => {
                        if (!ev.target.value) return;
                        onAssign(ev.target.value, pistaNum);
                      }}
                    >
                      <option value="">+ {t("callups.addPlayer")}</option>
                      {available.map((r) => (
                        <option key={r.id} value={r.id}>
                          {nameFor(r.user_id)}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isFull && available.length === 0 && (
                    <span className="text-xxs text-muted-foreground">
                      {t("callups.noSignedUp")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
