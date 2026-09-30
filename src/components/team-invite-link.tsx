/**
 * El enlace para unirse al equipo, listo para mandarlo por WhatsApp.
 *
 * Quien lo abre se crea la cuenta y entra directamente en el equipo, sin
 * solicitud que aceptar: el enlace ya es la invitación. Por eso solo lo ven
 * los gestores, y por eso se puede cambiar —el viejo deja de valer— si ha
 * llegado a quien no debía. Ver `/api/teams/{id}/enlace/` y la ruta
 * `/unirse/$codigo`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/confirm-dialog";

export function joinUrl(codigo: string) {
  return `${window.location.origin}/unirse/${codigo}`;
}

export function TeamInviteLink({
  teamId,
  teamName,
  canRenew = false,
  className,
}: {
  teamId: string;
  teamName: string;
  /** Cambiar el enlace es cosa de la pantalla de Miembros, no de la tarjeta. */
  canRenew?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const queryKey = ["team-join-link", teamId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.get<{ codigo: string }>(`/teams/${teamId}/enlace/`),
    staleTime: Infinity,
  });
  const codigo = data?.codigo;

  const renew = useMutation({
    mutationFn: () => api.post<{ codigo: string }>(`/teams/${teamId}/enlace/`),
    onSuccess: (res) => {
      qc.setQueryData(queryKey, res);
      toast.success(t("joinLink.renewed"));
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  function sendWhatsApp() {
    if (!codigo) return;
    const text = t("joinLink.message", { team: teamName, url: joinUrl(codigo) });
    // wa.me abre la app en el móvil y WhatsApp Web en el ordenador, y deja
    // elegir el chat o el grupo al que va.
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function copy() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(joinUrl(codigo));
      toast.success(t("joinLink.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function askRenew() {
    const ok = await confirmar({
      title: t("joinLink.renewTitle"),
      description: t("joinLink.renewBody"),
      confirmLabel: t("joinLink.renewAction"),
      icon: RefreshCw,
    });
    if (ok) renew.mutate();
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-bold">{t("joinLink.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("joinLink.hint", { team: teamName })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendWhatsApp}
          disabled={!codigo}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#25D366] px-5 text-2xs font-bold uppercase tracking-[0.12em] text-[#073b1d] transition-opacity hover:opacity-90 disabled:opacity-60 sm:min-h-10 sm:w-auto"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {t("joinLink.whatsapp")}
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={!codigo}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-2xs font-bold uppercase tracking-[0.12em] transition-colors hover:bg-muted disabled:opacity-60 sm:min-h-10 sm:flex-none"
        >
          <Copy className="size-4" aria-hidden="true" />
          {t("joinLink.copy")}
        </button>
        {canRenew && (
          <button
            type="button"
            onClick={askRenew}
            disabled={!codigo || renew.isPending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60 sm:min-h-10"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {t("joinLink.renew")}
          </button>
        )}
      </div>
    </div>
  );
}
