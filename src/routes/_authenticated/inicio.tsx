import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Shield,
  Calendar,
  Bell,
  Vote,
  MapPin,
  Clock,
  MessagesSquare,
  ClipboardList,
  Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { eventTypeStyles } from "@/lib/events";
import { TeamDiscovery } from "@/components/team-discovery";
import { CallupDetailDialog } from "@/components/callup-detail-dialog";

export const Route = createFileRoute("/_authenticated/inicio")({
  component: Inicio,
});

function Inicio() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [callupId, setCallupId] = useState<string | null>(null);

  const { data: alreadySignedUp } = useQuery({
    queryKey: ["my-response-for", user?.id, callupId],
    enabled: !!user && !!callupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_responses")
        .select("id, status")
        .eq("user_id", user!.id)
        .eq("event_id", callupId!)
        .maybeSingle();
      if (error) throw error;
      return !!data && data.status === "confirmado";
    },
  });

  const signUp = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) return;
      const { error } = await supabase.from("event_responses").upsert(
        {
          event_id: eventId,
          user_id: user.id,
          status: "confirmado",
          responded_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, eventId) => {
      toast.success(t("callups.signedUp"));
      qc.invalidateQueries({ queryKey: ["dash-open-callups"] });
      qc.invalidateQueries({ queryKey: ["my-responses-map"] });
      qc.invalidateQueries({ queryKey: ["my-response-for", user?.id, eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: teams } = useQuery({
    queryKey: ["my-teams", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, status, teams:team_id(id, nombre, logo_url, descripcion)")
        .eq("user_id", user!.id)
        .eq("status", "activo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const teamIds = (teams ?? [])
    .map((t) => t.team_id)
    .filter(Boolean) as string[];

  const { data: pendingInvites } = useQuery({
    queryKey: ["my-invitations-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("team_invitations")
        .select("id", { count: "exact", head: true })
        .eq("invited_user_id", user!.id)
        .eq("status", "pendiente");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["dash-upcoming", teamIds.join(",")],
    enabled: teamIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, titulo, tipo, fecha_inicio, ubicacion, rival, es_local, team:team_id(nombre)")
        .in("team_id", teamIds)
        .gte("fecha_inicio", new Date().toISOString())
        .order("fecha_inicio", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myPending } = useQuery({
    queryKey: ["dash-open-callups", user?.id, teamIds.join(",")],
    enabled: !!user && teamIds.length > 0,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data: evs, error } = await supabase
        .from("events")
        .select("id, titulo, tipo, fecha_inicio, ubicacion, requiere_convocatoria")
        .in("team_id", teamIds)
        .in("tipo", ["partido", "entrenamiento"])
        .gte("fecha_inicio", nowIso)
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      const open = (evs ?? []).filter((e) => e.requiere_convocatoria);
      if (open.length === 0) return [];
      const { data: resps, error: rErr } = await supabase
        .from("event_responses")
        .select("event_id")
        .eq("user_id", user!.id)
        .in("event_id", open.map((e) => e.id));
      if (rErr) throw rErr;
      const answered = new Set((resps ?? []).map((r) => r.event_id));
      return open.filter((e) => !answered.has(e.id)).slice(0, 5);
    },
  });

  const { data: unreadNotifs } = useQuery({
    queryKey: ["unread-notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const hasTeam = (teams?.length ?? 0) > 0;

  if (!hasTeam) {
    const canCreateTeam = profile?.preferred_role === "capitan";
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight sm:text-4xl">
            {t("dashboard.findTeamTitle")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("dashboard.findTeamSubtitle")}</p>
        </div>

        {(canCreateTeam || (pendingInvites ?? 0) > 0) && (
          <div className="flex flex-wrap gap-2">
            {canCreateTeam && (
              <Link
                to="/mi-equipo"
                className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"
              >
                {t("team.create")}
              </Link>
            )}
            {(pendingInvites ?? 0) > 0 && (
              <Link
                to="/notificaciones"
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest hover:border-primary/40"
              >
                {t("notifications.title")} ({pendingInvites})
              </Link>
            )}
          </div>
        )}

        <TeamDiscovery onlyOpen />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-display text-3xl font-black tracking-tight sm:text-4xl">
          {t("dashboard.welcome", { name: profile?.nombre || "" })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("dashboard.welcomeSubtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Shield />} label={t("nav.miEquipo")} value={teams?.length ?? 0} to="/mi-equipo" />
        <StatCard icon={<Bell />} label={t("notifications.title")} value={(pendingInvites ?? 0) + (unreadNotifs ?? 0)} to="/notificaciones" />
        <StatCard icon={<ClipboardList />} label={t("dashboard.pendingCallups")} value={myPending?.length ?? 0} to="/convocatorias" />
        <StatCard icon={<Calendar />} label={t("dashboard.upcomingEvents")} value={upcoming?.length ?? 0} to="/calendario" />
      </div>

      {hasTeam && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upcoming events */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-display text-xl font-bold uppercase tracking-tight">
                {t("dashboard.upcomingEvents")}
              </h2>
              <Link
                to="/calendario"
                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                {t("dashboard.viewAll")}
              </Link>
            </div>
            <div className="space-y-2">
              {(upcoming?.length ?? 0) === 0 ? (
                <div className="surface-card p-6 text-center text-sm text-muted-foreground">
                  {t("events.empty")}
                </div>
              ) : (
                upcoming!.map((e) => {
                  const style = eventTypeStyles[e.tipo as keyof typeof eventTypeStyles];
                  const team = Array.isArray(e.team) ? e.team[0] : e.team;
                  return (
                    <Link
                      key={e.id}
                      to="/eventos/$id"
                      params={{ id: e.id }}
                      className="surface-card group flex items-center gap-4 p-4 transition-colors hover:border-primary/40"
                    >
                      <div className={`flex size-12 flex-col items-center justify-center rounded-md border ${style.badge}`}>
                        <span className="text-xs font-bold">
                          {new Date(e.fecha_inicio).toLocaleDateString([], { day: "numeric" })}
                        </span>
                        <span className="text-[9px] uppercase tracking-widest">
                          {new Date(e.fecha_inicio).toLocaleDateString([], { month: "short" })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${style.dot}`} />
                          <p className="truncate text-sm font-bold">
                            {e.tipo === "partido" && e.rival
                              ? `${e.es_local ? team?.nombre : e.rival} vs ${e.es_local ? e.rival : team?.nombre}`
                              : e.titulo}
                          </p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {new Date(e.fecha_inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {e.ubicacion && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              <span className="truncate max-w-[160px]">{e.ubicacion}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending callups + quick actions */}
          <div className="space-y-6">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-display text-xl font-bold uppercase tracking-tight">
                  {t("dashboard.pendingCallups")}
                </h2>
                <Link
                  to="/convocatorias"
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  {t("dashboard.viewAll")}
                </Link>
              </div>
              {(myPending?.length ?? 0) === 0 ? (
                <div className="surface-card p-6 text-center text-sm text-muted-foreground">
                  {t("callups.empty")}
                </div>
              ) : (
                <div className="space-y-2">
                  {myPending!.map((e) => (
                    <button
                      key={e!.id}
                      type="button"
                      onClick={() => setCallupId(e!.id)}
                      className="surface-card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-primary/40"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ClipboardList className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{e!.titulo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(e!.fecha_inicio).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                        {t("callups.pending")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-display mb-4 text-xl font-bold uppercase tracking-tight">
                {t("dashboard.quickAccess")}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <QuickLink to="/comunicaciones" icon={<MessagesSquare />} label={t("nav.comunicaciones")} />
                <QuickLink to="/estadisticas" icon={<Trophy />} label={t("nav.estadisticas")} />
                <QuickLink to="/entrenamientos" icon={<Calendar />} label={t("nav.entrenamientos")} />
                <QuickLink to="/encuestas" icon={<Vote />} label={t("nav.encuestas")} />
              </div>
            </div>
          </div>
        </div>
      )}

      {hasTeam && (
        <div>
          <h2 className="text-display mb-4 text-xl font-bold uppercase tracking-tight">
            {t("nav.miEquipo")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams!.map((tm) => {
              const team = Array.isArray(tm.teams) ? tm.teams[0] : tm.teams;
              if (!team) return null;
              return (
                <Link
                  key={tm.team_id}
                  to="/mi-equipo"
                  className="surface-card group flex items-start gap-4 p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt="" className="size-12 rounded-md object-cover" />
                    ) : (
                      <Shield className="size-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-display truncate text-lg font-bold">{team.nombre}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {tm.role}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <CallupDetailDialog
        eventId={callupId}
        open={!!callupId}
        onOpenChange={(o) => !o && setCallupId(null)}
        onSignUp={(id) => signUp.mutate(id)}
        signingUp={signUp.isPending}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="surface-card group flex flex-col gap-3 p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-display text-3xl font-black">{value}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
    </Link>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="surface-card flex items-center gap-3 p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:size-4">
        {icon}
      </div>
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}
