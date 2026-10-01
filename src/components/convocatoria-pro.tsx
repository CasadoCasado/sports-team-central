/**
 * Convocatoria PRO: lo que se suma al reparto de pistas de un equipo con PRO.
 *
 * Es una capa de lectura sobre la misma convocatoria, nunca otra: las pistas
 * se mueven con las mismas peticiones que el tablero normal, y «Usar esta»
 * rehace el reparto en una sola (`/api/events/{id}/parejas/`). Por eso
 * alternar entre Normal y PRO, o que un gestor use uno y otro gestor el otro,
 * no descuadra nada: los dos pintan las mismas respuestas.
 *
 * Los datos salen de `/api/events/{id}/pro/` (ver `apps/events/pro.py`), que
 * solo responde a la gestión de un equipo con PRO.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles, Star, Swords } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmar } from "@/components/confirm-dialog";

export type ParejaPro = {
  a: string;
  b: string;
  ganados: number;
  perdidos: number;
  prob: number;
};

export type JugadorPro = {
  partidos: number;
  ganados: number;
  /** De la más antigua a la más reciente; `true` es pista ganada. */
  forma: boolean[];
  /** Jornadas del equipo desde la última que jugó; null si nunca. */
  sin_jugar: number | null;
  nivel: string | null;
};

export type PropuestaPro = {
  id: "victoria" | "equilibrada" | "rotacion";
  pistas: string[][];
  esperadas: number;
  descansan: string[];
};

export type TableroPro = {
  media: number;
  jugadores: Record<string, JugadorPro>;
  parejas: ParejaPro[];
  rival: {
    nombre: string;
    ganados: number;
    empatados: number;
    perdidos: number;
    ultimo: { fecha: string; nuestro: number | null; suyo: number | null } | null;
    parejas: { a: string; b: string; ganados: number; perdidos: number }[];
  } | null;
  quimica_mutua: [string, string][];
  propuestas: PropuestaPro[];
};

const CLAVE_MODO = "teamup:convocatoria-pro";

/** Normal o PRO, recordado en este navegador. Por defecto, PRO. */
export function useModoPro(): [boolean, (v: boolean) => void] {
  const [activo, setActivo] = useState(() => {
    try {
      return window.localStorage.getItem(CLAVE_MODO) !== "0";
    } catch {
      return true;
    }
  });
  return [
    activo,
    (v: boolean) => {
      setActivo(v);
      try {
        window.localStorage.setItem(CLAVE_MODO, v ? "1" : "0");
      } catch {
        // Ventana privada: vale para esta visita.
      }
    },
  ];
}

export function useTableroPro(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["event-pro", eventId],
    queryFn: () => api.get<TableroPro>(`/events/${eventId}/pro/`),
    enabled,
  });
}

export function parejaPro(pro: TableroPro, a: string, b: string) {
  return pro.parejas.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
}

const pct = (p: number) => Math.round(100 * p);

