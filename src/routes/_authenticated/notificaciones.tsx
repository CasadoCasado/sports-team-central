import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Check, X, Trash2, MailOpen } from "lucide-react";
import { api } from "@/lib/api";
import type { Notification, TeamInvitation } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  head: () => ({
    meta: [
      { title: "Notificaciones | TeamUp" },
      { name: "description", content: "Todos los avisos de tu equipo: convocatorias, mensajes, encuestas y recordatorios." },
      { property: "og:title", content: "Notificaciones | TeamUp" },
      { property: "og:description", content: "Todos los avisos de tu equipo: convocatorias, mensajes, encuestas y recordatorios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Notificaciones,
});

function Notificaciones() {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Sin Realtime, la bandeja se recarga al volver a la pestaña y cada minuto;
  // la suscripción a `postgres_changes` la ponía Supabase.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      qc.invalidateQueries({ queryKey: ["shell-unread", user.id] });
    }, 60_000);
    return () => clearInterval(id);
  }, [user, qc]);



  const { data: invitations } = useQuery({
    queryKey: ["invitations", user?.id],
    enabled: !!user,
    queryFn: () =>
      api.get<TeamInvitation[]>("/team-invitations/", {
        mine: 1,
        status: "pendiente",
        es_solicitud: false,
      }),
  });

  // Join requests to teams the current user manages
  const { data: joinRequests } = useQuery({
    queryKey: ["join-requests", user?.id],
    enabled: !!user,
    // `managed=1` devuelve lo que llega a los equipos que gestiono, sin tener
    // que averiguar antes cuáles son.
    queryFn: () =>
      api.get<TeamInvitation[]>("/team-invitations/", {
        managed: 1,
        es_solicitud: true,
        status: "pendiente",
      }),
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: () =>
      api.get<Notification[]>("/notifications/", {
        order: "-created_at",
        limit: 50,
      }),
  });

  async function respond(invId: string, accept: boolean) {
    if (!user) return;
    try {
      await api.post(`/team-invitations/${invId}/${accept ? "accept" : "reject"}/`);
      toast.success(accept ? t("notifications.accepted") : t("notifications.rejected"));
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-invitations-count"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function respondRequest(invId: string, accept: boolean) {
    try {
      await api.post(`/team-invitations/${invId}/${accept ? "accept" : "reject"}/`);
      toast.success(accept ? t("notifications.accepted") : t("notifications.rejected"));
      qc.invalidateQueries({ queryKey: ["join-requests"] });
      qc.invalidateQueries({ queryKey: ["team-members-count"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const all = notifications ?? [];
  const types = Array.from(new Set(all.map((n) => n.tipo).filter(Boolean)));
  const visible = all.filter(
    (n) =>
      (statusFilter === "all" ||
        (statusFilter === "unread" && !n.read) ||
        (statusFilter === "read" && n.read)) &&
      (typeFilter === "all" || n.tipo === typeFilter),
  );
  const readIds = visible.filter((n) => n.read).map((n) => n.id);
  const unreadIds = visible.filter((n) => !n.read).map((n) => n.id);
  const totalUnread = all.filter((n) => !n.read).length;
  const typeLabel = (tipo: string) => t(`notifications.types.${tipo}`, { defaultValue: tipo });

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function toggleSelectAllRead() {
    setSelected((s) => (s.length === readIds.length ? [] : readIds));
  }

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    // Actualización optimista para reflejar el estado al instante.
    qc.setQueryData(["notifications", user?.id], (prev: typeof notifications) =>
      (prev ?? []).map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
    );
    let ok = true;
    try {
      await api.post("/notifications/mark-read/", { ids });
    } catch (err) {
      ok = false;
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    qc.invalidateQueries({ queryKey: ["shell-unread", user?.id] });
    return ok;
  }

  async function markAllRead() {
    const count = unreadIds.length;
    const ok = await markRead(unreadIds);
    if (ok) toast.success(t("notifications.allRead", { count }));
  }


  async function deleteSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    // El servidor solo borra las que estén leídas, aunque lleguen otras.
    try {
      await api.post("/notifications/delete-read/", { ids: selected });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : t("common.error"));
      return;
    }
    setBusy(false);
    toast.success(t("notifications.deleted", { count: selected.length }));
    setSelected([]);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["shell-unread"] });
  }


  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-display text-3xl font-black tracking-tight">{t("notifications.title")}</h1>

      {(joinRequests?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
            {t("notifications.joinRequests")}
          </h2>
          {joinRequests!.map((req) => {
            const team = req.team;
            const requester = req.invited_user_profile;
            return (
              <div key={req.id} className="surface-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      {t("notifications.joinRequestBody", {
                        user: `${requester?.nombre ?? ""} ${requester?.apellidos ?? ""}`.trim() || requester?.email || "?",
                        team: team?.nombre ?? "",
                      })}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respondRequest(req.id, true)}
                        className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                      >
                        <Check className="mr-1 size-3.5" />
                        {t("notifications.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondRequest(req.id, false)}
                      >
                        <X className="mr-1 size-3.5" />
                        {t("notifications.reject")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {(invitations?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
            {t("nav.notificaciones")}
          </h2>
          {invitations!.map((inv) => {
            const team = inv.team;
            const inviter = inv.inviter_profile;
            return (
              <div key={inv.id} className="surface-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      {t("notifications.invitationBody", {
                        captain: `${inviter?.nombre ?? ""} ${inviter?.apellidos ?? ""}`.trim(),
                        team: team?.nombre ?? "",
                      })}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respond(inv.id, true)}
                        className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                      >
                        <Check className="mr-1 size-3.5" />
                        {t("notifications.accept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respond(inv.id, false)}
                      >
                        <X className="mr-1 size-3.5" />
                        {t("notifications.reject")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {all.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
              {t("notifications.title")}
              {totalUnread > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-bold text-primary">
                  {t("notifications.unreadCount", { count: totalUnread })}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-2">

              {readIds.length > 0 && (
                <Button size="sm" variant="outline" onClick={toggleSelectAllRead}>
                  {selected.length === readIds.length
                    ? t("notifications.clearSelection")
                    : t("notifications.selectAllRead")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={markAllRead}
                disabled={unreadIds.length === 0}
              >
                <MailOpen className="mr-1 size-3.5" />
                {t("notifications.markAllRead")}
              </Button>

              <Button
                size="sm"
                variant="destructive"
                disabled={selected.length === 0 || busy}
                onClick={deleteSelected}
              >
                <Trash2 className="mr-1 size-3.5" />
                {t("notifications.deleteSelected", { count: selected.length })}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "unread", "read"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter(s);
                  setSelected([]);
                }}
              >
                {t(
                  s === "all"
                    ? "notifications.filterAll"
                    : s === "unread"
                      ? "notifications.filterUnread"
                      : "notifications.filterRead",
                )}
              </Button>
            ))}
            {types.length > 1 && (
              <>
                <span className="ml-1 text-2xs uppercase tracking-widest text-muted-foreground">
                  {t("notifications.filterType")}
                </span>
                <Button
                  size="sm"
                  variant={typeFilter === "all" ? "secondary" : "ghost"}
                  onClick={() => {
                    setTypeFilter("all");
                    setSelected([]);
                  }}
                >
                  {t("notifications.allTypes")}
                </Button>
                {types.map((tp) => (
                  <Button
                    key={tp}
                    size="sm"
                    variant={typeFilter === tp ? "secondary" : "ghost"}
                    onClick={() => {
                      setTypeFilter(tp);
                      setSelected([]);
                    }}
                  >
                    {typeLabel(tp)}
                  </Button>
                ))}
              </>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="surface-card p-8 text-center text-sm text-muted-foreground">
              {t("notifications.noResults")}
            </div>
          ) : (
          <div className="surface-card divide-y divide-border">
            {visible.map((n) => (
              <div
                key={n.id}
                className={cn("flex items-start gap-4 p-4", !n.read && "bg-primary/5")}
              >
                <div className="mt-1.5">
                  <Checkbox
                    checked={selected.includes(n.id)}
                    disabled={!n.read}
                    onCheckedChange={() => toggleSelect(n.id)}
                    aria-label={
                      n.read
                        ? t("notifications.selectOne", { title: n.titulo })
                        : t("notifications.onlyReadDeletable")
                    }
                  />
                </div>
                <div className="mt-1 flex size-8 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border">
                  <Bell className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{n.titulo}</p>
                  {n.cuerpo && <p className="mt-0.5 text-xs text-muted-foreground">{n.cuerpo}</p>}
                  <p className="mt-1 text-2xs uppercase tracking-widest text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" onClick={() => markRead([n.id])}>
                    {t("notifications.markRead")}
                  </Button>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      ) : (
        (invitations?.length ?? 0) === 0 && (
          <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
            <Bell className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
          </div>
        )
      )}
    </div>
  );
}
