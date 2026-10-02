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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles, Star } from "lucide-react";

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
import { PadelCourtsBoard } from "@/components/padel-courts-board";
import { VistaPro } from "@/components/vista-pro";
import { CargandoPro } from "@/components/cargando-pro";
import { parejaPro, type PropuestaPro, type TableroPro } from "@/lib/pro";
import { PistasCerradas } from "@/components/pistas-cerradas";

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

const pct = (p: number) => Math.round(100 * p);

type Evento = {
  id: string;
  rival?: string | null;
  padel_num_pistas: number | null;
  convocatoria_confirmada: boolean;
};

/**
 * La barra PRO encima del tablero: el conmutador Normal/PRO, lo que pasó
 * contra el rival y «Sugerir parejas».
 *
 * Es también donde se activa: en un equipo sin PRO, pulsar «PRO» lo activa
 * para el equipo si quien pulsa es el capitán o el dueño; al resto de la
 * gestión se le dice que lo activa el capitán.
 */
function BarraPro({
  event,
  equipo,
  puedeActivar,
  pro,
  activo,
  onActivo,
  nombre,
  hayReparto,
  onChanged,
}: {
  event: Evento;
  equipo: { id: string; nombre: string; es_pro: boolean };
  /** El capitán o el dueño: `can_manage_roles` en el backend. */
  puedeActivar: boolean;
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
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  // Las propuestas son lo único caro de PRO: se piden al abrir el diálogo, no
  // al cargar el tablero.
  const { data: propuestas, isFetching: buscando } = useQuery({
    queryKey: ["event-pro-propuestas", event.id],
    queryFn: () =>
      api
        .get<{ propuestas: PropuestaPro[] }>(`/events/${event.id}/propuestas/`)
        .then((r) => r.propuestas),
    enabled: abierto && !event.convocatoria_confirmada,
  });
  const cerrada = event.convocatoria_confirmada;

  const cambiarPro = useMutation({
    mutationFn: (on: boolean) => api.post(`/teams/${equipo.id}/pro/`, { activo: on }),
    onSuccess: (_d, on) => {
      toast.success(t(on ? "pro.activado" : "pro.quitado", { team: equipo.nombre }));
      onActivo(on);
      qc.invalidateQueries({ queryKey: ["team-sport", equipo.id] });
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function pulsarPro() {
    if (equipo.es_pro) return onActivo(true);
    if (!puedeActivar) return toast.info(t("pro.soloCapitan"));
    const ok = await confirmar({
      title: t("pro.activarTitulo", { team: equipo.nombre }),
      description: t("pro.explica"),
      confirmLabel: t("pro.activar"),
      icon: Star,
    });
    if (ok) cambiarPro.mutate(true);
  }

  async function quitarPro() {
    const ok = await confirmar({
      title: t("pro.quitarTitulo", { team: equipo.nombre }),
      description: t("pro.quitarTexto"),
      confirmLabel: t("pro.quitar"),
      tone: "danger",
    });
    if (ok) cambiarPro.mutate(false);
  }

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
            onClick={pulsarPro}
            disabled={cambiarPro.isPending}
            className={boton(activo)}
          >
            <Star className="size-3.5" aria-hidden="true" />
            {t("pro.pro")}
          </button>
        </div>
        {activo && (
          <div className="flex flex-wrap items-center gap-2">
            {puedeActivar && (
              <Button
                size="sm"
                variant="ghost"
                onClick={quitarPro}
                disabled={cambiarPro.isPending}
                className="min-h-9 text-2xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                {t("pro.quitar")}
              </Button>
            )}
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
          </div>
        )}
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("pro.sugerirTitulo")}</DialogTitle>
            <DialogDescription>{t("pro.sugerirExplica")}</DialogDescription>
          </DialogHeader>
          {buscando && !propuestas && <CargandoPro texto={t("pro.cargandoPropuestas")} />}
          {propuestas && propuestas.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("pro.sinPropuestas")}</p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {propuestas?.map((p) => (
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
                    const par = b && pro ? parejaPro(pro, a, b) : undefined;
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

type Miembro = {
  user_id: string;
  role?: string;
  profile: { nombre: string; apellidos: string } | null;
};

/**
 * El reparto de pistas de un partido de pádel, con su barra Normal/PRO. Lo
 * usan la ficha del partido y Enfrentamientos, para que PRO se active y se use
 * en el mismo sitio en las dos.
 */
export function RepartoPadel({
  event,
  equipo,
  userId,
  responses,
  members,
  onChanged,
}: {
  event: Parameters<typeof PadelCourtsBoard>[0]["event"];
  equipo: { id: string; nombre: string; owner_id: string; es_pro: boolean };
  userId: string | null;
  responses: Parameters<typeof PadelCourtsBoard>[0]["responses"];
  members: Miembro[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [modoPro, setModoPro] = useModoPro();
  const activo = equipo.es_pro && modoPro;
  const { data: pro } = useTableroPro(event.id, activo);
  const miRol = members.find((m) => m.user_id === userId)?.role;
  const puedeActivar = !!userId && (equipo.owner_id === userId || miRol === "capitan");

  // El tablero normal y el PRO pintan las mismas respuestas: tras cualquier
  // cambio se vuelven a pedir las dos cosas.
  function alCambiar() {
    onChanged();
    qc.invalidateQueries({ queryKey: ["event-pro", event.id] });
  }

  // Cerrada y sin jugar, ya no se reparte: solo las pistas. Reabrir vuelve
  // aquí, al reparto normal o PRO tal como estaba.
  if (event.convocatoria_confirmada && !event.finalizado) {
    return (
      <PistasCerradas
        event={event}
        responses={responses}
        members={members}
        userId={userId}
        isManager
        onChanged={alCambiar}
      />
    );
  }

  return (
    <>
      <BarraPro
        event={event}
        equipo={equipo}
        puedeActivar={puedeActivar}
        pro={pro}
        activo={activo}
        onActivo={setModoPro}
        nombre={(uid) => {
          const p = members.find((m) => m.user_id === uid)?.profile;
          return p ? `${p.nombre} ${p.apellidos?.[0] ?? ""}.` : "?";
        }}
        hayReparto={responses.some((r) => r.padel_pista != null)}
        onChanged={alCambiar}
      />
      {activo ? (
        pro ? (
          <VistaPro
            event={event}
            responses={responses}
            members={members}
            pro={pro}
            onChanged={alCambiar}
          />
        ) : (
          <CargandoPro className="pro-ui rounded-2xl border border-[var(--pro-line)]" />
        )
      ) : (
        <PadelCourtsBoard
          event={event}
          responses={responses}
          members={members}
          onChanged={alCambiar}
        />
      )}
    </>
  );
}
