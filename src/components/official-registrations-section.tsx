import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Medal, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  categoriesCatalogQuery,
  competitionsCatalogQuery,
  divisionsCatalogQuery,
  teamRegistrationsQuery,
  type RegistrationStatus,
  type TeamRegistration,
} from "@/lib/official-competitions";

const STATUSES: RegistrationStatus[] = ["abierta", "activa", "cerrada", "rechazada"];

export function statusBadgeClass(status: RegistrationStatus) {
  switch (status) {
    case "abierta":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "activa":
      return "border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400";
    case "rechazada":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

export function OfficialRegistrationsSection({
  teamId,
  canManage,
}: {
  teamId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Partial<TeamRegistration> | null>(null);
  const { data: registrations } = useQuery(teamRegistrationsQuery(teamId));

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-display text-xl font-bold">{t("registrations.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("registrations.subtitle")}</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setEditing({})}
            className="min-h-11 bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            <Plus className="mr-1 size-4" />
            {t("registrations.register")}
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {(registrations?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">{t("registrations.empty")}</p>
        )}
        {registrations?.map((r) => (
          <RegistrationRow
            key={r.id}
            r={r}
            canManage={canManage}
            onEdit={() => setEditing(r)}
          />
        ))}
      </div>

      {editing && (
        <RegistrationDialog
          teamId={teamId}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function RegistrationRow({
  r,
  canManage,
  onEdit,
}: {
  r: TeamRegistration;
  canManage: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("competition_registrations").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("registrations.deleted"));
      qc.invalidateQueries({ queryKey: ["competition-registrations"] });
      qc.invalidateQueries({ queryKey: ["open-registrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
        <Medal className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {r.official_competitions?.nombre ?? "—"}
          {r.temporada ? ` · ${r.temporada}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs font-bold uppercase tracking-widest">
          <span className="rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-primary">
            {r.official_competition_categories?.nombre}
          </span>
          <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
            {r.official_competition_divisions?.nombre}
          </span>
          <span className={`rounded border px-1.5 py-0.5 ${statusBadgeClass(r.status)}`}>
            {t(`registrations.status.${r.status}`)}
          </span>
        </div>
      </div>
      {canManage && (
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded-md border border-border p-2 hover:bg-muted"
            aria-label={t("common.edit")}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirm(t("registrations.deleteConfirm"))) del.mutate();
            }}
            className="rounded-md border border-border p-2 text-destructive hover:bg-muted"
            aria-label={t("common.delete")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function RegistrationDialog({
  teamId,
  initial,
  onClose,
}: {
  teamId: string;
  initial: Partial<TeamRegistration>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const isEdit = !!initial.id;

  const { data: competitions } = useQuery(competitionsCatalogQuery);
  const { data: categories } = useQuery(categoriesCatalogQuery);
  const { data: divisions } = useQuery(divisionsCatalogQuery);

  const [competitionId, setCompetitionId] = useState(initial.competition_id ?? "");
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");
  const [divisionId, setDivisionId] = useState(initial.division_id ?? "");
  const [temporada, setTemporada] = useState(initial.temporada ?? "");
  const [status, setStatus] = useState<RegistrationStatus>(initial.status ?? "abierta");

  useEffect(() => {
    if (!competitionId && competitions?.length === 1) setCompetitionId(competitions[0].id);
  }, [competitions, competitionId]);

  const cats = useMemo(
    () => (categories ?? []).filter((c) => c.competition_id === competitionId),
    [categories, competitionId],
  );
  const divs = useMemo(
    () => (divisions ?? []).filter((d) => d.competition_id === competitionId),
    [divisions, competitionId],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t("common.error"));
      if (!competitionId || !categoryId || !divisionId) {
        throw new Error(t("registrations.requiredFields"));
      }
      const payload = {
        team_id: teamId,
        competition_id: competitionId,
        category_id: categoryId,
        division_id: divisionId,
        temporada: temporada.trim() || null,
        status,
        created_by: user.id,
      };
      if (isEdit) {
        const { error } = await supabase
          .from("competition_registrations")
          .update(payload)
          .eq("id", initial.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("competition_registrations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? t("registrations.updated") : t("registrations.created"));
      qc.invalidateQueries({ queryKey: ["competition-registrations"] });
      qc.invalidateQueries({ queryKey: ["open-registrations"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("registrations.edit") : t("registrations.register")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label>{t("registrations.competition")}</Label>
            <Select
              value={competitionId}
              onValueChange={(v) => {
                setCompetitionId(v);
                setCategoryId("");
                setDivisionId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("registrations.selectCompetition")} />
              </SelectTrigger>
              <SelectContent>
                {competitions?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("registrations.category")} *</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={!competitionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("registrations.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("registrations.division")} *</Label>
              <Select value={divisionId} onValueChange={setDivisionId} disabled={!competitionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("registrations.selectDivision")} />
                </SelectTrigger>
                <SelectContent>
                  {divs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("competitions.temporada")}</Label>
              <Input
                value={temporada}
                onChange={(e) => setTemporada(e.target.value)}
                placeholder="2025/26"
                maxLength={20}
              />
            </div>
            <div>
              <Label>{t("registrations.statusLabel")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RegistrationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`registrations.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={save.isPending}
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {isEdit ? t("common.save") : t("registrations.register")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
