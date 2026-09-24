import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { Quimica } from "@/lib/types";

/**
 * La química de una o varias convocatorias.
 *
 * Qué llega depende de quién pregunta, y lo decide el servidor: un jugador
 * recibe solo la suya; la gestión del equipo, la de todos los apuntados.
 */
export function useQuimicas(eventIds: string[], enabled = true) {
  return useQuery({
    queryKey: ["quimicas", eventIds.join(",")],
    enabled: enabled && eventIds.length > 0,
    queryFn: () => api.get<Quimica[]>("/quimicas/", { event_id__in: eventIds.join(",") }),
  });
}

/** Dar química a alguien, cambiarla, o quitarla con `targetId: null`. */
export function useDarQuimica() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, targetId }: { eventId: string; targetId: string | null }) =>
      targetId
        ? api.post("/quimicas/", { event_id: eventId, target_user_id: targetId })
        : api.delete(`/quimicas/mia/?event_id=${eventId}`),
    onSuccess: (_d, { targetId }) => {
      toast.success(targetId ? t("quimica.dada") : t("quimica.quitada"));
      qc.invalidateQueries({ queryKey: ["quimicas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
