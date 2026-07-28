import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, X, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function TeamJoinRequests({
  teamId,
  compact = false,
}: {
  teamId: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ["team-join-requests", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select(
          "id, team_id, invited_user_id, created_at, mensaje, requester:invited_user_id(nombre, apellidos, email)",
        )
        .eq("team_id", teamId)
        .eq("es_solicitud", true)
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function respond(
    invId: string,
    tId: string,
    requesterId: string,
    accept: boolean,
  ) {
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
          team_id: tId,
          user_id: requesterId,
          role: "jugador",
          status: "activo",
        });
        if (memErr && !memErr.message.includes("duplicate")) throw memErr;
      }
      toast.success(accept ? t("notifications.accepted") : t("notifications.rejected"));
      qc.invalidateQueries({ queryKey: ["team-join-requests"] });
      qc.invalidateQueries({ queryKey: ["team-members-list"] });
      qc.invalidateQueries({ queryKey: ["team-members-count"] });
      qc.invalidateQueries({ queryKey: ["join-requests"] });
      qc.invalidateQueries({ queryKey: ["shell-unread"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const count = requests?.length ?? 0;

  if (compact && count === 0) return null;

  return (
    <div className={compact ? "border-t border-border" : "surface-card"}>
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Inbox className="size-4 text-primary" />
        <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
          {t("members.joinRequests", { defaultValue: "Solicitudes pendientes" })} ({count})
        </h2>
      </div>
      <div className="divide-y divide-border">
        {count === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            {t("members.noJoinRequests", { defaultValue: "No hay solicitudes pendientes." })}
          </div>
        ) : (
          requests!.map((req) => {
            const p = Array.isArray(req.requester) ? req.requester[0] : req.requester;
            return (
              <div key={req.id} className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-border">
                  {(p?.nombre?.[0] ?? "") + (p?.apellidos?.[0] ?? "")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {p?.nombre} {p?.apellidos}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p?.email}</p>
                  {req.mensaje && (
                    <p className="mt-1 text-xs italic text-muted-foreground">"{req.mensaje}"</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => respond(req.id, req.team_id, req.invited_user_id, true)}
                  className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                >
                  <Check className="mr-1 size-3.5" />
                  {t("notifications.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(req.id, req.team_id, req.invited_user_id, false)}
                >
                  <X className="mr-1 size-3.5" />
                  {t("notifications.reject")}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
