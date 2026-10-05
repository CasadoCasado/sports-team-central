/**
 * La liga de una competición: la clasificación de equipos y los
 * enfrentamientos. Sale de nuestros partidos de la competición y de los que
 * la gestión mete a mano entre otros equipos (ver `apps/competitions/liga.py`).
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, Swords, Trash2, Trophy } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmar } from "@/components/confirm-dialog";

export type FilaLiga = {
  posicion: number;
  equipo: string;
  nuestro: boolean;
  pj: number;
  g: number;
  e: number;
  p: number;
  pf: number;
  pc: number;
  puntos: number;
};

export type PartidoDeLiga = {
  id: string;
  origen: "nuestro" | "manual";
  fecha: string | null;
  titulo: string | null;
  local: string;
  visitante: string;
  puntos_local: number | null;
  puntos_visitante: number | null;
};

export type Liga = { clasificacion: FilaLiga[]; partidos: PartidoDeLiga[] };

export function ligaQuery(competitionId: string) {
  return {
    queryKey: ["competition-liga", competitionId],
    queryFn: () => api.get<Liga>(`/competitions/${competitionId}/liga/`),
  };
}

export function LigaCompeticion({
  competitionId,
  liga,
  puedeGestionar,
  finalizada,
}: {
  competitionId: string;
  liga: Liga;
  puedeGestionar: boolean;
  finalizada: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const qc = useQueryClient();
  const [anadiendo, setAnadiendo] = useState(false);

  const borrar = useMutation({
    mutationFn: (id: string) => api.delete(`/partidos-liga/${id}/`),
    onSuccess: async () => {
      toast.success(t("liga.borrado"));
      await qc.invalidateQueries({ queryKey: ["competition-liga", competitionId] });
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  const equipos = liga.clasificacion.map((f) => f.equipo);

  return (
    <>
      <section className="surface-card overflow-hidden" aria-labelledby="liga-clasificacion">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Trophy className="size-5" />
          </div>
          <div>
            <h2
              id="liga-clasificacion"
              className="text-display text-lg font-bold uppercase tracking-tight"
            >
              {t("liga.clasificacion")}
            </h2>
            <p className="text-xxs text-muted-foreground">{t("liga.clasificacionTexto")}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full sm:min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-border text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">{t("liga.equipo")}</th>
                {(["pj", "g", "e", "p", "pf", "pc"] as const).map((k) => (
                  <th
                    key={k}
                    className={cn(
                      "px-2 py-2 text-right",
                      (k === "pf" || k === "pc") && "hidden sm:table-cell",
                    )}
                    title={t(`liga.${k}Largo`)}
                  >
                    {t(`liga.${k}`)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">{t("liga.puntos")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liga.clasificacion.map((f) => (
                <tr key={f.equipo} className={cn(f.nuestro && "bg-primary/5 font-semibold")}>
                  <td className="px-3 py-2 font-black tabular-nums">{f.posicion}</td>
                  {/* En el móvil sin PF ni PC: así caben los puntos, que es
                      lo que ordena la tabla. */}
                  <td className="max-w-[12rem] px-3 py-2">
                    <span className={cn("block truncate", f.nuestro && "text-primary")}>
                      {f.equipo}
                    </span>
                  </td>
                  {(["pj", "g", "e", "p", "pf", "pc"] as const).map((k) => (
                    <td
                      key={k}
                      className={cn(
                        "px-2 py-2 text-right tabular-nums text-muted-foreground",
                        (k === "pf" || k === "pc") && "hidden sm:table-cell",
                      )}
                    >
                      {f[k]}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-black tabular-nums">{f.puntos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Racha liga={liga} />

      <section className="surface-card overflow-hidden" aria-labelledby="liga-partidos">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2
            id="liga-partidos"
            className="text-2xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            {t("liga.enfrentamientos")}
          </h2>
          {puedeGestionar && !finalizada && (
            <Button size="sm" variant="outline" onClick={() => setAnadiendo(true)}>
              <Plus className="mr-1 size-4" aria-hidden="true" />
              {t("liga.anadir")}
            </Button>
          )}
        </div>
        {liga.partidos.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("liga.sinPartidos")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {liga.partidos.map((p) => {
              const jugado = p.puntos_local != null && p.puntos_visitante != null;
              const cuerpo = (
                <>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Swords className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                      <span className="truncate">{p.local}</span>
                      <span className="font-black tabular-nums">
                        {jugado ? `${p.puntos_local} – ${p.puntos_visitante}` : "–"}
                      </span>
                      <span className="truncate">{p.visitante}</span>
                    </p>
                    <p className="text-xxs text-muted-foreground">
                      {[
                        p.fecha &&
                          format(new Date(p.fecha), p.origen === "nuestro" ? "PPP HH:mm" : "PPP", {
                            locale,
                          }),
                        p.origen === "manual"
                          ? t("liga.metidoAMano")
                          : !jugado && t("liga.sinResultado"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </>
              );
              return (
                <li key={p.id}>
                  {p.origen === "nuestro" ? (
                    <Link
                      to="/eventos/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-4 p-4 hover:bg-card"
                    >
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 p-4">
                      {cuerpo}
                      {puedeGestionar && !finalizada && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("liga.borrar")}
                          disabled={borrar.isPending}
                          onClick={async () => {
                            const ok = await confirmar({
                              title: t("liga.borrarTitulo"),
                              description: t("liga.borrarTexto", {
                                partido: `${p.local} ${p.puntos_local} – ${p.puntos_visitante} ${p.visitante}`,
                              }),
                              confirmLabel: t("liga.borrar"),
                              tone: "danger",
                              icon: Trash2,
                            });
                            if (ok) borrar.mutate(p.id);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {anadiendo && (
        <AnadirPartido
          competitionId={competitionId}
          equipos={equipos}
          onClose={() => setAnadiendo(false)}
        />
      )}
    </>
  );
}

function AnadirPartido({
  competitionId,
  equipos,
  onClose,
}: {
  competitionId: string;
  equipos: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [local, setLocal] = useState("");
  const [visitante, setVisitante] = useState("");
  const [puntosLocal, setPuntosLocal] = useState("");
  const [puntosVisitante, setPuntosVisitante] = useState("");
  const [fecha, setFecha] = useState("");

  const guardar = useMutation({
    mutationFn: () =>
      api.post("/partidos-liga/", {
        competition_id: competitionId,
        local: local.trim(),
        visitante: visitante.trim(),
        puntos_local: Number(puntosLocal),
        puntos_visitante: Number(puntosVisitante),
        fecha: fecha || null,
      }),
    onSuccess: async () => {
      toast.success(t("liga.guardado"));
      await qc.invalidateQueries({ queryKey: ["competition-liga", competitionId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  const listo =
    local.trim() !== "" &&
    visitante.trim() !== "" &&
    /^\d+$/.test(puntosLocal) &&
    /^\d+$/.test(puntosVisitante);

  const numero = (v: string, set: (v: string) => void, id: string, label: string) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        value={v}
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 3))}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("liga.anadirTitulo")}</DialogTitle>
          <DialogDescription>{t("liga.anadirTexto")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (listo) guardar.mutate();
          }}
        >
          <datalist id="liga-equipos">
            {equipos.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-3">
            <div>
              <Label htmlFor="liga-local">{t("liga.local")}</Label>
              <Input
                id="liga-local"
                list="liga-equipos"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                maxLength={100}
              />
            </div>
            {numero(puntosLocal, setPuntosLocal, "liga-pl", t("liga.puntos"))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-3">
            <div>
              <Label htmlFor="liga-visitante">{t("liga.visitante")}</Label>
              <Input
                id="liga-visitante"
                list="liga-equipos"
                value={visitante}
                onChange={(e) => setVisitante(e.target.value)}
                maxLength={100}
              />
            </div>
            {numero(puntosVisitante, setPuntosVisitante, "liga-pv", t("liga.puntos"))}
          </div>
          <div>
            <Label htmlFor="liga-fecha">{t("liga.fecha")}</Label>
            <Input
              id="liga-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!listo || guardar.isPending}>
              {t("liga.guardar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Los últimos resultados de nuestro equipo en la liga, del más antiguo al más
 * reciente (el último, a la derecha): W ganado, L perdido, D empate.
 */
function Racha({ liga }: { liga: Liga }) {
  const { t } = useTranslation();
  const nuestro = liga.clasificacion.find((f) => f.nuestro)?.equipo;
  if (!nuestro) return null;
  const ultimos = liga.partidos
    .filter((p) => p.origen === "nuestro" && p.puntos_local != null && p.puntos_visitante != null)
    .slice(0, RACHA)
    .reverse()
    .map((p) => {
      const local = p.local === nuestro;
      const mios = (local ? p.puntos_local : p.puntos_visitante)!;
      const suyos = (local ? p.puntos_visitante : p.puntos_local)!;
      return {
        id: p.id,
        rival: local ? p.visitante : p.local,
        marcador: `${mios} – ${suyos}`,
        letra: mios > suyos ? "W" : mios < suyos ? "L" : "D",
      };
    });
  if (ultimos.length === 0) return null;

  return (
    <section
      aria-labelledby="liga-racha"
      className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4"
    >
      <h2
        id="liga-racha"
        className="text-2xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        {t("liga.racha", { equipo: nuestro })}
      </h2>
      <ol className="flex items-center gap-2">
        {ultimos.map((r) => (
          <li
            key={r.id}
            title={`${r.rival} · ${r.marcador}`}
            aria-label={t(`liga.racha${r.letra}`, { rival: r.rival, marcador: r.marcador })}
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-xs font-black text-white",
              r.letra === "W"
                ? "bg-ok"
                : r.letra === "L"
                  ? "bg-destructive"
                  : "bg-muted-foreground",
            )}
          >
            {r.letra}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Cuántos resultados enseña la racha. */
const RACHA = 5;
