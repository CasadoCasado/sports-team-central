/**
 * El tablero de un entreno de rey de pista: cómo quedó cada pista.
 *
 * - «Repartir pistas» cuenta quién asistió y crea las pistas de cuatro que
 *   hacen falta (ocho asistentes, dos pistas con ocho huecos). Si no sale
 *   justo, ofrece crear los invitados que falten («Invitado 1», «Invitado 2»…).
 * - Cada pista tiene dos lados: los que ganaron (aguantaban la pista) y los que
 *   perdieron, dos huecos cada uno. A cada jugador se le arrastra a su hueco;
 *   tocarlo y luego tocar el hueco también vale. Arrastrarlo a «Sin pista» o
 *   pulsar su «×» lo saca.
 * - El orden de las pistas es el orden final del entreno (la 1.ª, la de los
 *   reyes); se cambia con las flechas.
 *
 * Solo edita el borrador: guardar lo hace `TrainingResultsSection`.
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Crown, GripVertical, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type DraftCourt = {
  pista: number;
  players: { user_id: string; ganador: boolean }[];
};

export type Jugador = { user_id: string; nombre: string };

/** Huecos por lado de pista: dos ganadores y dos perdedores. */
const POR_LADO = 2;

export function ReyPistaTablero({
  draft,
  setDraft,
  canEdit,
  jugadores,
  nombre,
}: {
  draft: DraftCourt[];
  setDraft: (f: (prev: DraftCourt[]) => DraftCourt[]) => void;
  canEdit: boolean;
  /** Quién puede ir a una pista: los que asistieron (y los invitados). */
  jugadores: Jugador[];
  nombre: (userId: string) => string;
}) {
  const { t } = useTranslation();
  const raiz = useRef<HTMLDivElement>(null);
  const [elegido, setElegido] = useState<string | null>(null);

  const colocados = new Set(draft.flatMap((c) => c.players.map((p) => p.user_id)));
  const libres = jugadores.filter((j) => !colocados.has(j.user_id));

  /** Pone a alguien en un lado de una pista (o lo saca, con `destino` null). */
  function colocar(userId: string, destino: { pista: number; ganador: boolean } | null) {
    setDraft((prev) => {
      if (destino) {
        const c = prev.find((x) => x.pista === destino.pista);
        const enEseLado = c?.players.filter(
          (p) => p.ganador === destino.ganador && p.user_id !== userId,
        );
        if (!c || (enEseLado?.length ?? 0) >= POR_LADO) {
          toast.error(t("training.ladoLleno"));
          return prev;
        }
      }
      return prev.map((c) => {
        const sin = c.players.filter((p) => p.user_id !== userId);
        if (destino && c.pista === destino.pista) {
          return { ...c, players: [...sin, { user_id: userId, ganador: destino.ganador }] };
        }
        return { ...c, players: sin };
      });
    });
    setElegido(null);
  }

  // --- arrastrar (eventos de puntero, como el reparto de los partidos) -----
  const arrastre = useRef<{ u: string; x0: number; y0: number; movido: boolean } | null>(null);
  const destino = useRef<string | null>(null);
  const acabaDeArrastrar = useRef(false);
  const [fantasma, setFantasma] = useState<{ u: string; x: number; y: number } | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const arrastrable = (u: string) =>
    canEdit
      ? {
          onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
            if (e.button > 0) return;
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
              ?.closest<HTMLElement>("[data-hueco]");
            const nuevo = el && raiz.current?.contains(el) ? (el.dataset.hueco ?? null) : null;
            destino.current = nuevo;
            setSobre(nuevo);
          },
          onPointerUp: () => {
            const a = arrastre.current;
            arrastre.current = null;
            setFantasma(null);
            setSobre(null);
            if (!a?.movido) return;
            acabaDeArrastrar.current = true;
            setTimeout(() => (acabaDeArrastrar.current = false), 0);
            const d = destino.current;
            destino.current = null;
            if (d === "libres") colocar(a.u, null);
            else if (d) colocar(a.u, leerHueco(d));
          },
          onPointerCancel: () => {
            arrastre.current = null;
            destino.current = null;
            setFantasma(null);
            setSobre(null);
          },
        }
      : {};

  const tocar = (u: string) => () => {
    if (acabaDeArrastrar.current || !canEdit) return;
    setElegido((x) => (x === u ? null : u));
  };

  const ficha = (u: string, enPista: boolean) => (
    <span
      key={u}
      className={cn(
        "group relative inline-flex max-w-full items-center",
        fantasma?.u === u && "opacity-30",
      )}
    >
      <button
        type="button"
        onClick={tocar(u)}
        {...arrastrable(u)}
        aria-pressed={elegido === u}
        aria-label={canEdit ? t("training.arrastrar", { name: nombre(u) }) : nombre(u)}
        className={cn(
          "inline-flex min-h-9 max-w-full touch-none select-none items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
          canEdit && "cursor-grab active:cursor-grabbing",
          elegido === u ? "border-primary bg-primary/10" : "border-border bg-card",
        )}
      >
        {canEdit && (
          <GripVertical className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="truncate">{nombre(u)}</span>
      </button>
      {canEdit && enPista && (
        <button
          type="button"
          onClick={() => colocar(u, null)}
          aria-label={t("training.removePlayer")}
          title={t("training.removePlayer")}
          className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );

  const hueco = (pista: number, ganador: boolean, ocupante: string | undefined, i: number) => {
    const id = `${pista}:${ganador ? "g" : "p"}`;
    const marcado = sobre === id;
    if (ocupante) {
      return (
        <div key={ocupante} data-hueco={id} className="flex min-h-11 items-center">
          {ficha(ocupante, true)}
        </div>
      );
    }
    return (
      <button
        key={`vacio-${i}`}
        type="button"
        data-hueco={id}
        disabled={!canEdit || !elegido}
        onClick={() => elegido && colocar(elegido, { pista, ganador })}
        aria-label={
          elegido ? t("training.ponerAqui", { name: nombre(elegido) }) : t("training.huecoLibre")
        }
        className={cn(
          "flex min-h-11 min-w-28 flex-1 items-center justify-center rounded-lg border-[1.5px] border-dashed text-xs text-muted-foreground transition-colors disabled:cursor-default",
          marcado || elegido ? "border-primary bg-primary/5 text-primary" : "border-border",
        )}
      >
        {canEdit ? t("training.sueltaAqui") : "—"}
      </button>
    );
  };

  const lado = (c: DraftCourt, ganador: boolean) => {
    const ocupantes = c.players.filter((p) => p.ganador === ganador).map((p) => p.user_id);
    const id = `${c.pista}:${ganador ? "g" : "p"}`;
    return (
      <div
        data-hueco={id}
        className={cn(
          "space-y-1.5 rounded-lg p-2 transition-colors",
          ganador ? "bg-ok/5" : "bg-muted/40",
          sobre === id && "ring-2 ring-primary",
        )}
      >
        <p
          className={cn(
            "flex items-center gap-1 text-2xs font-bold uppercase tracking-widest",
            ganador ? "text-ok" : "text-muted-foreground",
          )}
        >
          {ganador && <Crown className="size-3" aria-hidden="true" />}
          {ganador ? t("training.ganadores") : t("training.perdedores")}
        </p>
        {/* Los dos del lado, en la misma línea; si no caben, bajan. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: Math.max(POR_LADO, ocupantes.length) }, (_, i) =>
            hueco(c.pista, ganador, ocupantes[i], i),
          )}
        </div>
      </div>
    );
  };

  const mover = (index: number, delta: number) =>
    setDraft((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div ref={raiz} className="space-y-3">
      {draft.map((c, index) => (
        <section
          key={c.pista}
          aria-label={t("training.pistaN", { n: c.pista })}
          data-pista-entreno={c.pista}
          className="rounded-xl border border-border p-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-2xs font-black text-primary">
                {index + 1}
              </span>
              <span className="text-sm font-bold">{t("training.pistaN", { n: c.pista })}</span>
              {index === 0 && (
                <span className="text-2xs font-bold uppercase tracking-widest text-evt-torneo">
                  {t("training.laDeLosReyes")}
                </span>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => mover(index, -1)}
                  disabled={index === 0}
                  aria-label={t("training.moveUp")}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-card disabled:opacity-40"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(index, 1)}
                  disabled={index === draft.length - 1}
                  aria-label={t("training.moveDown")}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-card disabled:opacity-40"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={t("training.removeCourt")}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-border text-destructive hover:bg-card"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {lado(c, true)}
            {lado(c, false)}
          </div>
        </section>
      ))}

      {canEdit && (
        <div
          data-hueco="libres"
          className={cn(
            "flex min-h-14 flex-wrap items-center gap-1.5 rounded-xl border-[1.5px] border-dashed p-2.5 transition-colors",
            sobre === "libres" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("training.sinPista")} ({libres.length})
          </span>
          {libres.map((j) => ficha(j.user_id, false))}
          {libres.length === 0 && (
            <span className="text-xs text-muted-foreground">{t("training.todosColocados")}</span>
          )}
        </div>
      )}

      {fantasma &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[60] inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-elev)]"
            style={{
              left: fantasma.x,
              top: fantasma.y,
              transform: "translate(-50%, -60%) rotate(-3deg) scale(1.06)",
            }}
          >
            <GripVertical className="size-3 text-muted-foreground" />
            {nombre(fantasma.u)}
          </div>,
          document.body,
        )}
    </div>
  );
}

function leerHueco(id: string): { pista: number; ganador: boolean } {
  const [pista, lado] = id.split(":");
  return { pista: Number(pista), ganador: lado === "g" };
}

/** Cuántas pistas de cuatro hacen falta para `n` jugadores, y cuántos faltan. */
export function pistasPara(n: number): { pistas: number; faltan: number } {
  const pistas = Math.ceil(n / 4);
  return { pistas, faltan: pistas * 4 - n };
}
