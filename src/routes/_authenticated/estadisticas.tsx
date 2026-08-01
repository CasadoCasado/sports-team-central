import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trophy, Dumbbell, CheckCircle2, XCircle, HelpCircle, Percent, Flame, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";

export const Route = createFileRoute("/_authenticated/estadisticas")({
  component: Estadisticas,
});

type EventRow = {
  id: string;
  tipo: "entrenamiento" | "partido" | "torneo" | "reunion" | "otro";
  fecha_inicio: string;
  resultado_local: number | null;
  resultado_visitante: number | null;
  es_local: boolean;
};

function Estadisticas() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { active, isManager } = useActiveTeam();
  const teamId = active?.team.id;

  const { data: events } = useQuery({
    queryKey: ["stats-events", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id, tipo, fecha_inicio, resultado_local, resultado_visitante, es_local")
        .eq("team_id", teamId!)
        .lte("fecha_inicio", new Date().toISOString());
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const { data: teamStats } = useQuery({
    queryKey: ["team-stats", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_match_stats")
        .select("*")
        .eq("team_id", teamId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: playerStats } = useQuery({
    queryKey: ["player-stats", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_match_stats")
        .select("*")
        .eq("team_id", teamId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: myResponses } = useQuery({
    queryKey: ["stats-my-responses", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_responses")
        .select("status, event:event_id(team_id, tipo, fecha_inicio)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).filter((r) => {
        const e = Array.isArray(r.event) ? r.event[0] : r.event;
        return e && e.team_id === teamId && new Date(e.fecha_inicio) <= new Date();
      });
    },
  });

  if (!active) return <EmptyTeamState />;


  const matches = (events ?? []).filter((e) => e.tipo === "partido");
  const withResult = matches.filter(
    (m) => m.resultado_local != null && m.resultado_visitante != null,
  );
  const trainings = (events ?? []).filter((e) => e.tipo === "entrenamiento");

  let wins = 0, draws = 0, losses = 0;
  withResult.forEach((m) => {
    const own = m.es_local ? m.resultado_local! : m.resultado_visitante!;
    const opp = m.es_local ? m.resultado_visitante! : m.resultado_local!;
    if (own > opp) wins++;
    else if (own === opp) draws++;
    else losses++;
  });
  const winPct = withResult.length ? Math.round((wins / withResult.length) * 100) : 0;

  const rc = (status: string) =>
    (myResponses ?? []).filter((r) => r.status === status).length;
  const myConfirmed = rc("confirmado");
  const myRejected = rc("rechazado");
  const myDoubt = rc("duda");
  const myPending = rc("convocado");
  const myTotal = (myResponses ?? []).length;
  const attendancePct = myTotal ? Math.round((myConfirmed / myTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">{t("stats.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("stats.subtitle")}</p>
        </div>
        <TeamPicker />
      </div>

      {/* Team stats */}
      <section className="space-y-4">
        <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
          {t("stats.team")}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
          <BigStat icon={<Trophy />} label={t("stats.matchesPlayed")} value={teamStats?.jugados ?? withResult.length} />
          <BigStat icon={<Percent />} label={t("stats.winRate")} value={`${teamStats?.win_pct ?? winPct}%`} accent />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <BigStat
            icon={<Flame />}
            label={teamStats?.racha_victorias ? t("stats.winStreak") : t("stats.lossStreak")}
            value={teamStats?.racha ?? 0}
          />
          <BigStat icon={<CheckCircle2 />} label={t("stats.courtsWon")} value={teamStats?.pistas_ganadas ?? 0} />
          <BigStat icon={<XCircle />} label={t("stats.courtsLost")} value={teamStats?.pistas_perdidas ?? 0} />
          <BigStat
            icon={<Percent />}
            label={t("stats.courtsDiff")}
            value={`${(teamStats?.diferencia_pistas ?? 0) > 0 ? "+" : ""}${teamStats?.diferencia_pistas ?? 0}`}
          />
        </div>


        <div className="surface-card grid grid-cols-3 divide-x divide-border">
          <ResultCell label={t("stats.wins")} value={wins} color="text-primary" />
          <ResultCell label={t("stats.draws")} value={draws} color="text-amber-300" />
          <ResultCell label={t("stats.losses")} value={losses} color="text-red-400" />
        </div>

        {withResult.length > 0 && (
          <div className="surface-card p-5">
            <h3 className="text-2xs mb-3 font-bold uppercase tracking-widest text-muted-foreground">
              {t("stats.recentResults")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {withResult
                .slice()
                .sort((a, b) => +new Date(b.fecha_inicio) - +new Date(a.fecha_inicio))
                .slice(0, 10)
                .map((m) => {
                  const own = m.es_local ? m.resultado_local! : m.resultado_visitante!;
                  const opp = m.es_local ? m.resultado_visitante! : m.resultado_local!;
                  const outcome = own > opp ? "W" : own === opp ? "D" : "L";
                  const cls =
                    outcome === "W"
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : outcome === "D"
                      ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                      : "bg-red-500/10 border-red-500/30 text-red-400";
                  return (
                    <div
                      key={m.id}
                      className={`flex size-10 flex-col items-center justify-center rounded-md border text-2xs font-bold ${cls}`}
                      title={`${own}-${opp}`}
                    >
                      <span className="text-sm">{outcome}</span>
                      <span className="opacity-80">{own}-{opp}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </section>

      {/* Personal stats */}
      <section className="space-y-4">
        <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
          {t("stats.personal")}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <BigStat icon={<Percent />} label={t("stats.attendanceRate")} value={`${attendancePct}%`} accent />
          <BigStat icon={<CheckCircle2 />} label={t("stats.confirmed")} value={myConfirmed} />
          <BigStat icon={<XCircle />} label={t("stats.rejected")} value={myRejected} />
          <BigStat icon={<HelpCircle />} label={t("stats.doubt")} value={myDoubt} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <BigStat icon={<Trophy />} label={t("stats.matchesCalled")} value={
            (myResponses ?? []).filter((r) => {
              const e = Array.isArray(r.event) ? r.event[0] : r.event;
              return e?.tipo === "partido";
            }).length
          } />
          <BigStat icon={<Dumbbell />} label={t("stats.trainingsCalled")} value={
            (myResponses ?? []).filter((r) => {
              const e = Array.isArray(r.event) ? r.event[0] : r.event;
              return e?.tipo === "entrenamiento";
            }).length
          } />
          <BigStat icon={<HelpCircle />} label={t("stats.pending")} value={myPending} />
        </div>

        <h3 className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("stats.myMatches")}
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <BigStat icon={<Percent />} label={t("stats.winRate")} value={`${playerStats?.win_pct ?? 0}%`} accent />
          <BigStat icon={<Trophy />} label={t("stats.wins")} value={playerStats?.victorias ?? 0} />
          <BigStat icon={<XCircle />} label={t("stats.losses")} value={playerStats?.derrotas ?? 0} />
          <BigStat icon={<CheckCircle2 />} label={t("stats.played")} value={playerStats?.disputados ?? 0} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BigStat icon={<HelpCircle />} label={t("stats.calledUp")} value={playerStats?.convocado ?? 0} />
          <BigStat
            icon={<CalendarClock />}
            label={t("stats.lastCallup")}
            value={playerStats?.ultima_convocatoria ? new Date(playerStats.ultima_convocatoria).toLocaleDateString() : "—"}
          />
          <BigStat
            icon={<CalendarClock />}
            label={t("stats.lastMatch")}
            value={playerStats?.ultimo_partido ? new Date(playerStats.ultimo_partido).toLocaleDateString() : "—"}
          />
        </div>
      </section>


      {isManager && (
        <p className="text-xs text-muted-foreground">
          {t("stats.totalTrainings", { count: trainings.length })}
        </p>
      )}
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="surface-card p-5">
      <div className={`flex size-8 items-center justify-center rounded-md ${accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"} [&>svg]:size-4`}>
        {icon}
      </div>
      <p className="text-display mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ResultCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center p-5">
      <span className={`text-display text-4xl font-black ${color}`}>{value}</span>
      <span className="mt-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
