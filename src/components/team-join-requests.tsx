import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, X, Inbox } from "lucide-react";
import { api } from "@/lib/api";
import type { TeamInvitation } from "@/lib/types";
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
    queryFn: () =>
      api.get<TeamInvitation[]>("/team-invitations/", {
        team_id: teamId,
        es_solicitud: true,
        status: "pendiente",
      }),
  });

  // Aceptar marcaba la solicitud y luego insertaba la pertenencia, en dos
  // escrituras que podían quedarse a medias. Ahora es una sola acción.
  async function respond(invId: string, accept: boolean) {
    try {
      await api.post(`/team-invitations/${invId}/${accept ? "accept" : "reject"}/`);
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
            const p = req.invited_user_profile;
            return (
              /* Quién pide entrar arriba, los dos botones debajo. En una sola
                 fila el nombre se quedaba en nada —los botones no se encogen y
                 se llevaban el ancho entero—, que es justo el dato que hace
                 falta para decidir. Desde `sm` ya caben en la misma línea. */
              <div key={req.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-border">
                    {(p?.nombre?.[0] ?? "") + (p?.apellidos?.[0] ?? "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold break-words">
                      {p?.nombre} {p?.apellidos}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={p?.email ?? undefined}>
                      {p?.email}
                    </p>
                    {req.mensaje && (
                      <p className="mt-1 text-xs italic text-muted-foreground">"{req.mensaje}"</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => respond(req.id, true)}
                    className="flex-1 bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90 sm:flex-none"
                  >
                    <Check className="mr-1 size-3.5" />
                    {t("notifications.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={() => respond(req.id, false)}
                  >
                    <X className="mr-1 size-3.5" />
                    {t("notifications.reject")}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
