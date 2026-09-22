/**
 * Una competición del equipo por dentro: sus entrenamientos, la clasificación
 * que sale de ellos y, cuando se da por terminada, el podio.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Crown,
  Dumbbell,
  ListOrdered,
  Lock,
  LockOpen,
  Medal,
  Trophy,
} from "lucide-react";

import { api } from "@/lib/api";
import { invalidateCompetitionQueries } from "@/lib/query-keys";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Competition,
  TrainingFormat,
  CompetitionStanding,
  CompetitionStandings,
  Profile,
  TeamEvent,
} from "@/lib/types";

// El guion bajo de `competiciones_` deja esta pantalla fuera de la lista de
// competiciones: es una página entera, no algo que se pinte dentro de ella.
export const Route = createFileRoute("/_authenticated/competiciones_/$id")({
  head: () => ({
    meta: [
      { title: "Competición | TeamUp" },
      {
        name: "description",
        content:
          "Clasificación y podio de una competición del equipo, con los entrenamientos que la alimentan.",
      },
      { property: "og:title", content: "Competición | TeamUp" },
      {
        property: "og:description",
        content:
          "Clasificación y podio de una competición del equipo, con los entrenamientos que la alimentan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompetitionDetail,
});

type Columna = {
  key: string;
  label: string;
  value: (row: CompetitionStanding) => React.ReactNode;
};

/**
 * Las columnas del medio, que son las que dependen del formato.
 *
 * Puesto, jugador, noches y nota salen siempre: son las que significan lo
 * mismo se juegue a lo que se juegue. Lo de en medio cambia porque cada
 * formato mide otra cosa, y enseñar columnas vacías sería peor que no
 * enseñarlas.
 */
function columnsFor(formato: TrainingFormat | null, t: (key: string) => string): Columna[] {
  if (formato === "rey_pista") {
    return [
      {
        key: "reinados",
        label: t("standings.vecesRey"),
        value: (row) =>
          (row.veces_rey ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1 font-bold text-amber-500">
              <Crown className="size-3.5" />
              {row.veces_rey}
            </span>
          ) : (
            0
          ),
      },
      {
        key: "mejor",
        label: t("standings.mejorPuesto"),
        value: (row) => `${row.mejor_puesto}.º`,
      },
      {
        key: "medio",
        label: t("standings.puestoMedio"),
        value: (row) => row.puesto_medio,
      },
    ];
  }
  if (formato === "partidos") {
    return [
      { key: "g", label: t("standings.ganados"), value: (row) => row.ganados },
      { key: "p", label: t("standings.perdidos"), value: (row) => row.perdidos },
      { key: "pct", label: t("standings.winPct"), value: (row) => row.win_pct },
    ];
  }
  if (formato === "americano") {
    return [
      { key: "jf", label: t("standings.juegosFavor"), value: (row) => row.juegos_favor },
      { key: "jc", label: t("standings.juegosContra"), value: (row) => row.juegos_contra },
      { key: "pct", label: t("standings.winPct"), value: (row) => row.juegos_pct },
    ];
  }
  return [];
}

const nameOf = (profile: Profile | null) =>
  profile ? `${profile.nombre} ${profile.apellidos}`.trim() : "—";

