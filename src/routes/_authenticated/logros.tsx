import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trophy, Flame, CalendarCheck, Star, Target, Medal, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { evaluateBadges, tallyParticipations, type ParticipationRow } from "@/lib/achievements";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/logros")({
  head: () => ({
    meta: [
      { title: "Logros | TeamUp" },
      {
        name: "description",
        content:
          "Insignias por asistencia, victorias y rachas: sigue tu progreso y el ranking de tu equipo.",
      },
      { property: "og:title", content: "Logros | TeamUp" },
      {
        property: "og:description",
        content: "Insignias por asistencia, victorias y rachas de tu equipo en TeamUp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Logros,
});

const ICONS = {
  trophy: Trophy,
  flame: Flame,
  calendar: CalendarCheck,
  star: Star,
  target: Target,
  medal: Medal,
};

function Logros() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : "es";
  const { user } = useSession();
  const { active } = useActiveTeam();
  const teamId = active?.team.id;

  const { data: participations } = useQuery({
    queryKey: ["achievements-participations", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<ParticipationRow[]> => {
      const { data, error } = await supabase
        .from("match_participations")
        .select("user_id, jugado, ganado, event_ganado, fecha, event_id")
        .eq("team_id", teamId!);
      if (error) throw error;
      return (data ?? []) as ParticipationRow[];
    },
  });

  const { data: roster } = useQuery({
    queryKey: ["achievements-roster", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, profiles:user_id(nombre, apellidos, avatar_url)")
        .eq("team_id", teamId!)
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((m) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          userId: m.user_id,
          name: [p?.nombre, p?.apellidos].filter(Boolean).join(" ").trim() || "—",
          avatar: p?.avatar_url ?? null,
        };
      });
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["achievements-attendance", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_responses")
        .select("status, es_convocado, event:event_id(team_id)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const rows = (data ?? []).filter((r) => {
        const ev = Array.isArray(r.event) ? r.event[0] : r.event;
        return ev?.team_id === teamId;
      });
      return {
        confirmed: rows.filter((r) => r.status === "confirmado").length,
        called: rows.filter((r) => r.es_convocado).length,
      };
    },
  });

  if (!active) {
    return (
      <div className="space-y-6">
        <Header t={t} />
        <EmptyTeamState />
      </div>
    );
  }

  const tallies = tallyParticipations(participations ?? []);
  const mine = (user && tallies.get(user.id)) || null;
  const maxWins = Math.max(0, ...[...tallies.values()].map((x) => x.wins));
  const isTeamTopWinner = !!mine && maxWins > 0 && mine.wins === maxWins;

  const badges = evaluateBadges({
    tally: mine,
    attendance: attendance ?? { confirmed: 0, called: 0 },
    isTeamTopWinner,
  });
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const leaderboard = (roster ?? [])
    .map((r) => ({ ...r, tally: tallies.get(r.userId) }))
    .filter((r) => r.tally && r.tally.played > 0)
    .sort((a, b) => (b.tally!.wins - a.tally!.wins) || (b.tally!.played - a.tally!.played))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <Header t={t} />
      <TeamPicker />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("achievements.unlocked")} value={`${unlockedCount}/${badges.length}`} icon={Medal} />
        <StatCard label={t("achievements.wins")} value={String(mine?.wins ?? 0)} icon={Trophy} />
        <StatCard label={t("achievements.bestStreak")} value={String(mine?.bestStreak ?? 0)} icon={Flame} />
      </div>

      <section className="surface-card p-5">
        <h2 className="text-display text-sm font-bold uppercase tracking-[0.18em]">
          {t("achievements.myBadges")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map(({ badge, unlocked, value, goal, pct }) => {
            const Icon = ICONS[badge.icon];
            return (
              <div
                key={badge.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  unlocked
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card/40 opacity-80",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {unlocked ? <Icon className="size-5" /> : <Lock className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{badge.title[lang]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {badge.description[lang]}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", unlocked ? "bg-primary" : "bg-muted-foreground/40")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {value}/{goal}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-display text-sm font-bold uppercase tracking-[0.18em]">
          {t("achievements.leaderboard")}
        </h2>
        {leaderboard.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("achievements.noData")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {leaderboard.map((row, index) => (
              <li key={row.userId} className="flex items-center gap-3 py-3">
                <span className="w-6 text-sm font-bold text-muted-foreground">{index + 1}</span>
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {row.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">
                  {row.tally!.played} {t("achievements.playedShort")}
                </span>
                <span className="text-sm font-bold text-primary">
                  {row.tally!.wins} {t("achievements.winsShort")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Header({ t }: { t: (k: string) => string }) {
  return (
    <div>
      <h1 className="text-display text-2xl font-black uppercase tracking-tight">
        {t("achievements.title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("achievements.subtitle")}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="text-display text-xl font-black">{value}</p>
      </div>
    </div>
  );
}
