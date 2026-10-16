import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Dumbbell, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import type {
  EventResponse,
  PlayerCard,
  TeamStats,
  TeamStatsMatch,
  TrainingStandings,
} from "@/lib/types";
import { ladoDe } from "@/lib/lado";
import { manoDe } from "@/lib/mano";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useVistasClasificacion } from "@/hooks/use-vistas-clasificacion";
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

/** El `competition_id` de los partidos que no son de ninguna competición. */
const SIN_COMPETICION = "ninguna";

/**
 * Lo que se mira: los partidos de una competición —o los que no son de
 * ninguna— o todos los entrenos juntos. Las competiciones no se suman entre
 * sí: cada una va por su lado.
 */
type Ambito = { tipo: "partidos"; competitionId?: string } | { tipo: "entrenos" };
type OpcionAmbito = { clave: string; nombre: string; ambito: Ambito; icono: ReactNode };

/** Cuántos resultados caen como pelotas en la racha del equipo. */
const ULTIMOS = 10;
/** Cuántos puestos de la clasificación de entrenos se ven aquí. */
const PUESTOS = 5;

/** Primero lo de quien mira y luego lo del equipo, cada cosa en su pestaña. */
function Estadisticas() {
  const { t } = useTranslation();
  const { active } = useActiveTeam();
  const [pestana, setPestana] = useState<Pestana>("mio");
  const [clave, setClave] = useState<string | null>(null);
  const { opciones, isLoading } = useAmbitos(active?.team.id ?? null);

  if (!active) return <EmptyTeamState />;

  // Sin nada jugado todavía, los partidos sin filtrar: enseñan sus vacíos.
  const elegida = opciones.find((o) => o.clave === clave) ?? opciones[0];
  const ambito: Ambito = elegida?.ambito ?? { tipo: "partidos" };
  const teamId = active.team.id;

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

      {opciones.length > 0 && (
        <Ambitos opciones={opciones} elegida={elegida.clave} onChange={setClave} />
      )}

      {/* Con `key`, al cambiar de pestaña o de competición se monta de nuevo y
          las animaciones se repiten. */}
      {!isLoading && (
        <div
          key={`${pestana}-${elegida?.clave ?? "todo"}`}
          role="tabpanel"
          id={`stats-panel-${pestana}`}
          aria-labelledby={`stats-tab-${pestana}`}
        >
          {ambito.tipo === "entrenos" ? (
            pestana === "mio" ? (
              <EntrenosMio teamId={teamId} />
            ) : (
              <EntrenosEquipo teamId={teamId} />
            )
          ) : pestana === "mio" ? (
            <LoMio teamId={teamId} competitionId={ambito.competitionId} />
          ) : (
            <ElEquipo teamId={teamId} competitionId={ambito.competitionId} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lo que se puede mirar: cada competición de partidos con algo jugado, los
 * partidos sin competición si los hay y, al final, los entrenos. Las
 * competiciones de entrenos no salen solas: van dentro de «Entrenos».
 */
function useAmbitos(teamId: string | null) {
  const { t } = useTranslation();
  const { disponibles, competitions, isLoading } = useVistasClasificacion(teamId);
  const opciones: OpcionAmbito[] = [];
  for (const c of competitions ?? []) {
    if (!c.formato && disponibles?.competiciones.includes(c.id)) {
      opciones.push({
        clave: `c:${c.id}`,
        nombre: c.nombre,
        ambito: { tipo: "partidos", competitionId: c.id },
        icono: <Trophy aria-hidden="true" />,
      });
    }
  }
  if (disponibles?.sin_competicion) {
    opciones.push({
      clave: SIN_COMPETICION,
      nombre: t("stats.scopes.none"),
      ambito: { tipo: "partidos", competitionId: SIN_COMPETICION },
      icono: <CalendarDays aria-hidden="true" />,
    });
  }
  if (disponibles?.entrenos) {
    opciones.push({
      clave: "entrenos",
      nombre: t("stats.scopes.trainings"),
      ambito: { tipo: "entrenos" },
      icono: <Dumbbell aria-hidden="true" />,
    });
  }
  return { opciones, isLoading };
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

/** Una pastilla por competición, la de sin competición y la de entrenos. */
function Ambitos({
  opciones,
  elegida,
  onChange,
}: {
  opciones: OpcionAmbito[];
  elegida: string;
  onChange: (clave: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("stats.scopes.label")}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {opciones.map((o) => {
        const sel = o.clave === elegida;
        return (
          <button
            key={o.clave}
            type="button"
            aria-pressed={sel}
            onClick={() => onChange(o.clave)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 ${sel ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {o.icono}
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ Lo común ---

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

/** Mis convocatorias que ya pasaron, de la más antigua a la más reciente, en `ambito`. */
function useMisConvocatorias(teamId: string, ambito: Ambito) {
  const { user } = useSession();
  const { data } = useQuery({
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
  return (data ?? []).filter((r) => {
    if (ambito.tipo === "entrenos") return r.event_tipo === "entrenamiento";
    if (r.event_tipo !== "partido") return false;
    if (!ambito.competitionId) return true;
    if (ambito.competitionId === SIN_COMPETICION) return r.event_competition_id == null;
    return r.event_competition_id === ambito.competitionId;
  });
}

/** Lado, mano y nivel de quien mira, para el antetítulo de la banda. */
function useDatosMios() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const lado = ladoDe(profile?.posicion);
  const mano = manoDe(profile?.mano_dominante);
  const datos = [
    lado && t(`lado.${lado}`),
    mano && t(`mano.${mano}`),
    profile?.nivel && `${t("ficha.nivel")} ${profile.nivel}`,
  ].filter(Boolean) as string[];
  return { lado, datos };
}

/** La banda oscura: el anillo, lo de en medio, en lo mío la pista y, abajo, `pie`. */
function Banda({
  anillo,
  datos,
  children,
  pista,
  pie,
}: {
  anillo: ReactNode;
  datos?: string;
  children: ReactNode;
  pista?: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <section
      className={`animate-fade-in-up grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-2xl bg-ink p-5 text-ink-foreground sm:gap-8 sm:p-7 ${pista ? "lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,300px)]" : ""}`}
    >
      {anillo}
      <div className="min-w-0 space-y-3">
        {datos && (
          <p className="text-xs font-bold uppercase tracking-widest text-evt-torneo">{datos}</p>
        )}
        {children}
      </div>
      {pista}
      {pie && <div className="col-span-full">{pie}</div>}
    </section>
  );
}

/** La pista con la pelota y, si lo ha dicho en su perfil, su lado marcado. */
function PistaMia({ lado }: { lado: ReturnType<typeof ladoDe> }) {
  const { t } = useTranslation();
  return (
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
  );
}

/** Una casilla por convocatoria, en su color, con la asistencia. */
function Convocatorias({ lista }: { lista: EventResponse[] }) {
  const { t, i18n } = useTranslation();
  const dia = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
  const cuenta = (e: Estado) => lista.filter((r) => estadoDe(r.status) === e).length;
  const asistencia = lista.length ? Math.round((cuenta("confirmado") / lista.length) * 100) : 0;
  const ultima = lista[lista.length - 1];

  return (
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
          {ultima && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("stats.callups.last", {
                fecha: dia.format(new Date(ultima.event_fecha_inicio)),
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------- Partidos ---

function LoMio({ teamId, competitionId }: { teamId: string; competitionId?: string }) {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const dia = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
  const { lado, datos } = useDatosMios();
  const lista = useMisConvocatorias(teamId, { tipo: "partidos", competitionId });

  const { data: ficha } = useQuery({
    queryKey: ["player-card", teamId, user?.id, competitionId ?? null],
    enabled: !!user,
    queryFn: () =>
      api.get<PlayerCard>("/stats/player-card/", {
        team_id: teamId,
        user_id: user!.id,
        ...(competitionId ? { competition_id: competitionId } : {}),
      }),
  });

  const jugados = (ficha?.partidos ?? []).filter((p) => p.ganado != null);
  const racha = rachaDe(jugados.map((p) => p.ganado!));
  const ultimo = ficha?.partidos[0];
  const pareja = ultimo?.pareja
    ? [ultimo.pareja.nombre, ultimo.pareja.apellidos].filter(Boolean).join(" ")
    : null;

  return (
    <div className="space-y-4">
      <Banda
        anillo={<AnilloStats pct={ficha?.disputados ? ficha.win_pct : null} />}
        datos={datos.join(" · ")}
        pista={<PistaMia lado={lado} />}
      >
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
      </Banda>

      <Convocatorias lista={lista} />

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <PairsSection
          teamId={teamId}
          mine
          currentUserId={user?.id}
          ambito="partidos"
          competitionId={competitionId}
        />
      </div>
    </div>
  );
}

const BOLA: Record<TeamStatsMatch["resultado"], string> = {
  G: "bg-accent text-ink",
  E: "bg-evt-torneo text-ink",
  P: "bg-danger text-white",
};

function ElEquipo({ teamId, competitionId }: { teamId: string; competitionId?: string }) {
  const { t } = useTranslation();

  const { data: stats } = useQuery({
    queryKey: ["team-stats", teamId, competitionId ?? null],
    // Era la vista SQL `team_match_stats`; ahora la agrega el backend.
    queryFn: () =>
      api.get<TeamStats>("/stats/team/", {
        team_id: teamId,
        ...(competitionId ? { competition_id: competitionId } : {}),
      }),
  });

  const partidos = stats?.partidos ?? [];
  const n = (r: TeamStatsMatch["resultado"]) => partidos.filter((p) => p.resultado === r).length;
  const ultimos = partidos.slice(-ULTIMOS).reverse();
  const conPistas = partidos.some((p) => p.pistas.length > 0);

  return (
    <div className="space-y-4">
      <Banda
        anillo={<AnilloStats pct={stats ? stats.win_pct : null} />}
        pie={
          ultimos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
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
          )
        }
      >
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
      </Banda>

      {stats && conPistas && <PistaAPista stats={stats} />}

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <PairsSection teamId={teamId} ambito="partidos" competitionId={competitionId} />
      </div>
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

// ------------------------------------------------------------- Entrenos ---

/** Todos los entrenos del equipo juntos, midan como midan (ver Miembros). */
function useClasificacionEntrenos(teamId: string) {
  return useQuery({
    queryKey: ["training-standings", teamId],
    queryFn: () => api.get<TrainingStandings>("/stats/trainings/", { team_id: teamId }),
  });
}

function EntrenosMio({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const { lado, datos } = useDatosMios();
  const lista = useMisConvocatorias(teamId, { tipo: "entrenos" });
  const { data: clasif } = useClasificacionEntrenos(teamId);
  const fila = clasif?.standings.find((s) => s.user_id === user?.id);
  const falta = fila && clasif ? clasif.minimo_podio - fila.entrenamientos : 0;

  return (
    <div className="space-y-4">
      <Banda
        anillo={
          <AnilloStats
            pct={fila ? Math.round(fila.nota) : null}
            etiqueta={t("stats.trainings.nota")}
          />
        }
        datos={datos.join(" · ")}
        pista={<PistaMia lado={lado} />}
      >
        {clasif && !fila ? (
          <p className="text-sm text-ink-muted">{t("stats.trainings.nada")}</p>
        ) : (
          <>
            <div className="grid max-w-md grid-cols-3 gap-3">
              <Cifra
                v={fila ? `${fila.puesto}.º` : "—"}
                l={`${t("stats.trainings.puesto")} ${t("stats.trainings.de", { count: clasif?.standings.length ?? 0 })}`}
                className="text-evt-torneo"
                i={0}
              />
              <Cifra v={fila?.entrenamientos ?? 0} l={t("stats.trainings.noches")} i={1} />
              <Cifra
                v={clasif ? Math.round(clasif.media) : "—"}
                l={t("stats.trainings.media")}
                i={2}
              />
            </div>
            {fila && (
              <p className="text-sm text-ink-muted">
                {falta > 0
                  ? t("stats.trainings.falta", { count: falta })
                  : t("stats.trainings.dentro")}
              </p>
            )}
          </>
        )}
      </Banda>

      <Convocatorias lista={lista} />

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <PairsSection teamId={teamId} mine currentUserId={user?.id} ambito="entrenos" />
      </div>
    </div>
  );
}

function EntrenosEquipo({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const { data: clasif } = useClasificacionEntrenos(teamId);
  const standings = clasif?.standings ?? [];
  const vacia = clasif && !standings.length;

  return (
    <div className="space-y-4">
      <Banda
        anillo={
          <AnilloStats
            pct={clasif && !vacia ? Math.round(clasif.media) : null}
            etiqueta={t("stats.trainings.notaMedia")}
          />
        }
      >
        {vacia ? (
          <p className="text-sm text-ink-muted">{t("stats.trainings.nadaEquipo")}</p>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-evt-torneo">
              {t("stats.trainings.cuantos", { count: clasif?.entrenamientos ?? 0 })}
            </p>
            <div className="grid max-w-xl grid-cols-3 gap-3">
              <Cifra v={standings.length} l={t("stats.trainings.jugadores")} i={0} />
              <Cifra
                v={standings.filter((s) => s.clasificado).length}
                l={t("stats.trainings.clasificados")}
                className="text-accent"
                i={1}
              />
              <Cifra v={clasif?.minimo_podio ?? 0} l={t("stats.trainings.minimo")} i={2} />
            </div>
          </>
        )}
      </Banda>

      {standings.length > 0 && (
        <section className="surface-card animate-fade-in-up overflow-hidden [animation-delay:120ms]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-display text-lg font-extrabold">{t("stats.trainings.tabla")}</h2>
            <Link to="/miembros" className="text-sm font-semibold text-primary hover:underline">
              {t("stats.trainings.verEntera")}
            </Link>
          </div>
          <ol className="divide-y divide-border">
            {standings.slice(0, PUESTOS).map((s, i) => (
              <li
                key={s.user_id}
                className={`animate-fade-in-up flex items-center gap-3 px-5 py-3 ${s.user_id === user?.id ? "bg-primary/5" : ""}`}
                style={{ animationDelay: `${250 + i * 70}ms` }}
              >
                <span className="text-display w-7 shrink-0 text-lg font-black text-muted-foreground">
                  {s.puesto}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {[s.profile?.nombre, s.profile?.apellidos].filter(Boolean).join(" ") || "—"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("stats.trainings.nochesN", { count: s.entrenamientos })}
                  </span>
                </span>
                <span className="text-display text-lg font-black tabular-nums">
                  {Math.round(s.nota)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="animate-fade-in-up [animation-delay:200ms]">
        <PairsSection teamId={teamId} ambito="entrenos" />
      </div>
    </div>
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

/**
 * Un % como un anillo que se dibuja al entrar; un guion sin nada jugado. Por
 * defecto, el de victorias; en entrenos, la nota.
 */
function AnilloStats({ pct, etiqueta }: { pct: number | null; etiqueta?: string }) {
  const { t } = useTranslation();
  const r = 56;
  const largo = 2 * Math.PI * r;
  const texto = etiqueta ?? t("stats.victories");
  return (
    <div className="relative size-28 shrink-0 sm:size-36">
      <svg
        viewBox="0 0 132 132"
        className="size-full"
        role="img"
        aria-label={
          pct == null
            ? t("ficha.sinPartidos")
            : etiqueta
              ? `${etiqueta}: ${pct}`
              : t("ficha.pctAria", { pct })
        }
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
            strokeDashoffset={largo * (1 - Math.min(pct, 100) / 100)}
            transform="rotate(-90 66 66)"
            className="stats-aro stroke-accent"
            style={{ "--largo": largo } as CSSProperties}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display text-3xl font-black leading-none sm:text-4xl">
          {pct == null ? "—" : etiqueta ? pct : `${pct}%`}
        </span>
        <span className="mt-1 text-[0.625rem] font-bold uppercase tracking-widest text-ink-muted">
          {texto}
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
