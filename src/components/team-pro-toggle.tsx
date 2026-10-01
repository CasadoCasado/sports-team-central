/**
 * La convocatoria PRO del equipo, en su tarjeta de Mi Equipo.
 *
 * PRO va por equipo: lo activa el capitán (o el dueño) y, activo, toda la
 * gestión del equipo ve el tablero PRO en el reparto de pistas. El resto de la
 * gestión ve que está activo, pero no lo cambia. De momento no se cobra. Ver
 * `/api/teams/{id}/pro/` y `components/convocatoria-pro.tsx`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export function TeamProToggle({
  teamId,
  teamName,
  esPro,
  puedeCambiar,
  className,
}: {
  teamId: string;
  teamName: string;
  esPro: boolean;
  /** El capitán o el dueño: `can_manage_roles` en el backend. */
  puedeCambiar: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const cambiar = useMutation({
    mutationFn: (activo: boolean) => api.post(`/teams/${teamId}/pro/`, { activo }),
    onSuccess: (_d, activo) => {
      toast.success(t(activo ? "pro.activado" : "pro.quitado", { team: teamName }));
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["team-sport", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const id = `pro-${teamId}`;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="mt-0.5 shrink-0 rounded-full bg-[#D7F24B] px-2 py-0.5 text-3xs font-extrabold tracking-widest text-[#0B1222]">
        PRO
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-bold">
          {t("pro.titulo")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("pro.explica")}
          {!puedeCambiar && ` ${t("pro.soloCapitan")}`}
        </p>
      </div>
      <Switch
        id={id}
        checked={esPro}
        disabled={!puedeCambiar || cambiar.isPending}
        onCheckedChange={(v) => cambiar.mutate(v)}
        aria-label={esPro ? t("pro.quitar") : t("pro.activar")}
        className="mt-1"
      />
    </div>
  );
}
