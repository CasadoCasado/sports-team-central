import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, Crown, MoreHorizontal, Trash2, Trophy } from "lucide-react";

import type { PlayerStats, TeamMember, TeamRole } from "@/lib/types";
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

/** Partidos que hay que llevar para subir al podio. */
const MIN_PODIO = 5;

/** Los roles que no juegan: van aparte, salvo que hayan jugado algún partido. */
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

type Orden = "nombre" | "pj" | "v" | "d" | "pct" | "ultimo";

type Fila = {
  member: TeamMember;
  nombre: string;
  iniciales: string;
  pj: number;
  v: number;
  d: number;
  /** `null` mientras no haya jugado: un 0 % diría que lo ha perdido todo. */
  pct: number | null;
  ultimo: string | null;
};

/**
 * Cruza la plantilla con el balance de `/stats/players/`.
 *
 * El balance solo trae a quien tiene alguna participación, así que el resto
 * sale con ceros.
 */
function filasDelEquipo(members: TeamMember[], stats: PlayerStats[]): Fila[] {
  const porUsuario = new Map(stats.map((s) => [s.user_id, s]));
  return members.map((m) => {
    const s = porUsuario.get(m.user_id);
    const pj = s?.disputados ?? 0;
    return {
      member: m,
      nombre: [m.profile?.nombre, m.profile?.apellidos].filter(Boolean).join(" ") || "—",
      iniciales: ((m.profile?.nombre?.[0] ?? "") + (m.profile?.apellidos?.[0] ?? "")).toUpperCase(),
      pj,
      v: s?.victorias ?? 0,
      d: s?.derrotas ?? 0,
      pct: pj > 0 ? (s?.win_pct ?? 0) : null,
      ultimo: s?.ultimo_partido ?? null,
    };
  });
}

/** Quién sube al podio: los que más ganan entre quienes llevan el mínimo. */
function podio(filas: Fila[]): Fila[] {
  return filas
    .filter((f) => f.pj >= MIN_PODIO)
    .sort((a, b) => b.pct! - a.pct! || b.pj - a.pj || a.nombre.localeCompare(b.nombre))
    .slice(0, 3);
}

