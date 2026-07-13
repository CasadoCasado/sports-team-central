import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileUp, FileText, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/documentos")({
  component: Documentos,
});

type Doc = {
  id: string;
  storage_path: string;
  filename: string;
  category: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  uploader_id: string;
};

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, storage_path, filename, category, size_bytes, mime_type, created_at, uploader_id")
        .eq("team_id", active!.team_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!active || !user) throw new Error("No team");
      const path = `${active.team_id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("team-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        team_id: active.team_id,
        uploader_id: user.id,
        storage_path: path,
        filename: file.name,
        size_bytes: file.size,
        mime_type: file.type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("documents.uploaded"));
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const remove = useMutation({
    mutationFn: async (d: Doc) => {
      await supabase.storage.from("team-documents").remove([d.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("documents.deleted"));
      qc.invalidateQueries({ queryKey: ["docs"] });
    },
  });

  async function download(d: Doc) {
    const { data, error } = await supabase.storage
      .from("team-documents")
      .createSignedUrl(d.storage_path, 60);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
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
        {isManager && (
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
              className="bg-primary text-primary-foreground uppercase text-[10px] tracking-widest font-bold"
            >
              <FileUp className="mr-2 size-4" />
              {upload.isPending ? t("common.loading") : t("documents.upload")}
            </Button>
          </>
        )}
      </div>

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
