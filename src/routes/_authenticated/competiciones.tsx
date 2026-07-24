import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trophy, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type CompType = Database["public"]["Enums"]["competition_type"];
type Competition = {
  id: string;
  nombre: string;
  tipo: CompType;
  temporada: string | null;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

type CompStatus = "proxima" | "enCurso" | "finalizada";

function getCompetitionStatus(c: Pick<Competition, "tipo" | "temporada" | "fecha_inicio" | "fecha_fin">): CompStatus | null {
  let start: Date | null = null;
  let end: Date | null = null;
  if (c.fecha_inicio) start = new Date(c.fecha_inicio);
  if (c.fecha_fin) {
    end = new Date(c.fecha_fin);
    end.setHours(23, 59, 59, 999);
  }
  if (!start && !end && c.tipo === "liga" && c.temporada) {
    const m = c.temporada.match(/^(\d{4})\s*[/\-]\s*(\d{2,4})$/);
    if (m) {
      const y1 = Number(m[1]);
      const y2Raw = Number(m[2]);
      const y2 = y2Raw < 100 ? 2000 + y2Raw : y2Raw;
      start = new Date(y1, 7, 1);
      end = new Date(y2, 5, 30, 23, 59, 59, 999);
    } else {
      const y = c.temporada.match(/^(\d{4})$/);
      if (y) {
        const yr = Number(y[1]);
        start = new Date(yr, 0, 1);
        end = new Date(yr, 11, 31, 23, 59, 59, 999);
      }
    }
  }
  if (!start && !end) return null;
  const now = new Date();
  if (end && now > end) return "finalizada";
  if (start && now < start) return "proxima";
  return "enCurso";
}

export const Route = createFileRoute("/_authenticated/competiciones")({
  component: CompetitionsPage,
});

function CompetitionsPage() {
  const { t } = useTranslation();
  const { active, isManager } = useActiveTeam();
  const [editing, setEditing] = useState<Partial<Competition> | null>(null);

  const { data } = useQuery({
    queryKey: ["competitions", active?.team_id],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("id, nombre, tipo, temporada, descripcion, fecha_inicio, fecha_fin")
        .eq("team_id", active!.team_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Competition[];
    },
  });

  if (!active) return <EmptyTeamState />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
            {t("nav.competiciones")}
          </h1>
          <div className="mt-1"><TeamPicker /></div>
        </div>
        {isManager && (
          <Button
            onClick={() => setEditing({})}
            className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            <Plus className="mr-1 size-4" />
            {t("competitions.create")}
          </Button>
        )}
      </div>

      {(data?.length ?? 0) === 0 ? (
        <div className="surface-card flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy className="size-7" />
          </div>
          <p className="text-sm text-muted-foreground">{t("competitions.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data!.map((c) => (
            <CompCard key={c.id} c={c} canManage={isManager} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}

      {editing && active && (
        <CompDialog
          teamId={active.team_id}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CompCard({
  c,
  canManage,
  onEdit,
}: {
  c: Competition;
  canManage: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("competitions").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("competitions.deleted"));
      qc.invalidateQueries({ queryKey: ["competitions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="surface-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Trophy className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-display truncate text-lg font-bold">{c.nombre}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className="rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-primary">
              {t(`competitions.types.${c.tipo}`)}
            </span>
            {(() => {
              const status = getCompetitionStatus(c);
              if (!status) return null;
              const styles: Record<CompStatus, string> = {
                proxima: "border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400",
                enCurso: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                finalizada: "border-muted-foreground/30 bg-muted text-muted-foreground",
              };
              return (
                <span className={`rounded border px-1.5 py-0.5 ${styles[status]}`}>
                  {t(`competitions.status.${status}`)}
                </span>
              );
            })()}
            {c.tipo === "liga" && c.temporada && (
              <span className="text-muted-foreground">{c.temporada}</span>
            )}
            {c.tipo !== "liga" && (c.fecha_inicio || c.fecha_fin) && (
              <span className="text-muted-foreground">
                {c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString() : "?"}
                {" – "}
                {c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString() : "?"}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="rounded-md border border-border p-1.5 hover:bg-card" aria-label={t("common.edit")}>
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(t("competitions.delete") + "?")) del.mutate();
              }}
              className="rounded-md border border-border p-1.5 text-destructive hover:bg-card"
              aria-label={t("common.delete")}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {c.descripcion && (
        <p className="mt-3 text-sm text-muted-foreground">{c.descripcion}</p>
      )}
    </div>
  );
}

function CompDialog({
  teamId,
  initial,
  onClose,
}: {
  teamId: string;
  initial: Partial<Competition>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<CompType>("liga");
  const [temporada, setTemporada] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(initial.nombre ?? "");
    setTipo((initial.tipo as CompType) ?? "liga");
    setTemporada(initial.temporada ?? "");
    setFechaInicio(initial.fecha_inicio ?? "");
    setFechaFin(initial.fecha_fin ?? "");
    setDescripcion(initial.descripcion ?? "");
  }, [initial]);

  const isEdit = !!initial.id;
  const isLiga = tipo === "liga";

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !nombre.trim()) throw new Error(t("auth.required"));
      const payload = {
        team_id: teamId,
        nombre: nombre.trim(),
        tipo,
        temporada: isLiga ? (temporada.trim() || null) : null,
        fecha_inicio: !isLiga && fechaInicio ? fechaInicio : null,
        fecha_fin: !isLiga && fechaFin ? fechaFin : null,
        descripcion: descripcion.trim() || null,
        created_by: user.id,
      };
      if (isEdit) {
        const { error } = await supabase.from("competitions").update(payload).eq("id", initial.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("competitions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? t("competitions.updated") : t("competitions.created"));
      qc.invalidateQueries({ queryKey: ["competitions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
    onSettled: () => setSaving(false),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("competitions.edit") : t("competitions.create")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            save.mutate();
          }}
        >
          <div>
            <Label>{t("competitions.nombre")}</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} />
          </div>
          <div>
            <Label>{t("competitions.tipo")}</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as CompType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["liga", "copa", "torneo", "amistoso"] as CompType[]).map((tp) => (
                  <SelectItem key={tp} value={tp}>{t(`competitions.types.${tp}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLiga ? (
            <div>
              <Label>{t("competitions.temporada")}</Label>
              <Input value={temporada} onChange={(e) => setTemporada(e.target.value)} placeholder="2025/26" maxLength={20} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("competitions.fechaInicio")}</Label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div>
                <Label>{t("competitions.fechaFin")}</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} min={fechaInicio || undefined} />
              </div>
            </div>
          )}

          <div>
            <Label>{t("competitions.descripcion")}</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} maxLength={500} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90">
              {isEdit ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
