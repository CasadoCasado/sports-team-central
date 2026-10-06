import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { MailCheck } from "lucide-react";

import { requestPasswordReset } from "@/lib/auth";
import { PantallaAcceso } from "@/components/pantalla-acceso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Pedir el enlace para recuperar la contraseña. El servidor responde igual
 * exista o no la cuenta, así que aquí siempre se dice lo mismo.
 */
export const Route = createFileRoute("/recuperar")({
  head: () => ({
    meta: [
      { title: "Recuperar la contraseña | TeamUp" },
      { name: "description", content: "Te mandamos un enlace para elegir una contraseña nueva." },
    ],
  }),
  validateSearch: z.object({ email: z.string().optional() }),
  component: Recuperar,
});

function Recuperar() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!z.string().email().safeParse(email.trim()).success) {
      setError(t("recuperar.emailMal"));
      return;
    }
    setEnviando(true);
    try {
      await requestPasswordReset(email.trim());
      setEnviado(true);
    } catch {
      setError(t("recuperar.errorEnvio"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PantallaAcceso titulo={t("recuperar.titulo")}>
      {enviado ? (
        <div role="status" className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-ok/30 bg-ok/10 p-4 text-sm">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
            <p>{t("recuperar.enviado", { email: email.trim() })}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t("recuperar.noLlega")}</p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">{t("recuperar.volverEntrar")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">{t("recuperar.explica")}</p>
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoComplete="email"
              maxLength={255}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "email-error" : undefined}
            />
            {error && (
              <p id="email-error" role="alert" className="mt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            {t("recuperar.enviar")}
          </Button>
          <p className="text-center text-sm">
            <Link
              to="/auth"
              className="inline-flex min-h-11 items-center font-bold text-primary hover:underline"
            >
              {t("recuperar.volverEntrar")}
            </Link>
          </p>
        </form>
      )}
    </PantallaAcceso>
  );
}
