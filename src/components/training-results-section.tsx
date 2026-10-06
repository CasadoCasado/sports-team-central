/**
 * Cómo quedó un entrenamiento: el orden final de las pistas y quién ganó.
 *
 * Solo tiene sentido en un entrenamiento que cuelga de una competición del
 * equipo, porque es de ahí de donde sale su clasificación. La pantalla arma la
 * foto completa del reparto y la manda de una vez a `/training-courts/bulk/`,
 * igual que los resultados de un partido van a `/match-results/bulk/`.
 */

import { invitadosApuntados, nombreVisible } from "@/lib/invitados";
import {
  ReyPistaTablero,
  pistasPara,
  type DraftCourt,
  type Jugador,
} from "@/components/rey-pista-tablero";
import { confirmar } from "@/components/confirm-dialog";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ListOrdered, Lock, Plus, Trophy, Shuffle } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TrainingCountSection, TrainingHeader } from "@/components/training-count-section";
import type {
  Competition,
  EventResponse,
  Profile,
  TeamMember,
  TrainingCourt,
  TrainingFormat,
} from "@/lib/types";

const nameOf = (profile: Profile | null | undefined) =>
  profile ? `${profile.nombre} ${profile.apellidos}`.trim() : "—";

/** Traduce los códigos que devuelve el backend al guardar. */
function saveErrorKey(message: string): string | null {
  if (message.includes("training_empty_court")) return "training.errEmptyCourt";
  if (message.includes("training_player_twice")) return "training.errPlayerTwice";
  if (message.includes("training_player_not_member")) return "training.errNotMember";
  if (message.includes("training_needs_format")) return "training.errNeedsFormat";
  if (message.includes("training_wrong_format")) return "training.errWrongFormat";
  if (message.includes("competition_finished")) return "training.closed";
  return null;
}

