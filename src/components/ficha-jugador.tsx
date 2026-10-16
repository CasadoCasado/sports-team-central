import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, X } from "lucide-react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { api } from "@/lib/api";
import { ladoDe, type Lado } from "@/lib/lado";
import { manoDe } from "@/lib/mano";
import type { PlayerCard, PlayerCardMatch, PlayerCardPair, Profile, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Picture } from "@/components/picture";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

type Pestana = "resumen" | "partidos" | "parejas";

/** Cuántas parejas y partidos caben en el resumen; el resto, en su pestaña. */
const EN_RESUMEN = 3;

/**
 * La ficha de un jugador: lo que sale al pulsarlo en Miembros.
 *
 * Una hoja por la derecha, con la tabla detrás, para mirar a alguien y volver
 * sin perder el sitio; en el móvil ocupa la pantalla entera. Arriba, la banda
 * oscura con quién es y cuánto gana; debajo, tres pestañas: el resumen, todos
 * sus partidos y todas sus parejas.
 */
export function FichaJugador({
  teamId,
  teamName,
  member,
  onClose,
}: {
  teamId: string;
  teamName: string | undefined;
  /** A quién se mira; `null` con la hoja cerrada. */
  member: TeamMember | null;
  onClose: () => void;
}) {
  // Al cerrar, la ficha sigue pintada mientras la hoja sale: si se vaciara
  // en cuanto `member` pasa a null, se vería la hoja en blanco al irse.
  const [visto, setVisto] = useState(member);
  if (member && member !== visto) setVisto(member);
  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        sinCerrar
        className="flex w-full flex-col gap-0 overflow-y-auto overflow-x-hidden overscroll-none bg-background p-0 scrollbar-fino sm:max-w-[560px]"
      >
        {visto && (
          // La clave vuelve a la pestaña del resumen al cambiar de jugador.
          <Ficha key={visto.user_id} teamId={teamId} teamName={teamName} member={visto} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Ficha({
  teamId,
  teamName,
  member,
}: {
  teamId: string;
  teamName: string | undefined;
  member: TeamMember;
}) {
  const { t, i18n } = useTranslation();
  const [pestana, setPestana] = useState<Pestana>("resumen");

  const { data: ficha, isError } = useQuery({
    queryKey: ["player-card", teamId, member.user_id],
    queryFn: () =>
      api.get<PlayerCard>("/stats/player-card/", { team_id: teamId, user_id: member.user_id }),
  });

  // Lo que ya se sabe por la fila de Miembros se pinta sin esperar.
  const perfil: Profile | null = ficha?.perfil ?? member.profile;
  const nombre = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ") || "—";
  const iniciales = ((perfil?.nombre?.[0] ?? "") + (perfil?.apellidos?.[0] ?? "")).toUpperCase();
  const lado = ladoDe(perfil?.posicion);
  const mano = manoDe(ficha?.perfil.mano_dominante);
  const desde = new Intl.DateTimeFormat(i18n.language, { month: "short", year: "numeric" });
  const datos = [
    lado && { l: t("ficha.lado"), v: t(`lado.${lado}`) },
    mano && { l: t("ficha.mano"), v: t(`mano.${mano}`) },
    ficha?.perfil.nivel && { l: t("ficha.nivel"), v: ficha.perfil.nivel },
    { l: t("ficha.desde"), v: desde.format(new Date(member.joined_at)) },
  ].filter(Boolean) as { l: string; v: string }[];

  return (
    <TabsPrimitive.Root
      value={pestana}
      onValueChange={(v) => setPestana(v as Pestana)}
      className="flex min-h-full shrink-0 flex-col"
    >
      {/* La banda: quién es y cuánto gana. */}
      <header className="relative shrink-0 overflow-hidden bg-ink px-4 pt-[calc(0.25rem+env(safe-area-inset-top))] text-ink-foreground sm:px-6 sm:pt-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full border-[36px] border-accent/10"
        />
        <div className="relative -mx-2 flex items-center justify-between sm:-mr-2 sm:justify-end">
          <SheetClose className="inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 text-[15px] font-semibold text-ink-foreground/90 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden">
            <ChevronLeft className="size-5" aria-hidden="true" />
            {t("members.title")}
          </SheetClose>
          <SheetClose
            className="hidden size-10 items-center justify-center rounded-lg bg-ink-foreground/10 text-ink-foreground/90 hover:bg-ink-foreground/15 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            aria-label={t("common.close")}
          >
            <X className="size-[18px]" aria-hidden="true" />
          </SheetClose>
        </div>

        <div className="relative mt-1 flex items-center gap-3.5 sm:gap-[18px]">
          <Picture
            url={perfil?.avatar_url}
            alt=""
            fallback={iniciales}
            className="font-display size-[60px] shrink-0 rounded-2xl bg-primary text-[22px] font-black text-primary-foreground sm:size-[76px] sm:rounded-[20px] sm:text-[28px]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-evt-torneo">
              {ficha?.es_dueno ? t("members.owner") : t(`roles.${member.role}`)}
              {teamName && <span className="max-sm:hidden"> · {teamName}</span>}
            </p>
            <SheetTitle className="mt-1 break-words font-display text-2xl font-black leading-[1.05] tracking-[-0.03em] text-ink-foreground sm:text-[30px]">
              {nombre}
            </SheetTitle>
            <SheetDescription className="sr-only">{t("ficha.description")}</SheetDescription>
          </div>
          <Anillo pct={ficha?.win_pct ?? null} v={ficha?.victorias} d={ficha?.derrotas} />
        </div>

        <dl className="relative mt-3.5 grid grid-cols-4 gap-2 sm:flex sm:gap-6">
          {datos.map((d) => (
            <div key={d.l} className="min-w-0">
              <dt className="text-[0.5625rem] font-bold uppercase tracking-widest text-ink-muted">
                {d.l}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-bold">{d.v}</dd>
            </div>
          ))}
        </dl>

        <TabsPrimitive.List
          aria-label={t("ficha.title")}
          className="relative mt-3 grid grid-cols-3 sm:mt-4 sm:flex sm:gap-6"
        >
          {(
            [
              ["resumen", t("ficha.tabResumen")],
              ["partidos", t("ficha.tabPartidos"), ficha?.partidos.length],
              ["parejas", t("ficha.tabParejas"), ficha?.parejas.length],
            ] as [Pestana, string, number | undefined][]
          ).map(([v, texto, n]) => (
            <TabsPrimitive.Trigger
              key={v}
              value={v}
              className="min-h-11 cursor-pointer whitespace-nowrap text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:font-bold data-[state=active]:text-ink-foreground data-[state=active]:shadow-[inset_0_-3px_0_var(--accent)]"
            >
              {texto}
              {!!n && <span className="max-sm:hidden"> · {n}</span>}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      </header>

      <div className="flex-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6">
        {isError ? (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            {t("common.error")}
          </p>
        ) : !ficha ? (
          <div className="space-y-3" aria-busy="true">
            <div className="surface-card h-20 animate-pulse" />
            <div className="surface-card h-32 animate-pulse" />
            <div className="surface-card h-40 animate-pulse" />
          </div>
        ) : (
          <>
            <TabsPrimitive.Content value="resumen" className="focus-visible:outline-none">
              <Resumen ficha={ficha} lado={lado} irA={setPestana} />
            </TabsPrimitive.Content>
            <TabsPrimitive.Content value="partidos" className="focus-visible:outline-none">
              <Partidos partidos={ficha.partidos} />
            </TabsPrimitive.Content>
            <TabsPrimitive.Content value="parejas" className="focus-visible:outline-none">
              <Parejas parejas={ficha.parejas} />
            </TabsPrimitive.Content>
          </>
        )}
      </div>
    </TabsPrimitive.Root>
  );
}

/** El % de victorias como un anillo; un guion mientras no haya jugado. */
function Anillo({ pct, v, d }: { pct: number | null; v?: number; d?: number }) {
  const { t } = useTranslation();
  const r = 56;
  const largo = 2 * Math.PI * r;
  return (
    <div className="relative size-[72px] shrink-0 sm:size-24">
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
          strokeWidth="13"
          className="stroke-ink-foreground/15"
        />
        {pct != null && pct > 0 && (
          <circle
            cx="66"
            cy="66"
            r={r}
            fill="none"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${(largo * pct) / 100} ${largo}`}
            transform="rotate(-90 66 66)"
            className="stroke-accent"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display text-[17px] font-black leading-none sm:text-[22px]">
          {pct == null ? "—" : `${pct} %`}
        </span>
        {pct != null && (
          <span className="mt-0.5 text-[0.5625rem] text-ink-muted max-sm:hidden">
            {t("ficha.gp", { v, d })}
          </span>
        )}
      </div>
    </div>
  );
}

function Resumen({
  ficha,
  lado,
  irA,
}: {
  ficha: PlayerCard;
  lado: Lado | null;
  irA: (p: Pestana) => void;
}) {
  const { t } = useTranslation();
  if (ficha.disputados === 0) {
    return (
      <div className="space-y-3">
        <Posicion lado={lado} pistas={[]} />
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          {t("ficha.sinPartidos")}
        </p>
      </div>
    );
  }
  const ultimos = ficha.racha;
  const sets = ficha.sets_ganados + ficha.sets_perdidos;
  const kpis = [
    {
      l: t("ficha.jugados"),
      v: String(ficha.disputados),
      s: t("ficha.gp", { v: ficha.victorias, d: ficha.derrotas }),
    },
    {
      l: t("ficha.ultimos", { count: ultimos.length }),
      v: `${ultimos.filter(Boolean).length}–${ultimos.filter((g) => !g).length}`,
      s: ultimos.map((g) => (g ? t("ficha.g") : t("ficha.p"))).join(" · "),
      color: "text-ok",
    },
    {
      l: t("ficha.sets"),
      v: sets ? `${ficha.sets_ganados}–${ficha.sets_perdidos}` : "—",
      s: sets ? t("ficha.setsPct", { pct: Math.round((100 * ficha.sets_ganados) / sets) }) : "",
    },
    {
      l: t("ficha.parejas"),
      v: String(ficha.parejas.length),
      s: ficha.parejas[0] ? t("ficha.masCon", { name: ficha.parejas[0].jugador.nombre }) : "",
    },
  ];
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-3 shadow-card">
            <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-muted-foreground">
              {k.l}
            </p>
            <p
              // Sin `cn`: `text-display` no es un tamaño ni un color que sepa
              // fusionar, y se perdería al juntarse con el color.
              className={`text-display mt-1 text-2xl font-extrabold leading-none tabular-nums sm:text-[22px] ${k.color ?? ""}`}
            >
              {k.v}
            </p>
            {k.s && <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">{k.s}</p>}
          </div>
        ))}
      </div>

      <Posicion lado={lado} pistas={ficha.pistas} />

      {ficha.parejas.length > 0 && (
        <Bloque
          titulo={t("ficha.parejas")}
          ver={
            ficha.parejas.length > EN_RESUMEN
              ? {
                  texto: t("ficha.verParejas", { count: ficha.parejas.length }),
                  ir: () => irA("parejas"),
                }
              : null
          }
        >
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-2.5">
            {ficha.parejas.slice(0, EN_RESUMEN).map((p, i) => (
              <TarjetaPareja
                key={p.jugador.id}
                pareja={p}
                mejor={i === 0 && esMejor(ficha.parejas)}
                compacta
              />
            ))}
          </div>
        </Bloque>
      )}

      <Bloque
        titulo={t("ficha.ultimosPartidos")}
        ver={
          ficha.partidos.length > EN_RESUMEN
            ? {
                texto: t("ficha.verPartidos", { count: ficha.partidos.length }),
                ir: () => irA("partidos"),
              }
            : null
        }
      >
        <ul className="-mt-1 divide-y divide-border">
          {ficha.partidos.slice(0, EN_RESUMEN).map((m) => (
            <FilaPartido key={m.event_id} partido={m} />
          ))}
        </ul>
      </Bloque>
    </div>
  );
}

/**
 * La mejor pareja se destaca solo si lo es de verdad: con al menos dos
 * partidos y por delante de las demás en partidos jugados juntos.
 */
function esMejor(parejas: PlayerCardPair[]) {
  const [a, b] = parejas;
  return (
    !!a && a.partidos >= 2 && (!b || a.partidos > b.partidos || (a.win_pct ?? 0) > (b.win_pct ?? 0))
  );
}

function Bloque({
  titulo,
  ver,
  children,
}: {
  titulo: string;
  ver?: { texto: string; ir: () => void } | null;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-3.5 shadow-card sm:p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-display text-[15px] font-extrabold sm:text-base">{titulo}</h3>
        {ver && (
          <button
            type="button"
            onClick={ver.ir}
            className="min-h-8 text-xs font-semibold text-primary hover:underline"
          >
            {ver.texto}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Dónde juega: la pista con su lado marcado —el que pone en su perfil— y,
 * al lado, cómo le va en cada número de pista. El lado de cada partido no se
 * guarda, así que no hay reparto por lados que enseñar.
 */
function Posicion({ lado, pistas }: { lado: Lado | null; pistas: PlayerCard["pistas"] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...pistas.map((p) => p.partidos));
  const reves = lado === "reves" || lado === "ambos";
  const derecha = lado === "derecha" || lado === "ambos";
  return (
    <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3.5 shadow-card sm:gap-[18px] sm:p-4">
      <svg
        viewBox="0 0 112 150"
        className="h-24 w-[72px] shrink-0 sm:h-28 sm:w-[84px]"
        role="img"
        aria-label={lado ? t("ficha.pistaAria", { lado: t(`lado.${lado}`) }) : t("ficha.sinLado")}
      >
        <rect
          x="6"
          y="4"
          width="100"
          height="142"
          rx="4"
          strokeWidth="2"
          className="fill-accent/10 stroke-accent"
        />
        {reves && <rect x="6" y="75" width="50" height="71" className="fill-primary/30" />}
        {derecha && <rect x="56" y="75" width="50" height="71" className="fill-primary/30" />}
        <line x1="6" y1="75" x2="106" y2="75" strokeWidth="3" className="stroke-foreground" />
        <line x1="6" y1="28" x2="106" y2="28" strokeWidth="1.6" className="stroke-accent" />
        <line x1="6" y1="122" x2="106" y2="122" strokeWidth="1.6" className="stroke-accent" />
        <line x1="56" y1="28" x2="56" y2="122" strokeWidth="1.6" className="stroke-accent" />
        {reves && <circle cx="31" cy="108" r="11" className="fill-primary" />}
        {derecha && <circle cx="81" cy="108" r="11" className="fill-primary" />}
      </svg>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div>
          <h3 className="text-display text-[15px] font-extrabold sm:text-base">
            {t("ficha.posicion")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {lado ? t(`ficha.juegaDe.${lado}`) : t("ficha.sinLado")}
          </p>
        </div>
        {pistas.map((p) => {
          const pct = Math.round((100 * p.ganados) / p.partidos);
          return (
            <div key={p.pista}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="font-bold">{t("ficha.pista", { n: p.pista })}</span>
                <span className="text-muted-foreground">
                  {t("ficha.pistaDatos", { count: p.partidos, pct })}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(100 * p.partidos) / max}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Iniciales({ perfil, className }: { perfil: Profile; className?: string }) {
  return (
    <Picture
      url={perfil.avatar_url}
      alt=""
      fallback={((perfil.nombre?.[0] ?? "") + (perfil.apellidos?.[0] ?? "")).toUpperCase()}
      className={cn("shrink-0 rounded-full bg-accent/15 font-bold text-ok", className)}
    />
  );
}

function TarjetaPareja({
  pareja: p,
  mejor,
  compacta,
}: {
  pareja: PlayerCardPair;
  mejor: boolean;
  compacta?: boolean;
}) {
  const { t } = useTranslation();
  const nombre = [p.jugador.nombre, p.jugador.apellidos].filter(Boolean).join(" ");
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl p-3",
        mejor ? "border-[1.5px] border-accent bg-accent/[0.07]" : "border border-border bg-card",
        compacta && "max-sm:gap-1.5 max-sm:py-2.5",
      )}
    >
      <div className={cn("flex items-center gap-2.5", compacta && "sm:items-start")}>
        <Iniciales perfil={p.jugador} className="size-8 text-[0.625rem]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight break-words">{nombre}</p>
          <p
            className={cn(
              "text-[0.6875rem]",
              mejor ? "font-bold text-ok" : "text-muted-foreground",
            )}
          >
            {mejor ? t("ficha.mejorPareja") : t("ficha.juntos", { count: p.partidos })}
          </p>
        </div>
        <div className={cn("text-right", compacta && "sm:hidden")}>
          <p className="text-display text-lg font-black leading-none">{p.win_pct ?? 0} %</p>
          <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
            {t("ficha.gp", { v: p.ganados, d: p.perdidos })}
          </p>
        </div>
      </div>
      {compacta && (
        <div className="flex items-baseline justify-between max-sm:hidden">
          <span className="text-display text-2xl font-black leading-none">{p.win_pct ?? 0} %</span>
          <span className="text-[0.6875rem] text-muted-foreground">
            {t("ficha.gp", { v: p.ganados, d: p.perdidos })}
          </span>
        </div>
      )}
      <div className="flex gap-[3px]" aria-hidden="true">
        {p.historial.slice(-12).map((g, i) => (
          <span
            key={i}
            className={cn("h-[5px] flex-1 rounded-full", g ? "bg-ok" : "bg-danger/35")}
          />
        ))}
      </div>
    </div>
  );
}

function Resultado({ ganado }: { ganado: boolean | null }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-extrabold",
        ganado == null
          ? "bg-muted text-muted-foreground"
          : ganado
            ? "bg-ok/15 text-ok"
            : "bg-danger/15 text-danger",
      )}
      aria-label={ganado == null ? undefined : ganado ? t("ficha.ganado") : t("ficha.perdido")}
    >
      {ganado == null ? "–" : ganado ? t("ficha.g") : t("ficha.p")}
    </span>
  );
}

function FilaPartido({ partido: m }: { partido: PlayerCardMatch }) {
  const { t, i18n } = useTranslation();
  const fecha = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" });
  const detalle = [
    fecha.format(new Date(m.fecha)),
    m.competicion,
    m.pareja && t("ficha.con", { name: m.pareja.nombre }),
    m.pista && t("ficha.pista", { n: m.pista }),
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Resultado ganado={m.ganado} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold break-words">
          {m.rival ? t("ficha.vs", { rival: m.rival }) : m.titulo}
        </p>
        <p className="text-xs text-muted-foreground">{detalle.join(" · ")}</p>
      </div>
      {m.sets && (
        <span className="text-display flex shrink-0 gap-1.5 text-[13px] font-bold tabular-nums sm:text-sm">
          {/* El espacio no se ve —lo pone el hueco— pero queda en el texto. */}
          {m.sets.split(" ").map((set, i) => (
            <span key={i}>
              {i > 0 && " "}
              {set}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

/** Todos sus partidos: los meses arriba y la lista, con filtro por competición. */
function Partidos({ partidos }: { partidos: PlayerCardMatch[] }) {
  const { t } = useTranslation();
  const SIN = "\u0000";
  const grupos = [...new Set(partidos.map((m) => m.competicion ?? SIN))];
  const [filtro, setFiltro] = useState<string | null>(null);
  if (partidos.length === 0) {
    return (
      <p className="surface-card p-6 text-center text-sm text-muted-foreground">
        {t("ficha.sinPartidos")}
      </p>
    );
  }
  const vistos =
    filtro == null ? partidos : partidos.filter((m) => (m.competicion ?? SIN) === filtro);
  const chip = (valor: string | null, texto: string, n: number) => (
    <button
      key={valor ?? "todos"}
      type="button"
      onClick={() => setFiltro(valor)}
      aria-pressed={filtro === valor}
      className={cn(
        "min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors",
        filtro === valor
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {texto} · {n}
    </button>
  );
  return (
    <div className="space-y-3.5">
      <PorMes partidos={partidos} />
      <section className="rounded-2xl border border-border bg-card shadow-card">
        {grupos.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto p-3.5 pb-1 sm:flex-wrap">
            {chip(null, t("ficha.todos"), partidos.length)}
            {grupos.map((g) =>
              chip(
                g,
                g === SIN ? t("ficha.sinCompeticion") : g,
                partidos.filter((m) => (m.competicion ?? SIN) === g).length,
              ),
            )}
          </div>
        )}
        <ul className="divide-y divide-border px-3.5 sm:px-4">
          {vistos.map((m) => (
            <FilaPartido key={m.event_id} partido={m} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Ganados y perdidos de los últimos meses con partidos, en barras apiladas. */
function PorMes({ partidos }: { partidos: PlayerCardMatch[] }) {
  const { t, i18n } = useTranslation();
  const nombreMes = new Intl.DateTimeFormat(i18n.language, { month: "short" });
  const meses = new Map<string, { g: number; p: number; fecha: Date }>();
  for (const m of partidos) {
    const f = new Date(m.fecha);
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
    const mes = meses.get(clave) ?? { g: 0, p: 0, fecha: f };
    if (m.ganado) mes.g += 1;
    else if (m.ganado === false) mes.p += 1;
    meses.set(clave, mes);
  }
  const ultimos = [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  if (ultimos.length < 2) return null;
  const max = Math.max(...ultimos.map(([, m]) => m.g + m.p), 1);
  return (
    <section className="rounded-2xl border border-border bg-card p-3.5 shadow-card sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-display text-[15px] font-extrabold sm:text-base">
          {t("ficha.porMes")}
        </h3>
        <span className="flex gap-3 text-[0.6875rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-ok" />
            {t("ficha.ganados")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-danger/35" />
            {t("ficha.perdidos")}
          </span>
        </span>
      </div>
      <div className="flex h-32 items-end gap-3 border-b border-border px-1 sm:gap-5">
        {ultimos.map(([clave, m]) => (
          <div key={clave} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[0.6875rem] font-bold tabular-nums">{m.g + m.p}</span>
            <div
              className="flex w-full max-w-10 flex-col overflow-hidden rounded-t-md"
              style={{ height: `${(100 * (m.g + m.p)) / max}%` }}
              title={t("ficha.gp", { v: m.g, d: m.p })}
            >
              <div className="bg-danger/35" style={{ flexGrow: m.p }} />
              <div className="bg-ok" style={{ flexGrow: m.g }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3 px-1 sm:gap-5">
        {ultimos.map(([clave, m]) => (
          <span key={clave} className="flex-1 text-center text-[0.6875rem] text-muted-foreground">
            {nombreMes.format(m.fecha)}
          </span>
        ))}
      </div>
    </section>
  );
}

function Parejas({ parejas }: { parejas: PlayerCardPair[] }) {
  const { t } = useTranslation();
  if (parejas.length === 0) {
    return (
      <p className="surface-card p-6 text-center text-sm text-muted-foreground">
        {t("ficha.sinParejas")}
      </p>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {parejas.map((p, i) => (
        <TarjetaPareja key={p.jugador.id} pareja={p} mejor={i === 0 && esMejor(parejas)} />
      ))}
    </div>
  );
}
