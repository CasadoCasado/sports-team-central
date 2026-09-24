import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDown, Crown, MoreHorizontal, Trash2, Trophy } from "lucide-react";

import { api } from "@/lib/api";
import { ladoDe, type Lado } from "@/lib/lado";
import type {
  Competition,
  CompetitionStandings,
  PlayerStats,
  TeamMember,
  TeamRole,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Picture } from "@/components/picture";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Partidos que hay que llevar para subir al podio de los enfrentamientos. */
const MIN_PARTIDOS = 5;

/** Los roles que no juegan: van aparte, salvo que hayan jugado algo. */
const STAFF: TeamRole[] = ["entrenador", "delegado"];

const ROLES: TeamRole[] = ["jugador", "entrenador", "delegado", "co_capitan", "capitan"];

/** El color de cada rol: los mismos que los tipos de evento. */
const COLOR_ROL: Record<TeamRole, string> = {
  capitan: "text-evt-torneo",
  co_capitan: "text-evt-torneo",
  entrenador: "text-evt-entreno",
  delegado: "text-evt-reunion",
  jugador: "text-primary",
};

/**
 * Qué se está mirando: los enfrentamientos, los entrenos, o una competición
 * (`c:<id>`). Una competición con formato se ve con su propia clasificación;
 * una sin formato solo agrupa partidos, y se ve como enfrentamientos suyos.
 */
export type Vista = "partidos" | "entrenos" | `c:${string}`;

/**
 * Cómo se mide. En los partidos, el % de victorias. En los entrenos, la nota
 * de la noche (0 a 100) que usan las competiciones: cada formato de entreno
 * mide una cosa distinta y la nota es lo único que tienen en común.
 */
type Medida = "pct" | "nota";

/** Lo que cambia los textos: de qué se habla en cada vista. */
type Modo = "partidos" | "partidosComp" | "entrenos" | "competicion";

type Orden = "nombre" | "jugados" | "v" | "d" | "valor" | "ultimo";

type Dato = {
  jugados: number;
  v: number;
  d: number;
  /** `null` mientras no haya jugado: un 0 % diría que lo ha perdido todo. */
  valor: number | null;
  ultimo: string | null;
  /** Si llega al mínimo para subir al podio. */
  clasificado: boolean;
  /** El puesto que da el servidor, cuando lo da: manda en los entrenos. */
  puesto: number | null;
};

type Balance = { medida: Medida; minimo: number; porUsuario: Map<string, Dato> };

type Fila = Dato & {
  member: TeamMember;
  nombre: string;
  iniciales: string;
  lado: Lado | null;
};

function balanceDePartidos(stats: PlayerStats[]): Balance {
  return {
    medida: "pct",
    minimo: MIN_PARTIDOS,
    porUsuario: new Map(
      stats.map((s) => [
        s.user_id,
        {
          jugados: s.disputados,
          v: s.victorias,
          d: s.derrotas,
          valor: s.disputados > 0 ? s.win_pct : null,
          ultimo: s.ultimo_partido,
          clasificado: s.disputados >= MIN_PARTIDOS,
          puesto: null,
        },
      ]),
    ),
  };
}

type Clasificacion = Pick<CompetitionStandings, "minimo_podio" | "standings">;

function balanceDeNotas(c: Clasificacion): Balance {
  return {
    medida: "nota",
    minimo: c.minimo_podio,
    porUsuario: new Map(
      c.standings.map((s) => [
        s.user_id,
        {
          jugados: s.entrenamientos,
          v: 0,
          d: 0,
          valor: s.nota,
          ultimo: null,
          clasificado: s.clasificado,
          puesto: s.puesto,
        },
      ]),
    ),
  };
}

const SIN_DATOS: Dato = {
  jugados: 0,
  v: 0,
  d: 0,
  valor: null,
  ultimo: null,
  clasificado: false,
  puesto: null,
};

