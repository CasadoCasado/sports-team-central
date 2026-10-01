/**
 * La vista PRO del reparto de pistas: el tablero y la matriz de parejas, en
 * dos pestañas. Es el diseño del lienzo «Convocatoria PRO» llevado a la app.
 *
 * - **Tablero.** A la izquierda los apuntados con su porcentaje y su forma; en
 *   el centro las pistas dibujadas, con la pareja, lo que ganan juntos y por
 *   qué; a la derecha la ficha del jugador elegido. A cada jugador se le
 *   arrastra a su pista (o a un hueco redondo), y de vuelta a «Sin pista» o a
 *   la lista para quitársela; la «×» que sale sobre el que ya está en pista
 *   hace lo mismo. Sin arrastrar: tocar al jugador y luego el hueco.
 * - **Matriz.** Quién gana con quién: cada casilla es una pareja. Tocarla los
 *   pone juntos en una pista libre.
 *
 * Mueve las pistas con las mismas peticiones que el tablero normal, así que lo
 * que se hace aquí se ve igual en Normal. Las reglas (dos por pista, nada con
 * la convocatoria confirmada) las aplica el backend para los dos.
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Clock, GripVertical, Plus, X } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuimicas } from "@/hooks/use-quimica";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parejaPro, type TableroPro } from "@/lib/pro";

type Respuesta = {
  id: string;
  user_id: string;
  status: string;
  padel_pista: number | null;
};

type Miembro = {
  user_id: string;
  profile: { nombre: string; apellidos: string } | null;
};

type Evento = {
  id: string;
  rival?: string | null;
  padel_num_pistas: number | null;
  convocatoria_confirmada: boolean;
  finalizado?: boolean;
};

const pct = (p: number) => Math.round(100 * p);

export function VistaPro({
  event,
  responses,
  members,
  pro,
  onChanged,
}: {
  event: Evento;
  responses: Respuesta[];
  members: Miembro[];
  pro: TableroPro;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const cerrada = event.convocatoria_confirmada;
  const numPistas = event.padel_num_pistas ?? 0;
  const pistas = Array.from({ length: numPistas }, (_, i) => i + 1);
  const apuntados = responses.filter((r) => r.status !== "rechazado");
  const porUsuario = new Map(apuntados.map((r) => [r.user_id, r]));
  const enPista = (n: number) => apuntados.filter((r) => r.padel_pista === n);

  const perfil = (u: string) => members.find((m) => m.user_id === u)?.profile;
  const nombre = (u: string) => {
    const p = perfil(u);
    return p ? `${p.nombre} ${p.apellidos}`.trim() : "?";
  };
  const pila = (u: string) => perfil(u)?.nombre ?? "?";
  const iniciales = (u: string) => {
    const p = perfil(u);
    return p ? `${p.nombre[0] ?? ""}${p.apellidos?.[0] ?? ""}`.toUpperCase() : "?";
  };

  const { data: quimicas } = useQuimicas([event.id]);
  const eligio = new Map((quimicas ?? []).map((q) => [q.user_id, q.target_user_id]));
  const mutua = (a: string, b: string) => eligio.get(a) === b && eligio.get(b) === a;

  // El jugador elegido: el de la ficha, y el que se coloca al tocar un hueco.
  const [sel, setSel] = useState<string | null>(
    () => apuntados.find((r) => r.padel_pista != null)?.user_id ?? apuntados[0]?.user_id ?? null,
  );
  const elegido = sel && porUsuario.has(sel) ? sel : (apuntados[0]?.user_id ?? null);

  // --- mover --------------------------------------------------------------
  const [moviendo, setMoviendo] = useState(false);
  async function poner(cambios: [string, number | null][]) {
    setMoviendo(true);
    try {
      for (const [u, pista] of cambios) {
        const r = porUsuario.get(u);
        if (!r || r.padel_pista === pista) continue;
        await api.patch(
          `/event-responses/${r.id}/`,
          pista == null ? { padel_pista: null } : { padel_pista: pista, es_convocado: true },
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setMoviendo(false);
      onChanged();
    }
  }

  function colocar(u: string | null, pista: number | null) {
    if (!u || cerrada) return;
    if (pista != null && enPista(pista).filter((r) => r.user_id !== u).length >= 2) {
      toast.error(t("quimica.pistaLlena", { n: pista }));
      return;
    }
    void poner([[u, pista]]);
  }

  // --- arrastrar ------------------------------------------------------------
  // Con eventos de puntero, como el tablero normal: el arrastrar y soltar del
  // navegador no funciona con el dedo. Los destinos llevan `data-drop-pro`: el
  // número de la pista, o «pool» para quitarle la pista.
  const raiz = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ u: string; x0: number; y0: number; movido: boolean } | null>(null);
  const destino = useRef<string | null>(null);
  const acabaDeArrastrar = useRef(false);
  const [fantasma, setFantasma] = useState<{ u: string; x: number; y: number } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  /**
   * Lo que hace arrastrable a un jugador. `tactil` es para las fichas
   * pequeñas; en las filas de la lista el dedo tiene que poder hacer scroll,
   * así que ahí solo se arrastra con ratón o lápiz.
   */
  function arrastrable(u: string, tactil: boolean) {
    if (cerrada) return {};
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button > 0 || (!tactil && e.pointerType === "touch")) return;
        arrastre.current = { u, x0: e.clientX, y0: e.clientY, movido: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const a = arrastre.current;
        if (!a) return;
        if (!a.movido) {
          if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
          a.movido = true;
        }
        setFantasma({ u: a.u, x: e.clientX, y: e.clientY });
        const el = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-drop-pro]");
        const nuevo = el && raiz.current?.contains(el) ? (el.dataset.dropPro ?? null) : null;
        destino.current = nuevo;
        setSobre(nuevo);
      },
      onPointerUp: () => {
        const a = arrastre.current;
        arrastre.current = null;
        setFantasma(null);
        setSobre(null);
        if (!a?.movido) return;
        // El navegador lanza un clic al soltar: que no cuente como un toque.
        acabaDeArrastrar.current = true;
        setTimeout(() => (acabaDeArrastrar.current = false), 0);
        const d = destino.current;
        destino.current = null;
        if (d === "pool") colocar(a.u, null);
        else if (d) colocar(a.u, Number(d));
      },
      onPointerCancel: () => {
        arrastre.current = null;
        destino.current = null;
        setFantasma(null);
        setSobre(null);
      },
    };
  }

  /** Un clic que no sea el final de un arrastre. */
  const tocar = (fn: () => void) => () => {
    if (!acabaDeArrastrar.current) fn();
  };

  /** Junta a dos: en la pista de uno si cabe el otro, si no en una libre. */
  function juntar(a: string, b: string) {
    if (cerrada) return toast.error(t("pro.sugerirCerrada"));
    const pa = porUsuario.get(a)?.padel_pista ?? null;
    const pb = porUsuario.get(b)?.padel_pista ?? null;
    if (pa != null && pa === pb) return;
    if (pa != null && enPista(pa).length < 2) return void poner([[b, pa]]);
    if (pb != null && enPista(pb).length < 2) return void poner([[a, pb]]);
    const libre = pistas.find((n) => enPista(n).every((r) => r.user_id === a || r.user_id === b));
    if (libre == null) return toast.error(t("quimica.pistasCompletas"));
    void poner([
      [a, libre],
      [b, libre],
    ]);
  }

  const confirmar = useMutation({
    mutationFn: (confirmada: boolean) => api.post(`/events/${event.id}/confirmar/`, { confirmada }),
    onSuccess: (_d, confirmada) => {
      toast.success(confirmada ? t("quimica.confirmada") : t("quimica.reabierta"));
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ctx: Ctx = {
    pro,
    nombre,
    pila,
    iniciales,
    mutua,
    eligio,
    elegido,
    setSel,
    cerrada,
    moviendo,
    arrastrable,
    tocar,
    quitar: (u: string) => colocar(u, null),
    sobre,
    arrastrando: fantasma?.u ?? null,
  };

  return (
    <div ref={raiz} className="pro-ui overflow-hidden rounded-2xl border border-[var(--pro-line)]">
      <Tabs defaultValue="tablero">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pro-line)] px-3 py-2 sm:px-4">
          <TabsList className="bg-[var(--pro-surface-2)]">
            <TabsTrigger value="tablero" className="text-xs font-bold">
              {t("pro.tabTablero")}
            </TabsTrigger>
            <TabsTrigger value="matriz" className="text-xs font-bold">
              {t("pro.tabMatriz")}
            </TabsTrigger>
          </TabsList>
          {cerrada
            ? !event.finalizado && (
                <button
                  type="button"
                  onClick={() => confirmar.mutate(false)}
                  disabled={confirmar.isPending}
                  className="min-h-10 rounded-xl border border-[var(--pro-line-2)] px-4 text-2xs font-extrabold uppercase tracking-widest"
                >
                  {t("quimica.reabrir")}
                </button>
              )
            : numPistas > 0 && (
                <button
                  type="button"
                  onClick={() => confirmar.mutate(true)}
                  disabled={confirmar.isPending}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--pro-blue)] px-4 text-2xs font-extrabold uppercase tracking-widest text-white"
                >
                  <Check className="size-4" aria-hidden="true" />
                  {t("quimica.confirmar")}
                </button>
              )}
        </div>

        {pro.rival && <FranjaRival pro={pro} pila={pila} />}

        <TabsContent value="tablero" className="mt-0">
          <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_300px]">
            <ListaApuntados ctx={ctx} apuntados={apuntados} />

            <div className="min-w-0 space-y-3">
              {numPistas === 0 && (
                <p className="text-sm text-[var(--pro-muted)]">{t("events.padelPistasHint")}</p>
              )}
              {pistas.map((n) => (
                <TarjetaPista
                  key={n}
                  ctx={ctx}
                  num={n}
                  dentro={enPista(n).map((r) => r.user_id)}
                  rival={event.rival ?? null}
                  onColocar={() => colocar(elegido, n)}
                />
              ))}
              <SinPista
                ctx={ctx}
                libres={apuntados.filter((r) => r.padel_pista == null).map((r) => r.user_id)}
              />
              {!cerrada && (
                <p className="text-xs text-[var(--pro-muted)]">{t("pro.comoColocar")}</p>
              )}
            </div>

            {elegido && (
              <FichaJugador
                ctx={ctx}
                u={elegido}
                pista={porUsuario.get(elegido)?.padel_pista ?? null}
                otros={apuntados.map((r) => r.user_id).filter((x) => x !== elegido)}
                jornadas={pro.jornadas}
                rival={pro.rival?.nombre ?? null}
                onQuitar={() => void poner([[elegido, null]])}
                onJuntar={(otro) => juntar(elegido, otro)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="matriz" className="mt-0">
          <Matriz ctx={ctx} jugadores={apuntados.map((r) => r.user_id)} onJuntar={juntar} />
        </TabsContent>
      </Tabs>

      {fantasma &&
        createPortal(
          <div
            aria-hidden="true"
            className="pro-ui pointer-events-none fixed z-[60] inline-flex items-center gap-2 rounded-full border border-[var(--pro-acc)] py-1 pl-1 pr-3 text-sm font-semibold shadow-xl"
            style={{
              left: fantasma.x,
              top: fantasma.y,
              transform: "translate(-50%, -60%) rotate(-3deg) scale(1.06)",
            }}
          >
            <Avatar texto={iniciales(fantasma.u)} />
            {pila(fantasma.u)}
          </div>,
          document.body,
        )}
    </div>
  );
}

type Ctx = {
  pro: TableroPro;
  nombre: (u: string) => string;
  pila: (u: string) => string;
  iniciales: (u: string) => string;
  mutua: (a: string, b: string) => boolean;
  eligio: Map<string, string>;
  elegido: string | null;
  setSel: (u: string) => void;
  cerrada: boolean;
  moviendo: boolean;
  arrastrable: (
    u: string,
    tactil: boolean,
  ) => Partial<{
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  }>;
  tocar: (fn: () => void) => () => void;
  quitar: (u: string) => void;
  /** El destino bajo el puntero mientras se arrastra: «pool» o la pista. */
  sobre: string | null;
  arrastrando: string | null;
};

const etiqueta = "text-2xs font-extrabold uppercase tracking-widest text-[var(--pro-muted)]";

/** Lo que pasó contra el rival, en una franja bajo las pestañas. */
function FranjaRival({ pro, pila }: { pro: TableroPro; pila: (u: string) => string }) {
  const { t } = useTranslation();
  const r = pro.rival!;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--pro-line)] bg-[var(--pro-surface-2)] px-3 py-2 text-xs sm:px-4">
      <span className="text-2xs font-extrabold uppercase tracking-widest text-[var(--pro-acc-txt)]">
        {t("pro.contraRival", { rival: r.nombre })}
      </span>
      {r.ultimo ? (
        <>
          <span>
            {r.empatados
              ? t("pro.rivalBalanceEmpates", { g: r.ganados, e: r.empatados, p: r.perdidos })
              : t("pro.rivalBalance", { g: r.ganados, p: r.perdidos })}
          </span>
          {r.ultimo.nuestro != null && r.ultimo.suyo != null && (
            <span>{t("pro.rivalUltimo", { a: r.ultimo.nuestro, b: r.ultimo.suyo })}</span>
          )}
          {r.parejas.slice(0, 2).map((p) => (
            <span key={p.a + p.b} className="text-[var(--pro-muted)]">
              {t("pro.rivalPareja", { a: pila(p.a), b: pila(p.b), g: p.ganados, p: p.perdidos })}
            </span>
          ))}
        </>
      ) : (
        <span className="text-[var(--pro-muted)]">{t("pro.rivalSinPartidos")}</span>
      )}
    </div>
  );
}

