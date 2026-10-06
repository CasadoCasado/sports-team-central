/**
 * La convocatoria de un partido de pádel para la gestión, en el móvil.
 *
 * En el ordenador cabe todo en una pantalla; en el móvil la lista, las pistas
 * y PRO apilados medían cuatro o seis pantallas. Aquí se parten en pestañas,
 * cada jugador ocupa una línea y lo que se hace con él (ponerlo en una pista,
 * quitarlo, convocarlo) sale en una hoja al tocarlo. Las pistas y PRO los
 * pinta `RepartoPadel` con su `vistaMovil`.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles, Star, X } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ladoDe } from "@/lib/lado";
import { parejaPro, type TableroPro } from "@/lib/pro";
import { nombreVisible } from "@/lib/invitados";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import type { EventResponse, Profile, ResponseStatus } from "@/lib/types";
import type { VistaMovil } from "@/components/convocatoria-pro";

/** El punto de color de cada estado, el mismo de las etiquetas. */
export const PUNTO_ESTADO: Record<string, string> = {
  confirmado: "bg-ok",
  reserva: "bg-info",
  duda: "bg-warn",
  rechazado: "bg-danger",
  convocado: "bg-muted-foreground",
};

type Miembro = { user_id: string; role?: string; profile: Profile | null };