function filasDelEquipo(members: TeamMember[], balance: Balance): Fila[] {
  return members.map((m) => ({
    ...(balance.porUsuario.get(m.user_id) ?? SIN_DATOS),
    member: m,
    nombre: [m.profile?.nombre, m.profile?.apellidos].filter(Boolean).join(" ") || "—",
    iniciales: ((m.profile?.nombre?.[0] ?? "") + (m.profile?.apellidos?.[0] ?? "")).toUpperCase(),
    lado: ladoDe(m.profile?.posicion),
  }));
}

const porNombre = (a: Fila, b: Fila) => a.nombre.localeCompare(b.nombre);

/**
 * El orden por la medida. En los entrenos manda el puesto del servidor, que
 * es el mismo que enseña Competiciones: así las dos pantallas nunca dicen
 * cosas distintas. En los partidos, quien llega al mínimo va delante: un
 * 100 % con un partido no es un líder.
 */
function porValor(medida: Medida) {
  return medida === "nota"
    ? (a: Fila, b: Fila) => (a.puesto ?? Infinity) - (b.puesto ?? Infinity) || porNombre(a, b)
    : (a: Fila, b: Fila) =>
        Number(b.clasificado) - Number(a.clasificado) ||
        (b.valor ?? -1) - (a.valor ?? -1) ||
        b.jugados - a.jugados ||
        porNombre(a, b);
}

function ordenar(filas: Fila[], orden: Orden, medida: Medida): Fila[] {
  const criterios: Record<Orden, (a: Fila, b: Fila) => number> = {
    nombre: porNombre,
    jugados: (a, b) => b.jugados - a.jugados || porNombre(a, b),
    v: (a, b) => b.v - a.v || porNombre(a, b),
    d: (a, b) => b.d - a.d || porNombre(a, b),
    valor: porValor(medida),
    ultimo: (a, b) => (b.ultimo ?? "").localeCompare(a.ultimo ?? "") || porNombre(a, b),
  };
  return [...filas].sort(criterios[orden]);
}

/** Quién sube al podio: los tres primeros entre quienes llegan al mínimo. */
function podio(filas: Fila[], medida: Medida): Fila[] {
  return filas
    .filter((f) => f.clasificado)
    .sort(porValor(medida))
    .slice(0, 3);
}