function Puntos({ forma, grande = false }: { forma: boolean[]; grande?: boolean }) {
  const { t } = useTranslation();
  const lista = forma.length
    ? forma.map((g) => t(g ? "pro.ganado" : "pro.perdido")).join(", ")
    : t("pro.sinPartidos");
  return (
    <span role="img" aria-label={t("pro.forma", { lista })} className="inline-flex gap-1">
      {forma.map((g, i) =>
        grande ? (
          <span
            key={i}
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-2xs font-extrabold",
              g
                ? "bg-[var(--pro-acc)] text-[var(--pro-ink)]"
                : "border-2 border-[var(--pro-line-2)] text-[var(--pro-muted)]",
            )}
          >
            {t(g ? "pro.letraGanado" : "pro.letraPerdido")}
          </span>
        ) : (
          <span
            key={i}
            className={cn(
              "size-2 rounded-full",
              g ? "bg-[var(--pro-acc)]" : "border-2 border-[var(--pro-line-2)]",
            )}
          />
        ),
      )}
    </span>
  );
}

function ListaApuntados({ ctx, apuntados }: { ctx: Ctx; apuntados: Respuesta[] }) {
  const { t } = useTranslation();
  const grupos: [string, Respuesta[]][] = [
    [t("pro.van"), apuntados.filter((r) => r.status === "confirmado" || r.status === "convocado")],
    [t("pro.enDuda"), apuntados.filter((r) => r.status === "duda")],
    [t("pro.reserva"), apuntados.filter((r) => r.status === "reserva")],
  ];
  return (
    <aside
      aria-label={t("pro.apuntados")}
      data-drop-pro="pool"
      className={cn(
        "space-y-3 rounded-2xl transition-colors",
        ctx.sobre === "pool" && "bg-[var(--pro-surface-2)] ring-2 ring-[var(--pro-acc)]",
      )}
    >
      {grupos
        .filter(([, rs]) => rs.length > 0)
        .map(([titulo, rs]) => (
          <div key={titulo} className="space-y-1">
            <h3 className={cn(etiqueta, "px-1")}>{titulo}</h3>
            {rs.map((r) => {
              const j = ctx.pro.jugadores[r.user_id];
              const activo = ctx.elegido === r.user_id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={ctx.tocar(() => ctx.setSel(r.user_id))}
                  {...ctx.arrastrable(r.user_id, false)}
                  aria-pressed={activo}
                  className={cn(
                    "flex min-h-12 w-full select-none items-center gap-2.5 rounded-xl border px-2 py-1.5 text-left",
                    !ctx.cerrada && "md:cursor-grab md:active:cursor-grabbing",
                    ctx.arrastrando === r.user_id && "opacity-40",
                    activo
                      ? "border-[var(--pro-acc)] bg-[var(--pro-sel)]"
                      : "border-transparent hover:bg-[var(--pro-surface-2)]",
                  )}
                >
                  <Avatar texto={ctx.iniciales(r.user_id)} va={r.status !== "duda"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {ctx.nombre(r.user_id)}
                    </span>
                    <span className="block text-xs text-[var(--pro-muted)]">
                      {r.padel_pista != null
                        ? `${t("callups.pista")} ${r.padel_pista}`
                        : t("quimica.sinPista")}
                    </span>
                  </span>
                  {j && (
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-sm font-extrabold">
                        {j.partidos ? `${Math.round((100 * j.ganados) / j.partidos)} %` : "—"}
                      </span>
                      <Puntos forma={j.forma} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
    </aside>
  );
}

function Avatar({
  texto,
  va = true,
  grande = false,
}: {
  texto: string;
  va?: boolean;
  grande?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold",
        grande ? "size-14 text-lg" : "size-9 text-xs",
        va
          ? grande
            ? "bg-[var(--pro-acc)] text-[var(--pro-ink)]"
            : "bg-[var(--pro-surface-2)] text-[var(--pro-fg)] ring-1 ring-[var(--pro-line)]"
          : "border-2 border-dashed border-[var(--pro-line-2)]",
      )}
    >
      {texto}
    </span>
  );
}

/** Una pista dibujada, con su pareja y lo que se espera de ella. */
function TarjetaPista({
  ctx,
  num,
  dentro,
  rival,
  onColocar,
}: {
  ctx: Ctx;
  num: number;
  dentro: string[];
  rival: string | null;
  onColocar: () => void;
}) {
  const { t } = useTranslation();
  const [a, b] = dentro;
  const par = a && b ? parejaPro(ctx.pro, a, b) : undefined;
  const n = par ? par.ganados + par.perdidos : 0;
  const valor = par ? pct(par.prob) : null;
  const vs =
    a && b
      ? ctx.pro.rival?.parejas.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))
      : undefined;
  const elegidoAqui = !!ctx.elegido && dentro.includes(ctx.elegido);
  const puedeColocar = !ctx.cerrada && !!ctx.elegido && !elegidoAqui && dentro.length < 2;

  const hueco = (u: string | undefined, arriba: boolean) =>
    u ? (
      <div
        className={cn(
          "group absolute left-[18%] -translate-x-1/2",
          arriba ? "top-[14%]" : "bottom-[14%]",
          ctx.arrastrando === u && "opacity-40",
        )}
      >
        <button
          type="button"
          onClick={ctx.tocar(() => ctx.setSel(u))}
          {...ctx.arrastrable(u, true)}
          aria-label={ctx.nombre(u)}
          className={cn(
            "flex size-10 touch-none select-none items-center justify-center rounded-full border-[3px] text-xs font-extrabold text-[#0b1222] sm:size-11",
            !ctx.cerrada && "cursor-grab active:cursor-grabbing",
            ctx.elegido === u ? "border-white bg-[#d7f24b]" : "border-[#0b1222]/25 bg-[#eef2fa]",
          )}
        >
          {ctx.iniciales(u)}
        </button>
        {/* Quitarle la pista: sale al pasar el ratón, y siempre en el que
            está elegido, que es como se ve en una pantalla táctil. */}
        {!ctx.cerrada && (
          <button
            type="button"
            onClick={() => ctx.quitar(u)}
            disabled={ctx.moviendo}
            aria-label={t("pro.quitarDeLaPista", { name: ctx.nombre(u) })}
            title={t("pro.quitarDeLaPista", { name: ctx.nombre(u) })}
            className={cn(
              "absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#e5484d] text-white shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
              ctx.elegido === u ? "opacity-100" : "opacity-0",
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    ) : (
      <button
        type="button"
        onClick={onColocar}
        disabled={!puedeColocar || ctx.moviendo}
        data-drop-pro={num}
        aria-label={
          ctx.elegido
            ? t("pro.colocarEn", { name: ctx.nombre(ctx.elegido), n: num })
            : t("pro.huecoLibre")
        }
        className={cn(
          "absolute left-[18%] flex size-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed text-white sm:size-11",
          arriba ? "top-[14%]" : "bottom-[14%]",
          puedeColocar || ctx.sobre === String(num)
            ? "border-[#d7f24b] bg-white/10"
            : "border-white/45 text-white/60",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    );

  return (
    <section
      aria-label={`${t("callups.pista")} ${num}`}
      data-pista-pro={num}
      data-drop-pro={num}
      className={cn(
        "@container rounded-2xl border p-3 transition-colors",
        ctx.sobre === String(num)
          ? dentro.filter((x) => x !== ctx.arrastrando).length >= 2
            ? "border-dashed border-[var(--pro-warn)] bg-[var(--pro-warn-bg)]"
            : "border-dashed border-[var(--pro-acc)] bg-[var(--pro-sel)]"
          : elegidoAqui
            ? "border-[var(--pro-line-2)] bg-[var(--pro-sel)]"
            : "border-[var(--pro-line)] bg-[var(--pro-surface)]",
      )}
    >
      <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center">
        <div className="shrink-0 space-y-1.5 @xl:w-[300px]">
          <span className={etiqueta}>
            {t("callups.pista")} {num}
          </span>
          <div className="relative aspect-[5/2] w-full overflow-hidden rounded-lg bg-[var(--pro-court)] shadow-[inset_0_0_0_3px_rgb(190_215_255/0.35)]">
            <div className="absolute inset-[5%] border-2 border-white/85" />
            <div className="absolute inset-y-[3%] left-1/2 w-[3px] -translate-x-1/2 bg-white/80" />
            <div className="absolute inset-y-[5%] left-[15%] w-0.5 bg-white/85" />
            <div className="absolute inset-y-[5%] right-[15%] w-0.5 bg-white/85" />
            <div className="absolute inset-x-[15%] top-1/2 h-0.5 bg-white/85" />
            <span className="absolute right-[18%] top-[14%] flex size-9 translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed border-white/45 text-sm font-bold text-white/60">
              ?
            </span>
            <span className="absolute bottom-[14%] right-[18%] flex size-9 translate-x-1/2 items-center justify-center rounded-full border-2 border-dashed border-white/45 text-sm font-bold text-white/60">
              ?
            </span>
            {hueco(a, true)}
            {hueco(b, false)}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-bold">
              {a && b
                ? t("pro.parejaTitulo", { a: ctx.pila(a), b: ctx.pila(b) })
                : a
                  ? t("pro.faltaPareja", { name: ctx.pila(a) })
                  : t("pro.pistaLibre")}
            </h3>
            {valor != null && (
              <span
                className={cn(
                  "text-2xl font-extrabold",
                  !n
                    ? "text-[var(--pro-warn)]"
                    : valor >= 60
                      ? "text-[var(--pro-acc-txt)]"
                      : "text-[var(--pro-fg)]",
                )}
              >
                {n ? `${valor} %` : t("pro.nueva")}
              </span>
            )}
          </div>
          {par && (
            <>
              <p className="text-xs text-[var(--pro-muted)]">
                {n
                  ? t("pro.resumenPareja", { g: par.ganados, p: par.perdidos, count: n })
                  : t("pro.resumenNueva", { pct: valor })}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--pro-track)]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    !n
                      ? "bg-[repeating-linear-gradient(135deg,#f5a524_0_6px,rgb(245_165_36/0.35)_6px_12px)]"
                      : valor! >= 60
                        ? "bg-[var(--pro-acc)]"
                        : "bg-[var(--pro-blue)]",
                  )}
                  style={{ width: `${n ? valor : 50}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ctx.mutua(a!, b!) ? (
                  <Tag tono="ok">{t("pro.quimicaMutua")}</Tag>
                ) : (
                  (ctx.eligio.get(a!) === b || ctx.eligio.get(b!) === a) && (
                    <Tag>{t("pro.quimicaUnLado")}</Tag>
                  )
                )}
                {vs && (
                  <Tag tono="acc">
                    {t("pro.contraEllos", { g: vs.ganados, p: vs.perdidos, rival: rival ?? "" })}
                  </Tag>
                )}
                {!n && <Tag tono="aviso">{t("pro.primeraVez")}</Tag>}
              </div>
            </>
          )}
          {!par && !ctx.cerrada && (
            <p className="text-xs text-[var(--pro-muted)]">{t("pro.huecoAyuda")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Tag({ tono, children }: { tono?: "ok" | "acc" | "aviso"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
        tono === "ok" && "border-[var(--pro-ok)]/40 bg-[var(--pro-ok-bg)] text-[var(--pro-ok)]",
        tono === "acc" && "border-[var(--pro-acc)] text-[var(--pro-acc-txt)]",
        tono === "aviso" &&
          "border-[var(--pro-warn)]/40 bg-[var(--pro-warn-bg)] text-[var(--pro-warn)]",
        !tono && "border-[var(--pro-line)] bg-[var(--pro-surface-2)] text-[var(--pro-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function SinPista({ ctx, libres }: { ctx: Ctx; libres: string[] }) {
  const { t } = useTranslation();
  return (
    <div
      data-drop-pro="pool"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors",
        ctx.sobre === "pool"
          ? "border-[var(--pro-acc)] bg-[var(--pro-sel)]"
          : "border-[var(--pro-line-2)]",
      )}
    >
      <span className={etiqueta}>{t("quimica.sinPista")}</span>
      {libres.length === 0 && (
        <span className="text-xs text-[var(--pro-muted)]">{t("quimica.todosConPista")}</span>
      )}
      {libres.map((u) => {
        const sj = ctx.pro.jugadores[u]?.sin_jugar ?? 0;
        return (
          <button
            key={u}
            type="button"
            onClick={ctx.tocar(() => ctx.setSel(u))}
            {...ctx.arrastrable(u, true)}
            aria-pressed={ctx.elegido === u}
            aria-label={t("pro.arrastrar", { name: ctx.nombre(u) })}
            className={cn(
              "inline-flex min-h-10 touch-none select-none items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold",
              !ctx.cerrada && "cursor-grab active:cursor-grabbing",
              ctx.arrastrando === u && "opacity-40",
              ctx.elegido === u
                ? "border-[var(--pro-acc)] bg-[var(--pro-sel)]"
                : "border-[var(--pro-line)] bg-[var(--pro-surface-2)]",
            )}
          >
            {!ctx.cerrada && (
              <GripVertical className="size-3.5 text-[var(--pro-muted)]" aria-hidden="true" />
            )}
            <Avatar texto={ctx.iniciales(u)} />
            {ctx.pila(u)}
            {sj >= 2 && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--pro-warn)]">
                <Clock className="size-3.5" aria-hidden="true" />
                {t("pro.sinJugar", { count: sj })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** La ficha del jugador elegido. */
function FichaJugador({
  ctx,
  u,
  pista,
  otros,
  jornadas,
  rival,
  onQuitar,
  onJuntar,
}: {
  ctx: Ctx;
  u: string;
  pista: number | null;
  otros: string[];
  jornadas: number;
  rival: string | null;
  onQuitar: () => void;
  onJuntar: (otro: string) => void;
}) {
  const { t } = useTranslation();
  const j = ctx.pro.jugadores[u];
  const forma = j?.forma ?? [];
  let racha = "—";
  if (forma.length) {
    const ultima = forma[forma.length - 1];
    let n = 0;
    for (let i = forma.length - 1; i >= 0 && forma[i] === ultima; i--) n++;
    racha = `${n} ${t(ultima ? "pro.letraGanado" : "pro.letraPerdido")}`;
  }

  const parejas = otros
    .map((o) => ({ o, p: parejaPro(ctx.pro, u, o) }))
    .filter((x): x is { o: string; p: NonNullable<typeof x.p> } => !!x.p)
    .map((x) => ({ ...x, n: x.p.ganados + x.p.perdidos }));
  const jugadas = parejas.filter((x) => x.n > 0);
  const mejores = jugadas
    .filter((x) => x.p.prob >= 0.5)
    .sort((a, b) => b.p.prob - a.p.prob)
    .slice(0, 3);
  const peores = jugadas
    .filter((x) => x.p.prob < 0.5)
    .sort((a, b) => a.p.prob - b.p.prob)
    .slice(0, 2);
  const ideal = [...parejas].sort((a, b) => b.p.prob - a.p.prob || b.n - a.n)[0];

  const suya = ctx.eligio.get(u);
  const vsRival = rival ? ctx.pro.rival?.jugadores[u] : undefined;

  const fila = (k: string, v: string) => (
    <div className="flex justify-between gap-3 border-b border-[var(--pro-line)] py-2 text-sm last:border-0">
      <span className="text-[var(--pro-muted)]">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );

  const barras = (lista: typeof mejores, mal: boolean) =>
    lista.map(({ o, p }) => (
      <div key={o} className="grid grid-cols-[80px_minmax(0,1fr)_44px] items-center gap-2 text-sm">
        <span className="truncate font-semibold">{ctx.pila(o)}</span>
        <span className="h-2 overflow-hidden rounded-full bg-[var(--pro-track)]">
          <span
            className={cn(
              "block h-full rounded-full",
              mal ? "bg-[#f5a524]" : "bg-[var(--pro-acc)]",
            )}
            style={{ width: `${pct(p.prob)}%` }}
          />
        </span>
        <span className="text-right text-[var(--pro-muted)]">
          {p.ganados}-{p.perdidos}
        </span>
      </div>
    ));

  return (
    <aside
      aria-label={t("pro.ficha")}
      className="space-y-4 rounded-2xl border border-[var(--pro-line)] bg-[var(--pro-surface)] p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar texto={ctx.iniciales(u)} grande />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{ctx.nombre(u)}</h3>
          <p className="text-xs text-[var(--pro-muted)]">
            {j?.nivel ? t("pro.nivel", { nivel: j.nivel }) : t("pro.sinNivel")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          [t("pro.partidos"), String(j?.partidos ?? 0)],
          [
            t("pro.pistasGanadas"),
            j?.partidos ? `${Math.round((100 * j.ganados) / j.partidos)} %` : "—",
          ],
          [t("pro.racha"), racha],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-[var(--pro-surface-2)] px-2.5 py-2">
            <div className="truncate text-3xs font-semibold text-[var(--pro-muted)]">{k}</div>
            <div className="whitespace-nowrap text-lg font-extrabold">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={etiqueta}>{t("pro.ultimos")}</span>
        {forma.length ? (
          <Puntos forma={forma} grande />
        ) : (
          <span className="text-xs text-[var(--pro-muted)]">{t("pro.sinPartidos")}</span>
        )}
      </div>

      <div className="space-y-2">
        <h4 className={etiqueta}>{t("pro.mejorCon")}</h4>
        {mejores.length ? (
          barras(mejores, false)
        ) : (
          <p className="text-xs text-[var(--pro-muted)]">{t("pro.sinParejasTodavia")}</p>
        )}
      </div>
      {peores.length > 0 && (
        <div className="space-y-2">
          <h4 className={etiqueta}>{t("pro.leCuestaCon")}</h4>
          {barras(peores, true)}
        </div>
      )}

      <div>
        {fila(
          t("quimica.nombre"),
          suya
            ? ctx.mutua(u, suya)
              ? t("pro.quimicaConMutua", { name: ctx.pila(suya) })
              : t("pro.quimicaCon", { name: ctx.pila(suya) })
            : t("pro.noHaElegido"),
        )}
        {rival &&
          fila(
            t("pro.contraRival", { rival }),
            vsRival
              ? t("pro.balanceCorto", { g: vsRival.ganados, p: vsRival.perdidos })
              : t("pro.sinPartidos"),
          )}
        {fila(t("pro.asistencia"), t("pro.jugoDe", { n: j?.partidos ?? 0, total: jornadas }))}
      </div>

      {!ctx.cerrada && (
        <div className="flex flex-col gap-2">
          {ideal && (
            <button
              type="button"
              onClick={() => onJuntar(ideal.o)}
              disabled={ctx.moviendo}
              className="min-h-11 rounded-xl border border-[var(--pro-acc)] bg-[var(--pro-acc)]/10 px-3 text-sm font-bold text-[var(--pro-acc-txt)]"
            >
              {t("pro.juntarCon", { name: ctx.pila(ideal.o), pct: pct(ideal.p.prob) })}
            </button>
          )}
          {pista != null && (
            <button
              type="button"
              onClick={onQuitar}
              disabled={ctx.moviendo}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--pro-line-2)] px-3 text-sm font-semibold"
            >
              <X className="size-4" aria-hidden="true" />
              {t("pro.quitarDePista", { n: pista })}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

/** Quién gana con quién: una casilla por pareja. */
function Matriz({
  ctx,
  jugadores,
  onJuntar,
}: {
  ctx: Ctx;
  jugadores: string[];
  onJuntar: (a: string, b: string) => void;
}) {
  const { t } = useTranslation();
  const rival = ctx.pro.rival;
  const [soloRival, setSoloRival] = useState(false);

  // Con el filtro del rival, el récord es solo el de contra ellos.
  const record = (a: string, b: string) => {
    if (soloRival) {
      const v = rival?.parejas.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
      return v ? { g: v.ganados, p: v.perdidos } : { g: 0, p: 0 };
    }
    const p = parejaPro(ctx.pro, a, b);
    return p ? { g: p.ganados, p: p.perdidos } : { g: 0, p: 0 };
  };

  const color = (v: number) =>
    v >= 75 ? "m5" : v >= 60 ? "m4" : v >= 45 ? "m3" : v >= 35 ? "m2" : "m1";

  const lista = jugadores.flatMap((a, i) =>
    jugadores.slice(i + 1).map((b) => {
      const r = record(a, b);
      const n = r.g + r.p;
      return { a, b, ...r, n, v: n ? r.g / n : 0 };
    }),
  );
  const conDatos = lista.filter((x) => x.n >= 2);
  const top = [...conDatos].sort((x, y) => y.v - x.v || y.n - x.n).slice(0, 4);
  const flojas = [...conDatos]
    .filter((x) => x.v < 0.5)
    .sort((x, y) => x.v - y.v || y.n - x.n)
    .slice(0, 3);
  const nunca = lista.filter((x) => x.n === 0).slice(0, 4);

  const boton = (on: boolean) =>
    cn(
      "min-h-9 rounded-full px-3.5 text-xs font-bold",
      on
        ? "bg-[var(--pro-fg)] text-[var(--pro-bg)]"
        : "border border-[var(--pro-line)] text-[var(--pro-muted)]",
    );

  return (
    <div className="grid gap-5 p-3 sm:p-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--pro-muted)]">{t("pro.matrizExplica")}</p>
          {rival && (
            <div role="group" aria-label={t("pro.matrizFiltro")} className="flex gap-1.5">
              <button
                type="button"
                aria-pressed={!soloRival}
                onClick={() => setSoloRival(false)}
                className={boton(!soloRival)}
              >
                {t("pro.matrizTodos")}
              </button>
              <button
                type="button"
                aria-pressed={soloRival}
                onClick={() => setSoloRival(true)}
                className={boton(soloRival)}
              >
                {t("pro.matrizSoloRival", { rival: rival.nombre })}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto pb-1">
          <table className="border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th />
                {jugadores.map((u) => (
                  <th key={u} scope="col" className="w-14 text-center">
                    <span className="mx-auto mb-1 flex size-8 items-center justify-center rounded-full bg-[var(--pro-surface-2)] text-2xs font-extrabold ring-1 ring-[var(--pro-line)]">
                      {ctx.iniciales(u)}
                    </span>
                    <span className="block truncate text-2xs font-semibold text-[var(--pro-muted)]">
                      {ctx.pila(u)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jugadores.map((f) => (
                <tr key={f}>
                  <th scope="row" className="pr-2 text-left">
                    <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
                      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--pro-surface-2)] text-2xs font-extrabold ring-1 ring-[var(--pro-line)]">
                        {ctx.iniciales(f)}
                      </span>
                      {ctx.pila(f)}
                    </span>
                  </th>
                  {jugadores.map((c) => {
                    if (f === c) return <td key={c} />;
                    const r = record(f, c);
                    const n = r.g + r.p;
                    const v = n ? Math.round((100 * r.g) / n) : 0;
                    const tono = color(v);
                    const pocos = n > 0 && n < 3;
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          onClick={() => onJuntar(f, c)}
                          disabled={ctx.cerrada || ctx.moviendo}
                          aria-label={
                            n
                              ? t("pro.celda", { a: ctx.pila(f), b: ctx.pila(c), g: r.g, p: r.p })
                              : t("pro.celdaNunca", { a: ctx.pila(f), b: ctx.pila(c) })
                          }
                          className={cn(
                            "flex h-12 w-14 flex-col items-center justify-center rounded-xl disabled:cursor-default",
                            !n &&
                              "border border-dashed border-[var(--pro-line-2)] text-[var(--pro-muted)]",
                            pocos && "border border-dashed border-[var(--pro-line-2)] opacity-80",
                          )}
                          style={
                            n
                              ? {
                                  background: pocos
                                    ? `color-mix(in srgb, var(--pro-${tono}) 40%, var(--pro-bg))`
                                    : `var(--pro-${tono})`,
                                  color: pocos ? "var(--pro-fg)" : `var(--pro-${tono}-txt)`,
                                }
                              : undefined
                          }
                        >
                          <span className="text-base font-extrabold">{n ? `${v}%` : "—"}</span>
                          <span className="text-3xs font-semibold opacity-85">
                            {n ? `${r.g}-${r.p}` : t("pro.nunca")}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--pro-muted)]">
          {(
            [
              ["m1", t("pro.leyendaMal")],
              ["m3", t("pro.leyendaParejo")],
              ["m5", t("pro.leyendaBien")],
            ] as const
          ).map(([k, txt]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded" style={{ background: `var(--pro-${k})` }} />
              {txt}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3.5 rounded border border-dashed border-[var(--pro-line-2)] bg-[color-mix(in_srgb,var(--pro-m5)_40%,var(--pro-bg))]" />
            {t("pro.leyendaPocos")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3.5 rounded border border-dashed border-[var(--pro-line-2)]" />
            {t("pro.leyendaNunca")}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1 2xl:content-start">
        <section className="space-y-2 rounded-2xl border border-[var(--pro-line)] bg-[var(--pro-surface)] p-4">
          <h3 className="font-bold">{t("pro.lasQueFuncionan")}</h3>
          {top.length === 0 && (
            <p className="text-xs text-[var(--pro-muted)]">{t("pro.pocosDatos")}</p>
          )}
          {top.map((x, i) => (
            <div
              key={x.a + x.b}
              className="grid grid-cols-[18px_minmax(0,1fr)_44px_44px] items-center gap-2 text-sm"
            >
              <span className="font-extrabold text-[var(--pro-acc-txt)]">{i + 1}</span>
              <span className="truncate font-semibold">
                {t("pro.parejaTitulo", { a: ctx.pila(x.a), b: ctx.pila(x.b) })}
              </span>
              <span className="text-right text-[var(--pro-muted)]">
                {x.g}-{x.p}
              </span>
              <span className="text-right font-extrabold">{Math.round(100 * x.v)}%</span>
            </div>
          ))}
        </section>
        {flojas.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-[var(--pro-line)] bg-[var(--pro-surface)] p-4">
            <h3 className="font-bold">{t("pro.lasQueNoArrancan")}</h3>
            {flojas.map((x) => (
              <div
                key={x.a + x.b}
                className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center gap-2 text-sm"
              >
                <span className="truncate font-semibold">
                  {t("pro.parejaTitulo", { a: ctx.pila(x.a), b: ctx.pila(x.b) })}
                </span>
                <span className="text-right text-[var(--pro-muted)]">
                  {x.g}-{x.p}
                </span>
                <span className="text-right font-extrabold text-[var(--pro-warn)]">
                  {Math.round(100 * x.v)}%
                </span>
              </div>
            ))}
          </section>
        )}
        {nunca.length > 0 && (
          <section className="space-y-1 rounded-2xl border border-dashed border-[var(--pro-line-2)] p-4">
            <h3 className="font-bold">{t("pro.porProbar")}</h3>
            <p className="text-sm text-[var(--pro-muted)]">
              {t("pro.porProbarTexto", {
                parejas: nunca
                  .map((x) => t("pro.parejaTitulo", { a: ctx.pila(x.a), b: ctx.pila(x.b) }))
                  .join(", "),
              })}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
