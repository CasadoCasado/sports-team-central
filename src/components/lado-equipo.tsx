/**
 * Lo que va a la derecha de la banda del equipo en Estadísticas, como la
 * pista en la de cada jugador: el próximo enfrentamiento, cara a cara, o, si
 * no queda ninguno por jugar, el escudo con los datos del equipo.
 *
 * El escudo se pinta con los colores del equipo (`color_primario` y
 * `color_secundario`); sin ellos, con los de la app. Si el equipo tiene logo,
 * va el logo en su lugar.
 */

import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { api } from "@/lib/api";
import { sportLabel } from "@/lib/sports";
import type { Team, TeamEvent } from "@/lib/types";
import { Picture } from "@/components/picture";

/** El `competition_id` de los partidos que no son de ninguna competición. */
const SIN_COMPETICION = "ninguna";

const FORMA = "M100 6 L188 34 V112 C188 168 150 204 100 224 C50 204 12 168 12 112 V34 Z";

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

/**
 * `competitionId` es la competición que se está mirando: el próximo
 * enfrentamiento es el de esa (o uno sin competición, con `ninguna`).
 */
export function LadoEquipo({ team, competitionId }: { team: Team; competitionId?: string }) {
  const { data: proximos } = useQuery({
    queryKey: ["stats-next-matches", team.id],
    queryFn: () =>
      api.get<TeamEvent[]>("/events/", {
        team_id: team.id,
        tipo: "partido",
        fecha_inicio__gte: new Date().toISOString(),
        order: "fecha_inicio",
        limit: 20,
      }),
  });

  const siguiente = (proximos ?? []).find((e) =>
    !competitionId
      ? true
      : competitionId === SIN_COMPETICION
        ? e.competition_id == null
        : e.competition_id === competitionId,
  );

  return (
    <div className="col-span-2 min-w-0 border-t border-ink-foreground/10 pt-5 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
      {/* Hasta saber si hay próximo, el hueco reservado: sin saltos. */}
      {!proximos ? (
        <div className="h-40" />
      ) : siguiente ? (
        <CaraACara team={team} partido={siguiente} />
      ) : (
        <FichaEscudo team={team} />
      )}
    </div>
  );
}

