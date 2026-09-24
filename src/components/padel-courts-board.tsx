import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, GripVertical, Hand, Lock, Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { useQuimicas } from "@/hooks/use-quimica";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type Props = {
  event: { id: string; padel_num_pistas: number | null; convocatoria_confirmada: boolean };
  responses: Respuesta[];
  members: Miembro[];
  /** Tras cada cambio, para que la pantalla vuelva a pedir lo que pinta. */
  onChanged: () => void;
};

/**
 * El reparto de parejas por pista de un partido de pádel, para la gestión.
 *
 * - A la izquierda, la química del equipo: primero las parejas mutuas, que se
 *   juntan con un toque, y luego las de un solo lado.
 * - A la derecha, las pistas. A cada jugador se le coge y se le arrastra a la
 *   suya; arrastrarlo a «Sin pista» le quita la pista. Poner a alguien en una
 *   pista lo convoca.
 * - Al final, confirmar la convocatoria: cierra la química y cada uno ve su
 *   pista. Se puede reabrir.
 *
 * El arrastre va con eventos de puntero, no con el arrastrar y soltar del
 * navegador, que no funciona con el dedo. Tocar un jugador sin arrastrarlo, o
 * pulsar Intro sobre él, lo lleva a la siguiente pista con hueco (o lo
 * devuelve a «Sin pista» si ya tenía una).
 */