export function TrainingResultsSection({
  eventId,
  teamId,
  competitionId,
  competitionNombre,
  formatoEntreno,
  startISO,
  isManager,
}: {
  eventId: string;
  teamId: string;
  competitionId: string | null;
  formatoEntreno: TrainingFormat | null;
  competitionNombre: string | null;
  startISO: string;
  isManager: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const hasStarted = new Date(startISO).getTime() <= Date.now();

  const { data: courts } = useQuery({
    queryKey: ["training-courts", eventId],
    enabled: !!competitionId,
    queryFn: () =>
      api.get<TrainingCourt[]>("/training-courts/", {
        event_id: eventId,
        order: "posicion",
      }),
  });

  const { data: competition } = useQuery({
    queryKey: ["competition", competitionId],
    enabled: !!competitionId,
    queryFn: () => api.get<Competition>(`/competitions/${competitionId}/`),
  });

  const { data: members } = useQuery({
    queryKey: ["team-members-full", teamId],
    enabled: !!competitionId,
    queryFn: () => api.get<TeamMember[]>("/team-members/", { team_id: teamId, status: "activo" }),
  });

  const { data: responses } = useQuery({
    queryKey: ["event-responses", eventId],
    enabled: !!competitionId,
    queryFn: () => api.get<EventResponse[]>("/event-responses/", { event_id: eventId }),
  });

  /** Quien se apuntó sale primero en el desplegable: es el caso normal. */
  const pool = useMemo(() => {
    const signedUp = new Set((responses ?? []).map((r) => r.user_id));
    return (
      (members ?? [])
        .map((m) => ({
          user_id: m.user_id,
          nombre: nameOf(m.profile),
          signedUp: signedUp.has(m.user_id),
        }))
        // Los invitados apuntados al entreno también juegan, aunque no sean del equipo.
        .concat(invitadosApuntados(responses))
        .sort((a, b) => Number(b.signedUp) - Number(a.signedUp) || a.nombre.localeCompare(b.nombre))
    );
  }, [members, responses]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    pool.forEach((p) => map.set(p.user_id, p.nombre));
    (courts ?? []).forEach((c) =>
      c.players.forEach((p) => {
        if (!map.has(p.user_id)) map.set(p.user_id, nameOf(p.profile));
      }),
    );
    return map;
  }, [pool, courts]);

  const [draft, setDraft] = useState<DraftCourt[]>([]);
  useEffect(() => {
    setDraft(
      (courts ?? []).map((c) => ({
        pista: c.pista,
        players: c.players.map((p) => ({ user_id: p.user_id, ganador: p.ganador })),
      })),
    );
  }, [courts]);

  const closed = !!competition?.finalizada;
  // Guardado, el resultado queda fijo: sin arrastrar ni quitar. «Reabrir» lo
  // vuelve editable, y al guardar otra vez se fija de nuevo.
  const guardado = (courts ?? []).length > 0;
  const [reabierto, setReabierto] = useState(false);
  const puedeGestionar = isManager && hasStarted && !closed;
  const canEdit = puedeGestionar && (!guardado || reabierto);

  const assigned = useMemo(
    () => new Set(draft.flatMap((c) => c.players.map((p) => p.user_id))),
    [draft],
  );
  const available = pool.filter((p) => !assigned.has(p.user_id));

  const save = useMutation({
    mutationFn: (pistas: DraftCourt[]) =>
      api.post("/training-courts/bulk/", {
        event_id: eventId,
        courts: pistas.map((court, index) => ({
          pista: court.pista,
          posicion: index + 1,
          players: court.players,
        })),
      }),
    onSuccess: async () => {
      toast.success(t("training.saved"));
      setReabierto(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["training-courts", eventId] }),
        qc.invalidateQueries({ queryKey: ["competition-standings"] }),
      ]);
    },
    onError: (e: Error) => {
      const key = saveErrorKey(e.message ?? "");
      toast.error(key ? t(key) : e.message || t("common.error"));
    },
  });

  // --- asistentes ---------------------------------------------------------

  // En un entreno, la casilla «Asistió» es `es_convocado`. Si nadie la ha
  // marcado aún, se cuenta a los apuntados que dijeron que iban.
  const asistieron = (responses ?? []).filter((r) => r.es_convocado && r.status !== "rechazado");
  const sinMarcar = asistieron.length === 0;
  const jugadores: Jugador[] = (
    sinMarcar ? (responses ?? []).filter((r) => r.status === "confirmado") : asistieron
  ).map((r) => ({ user_id: r.user_id, nombre: nombreVisible(r.profile) }));
  const nombre = (u: string) =>
    nameById.get(u) ?? jugadores.find((j) => j.user_id === u)?.nombre ?? "—";

  /** Crea «Invitado N» hasta completar `cuantos`, y devuelve sus ids. */
  async function crearInvitados(cuantos: number): Promise<string[]> {
    const usados = new Set(
      (responses ?? []).filter((r) => r.profile?.es_invitado).map((r) => r.profile!.nombre),
    );
    const ids: string[] = [];
    for (let n = 1; ids.length < cuantos; n++) {
      const nombreInvitado = t("training.invitadoN", { n });
      if (usados.has(nombreInvitado)) continue;
      const r = await api.post<{ user_id: string }>(`/events/${eventId}/invitados/`, {
        nombre: nombreInvitado,
      });
      ids.push(r.user_id);
    }
    await qc.invalidateQueries({ queryKey: ["event-responses", eventId] });
    return ids;
  }

  /** «Repartir pistas»: tantas pistas de cuatro como hagan falta, vacías. */
  async function repartir() {
    const n = jugadores.length;
    if (n === 0) return toast.error(t("training.nadieAsistio"));
    const { pistas, faltan } = pistasPara(n);
    if (faltan > 0) {
      const ok = await confirmar({
        title: t("training.faltanTitulo", { count: faltan }),
        description: t("training.faltanTexto", { n, pistas, count: faltan }),
        confirmLabel: t("training.crearInvitados", { count: faltan }),
      });
      if (ok) {
        try {
          await crearInvitados(faltan);
        } catch (e) {
          return toast.error(e instanceof Error ? e.message : t("common.error"));
        }
      }
    }
    setDraft(() => Array.from({ length: pistas }, (_, i) => ({ pista: i + 1, players: [] })));
  }

  const addCourt = () =>
    setDraft((prev) => {
      const used = new Set(prev.map((c) => c.pista));
      let pista = 1;
      while (used.has(pista)) pista += 1;
      return [...prev, { pista, players: [] }];
    });

  /** Antes de guardar: una pista con menos de cuatro pide invitados. */
  const handleSave = async () => {
    if (draft.length === 0) return toast.error(t("training.errNoCourts"));
    if (draft.some((c) => c.players.length === 0)) {
      return toast.error(t("training.errEmptyCourt"));
    }
    const cortas = draft.filter((c) => c.players.length < 4);
    if (cortas.length > 0) {
      const faltan = cortas.reduce((s, c) => s + 4 - c.players.length, 0);
      const ok = await confirmar({
        title: t("training.pistaCortaTitulo", { count: faltan }),
        description: t("training.pistaCortaTexto", {
          pistas: cortas.map((c) => c.pista).join(", "),
          count: faltan,
        }),
        confirmLabel: t("training.crearInvitados", { count: faltan }),
      });
      if (!ok) return;
      let ids: string[];
      try {
        ids = await crearInvitados(faltan);
      } catch (e) {
        return toast.error(e instanceof Error ? e.message : t("common.error"));
      }
      // Cada invitado, al hueco libre de su pista: primero el lado que falte.
      const completo = draft.map((c) => {
        const players = [...c.players];
        while (players.length < 4 && ids.length > 0) {
          const ganadores = players.filter((p) => p.ganador).length;
          players.push({ user_id: ids.shift()!, ganador: ganadores < 2 });
        }
        return { ...c, players };
      });
      setDraft(() => completo);
      return save.mutate(completo);
    }
    save.mutate(draft);
  };

  // --- pantalla ----------------------------------------------------------

  // Dentro de una competición manda el formato de ella; un entreno suelto usa
  // el suyo. Es la misma regla que aplica el servidor en `formato_efectivo`.
  const formato: TrainingFormat | null = competitionId
    ? (competition?.formato ?? null)
    : formatoEntreno;

  // Con competición pero sin cargar todavía no se sabe el formato, y enseñar
  // el aviso de «sin formato» un instante sería mentir.
  if (competitionId && !competition) return null;

  const enlaceCompeticion = competitionId ? (
    <Link
      to="/competiciones/$id"
      params={{ id: competitionId }}
      search={{ evento: eventId }}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-2xs font-bold uppercase tracking-widest text-primary hover:bg-primary/15"
    >
      <Trophy className="size-3" />
      {competitionNombre ?? t("standings.seeStandings")}
    </Link>
  ) : null;

  if (formato === null) {
    return (
      <div className="surface-card p-5 text-xs text-muted-foreground">
        {t("training.sinFormato")}
      </div>
    );
  }

  if (formato !== "rey_pista") {
    return (
      <TrainingCountSection
        eventId={eventId}
        teamId={teamId}
        formato={formato}
        closed={closed}
        hasStarted={hasStarted}
        isManager={isManager}
        header={
          <TrainingHeader
            titulo={t("training.countTitle")}
            subtitulo={t(
              formato === "americano"
                ? "training.countSubtitleAmericano"
                : "training.countSubtitlePartidos",
            )}
            action={enlaceCompeticion}
          />
        }
      />
    );
  }

  const shown: DraftCourt[] = canEdit
    ? draft
    : (courts ?? []).map((c) => ({
        pista: c.pista,
        players: c.players.map((p) => ({ user_id: p.user_id, ganador: p.ganador })),
      }));

  return (
    <div className="surface-card overflow-hidden">
      <TrainingHeader
        titulo={t("training.title")}
        subtitulo={t("training.subtitle")}
        action={enlaceCompeticion}
      />

      {closed && (
        <p className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-3 text-xxs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" /> {t("training.closed")}
        </p>
      )}
      {!hasStarted && !closed && (
        <p className="border-b border-border px-5 py-3 text-xxs text-muted-foreground">
          {t("training.notYetPlayed")}
        </p>
      )}

      <div className="space-y-4 p-4 sm:p-5">
        {puedeGestionar && guardado && !reabierto && (
          <GuardadoReabrir onReabrir={() => setReabierto(true)} />
        )}

        {canEdit && (
          <p className="text-2xs text-muted-foreground">
            {sinMarcar
              ? t("training.cuentaApuntados", { count: jugadores.length })
              : t("training.cuentaAsistentes", { count: jugadores.length })}
          </p>
        )}

        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {canEdit ? t("training.emptyManager") : t("training.empty")}
          </p>
        )}

        <ReyPistaTablero
          draft={shown}
          setDraft={(f) => setDraft((prev) => f(prev))}
          canEdit={canEdit}
          jugadores={jugadores}
          nombre={nombre}
        />

        {canEdit && (
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {draft.length === 0 && (
                <Button type="button" onClick={() => void repartir()}>
                  <Shuffle className="mr-1.5 size-4" />
                  {t("training.repartir", { count: pistasPara(jugadores.length).pistas })}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={addCourt}>
                <Plus className="mr-1 size-4" /> {t("training.addCourt")}
              </Button>
            </div>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={save.isPending}
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {t("training.save")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function GuardadoReabrir({ onReabrir }: { onReabrir: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-entreno-guardado
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ok/35 bg-ok/10 px-3 py-2.5 text-sm"
    >
      <span className="flex items-center gap-2">
        <Lock className="size-4 shrink-0 text-ok" aria-hidden="true" />
        {t("training.guardadoFijo")}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onReabrir}
        className="text-2xs font-bold uppercase tracking-widest"
      >
        {t("training.reabrir")}
      </Button>
    </div>
  );
}