/** El escudo del equipo en sus colores, con sus iniciales. */
function Escudo({ team, className }: { team: Team; className?: string }) {
  const { t } = useTranslation();
  const clip = `escudo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 200 230"
      className={className}
      role="img"
      aria-label={t("stats.equipo.escudoAria", { nombre: team.nombre })}
    >
      <defs>
        <clipPath id={clip}>
          <path d={FORMA} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect
          width="200"
          height="230"
          className={team.color_primario ? undefined : "fill-primary"}
          style={team.color_primario ? { fill: team.color_primario } : undefined}
        />
        <polygon
          points="0,150 200,60 200,96 0,186"
          className={team.color_secundario ? undefined : "fill-evt-torneo"}
          style={team.color_secundario ? { fill: team.color_secundario } : undefined}
        />
      </g>
      <path d={FORMA} fill="none" strokeWidth="8" className="stroke-ink-foreground/85" />
      <text
        x="100"
        y="128"
        textAnchor="middle"
        className="fill-white font-display"
        fontWeight="900"
        fontSize="78"
        letterSpacing="-2"
      >
        {iniciales(team.nombre)}
      </text>
    </svg>
  );
}

/** El logo si lo hay; si no, el escudo. */
function Insignia({ team, className }: { team: Team; className: string }) {
  return (
    <Picture
      url={team.logo_url}
      alt={team.nombre}
      className={className}
      imgClassName="size-full rounded-xl object-contain"
      fallback={<Escudo team={team} className="size-full" />}
    />
  );
}

/** Sin próximo enfrentamiento: el escudo grande y quién es el equipo. */
function FichaEscudo({ team }: { team: Team }) {
  const { t, i18n } = useTranslation();
  const lugar = [team.ciudad, team.instalacion].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-5">
      <div className="stats-escudo relative h-36 w-[7.5rem] shrink-0">
        <Insignia team={team} className="size-full" />
        <span
          aria-hidden="true"
          className="stats-brillo-escudo pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span />
        </span>
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-display text-2xl font-black leading-tight">{team.nombre}</p>
        <div className="flex flex-wrap gap-1.5">
          {team.deporte && (
            <span className="rounded-md bg-[#d7f24b]/15 px-2 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wider text-[#d7f24b]">
              {sportLabel(team.deporte, i18n.language)}
            </span>
          )}
          {team.categoria && (
            <span className="rounded-md bg-ink-foreground/10 px-2 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-foreground/80">
              {team.categoria}
            </span>
          )}
        </div>
        {lugar && (
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{lugar}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          {t("stats.equipo.miembros", { count: team.member_count })}
        </p>
      </div>
    </div>
  );
}

/** Cuántos días faltan, de calendario: hoy, mañana o en N días. */
function faltan(fecha: Date) {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((dia(fecha) - dia(new Date())) / 86_400_000);
}

/** El próximo enfrentamiento: nuestro escudo, el rival y cuándo y dónde. */
function CaraACara({ team, partido }: { team: Team; partido: TeamEvent }) {
  const { t, i18n } = useTranslation();
  const fecha = new Date(partido.fecha_inicio);
  const dias = faltan(fecha);
  const cuando = new Intl.DateTimeFormat(i18n.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
  const rival = partido.rival || partido.titulo;
  const sitio = [
    partido.es_local == null
      ? null
      : t(partido.es_local ? "stats.equipo.enCasa" : "stats.equipo.fuera"),
    partido.ubicacion,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-extrabold uppercase tracking-widest text-ink-muted">
          {t("stats.equipo.proximo")}
          {partido.jornada ? ` · ${t("stats.courts.jornada", { n: partido.jornada })}` : ""}
        </span>
        <span className="stats-pop rounded-full bg-accent/15 px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wider text-accent [animation-delay:1100ms]">
          {dias <= 0
            ? t("stats.equipo.hoy")
            : dias === 1
              ? t("stats.equipo.manana")
              : t("stats.equipo.enDias", { count: dias })}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
        <div className="stats-entra-izq flex min-w-0 flex-col items-center gap-2">
          <Insignia team={team} className="h-[4.5rem] w-16" />
          <span className="max-w-full truncate text-center text-sm font-extrabold">
            {team.nombre}
          </span>
        </div>
        <span className="stats-pop flex size-10 items-center justify-center rounded-full bg-[#d7f24b] font-display text-[15px] font-black text-ink shadow-[0_0_0_6px_rgb(215_242_75/0.14)] [animation-delay:800ms]">
          {t("stats.equipo.vs")}
        </span>
        <div className="stats-entra-der flex min-w-0 flex-col items-center gap-2">
          <span className="my-1 flex size-16 items-center justify-center rounded-full bg-ink-foreground/10 font-display text-2xl font-black text-ink-foreground/80 shadow-[inset_0_0_0_3px_rgb(255_255_255/0.15)]">
            {iniciales(rival)}
          </span>
          <span className="max-w-full truncate text-center text-sm font-extrabold text-ink-foreground/80">
            {rival}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-dashed border-ink-foreground/15 pt-3 text-sm text-ink-muted">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            <strong className="font-bold text-ink-foreground">{cuando}</strong>
            {partido.competition_nombre ? ` · ${partido.competition_nombre}` : ""}
          </span>
        </p>
        {sitio && (
          <p className="flex items-center gap-2">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{sitio}</span>
          </p>
        )}
        <Link
          to="/eventos/$id"
          params={{ id: partido.id }}
          search={{ desde: "estadisticas" }}
          className="inline-flex min-h-11 items-center text-sm font-bold text-[#93c5fd] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("stats.equipo.verConvocatoria")} →
        </Link>
      </div>
    </div>
  );
}
