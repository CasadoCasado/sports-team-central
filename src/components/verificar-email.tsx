/**
 * Confirmar el email: la franja que lo pide y los avisos por correo del perfil.
 *
 * Sin confirmar se usa la app igual; lo que no llega son los avisos por
 * correo (`apps/notifications/correo.py`). Sin correo en el servidor —la demo—
 * `pedir_verificar_email` viene a `false` y no se pide nada.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Mail, X } from "lucide-react";

import { api } from "@/lib/api";
import { invalidateUser } from "@/lib/auth";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

function useReenviar() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => api.post<{ enviado: boolean }>("/auth/verify-email/resend/"),
    onSuccess: ({ enviado }) =>
      enviado ? toast.success(t("verificarEmail.reenviado")) : toast(t("verificarEmail.esperar")),
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });
}

export function FranjaVerificarEmail() {
  const { t } = useTranslation();
  const { user } = useSession();
  const [cerrada, setCerrada] = useState(false);
  const reenviar = useReenviar();

  if (!user?.pedir_verificar_email || cerrada) return null;
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm"
    >
      <Mail className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
      {/* El botón va al lado si cabe y debajo en el móvil. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-[min(100%,18rem)] flex-1 break-words">
          {t("verificarEmail.franja", { email: user.email })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={() => reenviar.mutate()}
          disabled={reenviar.isPending}
        >
          {t("verificarEmail.reenviar")}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setCerrada(true)}
        className="-mr-1 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={t("common.close")}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AvisosPorCorreo() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const reenviar = useReenviar();

  const cambiar = useMutation({
    mutationFn: (valor: boolean) => api.patch("/profiles/me/", { avisos_por_correo: valor }),
    onSuccess: (_d, valor) => {
      toast.success(valor ? t("avisosCorreo.activados") : t("avisosCorreo.desactivados"));
      void qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      invalidateUser();
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  if (!profile) return null;
  return (
    <section className="surface-card p-6" aria-labelledby="avisos-correo">
      <h2
        id="avisos-correo"
        className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary"
      >
        {t("avisosCorreo.titulo")}
      </h2>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="avisos-correo-switch" className="max-w-prose text-sm text-muted-foreground">
          {t("avisosCorreo.explica")}
        </label>
        <Switch
          id="avisos-correo-switch"
          checked={profile.avisos_por_correo}
          disabled={cambiar.isPending}
          onCheckedChange={(v) => cambiar.mutate(v)}
        />
      </div>
      {user?.pedir_verificar_email && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">
          <p className="min-w-[min(100%,16rem)] flex-1 break-words">
            {t("avisosCorreo.sinConfirmar", { email: user.email })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => reenviar.mutate()}
            disabled={reenviar.isPending}
          >
            {t("verificarEmail.reenviar")}
          </Button>
        </div>
      )}
    </section>
  );
}
