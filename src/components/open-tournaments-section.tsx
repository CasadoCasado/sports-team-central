/**
 * Los torneos que organizan otros equipos, para apuntarse.
 *
 * Un equipo abre su torneo desde su propia lista de competiciones (tipo
 * torneo, con sede y «abierto a otros equipos») y aquí lo ven los demás. Se
 * entra directamente mientras queden plazas y no haya empezado; apuntar y dar
 * de baja al equipo es de sus gestores. Ver `/api/torneos/`.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { invalidateCompetitionQueries } from "@/lib/query-keys";
import type { Torneo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/confirm-dialog";

export function OpenTournamentsSection({
  teamId,
  teamName,
  canManage,
}: {
  teamId: string;
  teamName: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();

  const { data: torneos } = useQuery({
    queryKey: ["torneos", teamId],
    queryFn: () => api.get<Torneo[]>("/torneos/", { team_id: teamId }),
  });

  // Primero donde ya vais; luego el resto, por fecha (así llegan).
  const lista = [...(torneos ?? [])].sort((a, b) => Number(b.inscrito) - Number(a.inscrito));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-display flex items-center gap-2 text-xl font-bold">
          <Globe className="size-5 text-primary" aria-hidden="true" />
          {t("torneos.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("torneos.subtitle")}</p>
      </div>

      {torneos && lista.length === 0 ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">
          {t("torneos.empty")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((torneo) => (
            <TorneoCard
              key={torneo.id}
              torneo={torneo}
              teamId={teamId}
              teamName={teamName}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TorneoCard({
  torneo,
  teamId,
  teamName,
  canManage,
}: {
  torneo: Torneo;
  teamId: string;
  teamName: string;
  canManage: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const qc = useQueryClient();
  const [verEquipos, setVerEquipos] = useState(false);

  const { data: detalle } = useQuery({
    queryKey: ["torneo", torneo.id, teamId],
    enabled: verEquipos,
    queryFn: () => api.get<Torneo>(`/torneos/${torneo.id}/`, { team_id: teamId }),
  });

  const accion = useMutation({
    mutationFn: (que: "inscribir" | "baja") =>
      api.post<Torneo>(`/torneos/${torneo.id}/${que}/`, { team_id: teamId }),
    onSuccess: async (_res, que) => {
      toast.success(
        que === "inscribir"
          ? t("torneos.apuntado", { team: teamName, torneo: torneo.nombre })
          : t("torneos.deBaja", { torneo: torneo.nombre }),
      );
      await invalidateCompetitionQueries(qc);
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  async function darDeBaja() {
    const ok = await confirmar({
      title: t("torneos.bajaTitle", { torneo: torneo.nombre }),
      description: t("torneos.bajaBody"),
      confirmLabel: t("torneos.baja"),
      tone: "danger",
      icon: LogOut,
    });
    if (ok) accion.mutate("baja");
  }

  const fecha = (d: string) => format(new Date(`${d}T12:00:00`), "d MMM yyyy", { locale });
  const fechas =
    torneo.fecha_inicio && torneo.fecha_fin && torneo.fecha_fin !== torneo.fecha_inicio
      ? `${fecha(torneo.fecha_inicio)} – ${fecha(torneo.fecha_fin)}`
      : torneo.fecha_inicio
        ? fecha(torneo.fecha_inicio)
        : null;
  const cerrado = torneo.empezado || !torneo.abierto;
  const puedeApuntarse = canManage && !torneo.inscrito && !torneo.completo && !cerrado;
  const equipos = detalle?.equipos ?? [];

  return (
    <article className="surface-card flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Trophy className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-display text-lg font-bold break-words">{torneo.nombre}</h3>
          <p className="text-xs text-muted-foreground">
            {t("torneos.organiza", { team: torneo.organizador.nombre })}
            {torneo.organizador.ciudad ? ` · ${torneo.organizador.ciudad}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-2xs font-bold uppercase tracking-widest">
            {torneo.inscrito && (
              <span className="inline-flex items-center gap-1 rounded border border-ok/40 bg-ok/15 px-1.5 py-0.5 text-ok">
                <Check className="size-3" aria-hidden="true" />
                {t("torneos.inscrito")}
              </span>
            )}
            {!torneo.inscrito && torneo.completo && (
              <span className="rounded border border-warn/40 bg-warn/15 px-1.5 py-0.5 text-warn">
                {t("torneos.completo")}
              </span>
            )}
            {!torneo.inscrito && !torneo.completo && cerrado && (
              <span className="rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 text-muted-foreground">
                {t("torneos.cerrado")}
              </span>
            )}
            {torneo.formato && (
              <span className="rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-primary">
                {t(`competitions.formatos.${torneo.formato}`)}
              </span>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm">
        {torneo.sede && (
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="break-words">{torneo.sede}</span>
          </li>
        )}
        {fechas && (
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {fechas}
          </li>
        )}
        <li className="flex items-center gap-2">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {torneo.plazas
            ? t("torneos.inscritosDe", { count: torneo.inscritos, plazas: torneo.plazas })
            : t("torneos.inscritos", { count: torneo.inscritos })}
        </li>
      </ul>

      {torneo.descripcion && (
        <p className="mt-3 text-sm text-muted-foreground">{torneo.descripcion}</p>
      )}

      {torneo.inscritos > 0 && (
        <button
          type="button"
          onClick={() => setVerEquipos((v) => !v)}
          aria-expanded={verEquipos}
          className="-ml-2 mt-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-2 text-2xs font-bold uppercase tracking-widest text-primary hover:underline"
        >
          {t("torneos.verEquipos")}
          <ChevronDown
            className={cn("size-3.5 transition-transform", verEquipos && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      )}
      {verEquipos && (
        <ul className="mt-1 space-y-1 rounded-md border border-border p-2">
          {equipos.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 px-1 py-0.5 text-sm">
              <span className={cn("break-words", e.id === teamId && "font-bold")}>{e.nombre}</span>
              {e.ciudad && (
                <span className="shrink-0 text-xxs text-muted-foreground">{e.ciudad}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        {puedeApuntarse && (
          <Button
            onClick={() => accion.mutate("inscribir")}
            disabled={accion.isPending}
            className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            {t("torneos.apuntar", { team: teamName })}
          </Button>
        )}
        {canManage && torneo.inscrito && !torneo.empezado && (
          <Button
            variant="outline"
            onClick={darDeBaja}
            disabled={accion.isPending}
            className="w-full uppercase tracking-widest font-bold"
          >
            {t("torneos.baja")}
          </Button>
        )}
        {!canManage && !torneo.inscrito && !cerrado && !torneo.completo && (
          <p className="text-xxs text-muted-foreground">{t("torneos.pideAlCapitan")}</p>
        )}
      </div>
    </article>
  );
}
