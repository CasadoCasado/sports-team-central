import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { EventResponse, PlayerCard, TeamStats, TeamStatsMatch } from "@/lib/types";
import { ladoDe } from "@/lib/lado";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { PairsSection } from "@/components/pairs-section";
import { PistaConPelota } from "@/components/cargando-pro";

export const Route = createFileRoute("/_authenticated/estadisticas")({
  head: () => ({
    meta: [
      { title: "Estadísticas | TeamUp" },
      {
        name: "description",
        content:
          "Rendimiento del equipo y de cada jugador: partidos jugados, victorias y derrotas.",
      },
      { property: "og:title", content: "Estadísticas | TeamUp" },
      {
        property: "og:description",
        content:
          "Rendimiento del equipo y de cada jugador: partidos jugados, victorias y derrotas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Estadisticas,
});

type Pestana = "mio" | "equipo";
const PESTANAS: Pestana[] = ["mio", "equipo"];

/** Cuántos resultados caen como pelotas en la racha del equipo. */
const ULTIMOS = 10;

/** Primero lo de quien mira y luego lo del equipo, cada cosa en su pestaña. */
function Estadisticas() {
  const { t } = useTranslation();
  const { active } = useActiveTeam();
  const [pestana, setPestana] = useState<Pestana>("mio");

  if (!active) return <EmptyTeamState />;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
            {t("stats.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("stats.subtitle")}</p>
        </div>
        <TeamPicker />
      </div>

      <Pestanas pestana={pestana} onChange={setPestana} teamName={active.team.nombre} />

      {/* Con `key`, al cambiar de pestaña se monta de nuevo y las animaciones se repiten. */}
      <div
        key={pestana}
        role="tabpanel"
        id={`stats-panel-${pestana}`}
        aria-labelledby={`stats-tab-${pestana}`}
      >
        {pestana === "mio" ? (
          <LoMio teamId={active.team.id} />
        ) : (
          <ElEquipo teamId={active.team.id} />
        )}
      </div>
    </div>
  );
}

/** Las dos pestañas, con una pelota que rueda hasta la elegida. */
function Pestanas({
  pestana,
  onChange,
  teamName,
}: {
  pestana: Pestana;
  onChange: (p: Pestana) => void;
  teamName: string;
}) {
  const { t } = useTranslation();
  const { profile } = useSession();
  const refs = useRef<Record<Pestana, HTMLButtonElement | null>>({ mio: null, equipo: null });
  const equipo = pestana === "equipo";
  const nombre = [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ");

  const teclas = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const otra = equipo ? "mio" : "equipo";
    onChange(otra);
    refs.current[otra]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("stats.tabsLabel")}
      onKeyDown={teclas}
      className="relative grid max-w-md grid-cols-2 border-b border-border"
    >
      {PESTANAS.map((p) => {
        const sel = p === pestana;
        return (
          <button
            key={p}
            ref={(el) => {
              refs.current[p] = el;
            }}
            type="button"
            role="tab"
            id={`stats-tab-${p}`}
            aria-selected={sel}
            aria-controls={`stats-panel-${p}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => onChange(p)}
            className={`min-h-11 min-w-0 pb-4 pt-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sel ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className="text-display block text-lg font-extrabold sm:text-xl">
              {t(p === "mio" ? "stats.tabMine" : "stats.tabTeam")}
            </span>
            <span className="block truncate text-xs font-semibold text-muted-foreground">
              {p === "mio" ? nombre : teamName}
            </span>
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className={`absolute -bottom-px left-0 h-[3px] w-[calc(50%-1.5rem)] rounded-full bg-accent transition-transform duration-600 ease-[cubic-bezier(.5,0,.2,1)] motion-reduce:transition-none ${equipo ? "translate-x-[calc(100%+1.5rem)]" : ""}`}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-2 size-4 rounded-full bg-[#d7f24b] shadow-[inset_-2px_-2px_0_rgb(0_0_0/0.15),0_2px_4px_rgb(0_0_0/0.2)] transition-[left,rotate] duration-600 ease-[cubic-bezier(.5,0,.2,1)] motion-reduce:transition-none"
        style={{
          left: equipo ? "calc(100% - 1.5rem)" : "calc(50% - 1.5rem)",
          rotate: equipo ? "540deg" : "0deg",
        }}
      >
        <span className="absolute inset-0.5 rounded-full border-[1.5px] border-white/85 border-x-transparent" />
      </span>
    </div>
  );
}

// --------------------------------------------------------------- Lo mío ---

const ESTADOS = ["confirmado", "reserva", "duda", "rechazado", "convocado"] as const;
type Estado = (typeof ESTADOS)[number];
const COLOR_ESTADO: Record<Estado, string> = {
  confirmado: "bg-ok",
  reserva: "bg-info",
  duda: "bg-warn",
  rechazado: "bg-danger",
  convocado: "bg-muted-foreground/30",
};
const estadoDe = (s: string): Estado =>
  (ESTADOS as readonly string[]).includes(s) ? (s as Estado) : "convocado";

function LoMio({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const dia = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });

  const { data: ficha } = useQuery({
    queryKey: ["player-card", teamId, user?.id],
    enabled: !!user,
    queryFn: () =>
      api.get<PlayerCard>("/stats/player-card/", { team_id: teamId, user_id: user!.id }),
  });

  const { data: respuestas } = useQuery({
    queryKey: ["stats-my-responses", teamId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = await api.get<EventResponse[]>("/event-responses/", {
        team_id: teamId,
        user_id: user!.id,
      });
      return rows
        .filter((r) => new Date(r.event_fecha_inicio) <= new Date())
        .sort((a, b) => +new Date(a.event_fecha_inicio) - +new Date(b.event_fecha_inicio));
    },
  });

  const jugados = (ficha?.partidos ?? []).filter((p) => p.ganado != null);
  const racha = rachaDe(jugados.map((p) => p.ganado!));
  const ultimo = ficha?.partidos[0];
  const pareja = ultimo?.pareja
    ? [ultimo.pareja.nombre, ultimo.pareja.apellidos].filter(Boolean).join(" ")
    : null;
  const lado = ladoDe(ficha?.perfil.posicion);
  const datos = [
    lado && t(`lado.${lado}`),
    ficha?.perfil.mano_dominante,
    ficha?.perfil.nivel && `${t("ficha.nivel")} ${ficha.perfil.nivel}`,
  ].filter(Boolean);

  const lista = respuestas ?? [];
  const cuenta = (e: Estado) => lista.filter((r) => estadoDe(r.status) === e).length;
  const asistencia = lista.length ? Math.round((cuenta("confirmado") / lista.length) * 100) : 0;
  const ultimaConv = lista[lista.length - 1];

  return (
    <div className="space-y-4">
      <section className="animate-fade-in-up grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-2xl bg-ink p-5 text-ink-foreground sm:gap-8 sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,300px)]">
        <AnilloStats pct={ficha?.disputados ? ficha.win_pct : null} />
        <div className="min-w-0 space-y-3">
          {datos.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-widest text-evt-torneo">
              {datos.join(" · ")}
            </p>
          )}
          {ficha && !ficha.disputados ? (
            <p className="text-sm text-ink-muted">{t("stats.noMatchesMine")}</p>
          ) : (
            <>
              <div className="grid max-w-md grid-cols-3 gap-3">
                <Cifra v={ficha?.victorias ?? 0} l={t("stats.won")} className="text-accent" i={0} />
                <Cifra v={ficha?.derrotas ?? 0} l={t("stats.lost")} className="text-danger" i={1} />
                <Cifra
                  v={`${ficha?.sets_ganados ?? 0}–${ficha?.sets_perdidos ?? 0}`}
                  l={t("stats.sets")}
                  i={2}
                />
              </div>
              {ultimo && (
                <p className="text-sm text-ink-muted">
                  {racha && (
                    <strong className="font-bold text-ink-foreground">
                      {t(racha.ganado ? "stats.streakWon" : "stats.streakLost", {
                        count: racha.n,
                      })}{" "}
                    </strong>
                  )}
                  {pareja && ultimo.sets
                    ? t("stats.lastWith", {
                        fecha: dia.format(new Date(ultimo.fecha)),
                        sets: ultimo.sets,
                        pareja,
                      })
                    : ultimo.sets
                      ? t("stats.lastSets", {
                          fecha: dia.format(new Date(ultimo.fecha)),
                          sets: ultimo.sets,
                        })
                      : t("stats.lastDate", { fecha: dia.format(new Date(ultimo.fecha)) })}
                </p>
              )}
            </>
          )}
        </div>
        <PistaConPelota
          role="img"
          aria-label={t("stats.courtAria")}
          className="col-span-2 lg:col-span-1"
        >
          {(lado === "reves" || lado === "ambos") && (
            <div className="absolute left-0 top-0 h-1/2 w-1/2 bg-accent/40" />
          )}
          {(lado === "derecha" || lado === "ambos") && (
            <div className="absolute bottom-0 left-0 h-1/2 w-1/2 bg-accent/40" />
          )}
          <span className="absolute left-2 top-2 z-10 rounded bg-ink/60 px-1.5 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-widest text-white">
            {lado ? t("stats.yourSide", { lado: t(`lado.${lado}`) }) : t("stats.noSide")}
          </span>
        </PistaConPelota>
      </section>

      <section className="surface-card animate-fade-in-up p-5 [animation-delay:120ms]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-display text-lg font-extrabold">
            {t("stats.callups.title", { count: lista.length })}
          </h2>
          {lista.length > 0 && (
            <p className="text-display text-2xl font-black text-primary">
              {asistencia} %{" "}
              <span className="font-sans text-xs font-semibold text-muted-foreground">
                {t("stats.callups.attendance")}
              </span>
            </p>
          )}
        </div>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("stats.callups.empty")}</p>
        ) : (
          <>
            <div
              role="img"
              aria-label={t("stats.callups.aria")}
              className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(1.125rem,1fr))] gap-1.5"
            >
              {lista.map((r, i) => {
                const e = estadoDe(r.status);
                return (
                  <span
                    key={r.id}
                    title={`${dia.format(new Date(r.event_fecha_inicio))} · ${t(`stats.callups.${e}`)}`}
                    className={`stats-pop aspect-square rounded-[5px] ${COLOR_ESTADO[e]}`}
                    style={{ animationDelay: `${250 + Math.min(i * 28, 1200)}ms` }}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {ESTADOS.map((e) => (
                <span key={e} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`size-2.5 rounded-[3px] ${COLOR_ESTADO[e]}`} />
                  <strong className="text-foreground">{cuenta(e)}</strong> {t(`stats.callups.${e}`)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("stats.callups.summary", {
                partidos: lista.filter((r) => r.event_tipo === "partido").length,
                entrenos: lista.filter((r) => r.event_tipo === "entrenamiento").length,
              })}{" "}
              {ultimaConv &&
                t("stats.callups.last", {
                  fecha: dia.format(new Date(ultimaConv.event_fecha_inicio)),
                })}
            </p>
          </>
        )}
      </section>

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <PairsSection teamId={teamId} mine currentUserId={user?.id} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------ El equipo ---

const BOLA: Record<TeamStatsMatch["resultado"], string> = {
  G: "bg-accent text-ink",
  E: "bg-evt-torneo text-ink",
  P: "bg-danger text-white",
};

function ElEquipo({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { isManager } = useActiveTeam();

  const { data: stats } = useQuery({
    queryKey: ["team-stats", teamId],
    // Era la vista SQL `team_match_stats`; ahora la agrega el backend.
    queryFn: () => api.get<TeamStats>("/stats/team/", { team_id: teamId }),
  });

  const { data: entrenos } = useQuery({
    queryKey: ["stats-trainings-count", teamId],
    enabled: isManager,
    queryFn: async () =>
      (
        await api.get<{ id: string; tipo: string }[]>("/events/", {
          team_id: teamId,
          fecha_inicio__lte: new Date().toISOString(),
        })
      ).filter((e) => e.tipo === "entrenamiento").length,
  });

  const partidos = stats?.partidos ?? [];
  const n = (r: TeamStatsMatch["resultado"]) => partidos.filter((p) => p.resultado === r).length;
  const ultimos = partidos.slice(-ULTIMOS).reverse();
  const conPistas = partidos.some((p) => p.pistas.length > 0);

  return (
    <div className="space-y-4">
      <section className="animate-fade-in-up grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-2xl bg-ink p-5 text-ink-foreground sm:gap-8 sm:p-7">
        <AnilloStats pct={stats ? stats.win_pct : null} />
        <div className="min-w-0 space-y-3">
          {stats === null ? (
            <p className="text-sm text-ink-muted">{t("stats.noMatchesTeam")}</p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-evt-torneo">
                {t("stats.teamPlayed", { count: stats?.jugados ?? 0 })}
              </p>
              <div className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                <Cifra v={n("G")} l={t("stats.won")} className="text-accent" i={0} />
                <Cifra v={n("E")} l={t("stats.drawn")} className="text-evt-torneo" i={1} />
                <Cifra v={n("P")} l={t("stats.lost")} className="text-danger" i={2} />
                <Cifra
                  v={stats?.racha ?? 0}
                  l={t("stats.streakShort")}
                  className={stats?.racha_victorias ? "text-accent" : "text-danger"}
                  i={3}
                />
              </div>
            </>
          )}
        </div>
        {ultimos.length > 0 && (
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className="mr-1 w-full text-xs font-bold uppercase tracking-widest text-ink-muted sm:w-auto">
              {t("stats.lastN", { count: ultimos.length })}
              <span className="sr-only"> · {t("stats.lastNHint")}</span>
            </span>
            {ultimos.map((p, i) => (
              <span
                key={p.event_id}
                title={`${p.marcador}${p.rival ? ` · ${p.rival}` : ""}`}
                className={`stats-caer flex size-8 items-center justify-center rounded-full text-xs font-extrabold shadow-[inset_-3px_-3px_0_rgb(0_0_0/0.15)] ${BOLA[p.resultado]}`}
                style={{ animationDelay: `${450 + i * 90}ms` }}
              >
                {t(`stats.short${p.resultado}`)}
              </span>
            ))}
          </div>
        )}
      </section>

      {stats && conPistas && <PistaAPista stats={stats} />}

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <PairsSection teamId={teamId} />
      </div>

      {isManager && entrenos != null && (
        <p className="text-xs text-muted-foreground">
          {t("stats.totalTrainings", { count: entrenos })}
        </p>
      )}
    </div>
  );
}

/** Cada pista de cada enfrentamiento: verde ganada, roja perdida, en orden. */
function PistaAPista({ stats }: { stats: NonNullable<TeamStats> }) {
  const { t } = useTranslation();
  let k = 0;
  return (
    <section className="surface-card animate-fade-in-up p-5 [animation-delay:120ms]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-display text-lg font-extrabold">{t("stats.courts.title")}</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-ok">
            {t("stats.courts.won", { count: stats.pistas_ganadas })}
          </strong>{" "}
          ·{" "}
          <strong className="text-danger">
            {t("stats.courts.lost", { count: stats.pistas_perdidas })}
          </strong>{" "}
          ·{" "}
          <strong className="text-display text-base text-foreground">
            {stats.diferencia_pistas > 0 ? "+" : ""}
            {stats.diferencia_pistas}
          </strong>
        </p>
      </div>
      <div
        role="img"
        aria-label={t("stats.courts.aria", {
          won: stats.pistas_ganadas,
          lost: stats.pistas_perdidas,
        })}
        className="mt-4 flex flex-wrap gap-x-3.5 gap-y-4"
      >
        {stats.partidos.map((p, i) => (
          <div
            key={p.event_id}
            className="flex w-7 flex-col gap-1"
            title={`${p.marcador}${p.rival ? ` · ${p.rival}` : ""}`}
          >
            {p.pistas.map((g, j) => (
              <span
                key={j}
                title={t(
                  g == null
                    ? "stats.courts.pistaOpen"
                    : g
                      ? "stats.courts.pistaWon"
                      : "stats.courts.pistaLost",
                  { n: j + 1 },
                )}
                className={`stats-pop relative h-5 rounded-[4px] ${g == null ? "bg-muted-foreground/30" : g ? "bg-ok" : "bg-danger"}`}
                style={{ animationDelay: `${250 + Math.min(k++ * 30, 1500)}ms` }}
              >
                <span className="absolute inset-y-[3px] left-1/2 w-0.5 -translate-x-1/2 bg-white/70" />
              </span>
            ))}
            <span className="mt-0.5 text-center text-[0.6875rem] font-bold text-muted-foreground">
              {p.jornada ? t("stats.courts.jornada", { n: p.jornada }) : i + 1}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------- Piezas ---

/** Cuántos seguidos, desde el más reciente, acabaron igual que el último. */
function rachaDe(ganados: boolean[]) {
  if (!ganados.length) return null;
  let n = 0;
  while (n < ganados.length && ganados[n] === ganados[0]) n++;
  return { ganado: ganados[0], n };
}

/** El % de victorias como un anillo que se dibuja al entrar; un guion sin partidos. */
function AnilloStats({ pct }: { pct: number | null }) {
  const { t } = useTranslation();
  const r = 56;
  const largo = 2 * Math.PI * r;
  return (
    <div className="relative size-28 shrink-0 sm:size-36">
      <svg
        viewBox="0 0 132 132"
        className="size-full"
        role="img"
        aria-label={pct == null ? t("ficha.sinPartidos") : t("ficha.pctAria", { pct })}
      >
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          strokeWidth="12"
          className="stroke-ink-foreground/10"
        />
        {pct != null && pct > 0 && (
          <circle
            cx="66"
            cy="66"
            r={r}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${largo} ${largo}`}
            strokeDashoffset={largo * (1 - pct / 100)}
            transform="rotate(-90 66 66)"
            className="stats-aro stroke-accent"
            style={{ "--largo": largo } as CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display text-3xl font-black leading-none sm:text-4xl">
          {pct == null ? "—" : `${pct}%`}
        </span>
        <span className="mt-1 text-[0.625rem] font-bold uppercase tracking-widest text-ink-muted">
          {t("stats.victories")}
        </span>
      </div>
    </div>
  );
}

function Cifra({
  v,
  l,
  className = "",
  i,
}: {
  v: number | string;
  l: string;
  className?: string;
  i: number;
}) {
  return (
    <div className="animate-fade-in-up min-w-0" style={{ animationDelay: `${300 + i * 90}ms` }}>
      <p
        className={`text-display text-2xl font-black leading-none tabular-nums sm:text-3xl ${className}`}
      >
        {v}
      </p>
      <p className="mt-1 truncate text-xs text-ink-muted">{l}</p>
    </div>
  );
}