export function PadelCourtsBoard({ event, responses, members, onChanged }: Props) {
  const { t } = useTranslation();
  const cerrada = event.convocatoria_confirmada;
  const numPistas = event.padel_num_pistas ?? 0;
  const pistas = Array.from({ length: numPistas }, (_, i) => i + 1);

  // Lo que se acaba de mover, hasta que el servidor lo confirme: sin esto, el
  // jugador volvería un instante a su sitio al soltarlo.
  const [pendientes, setPendientes] = useState<Record<string, number | null>>({});
  useEffect(() => setPendientes({}), [responses]);

  const apuntados = responses.filter((r) => r.status !== "rechazado");
  const pistaDe = (r: Respuesta) => (r.id in pendientes ? pendientes[r.id] : r.padel_pista);
  const enPista = (n: number) => apuntados.filter((r) => pistaDe(r) === n);
  const porUsuario = new Map(apuntados.map((r) => [r.user_id, r]));

  const nombre = (userId: string) => {
    const p = members.find((m) => m.user_id === userId)?.profile;
    return p ? `${p.nombre} ${p.apellidos}` : "?";
  };
  const corto = (userId: string) => {
    const p = members.find((m) => m.user_id === userId)?.profile;
    return p ? `${p.nombre} ${p.apellidos?.[0] ?? ""}.` : "?";
  };
  const pila = (userId: string) =>
    members.find((m) => m.user_id === userId)?.profile?.nombre ?? "?";

  // --- química --------------------------------------------------------------
  const { data: quimicas } = useQuimicas([event.id]);
  const quimicaDe = new Map<string, string>();
  for (const q of quimicas ?? []) {
    if (porUsuario.has(q.user_id) && porUsuario.has(q.target_user_id)) {
      quimicaDe.set(q.user_id, q.target_user_id);
    }
  }
  const mutuas: [string, string][] = [];
  const deUnLado: [string, string][] = [];
  const vistos = new Set<string>();
  for (const [de, a] of quimicaDe) {
    if (vistos.has(de)) continue;
    if (quimicaDe.get(a) === de) {
      mutuas.push([de, a]);
      vistos.add(de).add(a);
    } else {
      deUnLado.push([de, a]);
    }
  }
  const juntos = (a: string, b: string) => {
    const pa = porUsuario.get(a),
      pb = porUsuario.get(b);
    return !!pa && !!pb && pistaDe(pa) != null && pistaDe(pa) === pistaDe(pb);
  };
  const conQuimica = (a: string, b: string) => quimicaDe.get(a) === b || quimicaDe.get(b) === a;

  // --- cambios ---------------------------------------------------------------
  const asignar = useMutation({
    mutationFn: ({ id, pista }: { id: string; pista: number | null }) =>
      api.patch(
        `/event-responses/${id}/`,
        pista == null ? { padel_pista: null } : { padel_pista: pista, es_convocado: true },
      ),
    onError: (e: Error) => {
      setPendientes({});
      toast.error(e.message);
    },
    onSettled: onChanged,
  });

  function mover(r: Respuesta, pista: number | null) {
    if (pistaDe(r) === pista) return;
    if (pista != null && enPista(pista).filter((o) => o.id !== r.id).length >= 2) {
      toast.error(t("quimica.pistaLlena", { n: pista }));
      return;
    }
    setPendientes((p) => ({ ...p, [r.id]: pista }));
    asignar.mutate({ id: r.id, pista });
    const pareja = pista != null ? enPista(pista).find((o) => o.id !== r.id) : undefined;
    if (pareja && conQuimica(r.user_id, pareja.user_id)) {
      toast.success(t("quimica.juntosConQuimica", { a: pila(r.user_id), b: pila(pareja.user_id) }));
    }
  }

  function tocar(r: Respuesta) {
    if (pistaDe(r) != null) return mover(r, null);
    const hueco = pistas.find((n) => enPista(n).length < 2);
    if (hueco == null) toast.error(t("quimica.pistasCompletas"));
    else mover(r, hueco);
  }

  function juntar(a: string, b: string) {
    const libre = pistas.find((n) => enPista(n).length === 0);
    const ra = porUsuario.get(a),
      rb = porUsuario.get(b);
    if (libre == null || !ra || !rb) return;
    mover(ra, libre);
    setPendientes((p) => ({ ...p, [rb.id]: libre }));
    asignar.mutate({ id: rb.id, pista: libre });
  }

  const confirmar = useMutation({
    mutationFn: (confirmada: boolean) => api.post(`/events/${event.id}/confirmar/`, { confirmada }),
    onSuccess: (_d, confirmada) => {
      toast.success(confirmada ? t("quimica.confirmada") : t("quimica.reabierta"));
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pistasDraft, setPistasDraft] = useState(numPistas ? String(numPistas) : "");
  const guardarPistas = useMutation({
    mutationFn: (n: number | null) => api.patch(`/events/${event.id}/`, { padel_num_pistas: n }),
    onSuccess: () => {
      toast.success(t("events.updated"));
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- arrastrar -------------------------------------------------------------
  const tablero = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ r: Respuesta; x0: number; y0: number; movido: boolean } | null>(null);
  const destino = useRef<string | null>(null);
  const acabaDeArrastrar = useRef(false);
  const [fantasma, setFantasma] = useState<{ r: Respuesta; x: number; y: number } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  function alPulsar(e: ReactPointerEvent<HTMLButtonElement>, r: Respuesta) {
    if (cerrada || e.button > 0) return;
    arrastre.current = { r, x0: e.clientX, y0: e.clientY, movido: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function alMover(e: ReactPointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    if (!a.movido) {
      if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
      a.movido = true;
    }
    setFantasma({ r: a.r, x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-drop]");
    const nuevo = el && tablero.current?.contains(el) ? (el.dataset.drop ?? null) : null;
    destino.current = nuevo;
    setSobre(nuevo);
  }

  function alSoltar() {
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
    if (d === "pool") mover(a.r, null);
    else if (d) mover(a.r, Number(d));
  }

  function alCancelar() {
    arrastre.current = null;
    destino.current = null;
    setFantasma(null);
    setSobre(null);
  }

  const chip = (r: Respuesta, colocado: boolean) => {
    const suya = quimicaDe.get(r.user_id);
    const pareja = colocado ? enPista(pistaDe(r)!).find((o) => o.id !== r.id) : undefined;
    const violeta = !!pareja && conQuimica(r.user_id, pareja.user_id);
    return (
      <button
        key={r.id}
        type="button"
        disabled={cerrada}
        onPointerDown={(e) => alPulsar(e, r)}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alCancelar}
        onClick={() => !acabaDeArrastrar.current && tocar(r)}
        aria-label={
          cerrada ? nombre(r.user_id) : t("quimica.arrastrar", { name: nombre(r.user_id) })
        }
        className={cn(
          "inline-flex touch-none select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          !cerrada && "cursor-grab active:cursor-grabbing",
          colocado
            ? violeta
              ? "border-evt-social/40 bg-evt-social/10"
              : "border-primary/40 bg-primary/10"
            : "border-border bg-card",
          fantasma?.r.id === r.id && "opacity-30",
        )}
      >
        {!cerrada && <GripVertical className="size-3 text-muted-foreground" aria-hidden="true" />}
        {corto(r.user_id)}
        {!colocado && suya && (
          <span className="inline-flex items-center gap-0.5 font-bold text-evt-social">
            <Sparkles className="size-3" aria-hidden="true" />
            {pila(suya)}
          </span>
        )}
      </button>
    );
  };

  const libres = apuntados.filter((r) => pistaDe(r) == null);
  const completas = numPistas > 0 && pistas.every((n) => enPista(n).length === 2);
  const etiqueta = "text-2xs font-bold uppercase tracking-widest text-muted-foreground";

  return (
    <div ref={tablero} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="space-y-3">
        <h3 className={cn(etiqueta, "flex items-center gap-1.5")}>
          <Sparkles className="size-3.5 text-evt-social" aria-hidden="true" />
          {t("quimica.delEquipo")}
        </h3>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {mutuas.length === 0 && deUnLado.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">{t("quimica.nadieTodavia")}</p>
          )}
          {mutuas.map(([a, b]) => (
            <div key={a} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <strong>{pila(a)}</strong>
                <span className="mx-1 font-extrabold text-evt-social">⇄</span>
                <strong>{pila(b)}</strong>
              </span>
              {juntos(a, b) ? (
                <Etiqueta tono="ok">
                  {t("quimica.enPista", { n: pistaDe(porUsuario.get(a)!) })}
                </Etiqueta>
              ) : (
                <>
                  <Etiqueta tono="mutua">{t("quimica.mutua")}</Etiqueta>
                  {!cerrada &&
                    pistaDe(porUsuario.get(a)!) == null &&
                    pistaDe(porUsuario.get(b)!) == null &&
                    pistas.some((n) => enPista(n).length === 0) && (
                      <Button
                        size="sm"
                        onClick={() => juntar(a, b)}
                        className="h-8 text-2xs font-bold uppercase tracking-widest"
                      >
                        {t("quimica.juntar")}
                      </Button>
                    )}
                </>
              )}
            </div>
          ))}
          {deUnLado.map(([de, a]) => (
            <div key={de} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <strong>{pila(de)}</strong>
                <span className="mx-1 font-extrabold text-evt-social">→</span>
                {pila(a)}
              </span>
              {juntos(de, a) ? (
                <Etiqueta tono="ok">
                  {t("quimica.enPista", { n: pistaDe(porUsuario.get(de)!) })}
                </Etiqueta>
              ) : (
                <Etiqueta tono="neutro">{t("quimica.deUnLado")}</Etiqueta>
              )}
            </div>
          ))}
        </div>

        <h3 className={etiqueta}>
          {t("quimica.sinPista")} ({libres.length})
        </h3>
        <div
          data-drop="pool"
          className={cn(
            "flex min-h-14 flex-wrap gap-1.5 rounded-lg border-[1.5px] border-dashed p-2.5 transition-colors",
            sobre === "pool" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          {libres.map((r) => chip(r, false))}
          {libres.length === 0 && (
            <span className="text-xs text-muted-foreground">{t("quimica.todosConPista")}</span>
          )}
        </div>
        {!cerrada && numPistas > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hand className="size-3.5 shrink-0" aria-hidden="true" />
            {t("quimica.comoArrastrar")}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className={etiqueta}>{t("callups.padelAssign")}</h3>
          {!cerrada && (
            <div className="flex items-end gap-2">
              <label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("events.padelPistas")}
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={pistasDraft}
                  onChange={(e) => setPistasDraft(e.target.value)}
                  className="mt-1 h-8 w-20"
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => guardarPistas.mutate(pistasDraft ? Number(pistasDraft) : null)}
                className="h-8 text-2xs font-bold uppercase tracking-widest"
              >
                {t("common.save")}
              </Button>
            </div>
          )}
        </div>
        {numPistas === 0 && (
          <p className="text-xs text-muted-foreground">{t("events.padelPistasHint")}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {pistas.map((n) => {
            const dentro = enPista(n);
            const llena = dentro.filter((r) => r.id !== fantasma?.r.id).length >= 2;
            return (
              <div
                key={n}
                data-drop={String(n)}
                className={cn(
                  "rounded-lg border-[1.5px] bg-card p-2.5 transition-colors",
                  sobre === String(n)
                    ? llena
                      ? "border-dashed border-warn bg-warn/5"
                      : "border-dashed border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <div className="mb-1.5 flex justify-between text-2xs font-bold uppercase tracking-widest">
                  <span>
                    {t("callups.pista")} {n}
                  </span>
                  <span className={dentro.length === 2 ? "text-primary" : "text-muted-foreground"}>
                    {dentro.length}/2
                  </span>
                </div>
                <div className="flex min-h-8 flex-wrap items-center gap-1.5">
                  {dentro.map((r) => chip(r, true))}
                  {dentro.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      {cerrada ? t("quimica.vacia") : t("quimica.sueltaAqui")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cerrada ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ok/35 bg-ok/10 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2">
              <Lock className="size-4 shrink-0 text-ok" aria-hidden="true" />
              <span>
                <strong>{t("quimica.confirmadaTitulo")}</strong> {t("quimica.confirmadaTexto")}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => confirmar.mutate(false)}
              disabled={confirmar.isPending}
              className="text-2xs font-bold uppercase tracking-widest"
            >
              {t("quimica.reabrir")}
            </Button>
          </div>
        ) : (
          numPistas > 0 && (
            <div className="space-y-1.5">
              <Button
                onClick={() => confirmar.mutate(true)}
                disabled={confirmar.isPending}
                className="min-h-11 w-full text-2xs font-bold uppercase tracking-widest"
              >
                <Check className="mr-1.5 size-4" aria-hidden="true" />
                {t("quimica.confirmar")}
              </Button>
              {!completas && (
                <p className="text-xs text-muted-foreground">{t("quimica.pistasSinCompletar")}</p>
              )}
            </div>
          )
        )}
      </div>

      {fantasma &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[60] inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-2.5 py-1 text-xs shadow-[var(--shadow-elev)]"
            style={{
              left: fantasma.x,
              top: fantasma.y,
              transform: "translate(-50%, -60%) rotate(-3deg) scale(1.06)",
            }}
          >
            <GripVertical className="size-3 text-muted-foreground" />
            {corto(fantasma.r.user_id)}
          </div>,
          document.body,
        )}
    </div>
  );
}

function Etiqueta({
  tono,
  children,
}: {
  tono: "mutua" | "ok" | "neutro";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-3xs font-extrabold uppercase tracking-widest",
        tono === "mutua" && "bg-evt-social text-white",
        tono === "ok" && "bg-ok/15 text-ok",
        tono === "neutro" && "border border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
