import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Lock } from "lucide-react";

import { nombreParaCompartir, textoAlineacion } from "@/lib/alineacion";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Respuesta = {
  id: string;
  user_id: string;
  status: string;
  padel_pista: number | null;
};

type Miembro = {
  user_id: string;
  profile: { nombre: string; apellidos: string } | null;
};

/**
 * Un partido con la convocatoria cerrada que aún no se ha jugado: solo las
 * pistas, en orden, con su pareja. Ni apuntados, ni convocados, ni
 * estadísticas: eso era para decidir, y ya está decidido.
 *
 * Lo ve todo el equipo. La gestión además copia las parejas como texto y
 * puede reabrir, que vuelve al reparto (normal o PRO) tal como estaba.
 */
export function PistasCerradas({
  event,
  responses,
  members,
  userId,
  isManager,
  onChanged,
}: {
  event: {
    id: string;
    titulo: string;
    rival?: string | null;
    fecha_inicio: string;
    ubicacion?: string | null;
    padel_num_pistas: number | null;
  };
  responses: Respuesta[];
  members: Miembro[];
  userId: string | null;
  isManager: boolean;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const perfil = (uid: string) => members.find((m) => m.user_id === uid)?.profile;
  const nombre = (uid: string) => {
    const p = perfil(uid);
    return p ? `${p.nombre} ${p.apellidos}` : "?";
  };

  const enPista = (n: number) =>
    responses.filter((r) => r.status !== "rechazado" && r.padel_pista === n);
  // Las pistas que dice el partido y, por si acaso, cualquiera que tenga
  // gente aunque luego se bajara el número.
  const numeros = [
    ...new Set([
      ...Array.from({ length: event.padel_num_pistas ?? 0 }, (_, i) => i + 1),
      ...responses.flatMap((r) => (r.padel_pista != null ? [r.padel_pista] : [])),
    ]),
  ].sort((a, b) => a - b);

  const reabrir = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/confirmar/`, { confirmada: false }),
    onSuccess: () => {
      toast.success(t("quimica.reabierta"));
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nombresListos = responses.every(
    (r) => r.padel_pista == null || members.some((m) => m.user_id === r.user_id),
  );
  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        textoAlineacion(
          event,
          numeros.map((n) => ({
            pista: n,
            nombres: enPista(n).map((r) => nombreParaCompartir(perfil(r.user_id))),
          })),
          t,
          i18n.language,
        ),
      );
      toast.success(t("quimica.copiadas"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  return (
    <div data-pistas-cerradas className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" />
          {t("callups.cerrada.etiqueta")}
        </span>
        {isManager && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={copiar}
              disabled={!nombresListos}
              className="text-2xs font-bold uppercase tracking-widest"
            >
              <Copy className="mr-1.5 size-3.5" aria-hidden="true" />
              {t("quimica.copiarTexto")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reabrir.mutate()}
              disabled={reabrir.isPending}
              className="text-2xs font-bold uppercase tracking-widest"
            >
              {t("callups.cerrada.reabrir")}
            </Button>
          </div>
        )}
      </div>

      {numeros.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("callups.cerrada.sinPistas")}</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {numeros.map((n) => {
            const dentro = enPista(n);
            const mia = dentro.some((r) => r.user_id === userId);
            return (
              <li
                key={n}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-[1.5px] bg-card p-3",
                  mia ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <span
                  className={cn(
                    "text-display flex size-9 shrink-0 items-center justify-center rounded-md text-base font-black",
                    mia ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                  aria-label={`${t("callups.pista")} ${n}`}
                >
                  {n}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium break-words">
                  {dentro.length === 0 ? (
                    <span className="text-muted-foreground">{t("quimica.vacia")}</span>
                  ) : (
                    dentro.map((r) => nombre(r.user_id)).join(" · ")
                  )}
                </span>
                {mia && (
                  <span className="shrink-0 text-3xs font-bold uppercase tracking-widest text-primary">
                    {t("callups.cerrada.tuPista")}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
