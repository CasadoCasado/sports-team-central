import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  component: Notificaciones,
});

function Notificaciones() {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: invitations } = useQuery({
    queryKey: ["invitations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select(
          "id, team_id, role, status, mensaje, created_at, teams:team_id(nombre, logo_url), inviter:invited_by(nombre, apellidos)",
        )
        .eq("invited_user_id", user!.id)
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-display text-3xl font-black tracking-tight">{t("notifications.title")}</h1>

      {(invitations?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary">
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
                        className="bg-primary text-primary-foreground uppercase text-[10px] font-bold tracking-widest hover:opacity-90"
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

      {(notifications?.length ?? 0) > 0 ? (
        <div className="surface-card divide-y divide-border">
          {notifications!.map((n) => (
            <div key={n.id} className="flex items-start gap-4 p-4">
              <div className="mt-1 flex size-8 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border">
                <Bell className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{n.titulo}</p>
                {n.cuerpo && <p className="mt-0.5 text-xs text-muted-foreground">{n.cuerpo}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
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
