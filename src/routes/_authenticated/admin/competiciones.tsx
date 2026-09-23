import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminCompetitionsQuery,
  categoriesCatalogQuery,
  divisionsCatalogQuery,
  type CatalogItem,
  type OfficialCompetition,
} from "@/lib/official-competitions";

export const Route = createFileRoute("/_authenticated/admin/competiciones")({
  component: AdminCompetitionsPage,
  head: () => ({
    meta: [
      { title: "Administración de competiciones oficiales | TeamUp" },
      {
        name: "description",
        content:
          "Gestiona el catálogo de competiciones oficiales: categorías, divisiones, reglas y estado de inscripción.",
      },
      { property: "og:title", content: "Administración de competiciones oficiales" },
      {
        property: "og:description",
        content: "Catálogo configurable de competiciones, categorías, divisiones y reglas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Las dos colecciones que cuelgan de una competición oficial. */
type CatalogKind = "official-categories" | "official-divisions";

function AdminCompetitionsPage() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Partial<OfficialCompetition> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: competitions } = useQuery(adminCompetitionsQuery);
  const { data: categories } = useQuery(categoriesCatalogQuery);
  const { data: divisions } = useQuery(divisionsCatalogQuery);

  if (!isAdmin) {
    return (
      <div className="surface-card p-6">
        <h1 className="text-display text-xl font-bold">{t("adminComps.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("adminComps.noAccess")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-2xl font-bold">{t("adminComps.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("adminComps.subtitle")}</p>
        </div>
        <Button
          onClick={() => setEditing({})}
          className="min-h-11 bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
        >
          <Plus className="mr-1 size-4" />
          {t("adminComps.newCompetition")}
        </Button>
      </header>

      <div className="space-y-3">
        {(competitions?.length ?? 0) === 0 && (
          <p className="surface-card p-5 text-sm text-muted-foreground">{t("adminComps.empty")}</p>
        )}
        {competitions?.map((c) => (
          <article key={c.id} className="surface-card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                <Trophy className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-display text-lg font-bold">
                  {c.nombre} <span className="text-xs text-muted-foreground">({c.code})</span>
                </h2>
                {c.descripcion && (
                  <p className="mt-1 text-sm text-muted-foreground">{c.descripcion}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5 text-2xs font-bold uppercase tracking-widest">
                  <span
                    className={`rounded border px-1.5 py-0.5 ${
                      c.activa
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {c.activa ? t("adminComps.active") : t("adminComps.inactive")}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 ${
                      c.inscripciones_abiertas
                        ? "border-sky-500/40 bg-sky-500/15 text-sky-600"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {c.inscripciones_abiertas
                      ? t("adminComps.registrationsOpen")
                      : t("adminComps.registrationsClosed")}
                  </span>
                  {c.temporada_actual && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                      {c.temporada_actual}
                    </span>
                  )}
                </div>
                {c.reglas && (
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {c.reglas}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(c)}
                  aria-label={t("common.edit")}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
                >
                  <Pencil className="size-3.5" />
                </button>
                <DeleteButton table="official-competitions" id={c.id} />
              </div>
            </div>

            <button
              onClick={() => setSelected(selected === c.id ? null : c.id)}
              className="-ml-2 mt-2 inline-flex min-h-11 items-center rounded-md px-2 text-2xs font-bold uppercase tracking-widest text-primary"
            >
              {selected === c.id ? t("adminComps.hideCatalog") : t("adminComps.showCatalog")}
            </button>

            {selected === c.id && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <CatalogList
                  title={t("registrations.category")}
                  kind="official-categories"
                  competitionId={c.id}
                  items={(categories ?? []).filter((x) => x.competition_id === c.id)}
                />
                <CatalogList
                  title={t("registrations.division")}
                  kind="official-divisions"
                  competitionId={c.id}
                  items={(divisions ?? []).filter((x) => x.competition_id === c.id)}
                />
              </div>
            )}
          </article>
        ))}
      </div>

      {editing && (
        <CompetitionDialog initial={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function DeleteButton({ table, id }: { table: CatalogKind | "official-competitions"; id: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => api.delete(`/${table}/${id}/`),
    onSuccess: () => {
      toast.success(t("adminComps.deleted"));
      qc.invalidateQueries({ queryKey: ["official-competitions-admin"] });
      qc.invalidateQueries({ queryKey: ["official-competitions"] });
      qc.invalidateQueries({ queryKey: ["official-competition-categories"] });
      qc.invalidateQueries({ queryKey: ["official-competition-divisions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      onClick={() => {
        if (confirm(t("adminComps.deleteConfirm"))) del.mutate();
      }}
      aria-label={t("common.delete")}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-destructive hover:bg-muted"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

function CatalogList({
  title,
  kind,
  competitionId,
  items,
}: {
  title: string;
  kind: CatalogKind;
  competitionId: string;
  items: CatalogItem[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [nombre, setNombre] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!code.trim() || !nombre.trim()) throw new Error(t("adminComps.requiredFields"));
      await api.post(`/${kind}/`, {
        competition_id: competitionId,
        code: code.trim().toUpperCase(),
        nombre: nombre.trim(),
        orden: items.length + 1,
      });
    },
    onSuccess: () => {
      setCode("");
      setNombre("");
      toast.success(t("adminComps.created"));
      qc.invalidateQueries({ queryKey: ["official-competition-categories"] });
      qc.invalidateQueries({ queryKey: ["official-competition-divisions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-border p-3">
      <h3 className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 space-y-1">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm"
          >
            <span className="truncate">
              {i.nombre} <span className="text-muted-foreground">({i.code})</span>
            </span>
            <DeleteButton table={kind} id={i.id} />
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-muted-foreground">{t("adminComps.emptyCatalog")}</li>
        )}
      </ul>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("adminComps.code")}
          className="w-24"
          maxLength={20}
        />
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={t("adminComps.name")}
          className="min-w-32 flex-1"
          maxLength={80}
        />
        <Button type="submit" variant="outline" className="min-h-10">
          <Plus className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function CompetitionDialog({
  initial,
  onClose,
}: {
  initial: Partial<OfficialCompetition>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = !!initial.id;
  const [code, setCode] = useState(initial.code ?? "");
  const [nombre, setNombre] = useState(initial.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial.descripcion ?? "");
  const [reglas, setReglas] = useState(initial.reglas ?? "");
  const [temporada, setTemporada] = useState(initial.temporada_actual ?? "");
  const [activa, setActiva] = useState(initial.activa ?? true);
  const [abiertas, setAbiertas] = useState(initial.inscripciones_abiertas ?? true);

  const save = useMutation({
    mutationFn: async () => {
      if (!code.trim() || !nombre.trim()) throw new Error(t("adminComps.requiredFields"));
      const payload = {
        code: code.trim().toUpperCase(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        reglas: reglas.trim() || null,
        temporada_actual: temporada.trim() || null,
        activa,
        inscripciones_abiertas: abiertas,
      };
      if (isEdit) {
        await api.patch(`/official-competitions/${initial.id!}/`, payload);
      } else {
        await api.post("/official-competitions/", payload);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? t("adminComps.updated") : t("adminComps.created"));
      qc.invalidateQueries({ queryKey: ["official-competitions-admin"] });
      qc.invalidateQueries({ queryKey: ["official-competitions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("adminComps.editCompetition") : t("adminComps.newCompetition")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <Label>{t("adminComps.code")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} required />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("adminComps.name")}</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={100}
                required
              />
            </div>
          </div>
          <div>
            <Label>{t("adminComps.description")}</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              maxLength={400}
            />
          </div>
          <div>
            <Label>{t("adminComps.rules")}</Label>
            <Textarea
              value={reglas}
              onChange={(e) => setReglas(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
          <div>
            <Label>{t("adminComps.season")}</Label>
            <Input
              value={temporada}
              onChange={(e) => setTemporada(e.target.value)}
              placeholder="2025/2026"
              maxLength={20}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="activa" className="cursor-pointer">
              {t("adminComps.active")}
            </Label>
            <Switch id="activa" checked={activa} onCheckedChange={setActiva} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="abiertas" className="cursor-pointer">
              {t("adminComps.registrationsOpen")}
            </Label>
            <Switch id="abiertas" checked={abiertas} onCheckedChange={setAbiertas} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