/** «hace 3 días», «hace 2 semanas»… en el idioma de la app. */
function haceCuanto(fecha: string, lang: string): string {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const dias = Math.round((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (dias < 7) return rtf.format(-Math.max(dias, 0), "day");
  if (dias < 60) return rtf.format(-Math.round(dias / 7), "week");
  return rtf.format(-Math.round(dias / 30), "month");
}

function useValor() {
  const { i18n } = useTranslation();
  const nota = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  return (medida: Medida, valor: number) => (medida === "pct" ? `${valor}%` : nota.format(valor));
}

function useCompeticiones(teamId: string) {
  return useQuery({
    queryKey: ["team-competitions", teamId],
    queryFn: () =>
      api.get<Competition[]>("/competitions/", { team_id: teamId, order: "-created_at" }),
  });
}

/**
 * Qué clasificación se ve: enfrentamientos, entrenos o una competición.
 *
 * Va aparte de la tabla porque en la página se coloca en la cabecera, debajo
 * de «Invitar», y no encima del podio.
 */
export function VistaSelector({
  teamId,
  vista,
  onChange,
  className,
}: {
  teamId: string;
  vista: Vista;
  onChange: (v: Vista) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { data: competitions } = useCompeticiones(teamId);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label
        htmlFor="vista-clasificacion"
        className="text-2xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        {t("members.ranking")}
      </label>
      <select
        id="vista-clasificacion"
        value={vista}
        onChange={(e) => onChange(e.target.value as Vista)}
        className="min-h-10 min-w-0 max-w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold"
      >
        <option value="partidos">{t("members.viewMatches")}</option>
        <option value="entrenos">{t("members.viewTrainings")}</option>
        {(competitions?.length ?? 0) > 0 && (
          <optgroup label={t("members.viewCompetitions")}>
            {competitions!.map((c) => (
              <option key={c.id} value={`c:${c.id}`}>
                {c.finalizada ? `${c.nombre} · ${t("members.finished")}` : c.nombre}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

type Props = {
  teamId: string;
  /** Qué se mide; lo elige el `VistaSelector` de la página. */
  vista: Vista;
  members: TeamMember[];
  currentUserId: string | undefined;
  canManage: boolean;
  onChangeRole: (memberId: string, role: TeamRole) => void;
  onRemove: (memberId: string) => void;
};

/**
 * La plantilla como la clasificación de una liga: un podio con los que van
 * mejor y, debajo, la tabla del equipo ordenable por columnas. Qué se mide
 * —los enfrentamientos, los entrenos o una competición— llega en `vista`.
 *
 * Hay tres momentos en la vida de un equipo y los tres tienen que verse bien:
 * - Nadie ha jugado todavía: ni podio ni columnas de guiones, solo la
 *   plantilla y una línea que cuenta qué va a aparecer aquí.
 * - Hay resultados pero nadie llega al mínimo: la tabla sí, el podio espera,
 *   y se dice quién está más cerca.
 * - Uno o dos llegan al mínimo: el podio sale con los huecos que falten.
 */
export function MembersRanking({
  teamId,
  vista,
  members,
  currentUserId,
  canManage,
  onChangeRole,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const [quitando, setQuitando] = useState<Fila | null>(null);
  // El orden vale para la vista en la que se eligió. Al cambiar de vista se
  // vuelve a la medida: las columnas de victorias, derrotas y último partido
  // no están en los entrenos.
  const [ordenElegido, setOrdenElegido] = useState<{ vista: Vista; orden: Orden }>({
    vista,
    orden: "valor",
  });
  const orden = ordenElegido.vista === vista ? ordenElegido.orden : "valor";
  const setOrden = (o: Orden) => setOrdenElegido({ vista, orden: o });

  const { data: competitions } = useCompeticiones(teamId);

  const competition = vista.startsWith("c:")
    ? competitions?.find((c) => c.id === vista.slice(2))
    : undefined;

  const { data: balance } = useQuery({
    queryKey: ["members-balance", teamId, vista, competition?.formato ?? null],
    // Una competición hace falta tenerla para saber si tiene clasificación.
    enabled: !vista.startsWith("c:") || !!competition,
    queryFn: async (): Promise<Balance> => {
      if (vista === "entrenos") {
        return balanceDeNotas(
          await api.get<Clasificacion>("/stats/trainings/", { team_id: teamId }),
        );
      }
      if (competition?.formato) {
        return balanceDeNotas(
          await api.get<CompetitionStandings>(`/competitions/${competition.id}/standings/`),
        );
      }
      return balanceDePartidos(
        await api.get<PlayerStats[]>("/stats/players/", {
          team_id: teamId,
          ...(competition ? { competition_id: competition.id } : {}),
        }),
      );
    },
  });

  const modo: Modo =
    vista === "partidos"
      ? "partidos"
      : vista === "entrenos"
        ? "entrenos"
        : competition?.formato
          ? "competicion"
          : "partidosComp";

  const menu = (f: Fila) =>
    canManage && f.member.user_id !== currentUserId ? (
      <MenuMiembro fila={f} onChangeRole={onChangeRole} onRemove={() => setQuitando(f)} />
    ) : null;

  if (!balance) {
    return <div className="surface-card h-40 animate-pulse" aria-busy="true" />;
  }

  const filas = filasDelEquipo(members, balance);
  const staff = filas.filter((f) => STAFF.includes(f.member.role) && f.jugados === 0);
  const jugadores = filas.filter((f) => !staff.includes(f));
  const sinResultados = jugadores.every((f) => f.jugados === 0);
  const top = podio(jugadores, balance.medida);
  const masJugados = [...jugadores].sort((a, b) => b.jugados - a.jugados)[0];
  const nombreComp = competition?.nombre ?? "";

  return (
    <div className="space-y-6">
      {sinResultados ? (
        <div className="surface-card flex flex-col items-center gap-2 px-6 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-evt-torneo/15 text-evt-torneo">
            <Trophy className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-display text-lg font-bold">
            {t(`members.emptyState.${modo}.title`, { name: nombreComp })}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t(`members.emptyState.${modo}.body`, { min: balance.minimo, name: nombreComp })}
          </p>
        </div>
      ) : top.length > 0 ? (
        <Podio top={top} medida={balance.medida} minimo={balance.minimo} />
      ) : (
        <p className="surface-card flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Trophy className="size-5 shrink-0 text-evt-torneo" aria-hidden="true" />
          <span>
            {t(balance.medida === "pct" ? "members.podiumPending" : "members.podiumPendingNights", {
              min: balance.minimo,
              name: masJugados.member.profile?.nombre ?? masJugados.nombre,
              count: masJugados.jugados,
            })}
          </span>
        </p>
      )}

      {staff.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("members.staff")}
          </span>
          {staff.map((f) => (
            <span
              key={f.member.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-1.5 text-sm"
            >
              <Avatar fila={f} className="size-6 text-3xs" />
              {f.nombre}
              <span
                className={cn(
                  "text-3xs font-bold uppercase tracking-widest",
                  COLOR_ROL[f.member.role],
                )}
              >
                {t(`roles.${f.member.role}`)}
              </span>
              {menu(f) ?? <span className="w-1" />}
            </span>
          ))}
        </div>
      )}

      {sinResultados ? (
        <Plantilla filas={jugadores} currentUserId={currentUserId} menu={menu} />
      ) : (
        <Tabla
          filas={ordenar(jugadores, orden, balance.medida)}
          medida={balance.medida}
          orden={orden}
          setOrden={setOrden}
          currentUserId={currentUserId}
          canManage={canManage}
          menu={menu}
          podio={top}
        />
      )}

      <AlertDialog open={!!quitando} onOpenChange={(open) => !open && setQuitando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("members.removeTitle", { name: quitando?.nombre })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("members.removeBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => quitando && onRemove(quitando.member.id)}
            >
              {t("members.removeFrom")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Avatar({ fila, className }: { fila: Fila; className?: string }) {
  return (
    <Picture
      url={fila.member.profile?.avatar_url}
      alt=""
      className={cn("rounded-full bg-primary/10 font-bold text-primary", className)}
      fallback={fila.iniciales}
    />
  );
}

/** Revés, derecha o los dos, como una etiqueta pequeña. */
function EtiquetaLado({ lado, className }: { lado: Lado | null; className?: string }) {
  const { t } = useTranslation();
  if (!lado) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-1.5 text-3xs font-bold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {t(`lado.${lado}`)}
    </span>
  );
}

/**
 * El podio: segundo, primero y tercero, como en uno de verdad. En escritorio
 * va centrado; si solo uno o dos llegan al mínimo, los huecos se quedan a la
 * vista, vacíos, para que se entienda que hay sitio.
 */
function Podio({ top, medida, minimo }: { top: Fila[]; medida: Medida; minimo: number }) {
  const { t } = useTranslation();
  const valor = useValor();
  const puestos = [
    { fila: top[1], n: 2, alto: "h-16" },
    { fila: top[0], n: 1, alto: "h-24" },
    { fila: top[2], n: 3, alto: "h-12" },
  ];
  return (
    <section aria-labelledby="podio-titulo" className="flex flex-col items-center gap-3">
      <h2
        id="podio-titulo"
        className="self-start text-2xs font-bold uppercase tracking-widest text-muted-foreground sm:self-center"
      >
        {t(medida === "pct" ? "members.podiumTitle" : "members.podiumTitleScore")}
      </h2>
      <ol className="grid w-full max-w-md grid-cols-3 items-end gap-2 sm:gap-4">
        {puestos.map(({ fila, n, alto }) => (
          <li key={n} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            {fila ? (
              <>
                <Avatar
                  fila={fila}
                  className={cn(
                    n === 1
                      ? "size-16 text-lg ring-2 ring-evt-torneo ring-offset-2 ring-offset-background"
                      : "size-12 text-sm",
                  )}
                />
                <span className="max-w-full truncate text-sm font-semibold">
                  {fila.member.profile?.nombre ?? fila.nombre}
                </span>
                <EtiquetaLado lado={fila.lado} />
                <span className="text-display text-xl font-black leading-none tabular-nums">
                  {valor(medida, fila.valor!)}
                </span>
                <span className="text-3xs text-muted-foreground">
                  {t(medida === "pct" ? "members.playedCount" : "members.nightsCount", {
                    count: fila.jugados,
                  })}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t("members.podiumFree")}</span>
            )}
            <div
              className={cn(
                "text-display mt-1 flex w-full justify-center rounded-t-xl rounded-b-sm pt-1.5 text-2xl font-black",
                alto,
                !fila
                  ? "border-2 border-dashed border-border text-muted-foreground/60"
                  : n === 1
                    ? "bg-gradient-to-b from-evt-torneo to-evt-torneo/70 text-white"
                    : "bg-gradient-to-b from-primary to-primary/70 text-primary-foreground",
              )}
              aria-label={t("members.position", { n })}
            >
              {n}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {t(medida === "pct" ? "members.podiumRule" : "members.podiumRuleNights", {
          min: minimo,
          count: minimo,
        })}
      </p>
    </section>
  );
}

function Tabla({
  filas,
  medida,
  orden,
  setOrden,
  currentUserId,
  canManage,
  menu,
  podio,
}: {
  filas: Fila[];
  medida: Medida;
  orden: Orden;
  setOrden: (o: Orden) => void;
  currentUserId: string | undefined;
  canManage: boolean;
  menu: (f: Fila) => React.ReactNode;
  podio: Fila[];
}) {
  const { t, i18n } = useTranslation();
  const valor = useValor();
  const esPct = medida === "pct";

  const cabecera = (clave: Orden, texto: string, className?: string, alinear = "justify-end") => (
    <th
      className={cn("px-2 py-2.5 font-bold", className)}
      aria-sort={orden === clave ? (clave === "nombre" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => setOrden(clave)}
        className={cn(
          "inline-flex w-full items-center gap-1 whitespace-nowrap uppercase tracking-widest transition-colors hover:text-foreground",
          alinear,
          orden === clave && "text-primary",
        )}
      >
        {texto}
        {orden === clave && <ArrowDown className="size-3" aria-hidden="true" />}
      </button>
    </th>
  );

  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead className="border-b border-border text-2xs text-muted-foreground">
          <tr>
            <th className="w-10 px-2 py-2.5 text-center font-bold">#</th>
            {cabecera("nombre", t("members.colPlayer"), "text-left", "justify-start")}
            {cabecera("jugados", t(esPct ? "members.colPlayed" : "members.colNights"))}
            {esPct && cabecera("v", t("members.colWon"), "hidden sm:table-cell")}
            {esPct && cabecera("d", t("members.colLost"), "hidden sm:table-cell")}
            {cabecera("valor", t(esPct ? "members.colPct" : "members.colScore"))}
            {esPct && cabecera("ultimo", t("members.colLast"), "hidden md:table-cell")}
            {canManage && <th className="w-10" aria-label={t("members.actions")} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((f, i) => {
            const enPodio = orden === "valor" && podio.includes(f);
            const esYo = f.member.user_id === currentUserId;
            const sub = [
              f.member.role !== "jugador" ? t(`roles.${f.member.role}`) : null,
              esYo ? t("members.you") : null,
            ].filter(Boolean);
            return (
              <tr key={f.member.id} className={cn(esYo && "bg-primary/[0.04]")}>
                <td
                  className={cn(
                    "text-display px-2 py-2.5 text-center font-extrabold",
                    enPodio ? "text-evt-torneo" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar fila={f} className="size-8 text-2xs" />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight break-words">
                        {f.member.role === "capitan" && (
                          <Crown
                            className="mr-1 inline size-3.5 -translate-y-px text-evt-torneo"
                            aria-hidden="true"
                          />
                        )}
                        {f.nombre}
                      </p>
                      {(sub.length > 0 || f.lado) && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <EtiquetaLado lado={f.lado} />
                          {sub.length > 0 && <span>{sub.join(" · ")}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right">{f.jugados || "—"}</td>
                {esPct && (
                  <td className="hidden px-2 py-2.5 text-right sm:table-cell">
                    {f.jugados ? f.v : "—"}
                  </td>
                )}
                {esPct && (
                  <td className="hidden px-2 py-2.5 text-right sm:table-cell">
                    {f.jugados ? f.d : "—"}
                  </td>
                )}
                <td className="px-2 py-2.5 text-right">
                  {f.valor === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted min-[400px]:block">
                        <span
                          className="block h-full rounded-full bg-ok"
                          style={{ width: `${f.valor}%` }}
                        />
                      </span>
                      <span className="text-display w-10 font-extrabold">
                        {valor(medida, f.valor)}
                      </span>
                    </span>
                  )}
                </td>
                {esPct && (
                  <td className="hidden whitespace-nowrap px-2 py-2.5 text-right text-muted-foreground md:table-cell">
                    {f.ultimo ? haceCuanto(f.ultimo, i18n.language) : "—"}
                  </td>
                )}
                {canManage && <td className="px-1 py-2.5 text-right">{menu(f)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Sin resultados, la tabla serían columnas de guiones: mejor la plantilla a secas. */
function Plantilla({
  filas,
  currentUserId,
  menu,
}: {
  filas: Fila[];
  currentUserId: string | undefined;
  menu: (f: Fila) => React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const desde = new Intl.DateTimeFormat(i18n.language, { month: "short", year: "numeric" });
  return (
    <section aria-labelledby="plantilla-titulo" className="surface-card">
      <h2
        id="plantilla-titulo"
        className="border-b border-border p-4 text-2xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        {t("members.squad")} ({filas.length})
      </h2>
      <ul className="divide-y divide-border">
        {filas.map((f) => (
          <li key={f.member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar fila={f} className="size-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold break-words">
                {f.nombre}
                {f.member.user_id === currentUserId && (
                  <span className="rounded-full bg-foreground px-1.5 py-0.5 text-3xs font-bold uppercase tracking-widest text-background">
                    {t("members.you")}
                  </span>
                )}
                <EtiquetaLado lado={f.lado} />
              </p>
              <p className="text-xs text-muted-foreground">
                {f.member.role !== "jugador" && (
                  <span className={cn("font-semibold", COLOR_ROL[f.member.role])}>
                    {t(`roles.${f.member.role}`)} ·{" "}
                  </span>
                )}
                {t("members.since", { date: desde.format(new Date(f.member.joined_at)) })}
              </p>
            </div>
            {menu(f)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Cambiar el rol o quitar a alguien. Antes era un desplegable y una papelera
 * en cada fila, a la vista siempre, y se tocaban sin querer.
 */
function MenuMiembro({
  fila,
  onChangeRole,
  onRemove,
}: {
  fila: Fila;
  onChangeRole: (memberId: string, role: TeamRole) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("members.optionsFor", { name: fila.nombre })}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("members.roleOf", { name: fila.member.profile?.nombre ?? fila.nombre })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={fila.member.role}
          onValueChange={(v) =>
            v !== fila.member.role && onChangeRole(fila.member.id, v as TeamRole)
          }
        >
          {ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r} className="min-h-9">
              {t(`roles.${r}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onRemove}
          className="min-h-9 gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t("members.removeFrom")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
