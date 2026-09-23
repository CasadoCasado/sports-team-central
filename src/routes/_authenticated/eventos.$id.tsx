import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar as CalIcon,
  ClipboardList,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { invalidateEventQueries } from "@/lib/query-keys";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { EventFormDialog } from "@/components/event-form-dialog";
import { TrainingResultsSection } from "@/components/training-results-section";
import { toDateTimeLocal, eventTypeStyles, type EventType } from "@/lib/events";
import {
  courtWinner,
  simpleCourtWinner,
  tieSummary,
  validatePadelCourt,
  type SetPair,
} from "@/lib/padel-scoring";
import { cn } from "@/lib/utils";
import type {
  EventResponse,
  MatchParticipation,
  ResponseStatus,
  Team,
  TeamEvent,
  TeamMember,
} from "@/lib/types";

export const Route = createFileRoute("/_authenticated/eventos/$id")({
  head: () => ({
    meta: [
      { title: "Detalle del evento | TeamUp" },
      { name: "description", content: "Información del evento, asistentes, convocados y resultados por pista." },
      { property: "og:title", content: "Detalle del evento | TeamUp" },
      { property: "og:description", content: "Información del evento, asistentes, convocados y resultados por pista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api.get<TeamEvent>(`/events/${id}/`),
  });

  const { data: membership } = useQuery({
    queryKey: ["event-membership", event?.team_id, user?.id],
    enabled: !!event && !!user,
    queryFn: async () => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        team_id: event!.team_id,
        user_id: user!.id,
      });
      return rows[0] ?? null;
    },
  });

  const isManager = membership && ["capitan", "co_capitan", "entrenador", "delegado"].includes(membership.role);

  const del = useMutation({
    mutationFn: () => api.delete(`/events/${id}/`),
    onSuccess: async () => {
      toast.success(t("events.deleted"));
      await invalidateEventQueries(qc);
      navigate({ to: "/calendario" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (!event) return <div className="p-8 text-sm text-muted-foreground">404</div>;

  const style = eventTypeStyles[event.tipo as EventType];
  const start = new Date(event.fecha_inicio);
  const end = event.fecha_fin ? new Date(event.fecha_fin) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/calendario"
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {t("events.backToCalendar")}
      </Link>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-bold uppercase tracking-widest", style.badge)}>
                <span className={cn("size-1.5 rounded-full", style.dot)} />
                {t(`events.types.${event.tipo}`)}
              </span>
              <h1 className="text-display mt-3 text-2xl font-black tracking-tight break-words sm:text-4xl">
                {event.titulo}
              </h1>
              {event.rival && (
                <p className="text-display mt-1 text-lg text-muted-foreground">
                  vs <span className="text-foreground">{event.rival}</span>
                  {event.es_local != null && (
                    <span className="ml-2 text-2xs font-bold uppercase tracking-widest text-primary">
                      {event.es_local ? t("events.local") : t("events.visitante")}
                    </span>
                  )}
                </p>
              )}
            </div>
            {isManager && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 size-3.5" /> {t("common.edit")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(t("events.deleteConfirm"))) del.mutate();
                  }}
                >
                  <Trash2 className="mr-1 size-3.5" /> {t("common.delete")}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <InfoRow icon={<CalIcon className="size-4" />} label={t("events.fechaInicio")}>
            {format(start, "PPPP", { locale })}
          </InfoRow>
          <InfoRow icon={<Clock className="size-4" />} label={t("events.fechaFin")}>
            {format(start, "HH:mm")}{end && ` — ${format(end, "HH:mm")}`}
          </InfoRow>
          {event.ubicacion && (
            <InfoRow icon={<MapPin className="size-4" />} label={t("events.ubicacion")}>
              {event.ubicacion}
            </InfoRow>
          )}
          {event.competition_nombre && (
            <InfoRow icon={<ClipboardList className="size-4" />} label={t("events.competicion")}>
              {event.competition_nombre}
            </InfoRow>
          )}
        </div>

        {event.descripcion && (
          <div className="border-t border-border p-4 text-sm text-muted-foreground whitespace-pre-wrap sm:p-6">
            {event.descripcion}
          </div>
        )}
      </div>

      {(event.requiere_convocatoria || event.tipo === "entrenamiento") && (
        <CallupSection event={event} isManager={!!isManager} userId={user?.id ?? null} />
      )}

      {/* Un entrenamiento dentro de una competición cierra con el orden de
          sus pistas; sin competición no hay nada que contar, así que solo se
          le enseña el aviso a quien puede arreglarlo. */}
      {event.tipo === "entrenamiento" && (event.competition_id || event.formato_entreno || isManager) && (
        <TrainingResultsSection
          eventId={event.id}
          teamId={event.team_id}
          competitionId={event.competition_id}
          formatoEntreno={event.formato_entreno}
          competitionNombre={event.competition_nombre}
          startISO={event.fecha_inicio}
          isManager={!!isManager}
        />
      )}

      {event.tipo === "partido" && (
        <MatchResultsSection
          eventId={event.id}
          teamId={event.team_id}
          startISO={event.fecha_inicio}
          padelNumPistas={event.padel_num_pistas}
          esLocal={event.es_local ?? true}
          isManager={!!isManager}
        />
      )}

      {editing && (
        <EventFormDialog
          open={editing}
          onOpenChange={setEditing}
          teamId={event.team_id}
          initial={{
            id: event.id,
            tipo: event.tipo,
            titulo: event.titulo,
            descripcion: event.descripcion ?? "",
            fecha_inicio: toDateTimeLocal(event.fecha_inicio),
            fecha_fin: toDateTimeLocal(event.fecha_fin),
            ubicacion: event.ubicacion ?? "",
            rival: event.rival ?? "",
            es_local: event.es_local ?? true,
            competition_id: event.competition_id,
            requiere_convocatoria: event.requiere_convocatoria,
            convocatoria_cierra_en: toDateTimeLocal(event.convocatoria_cierra_en),
            padel_num_pistas: event.padel_num_pistas,
            formato_entreno: event.formato_entreno,
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

function CallupSection({
  event,
  isManager,
  userId,
}: {
  event: {
    id: string;
    team_id: string;
    tipo: string;
    padel_num_pistas: number | null;
  };
  isManager: boolean;
  userId: string | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const eventId = event.id;
  const teamId = event.team_id;

  const { data: team } = useQuery({
    queryKey: ["team-sport", teamId],
    queryFn: () => api.get<Team>(`/teams/${teamId}/`),
  });
  const isPadel = team?.deporte === "padel";
  const showPadelCourts = isPadel && event.tipo === "partido" && (event.padel_num_pistas ?? 0) > 0;

  const { data: members } = useQuery({
    queryKey: ["team-members-full", teamId],
    queryFn: async () => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        team_id: teamId,
        status: "activo",
      });
      return rows.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        profile: m.profile,
      }));
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["event-responses", eventId],
    queryFn: () => api.get<EventResponse[]>("/event-responses/", { event_id: eventId }),
  });

  const respByUser = useMemo(() => {
    const m = new Map<
      string,
      {
        id: string;
        status: ResponseStatus;
        notas: string | null;
        es_convocado: boolean;
        padel_pista: number | null;
      }
    >();
    (responses ?? []).forEach((r) =>
      m.set(r.user_id, {
        id: r.id,
        status: r.status as ResponseStatus,
        notas: r.notas,
        es_convocado: !!r.es_convocado,
        padel_pista: r.padel_pista,
      }),
    );
    return m;
  }, [responses]);

  const signedUp = responses ?? [];
  const convocados = signedUp.filter((r) => r.es_convocado);
  const confirmed = signedUp.filter((r) => r.status === "confirmado").length;
  const rejected = signedUp.filter((r) => r.status === "rechazado").length;
  const doubt = signedUp.filter((r) => r.status === "duda").length;

  const signUp = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await api.post("/event-responses/respond/", {
        event_id: eventId,
        status: "confirmado",
      });
    },
    onSuccess: () => {
      toast.success(t("callups.signedUp"));
      qc.invalidateQueries({ queryKey: ["event-responses", eventId] });
      qc.invalidateQueries({ queryKey: ["my-callups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const existing = respByUser.get(userId);
      if (!existing) return;
      await api.delete(`/event-responses/${existing.id}/`);
    },
    onSuccess: () => {
      toast.success(t("callups.withdrawn"));
      qc.invalidateQueries({ queryKey: ["event-responses", eventId] });
      qc.invalidateQueries({ queryKey: ["my-callups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleConvocado = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const patch: { es_convocado: boolean; padel_pista?: number | null } = {
        es_convocado: value,
      };
      // Desconvocar libera también la pista asignada.
      if (!value) patch.padel_pista = null;
      await api.patch(`/event-responses/${id}/`, patch);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-responses", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const assignCourt = useMutation({
    mutationFn: ({ id, pista }: { id: string; pista: number | null }) =>
      api.patch(`/event-responses/${id}/`, { padel_pista: pista }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-responses", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const myResp = userId ? respByUser.get(userId) : undefined;
  const isMember = !!members?.some((m) => m.user_id === userId);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h2 className="text-display text-lg font-bold uppercase tracking-tight">{t("callups.title")}</h2>
            <p className="text-xxs text-muted-foreground">
              {signedUp.length} <Users className="inline size-3" /> · {confirmed} ✓ · {rejected} ✕ · {doubt} ? · {convocados.length} ★
            </p>
          </div>
        </div>
        {userId && isMember && !myResp && (
          <Button
            onClick={() => signUp.mutate()}
            className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            {t("callups.signUp")}
          </Button>
        )}
        {userId && myResp && !isManager && (
          <Button variant="outline" onClick={() => withdraw.mutate()}>
            {t("callups.withdraw")}
          </Button>
        )}
      </div>

      {userId && myResp && (
        <div className="border-b border-border p-4 sm:p-5">
          <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("callups.myStatus")}
          </div>
          {myResp.es_convocado && (
            <p className="mt-1 text-xxs font-bold uppercase tracking-widest text-primary">
              ★ {t("callups.youAreCalled")}
              {myResp.padel_pista ? ` · ${t("callups.pista")} ${myResp.padel_pista}` : ""}
            </p>
          )}
          <PlayerResponseForm response={myResp} eventId={eventId} userId={userId} />
        </div>
      )}

      <div className="p-4 sm:p-5">
        <h3 className="mb-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("callups.signedUpList")} ({signedUp.length})
        </h3>
        {signedUp.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("callups.noSignedUp")}</p>
        )}
        {/* Nombre y estado no caben en la misma línea de un móvil: la etiqueta
            «Confirmado» mide sus buenos noventa píxeles y dejaba el nombre en
            «Alejandro Rod…» o, dentro de una tarjeta con `overflow-hidden`,
            directamente cortado por el borde. Por debajo de `sm` cada ficha
            baja el estado a su propia línea; las dos columnas esperan a `lg`,
            porque a 640 px media columna vuelve a ser demasiado estrecha. */}
        <div className="grid gap-2 lg:grid-cols-2">
          {signedUp.map((r) => {
            const m = members?.find((x) => x.user_id === r.user_id);
            const status = r.status as ResponseStatus;
            return (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md border p-3 sm:flex",
                  r.es_convocado ? "border-primary/40 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border">
                  {(m?.profile?.nombre?.[0] ?? "") + (m?.profile?.apellidos?.[0] ?? "") || "?"}
                </div>
                <div className="min-w-0 sm:flex-1">
                  <p className="text-sm font-medium break-words">
                    {m?.profile?.nombre} {m?.profile?.apellidos}
                  </p>
                  <p className="text-2xs uppercase tracking-widest text-muted-foreground">
                    {m?.role}
                  </p>
                </div>
                <div className="col-span-2 flex shrink-0 items-center justify-between gap-2 sm:col-auto sm:justify-end">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest",
                      status === "confirmado" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
                      status === "rechazado" && "border-red-500/40 bg-red-500/15 text-red-300",
                      status === "duda" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
                      status === "convocado" && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {t(`callups.response_${status}`)}
                  </span>
                  {isManager && (
                    <label className="flex min-h-9 cursor-pointer items-center gap-1 text-2xs font-bold uppercase tracking-widest">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={r.es_convocado}
                        onChange={(e) =>
                          toggleConvocado.mutate({ id: r.id, value: e.target.checked })
                        }
                      />
                      ★
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showPadelCourts && isManager && convocados.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-2xs font-bold uppercase tracking-widest text-primary">
              {t("callups.padelAssign")} ({event.padel_num_pistas} {t("callups.pistas")})
            </h3>
            <div className="space-y-2">
              {Array.from({ length: event.padel_num_pistas ?? 0 }).map((_, i) => {
                const pistaNum = i + 1;
                const assigned = convocados.filter((r) => r.padel_pista === pistaNum);
                const isFull = assigned.length >= 2;
                return (
                  <div key={pistaNum} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between text-2xs font-bold uppercase tracking-widest">
                      <span>{t("callups.pista")} {pistaNum}</span>
                      <span className={cn(isFull ? "text-primary" : "text-muted-foreground")}>
                        {assigned.length}/2
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {assigned.map((r) => {
                        const m = members?.find((x) => x.user_id === r.user_id);
                        return (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs"
                          >
                            <span>
                              {m?.profile?.nombre} {m?.profile?.apellidos?.[0]}.
                            </span>
                            <button
                              onClick={() => assignCourt.mutate({ id: r.id, pista: null })}
                              className="text-muted-foreground hover:text-foreground"
                              title={t("common.remove")}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      {!isFull && (
                        <select
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            assignCourt.mutate({ id: e.target.value, pista: pistaNum });
                          }}
                        >
                          <option value="">+ {t("callups.addPlayer")}</option>
                          {convocados
                            .filter((r) => r.padel_pista == null)
                            .map((r) => {
                              const m = members?.find((x) => x.user_id === r.user_id);
                              return (
                                <option key={r.id} value={r.id}>
                                  {m?.profile?.nombre} {m?.profile?.apellidos}
                                </option>
                              );
                            })}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerResponseForm({
  response,
  eventId,
  userId,
}: {
  response: { id: string; status: ResponseStatus; notas: string | null };
  eventId: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [notas, setNotas] = useState(response.notas ?? "");

  const respond = useMutation({
    mutationFn: (status: ResponseStatus) =>
      api.patch(`/event-responses/${response.id}/`, {
        status,
        notas: notas.trim() || null,
        responded_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success(t("callups.responseSaved"));
      qc.invalidateQueries({ queryKey: ["event-responses", eventId] });
      qc.invalidateQueries({ queryKey: ["my-callups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const btn = (status: ResponseStatus, label: string, cls: string) => (
    <button
      onClick={() => respond.mutate(status)}
      className={cn(
        "rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
        response.status === status ? cls : "border-border text-muted-foreground hover:bg-card",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {btn("confirmado", t("callups.iAccept"), "border-emerald-500/40 bg-emerald-500/15 text-emerald-300")}
        {btn("duda", t("callups.iDoubt"), "border-amber-500/40 bg-amber-500/15 text-amber-300")}
        {btn("rechazado", t("callups.iReject"), "border-red-500/40 bg-red-500/15 text-red-300")}
      </div>
      <div>
        <Label className="text-2xs uppercase tracking-widest text-muted-foreground">
          {t("callups.notas")}
        </Label>
        <div className="mt-1 flex gap-2">
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={t("callups.notasPlaceholder")}
            maxLength={300}
          />
          <Button
            variant="outline"
            onClick={() => respond.mutate(response.status)}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type MatchResultRow = {
  id?: string;
  pista: number;
  set1_local: number | null;
  set1_visitante: number | null;
  set2_local: number | null;
  set2_visitante: number | null;
  set3_local: number | null;
  set3_visitante: number | null;
};

function MatchResultsSection({
  eventId,
  teamId,
  startISO,
  padelNumPistas,
  esLocal,
  isManager,
}: {
  eventId: string;
  teamId: string;
  startISO: string;
  padelNumPistas: number | null;
  esLocal: boolean;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const hasStarted = new Date(startISO).getTime() <= Date.now();

  const { data: team } = useQuery({
    queryKey: ["team-sport", teamId],
    queryFn: () => api.get<Team>(`/teams/${teamId}/`),
  });
  const isPadel = team?.deporte === "padel";
  const courtsCount = isPadel ? Math.max(1, padelNumPistas ?? 1) : 1;

  const { data: existing } = useQuery({
    queryKey: ["match-results", eventId],
    enabled: hasStarted,
    queryFn: () =>
      api.get<MatchResultRow[]>("/match-results/", {
        event_id: eventId,
        order: "pista",
      }),
  });

  const { data: participations } = useQuery({
    queryKey: ["match-participations", eventId],
    enabled: hasStarted,
    // Cada participación trae el perfil, así que ya no hace falta pedir los
    // nombres por separado.
    queryFn: () =>
      api.get<MatchParticipation[]>("/match-participations/", {
        event_id: eventId,
        order: "pista",
      }),
  });

  const [rows, setRows] = useState<MatchResultRow[]>([]);
  useEffect(() => {
    const base: MatchResultRow[] = Array.from({ length: courtsCount }).map((_, i) => {
      const found = existing?.find((r) => r.pista === i + 1);
      return (
        found ?? {
          pista: i + 1,
          set1_local: null,
          set1_visitante: null,
          set2_local: null,
          set2_visitante: null,
          set3_local: null,
          set3_visitante: null,
        }
      );
    });
    setRows(base);
  }, [existing, courtsCount]);

  const setsOf = (r: MatchResultRow): SetPair[] => [
    { local: r.set1_local, visitante: r.set1_visitante },
    { local: r.set2_local, visitante: r.set2_visitante },
    { local: r.set3_local, visitante: r.set3_visitante },
  ];

  const winners = rows.map((r) =>
    isPadel ? courtWinner(setsOf(r)) : simpleCourtWinner(r.set1_local, r.set1_visitante),
  );
  const summary = tieSummary(winners, esLocal);

  const validate = (): string | null => {
    if (isPadel) {
      for (const r of rows) {
        const err = validatePadelCourt(r.pista, setsOf(r));
        if (err) return t(`results.err_${err.code}`, { pista: err.pista });
      }
    } else {
      for (const r of rows) {
        const a = r.set1_local;
        const b = r.set1_visitante;
        if (a == null && b == null) continue;
        if (a == null || b == null || a < 0 || b < 0) return t("results.errScore");
      }
    }
    if (rows.every((r) => setsOf(r).every((s) => s.local == null && s.visitante == null))) {
      return t("results.errNoData");
    }
    return null;
  };

  const save = useMutation({
    mutationFn: async () => {
      // Todas las pistas van en una sola petición, y el servidor recalcula el
      // marcador del evento y las participaciones dentro de la misma
      // transacción.
      await api.post("/match-results/bulk/", {
        event_id: eventId,
        results: rows.map((r) => ({
          pista: r.pista,
          set1_local: r.set1_local,
          set1_visitante: r.set1_visitante,
          set2_local: isPadel ? r.set2_local : null,
          set2_visitante: isPadel ? r.set2_visitante : null,
          set3_local: isPadel ? r.set3_local : null,
          set3_visitante: isPadel ? r.set3_visitante : null,
        })),
      });
    },
    onSuccess: async () => {
      toast.success(t("results.saved"));
      // El backend recalcula el resultado del enfrentamiento y las
      // participaciones de los convocados al guardar; refrescamos todo
      // lo que depende de ello para verlo al instante.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["match-results", eventId] }),
        qc.invalidateQueries({ queryKey: ["match-participations", eventId] }),
        qc.invalidateQueries({ queryKey: ["event-responses", eventId] }),
        qc.invalidateQueries({ queryKey: ["team-stats"] }),
        qc.invalidateQueries({ queryKey: ["player-stats"] }),
        invalidateEventQueries(qc),
      ]);
    },

    onError: (e: Error) => {
      const msg = e.message ?? "";
      if (msg.includes("padel_set_max_7")) {
        toast.error(t("results.errPadelSetMax7"));
      } else if (msg.includes("negative_set_score")) {
        toast.error(t("results.errNegativeSet"));
      } else {
        toast.error(msg || t("common.error"));
      }
    },
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSave = () => {
    setConfirmOpen(false);
    save.mutate();
  };


  if (!hasStarted) {
    return (
      <div className="surface-card p-5 text-xs text-muted-foreground">
        {t("results.notYetPlayed")}
      </div>
    );
  }

  const updateCell = (idx: number, key: keyof MatchResultRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const num = value === "" ? null : Number(value);
      next[idx] = { ...next[idx], [key]: Number.isNaN(num as number) ? null : num };
      return next;
    });
  };

  const NumInput = ({
    value,
    onChange,
    disabled,
    max = 99,
  }: {
    value: number | null;
    onChange: (v: string) => void;
    disabled?: boolean;
    max?: number;
  }) => (
    <input
      type="number"
      min={0}
      max={max}
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v !== "") {
          const n = Number(v);
          if (n > max) return;
        }
        onChange(v);
      }}
      disabled={disabled}
      className="w-full max-w-14 min-h-9 rounded-md border border-border bg-background px-1 py-1 text-center text-sm font-bold disabled:opacity-60"
    />
  );

  const teamSide = esLocal ? 1 : 2;
  const nameOf = (uid: string) => {
    const p = participations?.find((x) => x.user_id === uid)?.profile;
    return p ? `${p.nombre} ${p.apellidos}`.trim() : "—";
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-display text-lg font-bold uppercase tracking-tight">
            {t("results.title")}
          </h2>
          <p className="text-xxs text-muted-foreground">{t("results.subtitle")}</p>
        </div>
        <OutcomeBadge outcome={summary.outcome} won={summary.won} lost={summary.lost} />
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {rows.map((row, idx) => (
          <div key={row.pista} className="rounded-md border border-border p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              {isPadel ? (
                <div className="text-2xs font-bold uppercase tracking-widest text-primary">
                  {t("results.pista")} {row.pista}
                </div>
              ) : (
                <span />
              )}
              <CourtBadge winner={winners[idx]} teamSide={teamSide} />
            </div>
            {isPadel ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[3.25rem_repeat(3,minmax(0,1fr))] items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground sm:grid-cols-[80px_repeat(3,minmax(0,1fr))] sm:gap-2">
                  <span />
                  <span className="text-center">{t("results.set")} 1</span>
                  <span className="text-center">{t("results.set")} 2</span>
                  <span className="text-center">{t("results.set")} 3</span>
                </div>
                {(["local", "visitante"] as const).map((side) => (
                  <div key={side} className="grid grid-cols-[3.25rem_repeat(3,minmax(0,1fr))] items-center gap-1.5 sm:grid-cols-[80px_repeat(3,minmax(0,1fr))] sm:gap-2">
                    <span className="truncate text-3xs font-bold uppercase tracking-widest sm:text-xs">
                      {t(`results.${side}`)}
                    </span>
                    {[1, 2, 3].map((setNum) => {
                      const key = `set${setNum}_${side}` as keyof MatchResultRow;
                      return (
                        <div key={setNum} className="flex justify-center">
                          <NumInput
                            value={row[key] as number | null}
                            onChange={(v) => updateCell(idx, key, v)}
                            disabled={!isManager}
                            max={7}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="mb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("results.local")}
                  </div>
                  <NumInput
                    value={row.set1_local}
                    onChange={(v) => updateCell(idx, "set1_local", v)}
                    disabled={!isManager}
                  />
                </div>
                <span className="text-display text-2xl font-black text-muted-foreground">:</span>
                <div className="text-center">
                  <div className="mb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("results.visitante")}
                  </div>
                  <NumInput
                    value={row.set1_visitante}
                    onChange={(v) => updateCell(idx, "set1_visitante", v)}
                    disabled={!isManager}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <p className="text-2xs text-muted-foreground">{t("results.autoNote")}</p>

        {isManager && (
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={save.isPending}
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {t("results.save")}
            </Button>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-display uppercase tracking-tight">
                {t("results.confirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>{t("results.confirmDesc")}</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t("results.confirmCourts")}: {summary.won}-{summary.lost}
                </span>
                <OutcomeBadge outcome={summary.outcome} won={summary.won} lost={summary.lost} />
              </div>

              <ul className="space-y-2">
                {rows.map((row, idx) => {
                  const sets = setsOf(row).filter(
                    (s) => s.local != null || s.visitante != null,
                  );
                  return (
                    <li
                      key={row.pista}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                    >
                      <span className="text-2xs font-bold uppercase tracking-widest text-primary">
                        {isPadel ? `${t("results.pista")} ${row.pista}` : t("results.title")}
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {sets.length === 0
                          ? t("results.confirmEmptyCourt")
                          : sets
                              .map((s) => `${s.local ?? "-"}-${s.visitante ?? "-"}`)
                              .join(isPadel ? " · " : "")}
                      </span>
                      <CourtBadge winner={winners[idx]} teamSide={teamSide} />
                    </li>
                  );
                })}
              </ul>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmSave}
                className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
              >
                {t("results.confirmSave")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {(participations?.length ?? 0) > 0 && (
          <div className="rounded-md border border-border p-4">
            <h3 className="text-2xs mb-3 font-bold uppercase tracking-widest text-muted-foreground">
              {t("results.participants")}
            </h3>
            <ul className="space-y-1 text-sm">
              {participations!.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{nameOf(p.user_id)}</span>
                  <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                    {p.pista ? `${t("results.pista")} ${p.pista}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function CourtBadge({ winner, teamSide }: { winner: 1 | 2 | null; teamSide: number }) {
  const { t } = useTranslation();
  if (winner == null) {
    return (
      <span className="rounded-md border border-border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {t("results.pendingCourt")}
      </span>
    );
  }
  const won = winner === teamSide;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest",
        won
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
          : "border-red-500/40 bg-red-500/10 text-red-500",
      )}
    >
      {won ? <Trophy className="size-3" /> : <XCircle className="size-3" />}
      {won ? t("results.win") : t("results.loss")}
    </span>
  );
}

function OutcomeBadge({
  outcome,
  won,
  lost,
}: {
  outcome: "victoria" | "derrota" | "empate" | null;
  won: number;
  lost: number;
}) {
  const { t } = useTranslation();
  if (outcome == null) {
    return (
      <span className="rounded-md border border-border px-3 py-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {t("results.pendingResult")}
      </span>
    );
  }
  const cls =
    outcome === "victoria"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
      : outcome === "derrota"
      ? "border-red-500/40 bg-red-500/10 text-red-500"
      : "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-2xs font-bold uppercase tracking-widest",
        cls,
      )}
    >
      {outcome === "victoria" ? <Trophy className="size-3.5" /> : <XCircle className="size-3.5" />}
      {t(`results.${outcome}`)} · {won}-{lost}
    </span>
  );
}

