import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImagePlus, Trash2, Images } from "lucide-react";
import { api } from "@/lib/api";
import type { GalleryItem } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { FEATURES } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/galeria")({
  head: () => ({
    meta: [
      { title: "Galería | TeamUp" },
      { name: "description", content: "Fotos y recuerdos compartidos por los miembros del equipo." },
      { property: "og:title", content: "Galería | TeamUp" },
      { property: "og:description", content: "Fotos y recuerdos compartidos por los miembros del equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Galeria,
});

type Item = GalleryItem;

function Galeria() {
  const { t } = useTranslation();
  const { active, isManager } = useActiveTeam();
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items } = useQuery<Item[]>({
    queryKey: ["gallery", active?.team_id],
    enabled: !!active,
    queryFn: () =>
      api.get<Item[]>("/gallery-items/", {
        team_id: active!.team_id,
        order: "-created_at",
      }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!active || !user) throw new Error("No team");
      const form = new FormData();
      form.append("team_id", active.team_id);
      form.append("file", file);
      await api.upload("/gallery-items/", form);
    },
    onSuccess: () => {
      toast.success(t("gallery.uploaded"));
      qc.invalidateQueries({ queryKey: ["gallery"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const remove = useMutation({
    // La imagen se borra con la fila.
    mutationFn: (item: Item) => api.delete(`/gallery-items/${item.id}/`),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
            {t("nav.galeria")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("gallery.subtitle")}</p>
        </div>
        {FEATURES.galleryUploads && (
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
        )}
      </div>

      {!FEATURES.galleryUploads && (
        <MaintenanceNotice
          title={t("maintenance.galleryTitle")}
          description={t("maintenance.galleryDescription")}
        />
      )}

      {(items?.length ?? 0) === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 p-16 text-center">
          <Images className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {FEATURES.galleryUploads ? t("gallery.empty") : t("gallery.emptyPaused")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items?.map((it) => (
            <div key={it.id} className="group relative overflow-hidden rounded-md border border-border bg-card aspect-square">
              {it.url ? (
                <img
                  src={it.url}
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