function ordenar(filas: Fila[], orden: Orden): Fila[] {
  const porNombre = (a: Fila, b: Fila) => a.nombre.localeCompare(b.nombre);
  const criterios: Record<Orden, (a: Fila, b: Fila) => number> = {
    nombre: porNombre,
    pj: (a, b) => b.pj - a.pj || porNombre(a, b),
    v: (a, b) => b.v - a.v || porNombre(a, b),
    d: (a, b) => b.d - a.d || porNombre(a, b),
    // Quien llega al mínimo va delante: un 100 % con un partido no es un líder.
    pct: (a, b) =>
      Number(b.pj >= MIN_PODIO) - Number(a.pj >= MIN_PODIO) ||
      (b.pct ?? -1) - (a.pct ?? -1) ||
      b.pj - a.pj ||
      porNombre(a, b),
    ultimo: (a, b) => (b.ultimo ?? "").localeCompare(a.ultimo ?? "") || porNombre(a, b),
  };
  return [...filas].sort(criterios[orden]);
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

type Props = {
  members: TeamMember[];
  stats: PlayerStats[];
  currentUserId: string | undefined;
  canManage: boolean;
  onChangeRole: (memberId: string, role: TeamRole) => void;
  onRemove: (memberId: string) => void;
};

/**
 * La plantilla como la clasificación de una liga: un podio con los que más
 * ganan y, debajo, la tabla del equipo ordenable por columnas.
 *
 * Hay tres momentos en la vida de un equipo y los tres tienen que verse bien:
 * - Nadie ha jugado todavía: ni podio ni columnas de ceros, solo la plantilla
 *   y una línea que cuenta qué va a aparecer aquí.
 * - Hay partidos pero nadie llega al mínimo: la tabla sí, el podio espera, y
 *   se dice quién está más cerca.
 * - Uno o dos llegan al mínimo: el podio sale con los huecos que falten.
 */
export function MembersRanking({
  members,
  stats,
  currentUserId,
  canManage,
  onChangeRole,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const [orden, setOrden] = useState<Orden>("pct");
  const [quitando, setQuitando] = useState<Fila | null>(null);

  const filas = filasDelEquipo(members, stats);
  const staff = filas.filter((f) => STAFF.includes(f.member.role) && f.pj === 0);
  const jugadores = filas.filter((f) => !staff.includes(f));
  const nadieHaJugado = jugadores.every((f) => f.pj === 0);
  const top = podio(jugadores);
  const masPartidos = [...jugadores].sort((a, b) => b.pj - a.pj)[0];

  const menu = (f: Fila) =>
    canManage && f.member.user_id !== currentUserId ? (
      <MenuMiembro fila={f} onChangeRole={onChangeRole} onRemove={() => setQuitando(f)} />
    ) : null;

  return (
    <div className="space-y-6">
      {nadieHaJugado ? (
        <div className="surface-card flex flex-col items-center gap-2 px-6 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-evt-torneo/15 text-evt-torneo">
            <Trophy className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-display text-lg font-bold">{t("members.noMatchesTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("members.noMatchesBody", { min: MIN_PODIO })}
          </p>
        </div>
      ) : top.length > 0 ? (
        <Podio top={top} />
      ) : (
        <p className="surface-card flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Trophy className="size-5 shrink-0 text-evt-torneo" aria-hidden="true" />
          <span>
            {t("members.podiumPending", {
              min: MIN_PODIO,
              name: masPartidos.member.profile?.nombre ?? masPartidos.nombre,
              count: masPartidos.pj,
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

      {nadieHaJugado ? (
        <Plantilla filas={jugadores} currentUserId={currentUserId} menu={menu} />
      ) : (
        <Tabla
          filas={ordenar(jugadores, orden)}
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

/**
 * El podio: segundo, primero y tercero, como en uno de verdad. En escritorio
 * va centrado; si solo uno o dos llegan al mínimo, los huecos se quedan a la
 * vista, vacíos, para que se entienda que hay sitio.
 */
function Podio({ top }: { top: Fila[] }) {
  const { t } = useTranslation();
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
        {t("members.podiumTitle")}
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
                <span className="text-display text-xl font-black leading-none tabular-nums">
                  {fila.pct}
                  <span className="text-xs text-muted-foreground">%</span>
                </span>
                <span className="text-3xs text-muted-foreground">
                  {t("members.playedCount", { count: fila.pj })}
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
      <p className="text-xs text-muted-foreground">{t("members.podiumRule", { min: MIN_PODIO })}</p>
    </section>
  );
}

function Tabla({
  filas,
  orden,
  setOrden,
  currentUserId,
  canManage,
  menu,
  podio,
}: {
  filas: Fila[];
  orden: Orden;
  setOrden: (o: Orden) => void;
  currentUserId: string | undefined;
  canManage: boolean;
  menu: (f: Fila) => React.ReactNode;
  podio: Fila[];
}) {
  const { t, i18n } = useTranslation();

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
            {cabecera("pj", t("members.colPlayed"))}
            {cabecera("v", t("members.colWon"), "hidden sm:table-cell")}
            {cabecera("d", t("members.colLost"), "hidden sm:table-cell")}
            {cabecera("pct", t("members.colPct"))}
            {cabecera("ultimo", t("members.colLast"), "hidden md:table-cell")}
            {canManage && <th className="w-10" aria-label={t("members.actions")} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((f, i) => {
            const enPodio = orden === "pct" && podio.includes(f);
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
                      {sub.length > 0 && (
                        <p className="text-xs text-muted-foreground">{sub.join(" · ")}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right">{f.pj || "—"}</td>
                <td className="hidden px-2 py-2.5 text-right sm:table-cell">{f.pj ? f.v : "—"}</td>
                <td className="hidden px-2 py-2.5 text-right sm:table-cell">{f.pj ? f.d : "—"}</td>
                <td className="px-2 py-2.5 text-right">
                  {f.pct === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted min-[400px]:block">
                        <span
                          className="block h-full rounded-full bg-ok"
                          style={{ width: `${f.pct}%` }}
                        />
                      </span>
                      <span className="text-display w-10 font-extrabold">{f.pct}%</span>
                    </span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 text-right text-muted-foreground md:table-cell">
                  {f.ultimo ? haceCuanto(f.ultimo, i18n.language) : "—"}
                </td>
                {canManage && <td className="px-1 py-2.5 text-right">{menu(f)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Sin partidos, la tabla serían columnas de guiones: mejor la plantilla a secas. */
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
              <p className="text-sm font-semibold break-words">
                {f.nombre}
                {f.member.user_id === currentUserId && (
                  <span className="ml-2 rounded-full bg-foreground px-1.5 py-0.5 text-3xs font-bold uppercase tracking-widest text-background">
                    {t("members.you")}
                  </span>
                )}
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
