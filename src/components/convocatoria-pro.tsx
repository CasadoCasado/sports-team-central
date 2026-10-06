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

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Sparkles, Star } from "lucide-react";

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
  soloSugerir,
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
  /** En la pestaña PRO del móvil: solo «Sugerir parejas», sin Normal/PRO. */
  soloSugerir?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaPro["id"] | null>(null);
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
      {soloSugerir ? (
        <Button
          onClick={() => setAbierto(true)}
          disabled={!pro || cerrada}
          className="min-h-11 w-full bg-[#D7F24B] text-2xs font-extrabold uppercase tracking-widest text-[#0B1222] hover:bg-[#D7F24B]/85"
        >
          <Sparkles className="mr-1.5 size-4" aria-hidden="true" />
          {t("pro.sugerir")}
        </Button>
      ) : (
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
      )}

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
          {/* En el móvil, una propuesta a la vista y las tres en pestañas. */}
          {soloSugerir && propuestas && propuestas.length > 0 && (
            <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1">
              {propuestas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={(propuesta ?? propuestas[0].id) === p.id}
                  onClick={() => setPropuesta(p.id)}
                  className={cn(
                    "min-h-9 flex-1 rounded-md px-1 text-xs font-bold leading-tight",
                    (propuesta ?? propuestas[0].id) === p.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {t(`pro.propuesta_${p.id}`)}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {propuestas
              ?.filter((p) => !soloSugerir || p.id === (propuesta ?? propuestas[0].id))
              .map((p) => (
                <article
                  key={p.id}
                  aria-label={t(`pro.propuesta_${p.id}`)}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div>
                    <h3 className="font-bold">{t(`pro.propuesta_${p.id}`)}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t(`pro.propuesta_${p.id}Texto`)}
                    </p>
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
                            {par?.encaje === "mismo_lado" && (
                              <Chip>
                                {t("pro.mismoLado", {
                                  lado: t(
                                    `lado.${pro?.jugadores[a]?.lado ?? "reves"}`,
                                  ).toLowerCase(),
                                })}
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
  barraFija,
  vistaMovil,
}: {
  event: Parameters<typeof PadelCourtsBoard>[0]["event"];
  equipo: { id: string; nombre: string; owner_id: string; es_pro: boolean };
  userId: string | null;
  responses: Parameters<typeof PadelCourtsBoard>[0]["responses"];
  members: Miembro[];
  onChanged: () => void;
  /**
   * En el móvil, «Confirmar» y el progreso del reparto en una barra fija
   * abajo, siempre a mano. Solo en la ficha del partido: en Enfrentamientos
   * hay varios repartos en la misma página.
   */
  barraFija?: boolean;
  /**
   * En el móvil la convocatoria va en pestañas y aquí solo se pinta lo de la
   * pestaña abierta: «pistas» (las pistas y el banquillo abajo), «pro» (las
   * sugerencias, el rival, la química y la matriz) o «apuntados» (nada más
   * que la barra de confirmar: la lista la pinta la ficha).
   */
  vistaMovil?: VistaMovil;
}) {
  const qc = useQueryClient();
  // El hueco del banquillo dentro de la barra fija; los tableros pintan ahí
  // los que aún no tienen pista.
  const [banquillo, setBanquillo] = useState<HTMLElement | null>(null);
  const [modoPro, setModoPro] = useModoPro();
  // En el móvil no hay Normal/PRO: con el equipo PRO, siempre PRO (la
  // pestaña PRO es el interruptor).
  const activo = equipo.es_pro && (modoPro || !!vistaMovil);
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

  const barra = barraFija && (
    <BarraConfirmar
      event={event}
      responses={responses}
      onChanged={alCambiar}
      onBanquillo={vistaMovil === "pistas" ? setBanquillo : undefined}
    />
  );

  if (vistaMovil === "apuntados") return barra || null;
  if (vistaMovil === "pistas") {
    return (
      <>
        {activo ? (
          pro ? (
            <VistaPro
              event={event}
              responses={responses}
              members={members}
              pro={pro}
              onChanged={alCambiar}
              confirmarEnBarra
              vista="pistas"
              banquilloEn={banquillo}
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
            confirmarEnBarra
            banquilloEn={banquillo}
          />
        )}
        {barra}
      </>
    );
  }
  if (vistaMovil === "pro") {
    return (
      <>
        <BarraPro
          event={event}
          equipo={equipo}
          puedeActivar={puedeActivar}
          pro={pro}
          activo
          onActivo={setModoPro}
          nombre={(uid) => {
            const p = members.find((m) => m.user_id === uid)?.profile;
            return p ? `${p.nombre} ${p.apellidos?.[0] ?? ""}.` : "?";
          }}
          hayReparto={responses.some((r) => r.padel_pista != null)}
          onChanged={alCambiar}
          soloSugerir
        />
        {activo &&
          (pro ? (
            <VistaPro
              event={event}
              responses={responses}
              members={members}
              pro={pro}
              onChanged={alCambiar}
              confirmarEnBarra
              vista="pro"
            />
          ) : (
            <CargandoPro className="pro-ui rounded-2xl border border-[var(--pro-line)]" />
          ))}
        {barra}
      </>
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
            confirmarEnBarra={barraFija}
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
          confirmarEnBarra={barraFija}
        />
      )}
      {barra}
    </>
  );
}

export type VistaMovil = "apuntados" | "pistas" | "pro";

/**
 * La barra fija de abajo en el móvil: cuántos hay ya en pista y «Confirmar».
 * Así no hay que bajar hasta el final del tablero para cerrar la
 * convocatoria. En el ordenador no sale: allí cabe todo y el botón está en
 * el tablero.
 */
function BarraConfirmar({
  event,
  responses,
  onChanged,
  onBanquillo,
}: {
  event: Parameters<typeof PadelCourtsBoard>[0]["event"];
  responses: Parameters<typeof PadelCourtsBoard>[0]["responses"];
  onChanged: () => void;
  /** Si llega, la barra deja encima un hueco para el banquillo del tablero. */
  onBanquillo?: (el: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const numPistas = event.padel_num_pistas ?? 0;
  const total = numPistas * 2;
  const enPista = responses.filter((r) => r.status !== "rechazado" && r.padel_pista != null).length;
  const confirmarla = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/confirmar/`, { confirmada: true }),
    onSuccess: () => {
      toast.success(t("quimica.confirmada"));
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fuera del árbol de la página: la ficha entra con una animación que deja
  // puesto un `transform`, y con él `fixed` se pega a la tarjeta y no a la
  // pantalla. El portal solo existe en el navegador.
  const [montada, setMontada] = useState(false);
  useEffect(() => setMontada(true), []);

  // Lo que mide la barra (con el banquillo, más), de margen al final de la
  // página: así no tapa lo último y no queda un hueco dentro de la tarjeta.
  // En el ordenador la barra no se ve y mide 0.
  const [barraEl, setBarraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!barraEl) return;
    const ajustar = () => {
      document.body.style.paddingBottom = barraEl.offsetHeight ? `${barraEl.offsetHeight}px` : "";
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(barraEl);
    window.addEventListener("resize", ajustar);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", ajustar);
      document.body.style.paddingBottom = "";
    };
  }, [barraEl]);

  if (numPistas === 0) return null;
  const pct = Math.min(100, Math.round((enPista / total) * 100));
  return (
    <>
      {montada &&
        createPortal(
          <div
            ref={setBarraEl}
            className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.35)] backdrop-blur sm:hidden"
          >
            {onBanquillo && (
              <div ref={onBanquillo} data-banquillo className="border-b border-border" />
            )}
            <div
              data-barra-confirmar
              className="flex items-center gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {t("callups.barra.progreso", { n: enPista, total })}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={enPista}
                  aria-label={t("callups.barra.progreso", { n: enPista, total })}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn("h-full rounded-full", enPista >= total ? "bg-ok" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <Button
                onClick={() => confirmarla.mutate()}
                disabled={confirmarla.isPending}
                className="min-h-11 shrink-0 text-2xs font-bold uppercase tracking-widest"
              >
                <Check className="mr-1.5 size-4" aria-hidden="true" />
                {t("quimica.confirmarCorto")}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
