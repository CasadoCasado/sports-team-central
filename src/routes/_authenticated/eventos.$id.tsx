import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EventFormDialog } from "@/components/event-form-dialog";
import { toDateTimeLocal, eventTypeStyles, type EventType } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ResponseStatus = Database["public"]["Enums"]["response_status"];

export const Route = createFileRoute("/_authenticated/eventos/$id")({
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, competitions:competition_id(id, nombre)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: membership } = useQuery({
    queryKey: ["event-membership", event?.team_id, user?.id],
    enabled: !!event && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("role, status")
        .eq("team_id", event!.team_id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isManager = membership && ["capitan", "entrenador", "delegado"].includes(membership.role);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("events.deleted"));
      qc.invalidateQueries({ queryKey: ["events"] });
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
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {t("events.backToCalendar")}
      </Link>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", style.badge)}>
                <span className={cn("size-1.5 rounded-full", style.dot)} />
                {t(`events.types.${event.tipo}`)}
              </span>
              <h1 className="text-display mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                {event.titulo}
              </h1>
              {event.rival && (
                <p className="text-display mt-1 text-lg text-muted-foreground">
                  vs <span className="text-foreground">{event.rival}</span>
                  {event.es_local != null && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {event.es_local ? t("events.local") : t("events.visitante")}
                    </span>
                  )}
                </p>
              )}
            </div>
            {isManager && (
              <div className="flex gap-2">
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

        <div className="grid gap-4 p-6 sm:grid-cols-2">
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
          {event.competitions && (
            <InfoRow icon={<ClipboardList className="size-4" />} label={t("events.competicion")}>
              {(event.competitions as { nombre: string }).nombre}
            </InfoRow>
          )}
        </div>

        {event.descripcion && (
          <div className="border-t border-border p-6 text-sm text-muted-foreground whitespace-pre-wrap">
            {event.descripcion}
          </div>
        )}
      </div>

      {(event.requiere_convocatoria || event.tipo === "entrenamiento") && (
        <CallupSection event={event} isManager={!!isManager} userId={user?.id ?? null} />
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
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("deporte")
        .eq("id", teamId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const isPadel = team?.deporte === "padel";
  const showPadelCourts = isPadel && event.tipo === "partido" && (event.padel_num_pistas ?? 0) > 0;

  const { data: members } = useQuery({
    queryKey: ["team-members-full", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, role, profiles:user_id(id, nombre, apellidos, avatar_url)")
        .eq("team_id", teamId)
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        profile: (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as {
          id: string;
          nombre: string;
          apellidos: string;
          avatar_url: string | null;
        } | null,
      }));
    },
  });

  const { data: responses } = useQuery({
    queryKey: ["event-responses", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_responses")
        .select("id, user_id, status, notas, es_convocado, padel_pista")
        .eq("event_id", eventId);
      if (error) throw error;
      return data ?? [];
    },
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
      const { error } = await supabase.from("event_responses").insert({
        event_id: eventId,
        user_id: userId,
        status: "confirmado",
        responded_at: new Date().toISOString(),
      });
      if (error) throw error;
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
      const { error } = await supabase
        .from("event_responses")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) throw error;
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
      if (!value) patch.padel_pista = null;
      const { error } = await supabase.from("event_responses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-responses", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const assignCourt = useMutation({
    mutationFn: async ({ id, pista }: { id: string; pista: number | null }) => {
      const { error } = await supabase
        .from("event_responses")
        .update({ padel_pista: pista })
        .eq("id", id);
      if (error) throw error;
    },
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
            <p className="text-[11px] text-muted-foreground">
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
        <div className="border-b border-border p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("callups.myStatus")}
          </div>
          {myResp.es_convocado && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              ★ {t("callups.youAreCalled")}
              {myResp.padel_pista ? ` · ${t("callups.pista")} ${myResp.padel_pista}` : ""}
            </p>
          )}
          <PlayerResponseForm response={myResp} eventId={eventId} userId={userId} />
        </div>
      )}

      <div className="p-5">
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("callups.signedUpList")} ({signedUp.length})
        </h3>
        {signedUp.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("callups.noSignedUp")}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {signedUp.map((r) => {
            const m = members?.find((x) => x.user_id === r.user_id);
            const status = r.status as ResponseStatus;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3",
                  r.es_convocado ? "border-primary/40 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border">
                  {(m?.profile?.nombre?.[0] ?? "") + (m?.profile?.apellidos?.[0] ?? "") || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m?.profile?.nombre} {m?.profile?.apellidos}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m?.role}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                    status === "confirmado" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
                    status === "rechazado" && "border-red-500/40 bg-red-500/15 text-red-300",
                    status === "duda" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
                    status === "convocado" && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {t(`callups.response_${status}`)}
                </span>
                {isManager && (
                  <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                    <input
                      type="checkbox"
                      checked={r.es_convocado}
                      onChange={(e) =>
                        toggleConvocado.mutate({ id: r.id, value: e.target.checked })
                      }
                    />
                    ★
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {showPadelCourts && isManager && convocados.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
              {t("callups.padelAssign")} ({event.padel_num_pistas} {t("callups.pistas")})
            </h3>
            <div className="space-y-2">
              {Array.from({ length: event.padel_num_pistas ?? 0 }).map((_, i) => {
                const pistaNum = i + 1;
                const assigned = convocados.filter((r) => r.padel_pista === pistaNum);
                const isFull = assigned.length >= 2;
                return (
                  <div key={pistaNum} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
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
    mutationFn: async (status: ResponseStatus) => {
      const { error } = await supabase
        .from("event_responses")
        .update({ status, notas: notas.trim() || null, responded_at: new Date().toISOString() })
        .eq("id", response.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
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
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
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
