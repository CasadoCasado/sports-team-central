import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Check, X, Trash2, MailOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

  // Realtime: refresca la lista y el contador al instante.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-page:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
          qc.invalidateQueries({ queryKey: ["shell-unread", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);



  const { data: invitations } = useQuery({
    queryKey: ["invitations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select(
          "id, team_id, role, status, mensaje, created_at, es_solicitud, teams:team_id(nombre, logo_url), inviter:invited_by(nombre, apellidos)",
        )
        .eq("invited_user_id", user!.id)
        .eq("status", "pendiente")
        .eq("es_solicitud", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Join requests to teams the current user manages
  const { data: joinRequests } = useQuery({
    queryKey: ["join-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get teams where user is a manager
      const { data: managed, error: mErr } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user!.id)
        .eq("status", "activo")
        .in("role", ["capitan", "co_capitan", "entrenador", "delegado"]);
      if (mErr) throw mErr;
      const teamIds = (managed ?? []).map((r) => r.team_id);
      if (teamIds.length === 0) return [];
      const { data, error } = await supabase
        .from("team_invitations")
        .select(
          "id, team_id, invited_user_id, created_at, mensaje, teams:team_id(nombre), requester:invited_user_id(nombre, apellidos, email)",
        )
        .in("team_id", teamIds)
        .eq("es_solicitud", true)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function respond(invId: string, teamId: string, accept: boolean) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("team_invitations")
        .update({
          status: accept ? "aceptada" : "rechazada",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invId);
      if (error) throw error;

      if (accept) {
        const { error: memErr } = await supabase.from("team_members").insert({
          team_id: teamId,
          user_id: user.id,
          role: "jugador",
          status: "activo",
        });
        if (memErr && !memErr.message.includes("duplicate")) throw memErr;
      }

      toast.success(accept ? t("notifications.accepted") : t("notifications.rejected"));
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-invitations-count"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function respondRequest(invId: string, teamId: string, requesterId: string, accept: boolean) {
    try {
      const { error } = await supabase
        .from("team_invitations")
        .update({
          status: accept ? "aceptada" : "rechazada",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invId);
      if (error) throw error;
      if (accept) {
        const { error: memErr } = await supabase.from("team_members").insert({
          team_id: teamId,
          user_id: requesterId,
          role: "jugador",
          status: "activo",
        });
        if (memErr && !memErr.message.includes("duplicate")) throw memErr;
      }
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
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
    if (error) {
      toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    qc.invalidateQueries({ queryKey: ["shell-unread", user?.id] });
    return !error;
  }

  async function markAllRead() {
    const count = unreadIds.length;
    const ok = await markRead(unreadIds);
    if (ok) toast.success(t("notifications.allRead", { count }));
  }


  async function deleteSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", selected)
      .eq("read", true);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
            const team = Array.isArray(req.teams) ? req.teams[0] : req.teams;
            const requester = Array.isArray(req.requester) ? req.requester[0] : req.requester;
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
                        onClick={() => respondRequest(req.id, req.team_id, req.invited_user_id, true)}
                        className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                      >
                        <Check className="mr-1 size-3.5" />
                        {t("notifications.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondRequest(req.id, req.team_id, req.invited_user_id, false)}
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
            const team = Array.isArray(inv.teams) ? inv.teams[0] : inv.teams;
            const inviter = Array.isArray(inv.inviter) ? inv.inviter[0] : inv.inviter;
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
                        onClick={() => respond(inv.id, inv.team_id, true)}
                        className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                      >
                        <Check className="mr-1 size-3.5" />
                        {t("notifications.accept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respond(inv.id, inv.team_id, false)}
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
