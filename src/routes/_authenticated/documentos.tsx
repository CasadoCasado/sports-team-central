import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileUp, FileText, Trash2, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { TeamDocument } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { FEATURES } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos | TeamUp" },
      { name: "description", content: "Comparte y consulta los documentos importantes del equipo en un solo lugar." },
      { property: "og:title", content: "Documentos | TeamUp" },
      { property: "og:description", content: "Comparte y consulta los documentos importantes del equipo en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Documentos,
});

type Doc = TeamDocument;

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Documentos() {
  const { t } = useTranslation();
  const { active, isManager } = useActiveTeam();
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs } = useQuery<Doc[]>({
    queryKey: ["docs", active?.team_id],
    enabled: !!active,
    queryFn: () => api.get<Doc[]>("/documents/", { team_id: active!.team_id }),
  });

  const upload = useMutation({
    // Antes eran dos pasos —subir al bucket y luego insertar la fila— y si
    // fallaba el segundo quedaba un fichero huérfano. Ahora es una petición:
    // el nombre, el tamaño y el tipo los deduce el servidor del propio fichero,
    // y `uploader_id` sale del token.
    mutationFn: async (file: File) => {
      if (!active || !user) throw new Error("No team");
      const form = new FormData();
      form.append("team_id", active.team_id);
      form.append("file", file);
      await api.upload("/documents/", form);
    },
    onSuccess: () => {
      toast.success(t("documents.uploaded"));
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const remove = useMutation({
    // Borrar la fila borra también el fichero.
    mutationFn: (d: Doc) => api.delete(`/documents/${d.id}/`),
    onSuccess: () => {
      toast.success(t("documents.deleted"));
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
  });

  function download(d: Doc) {
    if (!d.url) {
      toast.error(t("common.error"));
      return;
    }
    window.open(d.url, "_blank");
  }

  if (!active) {
    return (
      <div className="mx-auto max-w-xl surface-card p-12 text-center">
        <p className="text-sm text-muted-foreground">{t("common.noTeamSelected")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
            {t("nav.documentos")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("documents.subtitle")}</p>
        </div>
        {isManager && FEATURES.documentUploads && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="bg-primary text-primary-foreground uppercase text-2xs tracking-widest font-bold"
            >
              <FileUp className="mr-2 size-4" />
              {upload.isPending ? t("common.loading") : t("documents.upload")}
            </Button>
          </>
        )}
      </div>

      {!FEATURES.documentUploads && (
        <MaintenanceNotice
          title={t("maintenance.documentsTitle")}
          description={t("maintenance.documentsDescription")}
        />
      )}

      <div className="surface-card divide-y divide-border">
        {(docs?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <FileText className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("documents.empty")}</p>
          </div>
        ) : (
          docs?.map((d) => (
            <div key={d.id} className="flex items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold">{d.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => download(d)}
                className="rounded-md p-2 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label={t("documents.download")}
              >
                <Download className="size-4" />
              </button>
              {(isManager || d.uploader_id === user?.id) && (
                <button
                  onClick={() => {
                    if (confirm(t("documents.deleteConfirm"))) remove.mutate(d);
                  }}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
