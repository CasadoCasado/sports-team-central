import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { AuthError, hasSession, verifyEmail } from "@/lib/auth";
import { PantallaAcceso } from "@/components/pantalla-acceso";
import { Button } from "@/components/ui/button";

/**
 * El enlace del correo de verificación (`/verificar-email?token=…`). Se
 * comprueba nada más abrirlo; no hace falta haber entrado.
 */
export const Route = createFileRoute("/verificar-email")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Confirmar email | Teamsup" }],
  }),
  validateSearch: z.object({ token: z.string().optional() }),
  component: VerificarEmail,
});

type Estado = "comprobando" | "hecho" | "caducado" | "no-vale";

function VerificarEmail() {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const [estado, setEstado] = useState<Estado>(token ? "comprobando" : "no-vale");
  // Una sola vez, aunque React monte el efecto dos veces en desarrollo.
  const pedido = useRef(false);

  useEffect(() => {
    if (!token || pedido.current) return;
    pedido.current = true;
    verifyEmail(token)
      .then(() => setEstado("hecho"))
      .catch((err) => {
        const cuerpo = err instanceof AuthError ? (err.body as { codigo?: string } | null) : null;
        setEstado(cuerpo?.codigo === "caducado" ? "caducado" : "no-vale");
      });
  }, [token]);

  const conSesion = hasSession();
  const mensaje = {
    comprobando: t("verificarEmail.comprobando"),
    hecho: t("verificarEmail.hecho"),
    caducado: t("verificarEmail.caducado"),
    "no-vale": t("verificarEmail.noVale"),
  }[estado];

  return (
    <PantallaAcceso titulo={t("verificarEmail.titulo")}>
      <div className="space-y-4" role={estado === "comprobando" ? undefined : "status"}>
        <p
          className={
            estado === "hecho" || estado === "comprobando"
              ? "text-sm text-muted-foreground"
              : "rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
          }
        >
          {mensaje}
        </p>
        {estado !== "comprobando" && (
          <Button asChild className="w-full">
            <Link to={conSesion ? "/perfil" : "/auth"}>
              {conSesion ? t("verificarEmail.irAlPerfil") : t("verificarEmail.entrar")}
            </Link>
          </Button>
        )}
      </div>
    </PantallaAcceso>
  );
}
