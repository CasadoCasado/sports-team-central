import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImagePlus, Trash2, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/galeria")({
  component: Galeria,
});

type Item = {
  id: string;
  storage_path: string;
  caption: string | null;
  uploader_id: string;
  created_at: string;
};

function Galeria() {
  const { t } = useTranslation();
  const { active, isManager } = useActiveTeam();
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items } = useQuery<Item[]>({
    queryKey: ["gallery", active?.team_id],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_items")
        .select("id, storage_path, caption, uploader_id, created_at")
        .eq("team_id", active!.team_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!items || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const paths = items.map((i) => i.storage_path);
      const { data } = await supabase.storage
        .from("team-gallery")
        .createSignedUrls(paths, 3600);
      if (cancelled) return;
      const map: Record<string, string> = {};
      data?.forEach((d, i) => {
        if (d.signedUrl) map[items[i].id] = d.signedUrl;
      });
      setUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!active || !user) throw new Error("No team");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${active.team_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("team-gallery")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("gallery_items").insert({
        team_id: active.team_id,
        uploader_id: user.id,
        storage_path: path,
        caption: file.name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("gallery.uploaded"));
      qc.invalidateQueries({ queryKey: ["gallery"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const remove = useMutation({
    mutationFn: async (item: Item) => {
      await supabase.storage.from("team-gallery").remove([item.storage_path]);
      const { error } = await supabase.from("gallery_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("gallery.deleted"));
      qc.invalidateQueries({ queryKey: ["gallery"] });
    },
  });

  if (!active) {
    return (
      <div className="mx-auto max-w-xl surface-card p-12 text-center">
        <p className="text-sm text-muted-foreground">{t("common.noTeamSelected")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
            {t("nav.galeria")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("gallery.subtitle")}</p>
        </div>
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
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
            <ImagePlus className="mr-2 size-4" />
            {upload.isPending ? t("common.loading") : t("gallery.upload")}
          </Button>
        </>
      </div>

      {(items?.length ?? 0) === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 p-16 text-center">
          <Images className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("gallery.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items?.map((it) => (
            <div key={it.id} className="group relative overflow-hidden rounded-md border border-border bg-card aspect-square">
              {urls[it.id] ? (
                <img
                  src={urls[it.id]}
                  alt={it.caption ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-muted" />
              )}
              {(it.uploader_id === user?.id || isManager) && (
                <button
                  onClick={() => {
                    if (confirm(t("gallery.deleteConfirm"))) remove.mutate(it);
                  }}
                  className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 opacity-0 transition group-hover:opacity-100"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="size-4 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
