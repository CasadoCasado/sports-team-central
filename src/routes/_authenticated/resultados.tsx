import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trophy, MapPin, Calendar as CalendarIcon, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados | TeamUp" },
      { name: "description", content: "Registra y consulta los resultados por pista de cada enfrentamiento de pádel." },
      { property: "og:title", content: "Resultados | TeamUp" },
      { property: "og:description", content: "Registra y consulta los resultados por pista de cada enfrentamiento de pádel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Resultados,
});

function Resultados() {
  const { t } = useTranslation();
  const { active } = useActiveTeam();
  const teamId = active?.team.id;

  const { data: matches } = useQuery({
    queryKey: ["results", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, titulo, rival, es_local, fecha_inicio, resultado_local, resultado_visitante, ubicacion, competition:competition_id(nombre)")
        .eq("team_id", teamId!)
        .eq("tipo", "partido")
        .lte("fecha_inicio", new Date().toISOString())
        .order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!active) return <EmptyTeamState />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-3xl font-black tracking-tight">{t("nav.resultados")}</h1>
        <TeamPicker />
      </div>

      {(matches?.length ?? 0) === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
          <Trophy className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("results.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches!.map((m) => {
            const played = m.resultado_local != null && m.resultado_visitante != null;
            const own = m.es_local ? m.resultado_local : m.resultado_visitante;
            const opp = m.es_local ? m.resultado_visitante : m.resultado_local;
            const outcome = played
              ? own! > opp! ? "W" : own === opp ? "D" : "L"
              : null;
            const outcomeClass = outcome === "W"
              ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/40"
              : outcome === "D"
              ? "bg-amber-400/20 text-amber-600 border border-amber-400/40"
              : outcome === "L"
              ? "bg-red-500/15 text-red-500 border border-red-500/40"
              : "bg-muted text-muted-foreground border border-border";
            const comp = Array.isArray(m.competition) ? m.competition[0] : m.competition;
            return (
              <Link
                key={m.id}
                to="/eventos/$id"
                params={{ id: m.id }}
                className="surface-card flex items-center gap-4 p-5 transition-colors hover:border-primary/40"
              >
                <div className={`flex size-14 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-bold ${outcomeClass}`}>
                  {played ? (
                    <>
                      {outcome === "W" ? <Trophy className="size-4" /> : outcome === "L" ? <XCircle className="size-4" /> : null}
                      <span>{own}-{opp}</span>
                    </>
                  ) : (
                    <span className="text-2xs uppercase tracking-widest">{t("results.notPlayed")}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-display truncate text-lg font-bold">
                    {m.es_local ? active.team.nombre : m.rival || "—"} <span className="text-muted-foreground">vs</span> {m.es_local ? m.rival || "—" : active.team.nombre}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="size-3" />
                      {new Date(m.fecha_inicio).toLocaleDateString()}
                    </span>
                    {m.ubicacion && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {m.ubicacion}
                      </span>
                    )}
                    {comp?.nombre && (
                      <span className="rounded-md border border-border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest">
                        {comp.nombre}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