export function PestanasConvocatoria({
  valor,
  onCambio,
  apuntados,
  enPista,
  plazas,
  conPro,
}: {
  valor: VistaMovil;
  onCambio: (v: VistaMovil) => void;
  apuntados: number;
  enPista: number;
  plazas: number;
  conPro: boolean;
}) {
  const { t } = useTranslation();
  const pestanas: { id: VistaMovil; texto: string; cuenta?: string }[] = [
    { id: "apuntados", texto: t("callups.movil.apuntados"), cuenta: String(apuntados) },
    {
      id: "pistas",
      texto: t("callups.movil.pistas"),
      cuenta: plazas ? `${enPista}/${plazas}` : undefined,
    },
    ...(conPro ? [{ id: "pro" as const, texto: "PRO" }] : []),
  ];
  return (
    <div role="tablist" className="mb-3 flex gap-1 rounded-lg bg-muted p-1">
      {pestanas.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={valor === p.id}
          onClick={() => onCambio(p.id)}
          className={cn(
            "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-bold transition-colors",
            // PRO, con su amarillo y su estrella, como el botón de siempre.
            p.id === "pro"
              ? valor === p.id
                ? "bg-[#D7F24B] font-extrabold uppercase tracking-widest text-[#0B1222] shadow-sm"
                : "bg-[#D7F24B]/35 font-extrabold uppercase tracking-widest text-[#0B1222] dark:text-[#D7F24B]"
              : valor === p.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.id === "pro" && <Star className="size-3.5" aria-hidden="true" />}
          {p.texto}
          {p.cuenta && <span className="tabular-nums text-primary">{p.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Los apuntados en filas de una línea: estado (el punto), nombre, lado y
 * pista. Tocar una abre la hoja de ese jugador.
 */
export function ListaCompacta({
  eventId,
  visibles,
  todas,
  members,
  numPistas,
  eligio,
  pro,
  onChanged,
}: {
  eventId: string;
  visibles: EventResponse[];
  todas: EventResponse[];
  members: Miembro[];
  numPistas: number;
  /** Con quién dijo cada uno que quiere jugar. */
  eligio: Map<string, string>;
  pro?: TableroPro;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState<string | null>(null);
  const perfil = (u: string, r?: EventResponse) =>
    members.find((m) => m.user_id === u)?.profile ?? r?.profile ?? null;
  const pila = (u: string) => perfil(u)?.nombre || "?";
  const respuesta = todas.find((r) => r.id === abierto) ?? null;

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {visibles.map((r) => {
          const p = perfil(r.user_id, r);
          const status = r.status as ResponseStatus;
          const lado = ladoDe(p?.posicion);
          const quiere = eligio.get(r.user_id);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setAbierto(r.id)}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
              >
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-bold text-primary">
                  {`${p?.nombre?.[0] ?? ""}${p?.apellidos?.[0] ?? ""}`.toUpperCase() || "?"}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card",
                      PUNTO_ESTADO[status],
                    )}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{nombreVisible(p)}</span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {[
                      t(`callups.response_${status}`),
                      lado && t(`lado.${lado}`),
                      quiere && `✦ ${pila(quiere)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {r.padel_pista != null ? (
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-2xs font-extrabold text-primary">
                    {t("callups.movil.pistaCorta", { n: r.padel_pista })}
                  </span>
                ) : r.es_convocado ? (
                  <Star
                    className="size-4 shrink-0 fill-primary text-primary"
                    aria-label={t("callups.convocadoCorto")}
                  />
                ) : (
                  <span className="shrink-0 rounded-md border border-dashed border-border px-2 py-1 text-2xs font-bold text-muted-foreground">
                    —
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {respuesta && (
        <HojaJugador
          eventId={eventId}
          r={respuesta}
          todas={todas}
          numPistas={numPistas}
          nombre={nombreVisible(perfil(respuesta.user_id, respuesta))}
          lado={ladoDe(perfil(respuesta.user_id, respuesta)?.posicion)}
          pila={pila}
          quiere={eligio.get(respuesta.user_id) ?? null}
          pro={pro}
          onClose={() => setAbierto(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

/** Lo que se hace con un jugador: su pista, quitársela y convocarlo. */
function HojaJugador({
  eventId,
  r,
  todas,
  numPistas,
  nombre,
  lado,
  pila,
  quiere,
  pro,
  onClose,
  onChanged,
}: {
  eventId: string;
  r: EventResponse;
  todas: EventResponse[];
  numPistas: number;
  nombre: string;
  lado: string | null;
  pila: (u: string) => string;
  quiere: string | null;
  pro?: TableroPro;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [guardando, setGuardando] = useState(false);
  const status = r.status as ResponseStatus;
  const puedeJugar = status !== "rechazado";
  const pistas = Array.from({ length: numPistas }, (_, i) => i + 1);
  const dentro = (n: number) =>
    todas.filter((o) => o.padel_pista === n && o.status !== "rechazado" && o.id !== r.id);

  async function cambiar(patch: Record<string, unknown>, cerrar = true) {
    setGuardando(true);
    try {
      await api.patch(`/event-responses/${r.id}/`, patch);
      onChanged();
      if (cerrar) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[88dvh] rounded-t-2xl border-border bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="space-y-4 overflow-y-auto pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="truncate text-lg font-bold">{nombre}</DrawerTitle>
              <DrawerDescription className="text-xs">
                {[
                  t(`callups.response_${status}`),
                  lado && t(`lado.${lado}`),
                  r.es_convocado && `★ ${t("callups.convocadoCorto")}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </DrawerDescription>
              {quiere && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-evt-social">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {t("callups.movil.quiereCon", { name: pila(quiere) })}
                </p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label={t("common.close")}
              className="-mr-2 shrink-0"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>

          {puedeJugar && numPistas > 0 && (
            <div className="space-y-2">
              <p className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("callups.movil.ponerEn")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {pistas.map((n) => {
                  const otros = dentro(n);
                  const aqui = r.padel_pista === n;
                  const llena = otros.length >= 2;
                  const companero = otros[0];
                  const par =
                    pro && companero ? parejaPro(pro, r.user_id, companero.user_id) : null;
                  const conQuimica = companero && quiere === companero.user_id;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={guardando || llena || aqui}
                      onClick={() => void cambiar({ padel_pista: n, es_convocado: true })}
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-2 text-center",
                        aqui
                          ? "border-primary bg-primary/10"
                          : conQuimica
                            ? "border-evt-social/50 bg-evt-social/10"
                            : "border-border",
                        llena && !aqui && "opacity-50",
                      )}
                    >
                      <span className="text-sm font-bold">
                        {t("callups.pista")} {n}
                      </span>
                      <span className="line-clamp-2 text-3xs text-muted-foreground">
                        {aqui
                          ? t("callups.movil.aqui")
                          : llena
                            ? t("callups.movil.llena")
                            : companero
                              ? t("callups.movil.con", { name: pila(companero.user_id) }) +
                                (par && par.ganados + par.perdidos > 0
                                  ? ` · ${Math.round(par.prob * 100)} %`
                                  : "")
                              : t("callups.movil.libre")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {r.padel_pista != null && (
              <Button
                variant="outline"
                disabled={guardando}
                onClick={() => void cambiar({ padel_pista: null })}
                className="flex-1"
              >
                {t("callups.movil.quitarPista")}
              </Button>
            )}
            <Button
              variant={r.es_convocado ? "outline" : "default"}
              disabled={guardando}
              onClick={() =>
                void cambiar(
                  r.es_convocado
                    ? { es_convocado: false, padel_pista: null }
                    : { es_convocado: true },
                )
              }
              className="flex-1"
            >
              <Star className="mr-1.5 size-4" aria-hidden="true" />
              {r.es_convocado ? t("callups.movil.desconvocar") : t("callups.movil.convocar")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
