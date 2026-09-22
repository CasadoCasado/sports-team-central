/**
 * Cómo quedó un entrenamiento: el orden final de las pistas y quién ganó.
 *
 * Solo tiene sentido en un entrenamiento que cuelga de una competición del
 * equipo, porque es de ahí de donde sale su clasificación. La pantalla arma la
 * foto completa del reparto y la manda de una vez a `/training-courts/bulk/`,
 * igual que los resultados de un partido van a `/match-results/bulk/`.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Crown,
  ListOrdered,
  Lock,
  Plus,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TrainingCountSection, TrainingHeader } from "@/components/training-count-section";
import type {
  Competition,
  EventResponse,
  Profile,
  TeamMember,
  TrainingCourt,
  TrainingFormat,
} from "@/lib/types";

/** Una pista mientras se edita: la posición final es su sitio en la lista. */
type DraftCourt = {
  pista: number;
  players: { user_id: string; ganador: boolean }[];
};

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
    return (members ?? [])
      .map((m) => ({
        user_id: m.user_id,
        nombre: nameOf(m.profile),
        signedUp: signedUp.has(m.user_id),
      }))
      .sort((a, b) => Number(b.signedUp) - Number(a.signedUp) || a.nombre.localeCompare(b.nombre));
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
  const canEdit = isManager && hasStarted && !closed;

  const assigned = useMemo(
    () => new Set(draft.flatMap((c) => c.players.map((p) => p.user_id))),
    [draft],
  );
  const available = pool.filter((p) => !assigned.has(p.user_id));

  const save = useMutation({
    mutationFn: () =>
      api.post("/training-courts/bulk/", {
        event_id: eventId,
        courts: draft.map((court, index) => ({
          pista: court.pista,
          posicion: index + 1,
          players: court.players,
        })),
      }),
    onSuccess: async () => {
      toast.success(t("training.saved"));
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

  // --- edición del borrador ---------------------------------------------

  const addCourt = () =>
    setDraft((prev) => {
      const used = new Set(prev.map((c) => c.pista));
      let pista = 1;
      while (used.has(pista)) pista += 1;
      return [...prev, { pista, players: [] }];
    });

  const removeCourt = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  const moveCourt = (index: number, delta: number) =>
    setDraft((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const setPista = (index: number, pista: number) =>
    setDraft((prev) => prev.map((c, i) => (i === index ? { ...c, pista } : c)));

  const addPlayer = (index: number, userId: string) =>
    setDraft((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, players: [...c.players, { user_id: userId, ganador: false }] } : c,
      ),
    );

  const removePlayer = (index: number, userId: string) =>
    setDraft((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, players: c.players.filter((p) => p.user_id !== userId) } : c,
      ),
    );

  const toggleWinner = (index: number, userId: string) =>
    setDraft((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              players: c.players.map((p) =>
                p.user_id === userId ? { ...p, ganador: !p.ganador } : p,
              ),
            }
          : c,
      ),
    );

  const handleSave = () => {
    if (draft.length === 0) return toast.error(t("training.errNoCourts"));
    if (draft.some((c) => c.players.length === 0)) {
      return toast.error(t("training.errEmptyCourt"));
    }
    const pistas = draft.map((c) => c.pista);
    if (new Set(pistas).size !== pistas.length) {
      return toast.error(t("training.errDuplicateCourt"));
    }
    save.mutate();
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

      <div className="space-y-4 p-5">
        {canEdit && shown.length > 0 && (
          <p className="text-2xs text-muted-foreground">{t("training.reyesHint")}</p>
        )}

        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {canEdit ? t("training.emptyManager") : t("training.empty")}
          </p>
        )}

        {shown.map((court, index) => (
          <div key={`${court.pista}-${index}`} className="rounded-md border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-2xs font-black text-primary">
                  {index + 1}
                </span>
                <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t("training.posicion")}
                </span>
                <span className="ml-2 text-2xs font-bold uppercase tracking-widest text-primary">
                  {t("training.pista")}
                </span>
                {canEdit ? (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={court.pista}
                    onChange={(e) => setPista(index, Number(e.target.value) || 1)}
                    aria-label={t("training.pista")}
                    className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center text-sm font-bold"
                  />
                ) : (
                  <span className="text-sm font-bold">{court.pista}</span>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveCourt(index, -1)}
                    disabled={index === 0}
                    aria-label={t("training.moveUp")}
                    className="rounded-md border border-border p-1.5 hover:bg-card disabled:opacity-40"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCourt(index, 1)}
                    disabled={index === shown.length - 1}
                    aria-label={t("training.moveDown")}
                    className="rounded-md border border-border p-1.5 hover:bg-card disabled:opacity-40"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCourt(index)}
                    aria-label={t("training.removeCourt")}
                    className="rounded-md border border-border p-1.5 text-destructive hover:bg-card"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {court.players.length === 0 ? (
              <p className="text-xxs text-muted-foreground">{t("training.noPlayers")}</p>
            ) : (
              <ul className="space-y-1.5">
                {[...court.players]
                  .sort((a, b) => Number(b.ganador) - Number(a.ganador))
                  .map((player) => (
                    <li
                      key={player.user_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {nameById.get(player.user_id) ?? "—"}
                      </span>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleWinner(index, player.user_id)}
                        aria-pressed={player.ganador}
                        aria-label={t("training.markWinner")}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest",
                          player.ganador
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                            : "border-border text-muted-foreground",
                          canEdit ? "hover:bg-card" : "cursor-default",
                        )}
                      >
                        <Crown className="size-3" />
                        {player.ganador ? t("training.winner") : t("training.loser")}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removePlayer(index, player.user_id)}
                          aria-label={t("training.removePlayer")}
                          className="rounded-md border border-border p-1 text-muted-foreground hover:bg-card"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            )}

            {canEdit && (
              <div className="mt-3">
                <Select
                  value=""
                  disabled={available.length === 0}
                  onValueChange={(v) => addPlayer(index, v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue
                      placeholder={
                        available.length === 0 ? t("training.allAssigned") : t("training.addPlayer")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.nombre}
                        {p.signedUp ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ))}

        {canEdit && (
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={addCourt}>
              <Plus className="mr-1 size-4" /> {t("training.addCourt")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
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
