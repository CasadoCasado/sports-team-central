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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /** La jornada de la liga, si se puso. */
  jornada: number | null;
};

/** `jornadas`: las que tienen algún enfrentamiento, de menor a mayor. */
export type Liga = { clasificacion: FilaLiga[]; partidos: PartidoDeLiga[]; jornadas: number[] };

/** El filtro de los enfrentamientos: todas, una jornada o los que no tienen. */
type FiltroJornada = "todas" | "sin" | number;

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
  // null: cerrado; «nuevo»: añadiendo; un partido: editándolo.
  const [editando, setEditando] = useState<PartidoDeLiga | "nuevo" | null>(null);
  const [filtro, setFiltro] = useState<FiltroJornada>("todas");

  const borrar = useMutation({
    mutationFn: (id: string) => api.delete(`/partidos-liga/${id}/`),
    onSuccess: async () => {
      toast.success(t("liga.borrado"));
      await qc.invalidateQueries({ queryKey: ["competition-liga", competitionId] });
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  const equipos = liga.clasificacion.map((f) => f.equipo);
  const editable = puedeGestionar && !finalizada;

  // Si la jornada filtrada se queda sin enfrentamientos (se borró el último),
  // se vuelve a verlas todas.
  const jornadas = liga.jornadas ?? [];
  const haySinJornada = jornadas.length > 0 && liga.partidos.some((p) => p.jornada == null);
  const filtroValido =
    filtro === "todas" || (filtro === "sin" ? haySinJornada : jornadas.includes(filtro))
      ? filtro
      : "todas";
  const partidos = liga.partidos.filter((p) =>
    filtroValido === "todas"
      ? true
      : filtroValido === "sin"
        ? p.jornada == null
        : p.jornada === filtroValido,
  );
  // Al añadir, la jornada que se está mirando o, si no, la última.
  const jornadaPorDefecto =
    typeof filtroValido === "number" ? filtroValido : (jornadas[jornadas.length - 1] ?? null);

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
          <div className="flex flex-wrap items-center gap-2">
            {jornadas.length > 0 && (
              <Select
                value={String(filtroValido)}
                onValueChange={(v) => setFiltro(v === "todas" || v === "sin" ? v : Number(v))}
              >
                <SelectTrigger
                  className="h-9 w-auto min-w-[9.5rem] text-xs"
                  aria-label={t("liga.filtroJornada")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">{t("liga.todasJornadas")}</SelectItem>
                  {jornadas.map((j) => (
                    <SelectItem key={j} value={String(j)}>
                      {t("liga.jornadaN", { n: j })}
                    </SelectItem>
                  ))}
                  {haySinJornada && <SelectItem value="sin">{t("liga.sinJornada")}</SelectItem>}
                </SelectContent>
              </Select>
            )}
            {editable && (
              <Button size="sm" variant="outline" onClick={() => setEditando("nuevo")}>
                <Plus className="mr-1 size-4" aria-hidden="true" />
                {t("liga.anadir")}
              </Button>
            )}
          </div>
        </div>
        {liga.partidos.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("liga.sinPartidos")}</p>
        ) : partidos.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("liga.sinPartidosJornada")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {partidos.map((p) => {
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
                        p.jornada != null && t("liga.jornadaN", { n: p.jornada }),
                        p.fecha &&
                          format(new Date(p.fecha), p.origen === "nuestro" ? "PPP HH:mm" : "PPP", {
                            locale,
                          }),
                        p.origen === "manual" && t("liga.metidoAMano"),
                        !jugado && t("liga.sinResultado"),
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
                      search={{ desde: "competicion", comp: competitionId }}
                      className="flex items-center gap-4 p-4 hover:bg-card"
                    >
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 pr-4">
                      {/* La gestión lo abre para cambiarlo o guardar el
                          resultado de un cruce que aún no se había jugado. */}
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => setEditando(p)}
                          title={t("liga.editar")}
                          className="flex min-w-0 flex-1 items-center gap-4 p-4 text-left hover:bg-card"
                        >
                          {cuerpo}
                        </button>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-4 p-4">{cuerpo}</div>
                      )}
                      {editable && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("liga.borrar")}
                          disabled={borrar.isPending}
                          onClick={async () => {
                            const ok = await confirmar({
                              title: t("liga.borrarTitulo"),
                              description: t("liga.borrarTexto", {
                                partido: jugado
                                  ? `${p.local} ${p.puntos_local} – ${p.puntos_visitante} ${p.visitante}`
                                  : `${p.local} – ${p.visitante}`,
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

      {editando && (
        <PartidoAMano
          competitionId={competitionId}
          equipos={equipos}
          partido={editando === "nuevo" ? null : editando}
          jornadaPorDefecto={jornadaPorDefecto}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}

/**
 * Añadir o cambiar un enfrentamiento entre otros equipos. Los puntos pueden
 * ir vacíos: el cruce de una jornada que aún no se ha jugado, que no cuenta
 * hasta que se guarde su resultado.
 */
function PartidoAMano({
  competitionId,
  equipos,
  partido,
  jornadaPorDefecto,
  onClose,
}: {
  competitionId: string;
  equipos: string[];
  /** null: uno nuevo. */
  partido: PartidoDeLiga | null;
  jornadaPorDefecto: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const texto = (n: number | null | undefined) => (n == null ? "" : String(n));
  const [local, setLocal] = useState(partido?.local ?? "");
  const [visitante, setVisitante] = useState(partido?.visitante ?? "");
  const [puntosLocal, setPuntosLocal] = useState(texto(partido?.puntos_local));
  const [puntosVisitante, setPuntosVisitante] = useState(texto(partido?.puntos_visitante));
  const [fecha, setFecha] = useState(partido?.fecha?.slice(0, 10) ?? "");
  const [jornada, setJornada] = useState(texto(partido ? partido.jornada : jornadaPorDefecto));

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        local: local.trim(),
        visitante: visitante.trim(),
        puntos_local: puntosLocal === "" ? null : Number(puntosLocal),
        puntos_visitante: puntosVisitante === "" ? null : Number(puntosVisitante),
        fecha: fecha || null,
        jornada: jornada === "" ? null : Number(jornada),
      };
      return partido
        ? api.patch(`/partidos-liga/${partido.id}/`, cuerpo)
        : api.post("/partidos-liga/", { competition_id: competitionId, ...cuerpo });
    },
    onSuccess: async () => {
      toast.success(t("liga.guardado"));
      await qc.invalidateQueries({ queryKey: ["competition-liga", competitionId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  // El resultado va entero o no va: con un solo marcador no se sabe quién ganó.
  const conResultado = puntosLocal !== "" || puntosVisitante !== "";
  const listo =
    local.trim() !== "" &&
    visitante.trim() !== "" &&
    (!conResultado || (/^\d+$/.test(puntosLocal) && /^\d+$/.test(puntosVisitante))) &&
    (jornada === "" || Number(jornada) >= 1);

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
          <DialogTitle>{t(partido ? "liga.editarTitulo" : "liga.anadirTitulo")}</DialogTitle>
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
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-end gap-3">
            {numero(jornada, setJornada, "liga-jornada", t("liga.jornada"))}
            <div>
              <Label htmlFor="liga-fecha">{t("liga.fecha")}</Label>
              <Input
                id="liga-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xxs text-muted-foreground">{t("liga.sinPuntosHint")}</p>
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
