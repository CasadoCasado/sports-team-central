/**
 * Borrar la propia cuenta, desde el perfil.
 *
 * Lo exigen Apple, Google y la RGPD. Antes de pedir la contraseña se cuenta qué
 * se borra, qué se queda en los equipos y qué pasa con cada equipo del que se
 * es dueño (lo calcula el servidor: `apps/accounts/borrado.py`).
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Plan = {
  equipos_traspasados: { team_id: string; team_nombre: string; nuevo_dueno: string }[];
  equipos_borrados: { team_id: string; team_nombre: string }[];
};

export function BorrarCuenta() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);

  return (
    <section className="surface-card border-danger/30 p-6" aria-labelledby="borrar-cuenta">
      <h2
        id="borrar-cuenta"
        className="text-2xs mb-4 font-bold uppercase tracking-widest text-danger"
      >
        {t("borrarCuenta.titulo")}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t("borrarCuenta.explica")}</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => setAbierto(true)}
        >
          <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
          {t("borrarCuenta.boton")}
        </Button>
      </div>
      {abierto && <Confirmar onClose={() => setAbierto(false)} />}
    </section>
  );
}

function Confirmar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: plan, isLoading } = useQuery({
    queryKey: ["borrar-cuenta-plan"],
    queryFn: () => api.get<Plan>("/auth/delete-account/"),
    staleTime: 0,
  });

  const borrar = useMutation({
    mutationFn: () => api.post("/auth/delete-account/", { password }),
    onSuccess: async () => {
      signOut();
      qc.clear();
      toast.success(t("borrarCuenta.hecho"));
      await navigate({ to: "/auth" });
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.status === 400) setError(t("borrarCuenta.contrasenaMal"));
      else toast.error(e.message || t("common.error"));
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && !borrar.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
            {t("borrarCuenta.confirmarTitulo")}
          </DialogTitle>
          <DialogDescription>{t("borrarCuenta.noHayVuelta")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold">{t("borrarCuenta.seBorra")}</p>
            <p className="text-muted-foreground">{t("borrarCuenta.seBorraLista")}</p>
          </div>
          <div>
            <p className="font-semibold">{t("borrarCuenta.seQueda")}</p>
            <p className="text-muted-foreground">{t("borrarCuenta.seQuedaLista")}</p>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          ) : (
            plan &&
            (plan.equipos_traspasados.length > 0 || plan.equipos_borrados.length > 0) && (
              <div className="rounded-md border border-warn/40 bg-warn/10 p-3">
                <p className="font-semibold">{t("borrarCuenta.tusEquipos")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {plan.equipos_traspasados.map((e) => (
                    <li key={e.team_id}>
                      {t("borrarCuenta.pasaA", { equipo: e.team_nombre, nombre: e.nuevo_dueno })}
                    </li>
                  ))}
                  {plan.equipos_borrados.map((e) => (
                    <li key={e.team_id} className="text-danger">
                      {t("borrarCuenta.seBorraEquipo", { equipo: e.team_nombre })}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          <form
            id="form-borrar-cuenta"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) borrar.mutate();
            }}
          >
            <Label htmlFor="borrar-password">{t("borrarCuenta.contrasena")}</Label>
            <Input
              id="borrar-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "borrar-password-error" : undefined}
              className="mt-1"
            />
            {error && (
              <p
                id="borrar-password-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-danger"
              >
                {error}
              </p>
            )}
          </form>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={borrar.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="form-borrar-cuenta"
            disabled={!password || borrar.isPending || isLoading}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {t("borrarCuenta.confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
