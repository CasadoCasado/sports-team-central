/**
 * Cómo quedó un entreno que se apunta contando, no ordenando pistas.
 *
 * En un americano las parejas rotan toda la noche y ninguna pista significa
 * nada al acabar, así que no hay orden que guardar: lo que queda es un
 * recuento por jugador. Según el formato se cuentan partidos —ganados y
 * perdidos— o juegos —a favor y en contra—. La foto completa de la noche va de
 * una vez a `/training-scores/bulk/`, igual que las pistas del rey de pista.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ListOrdered, Lock, X } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EventResponse,
  Profile,
  TeamMember,
  TrainingFormat,
  TrainingScore,
} from "@/lib/types";

/** Una fila mientras se edita. */
type DraftScore = { user_id: string; favor: number; contra: number };

const nameOf = (profile: Profile | null | undefined) =>
  profile ? `${profile.nombre} ${profile.apellidos}`.trim() : "—";

function saveErrorKey(message: string): string | null {
  if (message.includes("training_empty_night")) return "training.errEmptyNight";
  if (message.includes("training_negative_count")) return "training.errNegative";
  if (message.includes("training_player_twice")) return "training.errPlayerTwice";
  if (message.includes("training_player_not_member")) return "training.errNotMember";
  if (message.includes("training_wrong_format")) return "training.errWrongFormat";
  if (message.includes("training_needs_format")) return "training.errNeedsFormat";
  if (message.includes("competition_finished")) return "training.closed";
  return null;
}

export function TrainingCountSection({
  eventId,
  teamId,
  formato,
  closed,
  hasStarted,
  isManager,
  header,
}: {
  eventId: string;
  teamId: string;
  formato: Extract<TrainingFormat, "partidos" | "americano">;
  closed: boolean;
  hasStarted: boolean;
  isManager: boolean;
  header: React.ReactNode;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const esAmericano = formato === "americano";

  const { data: scores } = useQuery({
    queryKey: ["training-scores", eventId],
    queryFn: () => api.get<TrainingScore[]>("/training-scores/", { event_id: eventId }),
  });

  const { data: members } = useQuery({
    queryKey: ["team-members-full", teamId],
    queryFn: () => api.get<TeamMember[]>("/team-members/", { team_id: teamId, status: "activo" }),
  });

  const { data: responses } = useQuery({
    queryKey: ["event-responses", eventId],
    queryFn: () => api.get<EventResponse[]>("/event-responses/", { event_id: eventId }),
  });

  /** Quien se apuntó sale primero: es a quien más probablemente hay que añadir. */
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
    (scores ?? []).forEach((s) => {
      if (!map.has(s.user_id)) map.set(s.user_id, nameOf(s.profile));
    });
    return map;
  }, [pool, scores]);

  const [draft, setDraft] = useState<DraftScore[]>([]);
  useEffect(() => {
    setDraft(
      (scores ?? []).map((s) => ({
        user_id: s.user_id,
        favor: esAmericano ? s.juegos_favor : s.ganados,
        contra: esAmericano ? s.juegos_contra : s.perdidos,
      })),
    );
  }, [scores, esAmericano]);

  const canEdit = isManager && hasStarted && !closed;
  const assigned = useMemo(() => new Set(draft.map((d) => d.user_id)), [draft]);
  const available = pool.filter((p) => !assigned.has(p.user_id));

  const save = useMutation({
    mutationFn: () =>
      api.post("/training-scores/bulk/", {
        event_id: eventId,
        scores: draft.map((row) => ({
          user_id: row.user_id,
          ...(esAmericano
            ? { juegos_favor: row.favor, juegos_contra: row.contra }
            : { ganados: row.favor, perdidos: row.contra }),
        })),
      }),
    onSuccess: async () => {
      toast.success(t("training.saved"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["training-scores", eventId] }),
        qc.invalidateQueries({ queryKey: ["competition-standings"] }),
      ]);
    },
    onError: (e: Error) => {
      const key = saveErrorKey(e.message ?? "");
      toast.error(key ? t(key) : e.message || t("common.error"));
    },
  });

  const addPlayer = (userId: string) =>
    setDraft((prev) => [...prev, { user_id: userId, favor: 0, contra: 0 }]);

  const removePlayer = (userId: string) =>
    setDraft((prev) => prev.filter((row) => row.user_id !== userId));

  const setValue = (userId: string, campo: "favor" | "contra", value: string) =>
    setDraft((prev) =>
      prev.map((row) =>
        row.user_id === userId ? { ...row, [campo]: Math.max(0, Number(value) || 0) } : row,
      ),
    );

  const handleSave = () => {
    if (draft.length === 0) return toast.error(t("training.errEmptyNight"));
    save.mutate();
  };

  const rows = canEdit
    ? draft
    : (scores ?? []).map((s) => ({
        user_id: s.user_id,
        favor: esAmericano ? s.juegos_favor : s.ganados,
        contra: esAmericano ? s.juegos_contra : s.perdidos,
      }));

  const etiquetaFavor = t(esAmericano ? "training.juegosFavor" : "training.ganados");
  const etiquetaContra = t(esAmericano ? "training.juegosContra" : "training.perdidos");

  return (
    <div className="surface-card overflow-hidden">
      {header}

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

      <div className="space-y-3 p-5">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {canEdit ? t("training.countEmptyManager") : t("training.countEmpty")}
          </p>
        )}

        {rows.length > 0 && (
          <div className="grid grid-cols-[1fr_5rem_5rem_2rem] items-center gap-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            <span />
            <span className="text-center">{etiquetaFavor}</span>
            <span className="text-center">{etiquetaContra}</span>
            <span />
          </div>
        )}

        {rows.map((row) => (
          <div
            key={row.user_id}
            className="grid grid-cols-[1fr_5rem_5rem_2rem] items-center gap-2 rounded-md border border-border px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm">{nameById.get(row.user_id) ?? "—"}</span>
            {(["favor", "contra"] as const).map((campo) => (
              <input
                key={campo}
                type="number"
                min={0}
                max={999}
                inputMode="numeric"
                value={row[campo]}
                disabled={!canEdit}
                aria-label={`${campo === "favor" ? etiquetaFavor : etiquetaContra} — ${nameById.get(row.user_id) ?? ""}`}
                onChange={(e) => setValue(row.user_id, campo, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-center text-sm font-bold disabled:opacity-60"
              />
            ))}
            {canEdit ? (
              <button
                type="button"
                onClick={() => removePlayer(row.user_id)}
                aria-label={t("training.removePlayer")}
                className="rounded-md border border-border p-1 text-muted-foreground hover:bg-card"
              >
                <X className="size-3" />
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}

        {canEdit && (
          <>
            <Select value="" disabled={available.length === 0} onValueChange={addPlayer}>
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
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={save.isPending}
                className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
              >
                {t("training.save")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** La cabecera compartida por los dos editores de entreno. */
export function TrainingHeader({
  titulo,
  subtitulo,
  action,
}: {
  titulo: string;
  subtitulo: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ListOrdered className="size-5" />
        </div>
        <div>
          <h2 className="text-display text-lg font-bold uppercase tracking-tight">{titulo}</h2>
          <p className="text-xxs text-muted-foreground">{subtitulo}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
