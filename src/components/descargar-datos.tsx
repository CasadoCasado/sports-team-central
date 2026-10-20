/**
 * Descargar mis datos, desde el perfil.
 *
 * Lo pide la RGPD: una copia de todo lo de la persona en un formato que se
 * pueda leer con un programa. El servidor junta el JSON
 * (`apps/accounts/exportar.py`); aquí solo se guarda como fichero.
 */

import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

function guardar(datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `teamup-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function DescargarDatos() {
  const { t } = useTranslation();
  const descargar = useMutation({
    mutationFn: () => api.get<unknown>("/auth/my-data/"),
    onSuccess: (datos) => {
      guardar(datos);
      toast.success(t("descargarDatos.hecho"));
    },
    onError: (e: Error) => toast.error(e.message || t("common.error")),
  });

  return (
    <section className="surface-card p-6" aria-labelledby="descargar-datos">
      <h2
        id="descargar-datos"
        className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary"
      >
        {t("descargarDatos.titulo")}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">{t("descargarDatos.explica")}</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => descargar.mutate()}
          disabled={descargar.isPending}
        >
          <Download className="mr-1.5 size-4" aria-hidden="true" />
          {descargar.isPending ? t("descargarDatos.preparando") : t("descargarDatos.boton")}
        </Button>
      </div>
    </section>
  );
}