/** Los últimos partidos de un jugador, en puntos: lleno es pista ganada. */
export function FormaPuntos({ forma }: { forma: boolean[] }) {
  const { t } = useTranslation();
  if (forma.length === 0) return null;
  const lista = forma.map((g) => t(g ? "pro.ganado" : "pro.perdido")).join(", ");
  return (
    <span
      role="img"
      aria-label={t("pro.forma", { lista })}
      title={t("pro.forma", { lista })}
      className="inline-flex gap-0.5"
    >
      {forma.map((g, i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full",
            g ? "bg-ok" : "border border-muted-foreground/60 bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

/** Debajo de una pista con pareja: su récord juntos y lo que se espera. */
export function PistaPro({ pro, a, b }: { pro: TableroPro; a: string; b: string }) {
  const { t } = useTranslation();
  const p = parejaPro(pro, a, b);
  if (!p) return null;
  const n = p.ganados + p.perdidos;
  const valor = pct(p.prob);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-2xs">
        <span className="text-muted-foreground">
          {n ? t("pro.juntos", { g: p.ganados, p: p.perdidos }) : t("pro.nuncaJuntos")}
        </span>
        <span className={cn("font-extrabold", valor >= 60 ? "text-ok" : "text-foreground")}>
          {n ? `${valor} %` : t("pro.estimado", { pct: valor })}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            n ? (valor >= 60 ? "bg-ok" : "bg-primary") : "bg-warn/70",
          )}
          style={{ width: `${valor}%` }}
        />
      </div>
    </div>
  );
}

type Evento = {
  id: string;
  rival?: string | null;
  padel_num_pistas: number | null;
  convocatoria_confirmada: boolean;
};

/**
 * La barra PRO encima del tablero: el conmutador Normal/PRO, lo que pasó
 * contra el rival y «Sugerir parejas».
 */
export function BarraPro({
  event,
  pro,
  activo,
  onActivo,
  nombre,
  hayReparto,
  onChanged,
}: {
  event: Evento;
  pro: TableroPro | undefined;
  activo: boolean;
  onActivo: (v: boolean) => void;
  /** Nombre corto de un jugador: «Sara L.». */
  nombre: (userId: string) => string;
  /** Si alguien tiene ya pista: entonces «Usar esta» pregunta antes. */
  hayReparto: boolean;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const cerrada = event.convocatoria_confirmada;

  const aplicar = useMutation({
    mutationFn: (pistas: string[][]) => api.post(`/events/${event.id}/parejas/`, { pistas }),
    onSuccess: () => {
      toast.success(t("pro.aplicada"));
      setAbierto(false);
      onChanged();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      onChanged();
    },
  });

  async function usar(p: PropuestaPro) {
    if (hayReparto) {
      const ok = await confirmar({
        title: t("pro.cambiarTitulo"),
        description: t("pro.cambiarTexto"),
        confirmLabel: t("pro.usar"),
      });
      if (!ok) return;
    }
    aplicar.mutate(p.pistas);
  }

  const boton = (on: boolean) =>
    cn(
      "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-2xs font-extrabold uppercase tracking-widest transition-colors",
      on ? "bg-[#D7F24B] text-[#0B1222]" : "text-muted-foreground hover:text-foreground",
    );

  const rival = pro?.rival;
  const mutua = (a: string, b: string) =>
    !!pro?.quimica_mutua.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const contraRival = (a: string, b: string) =>
    rival?.parejas.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label={t("pro.modo")}
          className="inline-flex rounded-full border border-border bg-card p-1"
        >
          <button
            type="button"
            aria-pressed={!activo}
            onClick={() => onActivo(false)}
            className={boton(!activo)}
          >
            {t("pro.normal")}
          </button>
          <button
            type="button"
            aria-pressed={activo}
            onClick={() => onActivo(true)}
            className={boton(activo)}
          >
            <Star className="size-3.5" aria-hidden="true" />
            {t("pro.pro")}
          </button>
        </div>
        {activo && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAbierto(true)}
            disabled={!pro || cerrada}
            title={cerrada ? t("pro.sugerirCerrada") : undefined}
            className="min-h-9 text-2xs font-bold uppercase tracking-widest"
          >
            <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
            {t("pro.sugerir")}
          </Button>
        )}
      </div>

      {activo && rival && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-extrabold uppercase tracking-widest text-2xs">
            <Swords className="size-3.5" aria-hidden="true" />
            {t("pro.contraRival", { rival: rival.nombre })}
          </span>
          {rival.ultimo ? (
            <>
              <span>
                {rival.empatados
                  ? t("pro.rivalBalanceEmpates", {
                      g: rival.ganados,
                      e: rival.empatados,
                      p: rival.perdidos,
                    })
                  : t("pro.rivalBalance", { g: rival.ganados, p: rival.perdidos })}
              </span>
              {rival.ultimo.nuestro != null && rival.ultimo.suyo != null && (
                <span>
                  {t("pro.rivalUltimo", { a: rival.ultimo.nuestro, b: rival.ultimo.suyo })}
                </span>
              )}
              {rival.parejas.slice(0, 2).map((p) => (
                <span key={p.a + p.b} className="text-muted-foreground">
                  {t("pro.rivalPareja", {
                    a: nombre(p.a),
                    b: nombre(p.b),
                    g: p.ganados,
                    p: p.perdidos,
                  })}
                </span>
              ))}
            </>
          ) : (
            <span className="text-muted-foreground">{t("pro.rivalSinPartidos")}</span>
          )}
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("pro.sugerirTitulo")}</DialogTitle>
            <DialogDescription>{t("pro.sugerirExplica")}</DialogDescription>
          </DialogHeader>
          {pro && pro.propuestas.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("pro.sinPropuestas")}</p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {pro?.propuestas.map((p) => (
              <article
                key={p.id}
                aria-label={t(`pro.propuesta_${p.id}`)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <h3 className="font-bold">{t(`pro.propuesta_${p.id}`)}</h3>
                  <p className="text-xs text-muted-foreground">{t(`pro.propuesta_${p.id}Texto`)}</p>
                </div>
                <p className="text-sm font-bold">
                  {t("pro.esperadas", {
                    n: p.esperadas.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
                    total: p.pistas.length,
                  })}
                </p>
                <ol className="space-y-2">
                  {p.pistas.map(([a, b], i) => {
                    const par = b ? parejaPro(pro, a, b) : undefined;
                    const vs = b ? contraRival(a, b) : undefined;
                    return (
                      <li key={i} className="rounded-lg bg-muted/50 p-2 text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold">
                            {i + 1}. {nombre(a)}
                            {b && ` · ${nombre(b)}`}
                          </span>
                          {par && <span className="font-extrabold">{pct(par.prob)} %</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {par && (
                            <Chip>
                              {par.ganados + par.perdidos
                                ? t("pro.juntos", { g: par.ganados, p: par.perdidos })
                                : t("pro.nuncaJuntos")}
                            </Chip>
                          )}
                          {b && mutua(a, b) && <Chip tono="ok">{t("pro.quimicaMutua")}</Chip>}
                          {vs && (
                            <Chip tono="ok">
                              {vs.ganados}-{vs.perdidos} {rival?.nombre}
                            </Chip>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-xs text-muted-foreground">
                  {p.descansan.length
                    ? t("pro.descansan", { nombres: p.descansan.map(nombre).join(", ") })
                    : t("pro.nadieDescansa")}
                </p>
                <Button
                  onClick={() => usar(p)}
                  disabled={aplicar.isPending || cerrada}
                  className="mt-auto min-h-11 text-2xs font-bold uppercase tracking-widest"
                >
                  {t("pro.usar")}
                </Button>
              </article>
            ))}
          </div>
          <p className="text-2xs text-muted-foreground">{t("pro.comoSeCalcula")}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ tono, children }: { tono?: "ok"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-3xs font-bold",
        tono === "ok" ? "bg-ok/15 text-ok" : "border border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