function CompetitionDetail() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { id } = Route.useParams();
  const { isManager } = useActiveTeam();
  const qc = useQueryClient();

  const { data: competition, isLoading } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => api.get<Competition>(`/competitions/${id}/`),
  });

  const { data: standings } = useQuery({
    queryKey: ["competition-standings", id],
    queryFn: () => api.get<CompetitionStandings>(`/competitions/${id}/standings/`),
  });

  const { data: trainings } = useQuery({
    queryKey: ["competition-trainings", id],
    queryFn: () =>
      api.get<TeamEvent[]>("/events/", {
        competition_id: id,
        tipo: "entrenamiento",
        order: "-fecha_inicio",
      }),
  });

  const finish = useMutation({
    mutationFn: (finalizada: boolean) =>
      api.post<Competition>(`/competitions/${id}/finalizar/`, { finalizada }),
    onSuccess: async (_data, finalizada) => {
      toast.success(finalizada ? t("standings.finished") : t("standings.reopened"));
      await invalidateCompetitionQueries(qc);
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  // Antes de que cargue la clasificación vale el de la competición, para que
  // la tabla no cambie de columnas a mitad de carga.
  const formato = standings?.formato ?? competition?.formato ?? null;
  const columnas = useMemo(() => columnsFor(formato, t), [formato, t]);

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!competition) return <div className="p-8 text-sm text-muted-foreground">404</div>;

  const rows = standings?.standings ?? [];
  const podium = standings?.podium ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/competiciones"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {t("standings.back")}
      </Link>

      <div className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Trophy className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-display text-3xl font-black tracking-tight">
                {competition.nombre}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs font-bold uppercase tracking-widest">
                <span className="rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-primary">
                  {t(`competitions.types.${competition.tipo}`)}
                </span>
                {competition.temporada && (
                  <span className="text-muted-foreground">{competition.temporada}</span>
                )}
                {competition.finalizada && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-amber-600">
                    <Lock className="size-3" />
                    {t("competitions.status.finalizada")}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {t("standings.trainingsCount", {
                    count: standings?.entrenamientos ?? 0,
                  })}
                </span>
                {(standings?.entrenamientos ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    {t("standings.minimoPodio", { count: standings!.minimo_podio })}
                  </span>
                )}
              </div>
              {competition.finalizada && competition.finalizada_en && (
                <p className="mt-2 text-xxs text-muted-foreground">
                  {t("standings.finishedOn", {
                    date: format(new Date(competition.finalizada_en), "PPP", { locale }),
                  })}
                </p>
              )}
            </div>
          </div>
          {isManager && (
            <Button
              variant={competition.finalizada ? "outline" : "default"}
              disabled={finish.isPending}
              onClick={() => {
                if (competition.finalizada) return finish.mutate(false);
                if (confirm(t("standings.finishConfirm"))) finish.mutate(true);
              }}
              className={cn(
                "uppercase tracking-widest font-bold",
                !competition.finalizada && "bg-primary text-primary-foreground hover:opacity-90",
              )}
            >
              {competition.finalizada ? (
                <>
                  <LockOpen className="mr-1 size-4" /> {t("standings.reopen")}
                </>
              ) : (
                <>
                  <Lock className="mr-1 size-4" /> {t("standings.finish")}
                </>
              )}
            </Button>
          )}
        </div>
        {competition.descripcion && (
          <p className="mt-4 text-sm text-muted-foreground">{competition.descripcion}</p>
        )}
      </div>

      {podium.length > 0 && <Podium rows={podium} />}

      <section className="surface-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListOrdered className="size-5" />
          </div>
          <div>
            <h2 className="text-display text-lg font-bold uppercase tracking-tight">
              {t("standings.title")}
            </h2>
            <p className="text-xxs text-muted-foreground">
              {formato ? t(`standings.formatos.${formato}`) : t("standings.subtitle")}
            </p>
          </div>
        </div>

        {formato === null ? (
          <p className="p-6 text-sm text-muted-foreground">{t("standings.sinFormato")}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("standings.empty")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2 text-left">{t("standings.puesto")}</th>
                    <th className="px-3 py-2 text-left">{t("standings.jugador")}</th>
                    <th className="px-3 py-2 text-right">{t("standings.entrenamientos")}</th>
                    {columnas.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-right">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">{t("standings.nota")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr
                      key={row.user_id}
                      className={cn("hover:bg-card", !row.clasificado && "opacity-60")}
                    >
                      <td className="px-3 py-2 font-black tabular-nums">{row.puesto}</td>
                      <td className="max-w-[12rem] px-3 py-2">
                        <span className="block truncate">{nameOf(row.profile)}</span>
                        {!row.clasificado && (
                          <span className="text-xxs text-muted-foreground">
                            {t("standings.noClasificado")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.entrenamientos}</td>
                      {columnas.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                        >
                          {col.value(row)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{row.nota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="border-t border-border px-5 py-3">
              <summary className="cursor-pointer text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("standings.reglaTitulo")}
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("standings.regla", {
                  media: standings?.media ?? 50,
                  margen: standings?.margen ?? 5,
                })}
              </p>
            </details>
          </>
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("standings.trainings")}
        </div>
        {(trainings?.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("standings.noTrainings")}</p>
        ) : (
          <div className="divide-y divide-border">
            {trainings!.map((e) => (
              <Link
                key={e.id}
                to="/eventos/$id"
                params={{ id: e.id }}
                className="flex items-center gap-4 p-4 hover:bg-card"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/30">
                  <Dumbbell className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.titulo}</p>
                  <p className="text-xxs text-muted-foreground">
                    {format(new Date(e.fecha_inicio), "PPP HH:mm", { locale })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Los tres primeros, con el primero en el centro y más alto.
 *
 * Las tres columnas miden lo mismo y alinean su contenido abajo: así los
 * escalones apoyan todos en la misma línea aunque un puesto lo compartan dos
 * personas y su rótulo ocupe el doble.
 */
function Podium({ rows }: { rows: CompetitionStanding[] }) {
  const { t } = useTranslation();
  const steps: { puesto: number; height: string; color: string }[] = [
    { puesto: 2, height: "h-16", color: "text-slate-400" },
    { puesto: 1, height: "h-24", color: "text-amber-500" },
    { puesto: 3, height: "h-10", color: "text-orange-600" },
  ];

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <div className="flex size-10 items-center justify-center rounded-md bg-amber-400/10 text-amber-500">
          <Medal className="size-5" />
        </div>
        <h2 className="text-display text-lg font-bold uppercase tracking-tight">
          {t("standings.podium")}
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-3 px-6 pb-6 pt-8">
        {steps.map((step) => {
          const winners = rows.filter((r) => r.puesto === step.puesto);
          return (
            <div key={step.puesto} className="flex h-44 flex-col items-center justify-end gap-2">
              <div className="space-y-1 text-center">
                {winners.length === 0 ? (
                  <span className="text-xxs text-muted-foreground">—</span>
                ) : (
                  winners.map((row) => (
                    <div key={row.user_id}>
                      <p className="text-sm font-bold leading-tight">{nameOf(row.profile)}</p>
                      <p className="text-xxs text-muted-foreground">
                        {t("standings.nota")} {row.nota}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div
                className={cn(
                  "flex w-full items-center justify-center rounded-t-md border border-border bg-card",
                  step.height,
                )}
              >
                <span className={cn("text-display text-2xl font-black", step.color)}>
                  {step.puesto}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
