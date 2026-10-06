import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";

import { AuthError, confirmPasswordReset } from "@/lib/auth";
import { PantallaAcceso } from "@/components/pantalla-acceso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Elegir la contraseña nueva desde el enlace del correo
 * (`/restablecer?uid=…&token=…`). Al guardarla se entra directamente.
 */
export const Route = createFileRoute("/restablecer")({
  head: () => ({
    meta: [{ title: "Nueva contraseña | TeamUp" }],
  }),
  validateSearch: z.object({ uid: z.string().optional(), token: z.string().optional() }),
  component: Restablecer,
});

function Restablecer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uid, token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [caducado, setCaducado] = useState(!uid || !token);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setErrores([t("auth.passwordMin")]);
    if (password !== repetir) return setErrores([t("auth.passwordsDontMatch")]);
    setGuardando(true);
    try {
      await confirmPasswordReset(uid!, token!, password);
      toast.success(t("restablecer.hecho"));
      await navigate({ to: "/inicio", replace: true });
    } catch (err) {
      const cuerpo =
        err instanceof AuthError ? (err.body as Record<string, string[]> | null) : null;
      if (cuerpo?.token) setCaducado(true);
      else if (cuerpo?.password) setErrores(cuerpo.password);
      else setErrores([t("common.error")]);
    } finally {
      setGuardando(false);
    }
  }

  if (caducado) {
    return (
      <PantallaAcceso titulo={t("restablecer.titulo")}>
        <div role="alert" className="space-y-4">
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            {t("restablecer.caducado")}
          </p>
          <Button asChild className="w-full">
            <Link to="/recuperar">{t("restablecer.pedirOtro")}</Link>
          </Button>
        </div>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo={t("restablecer.titulo")}>
      <form onSubmit={guardar} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground">{t("restablecer.explica")}</p>
        <div>
          <Label htmlFor="password">{t("restablecer.nueva")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrores([]);
            }}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="repetir">{t("auth.confirmPassword")}</Label>
          <Input
            id="repetir"
            type="password"
            value={repetir}
            onChange={(e) => {
              setRepetir(e.target.value);
              setErrores([]);
            }}
            autoComplete="new-password"
          />
        </div>
        {errores.length > 0 && (
          <ul role="alert" className="space-y-1 text-xs text-destructive">
            {errores.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <Button
          type="submit"
          disabled={guardando}
          className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
        >
          {t("restablecer.guardar")}
        </Button>
      </form>
    </PantallaAcceso>
  );
}
