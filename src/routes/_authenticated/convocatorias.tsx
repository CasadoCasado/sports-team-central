import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { ClipboardList, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { eventTypeStyles, type EventType } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ResponseStatus = Database["public"]["Enums"]["response_status"];

export const Route = createFileRoute("/_authenticated/convocatorias")({
  component: MyCallups,
});

function MyCallups() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { user } = useSession();

  const { data } = useQuery({
    queryKey: ["my-callups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("event_responses")
        .select(
          "id, status, notas, events:event_id(id, tipo, titulo, fecha_inicio, ubicacion, rival, convocatoria_cierra_en)",
        )
        .eq("user_id", user!.id)
        .order("responded_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({
          id: r.id,
          status: r.status as ResponseStatus,
          event: Array.isArray(r.events) ? r.events[0] : r.events,
        }))
        .filter((r) => r.event && r.event.fecha_inicio >= nowIso)
        .sort((a, b) => a.event!.fecha_inicio.localeCompare(b.event!.fecha_inicio));
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-display text-3xl font-black tracking-tight">{t("nav.convocatorias")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("callups.title")}</p>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <div className="surface-card flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ClipboardList className="size-7" />
          </div>
          <p className="text-sm text-muted-foreground">{t("callups.empty")}</p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border overflow-hidden">
          {data!.map((r) => {
            const e = r.event!;
            const style = eventTypeStyles[e.tipo as EventType];
            return (
              <Link
                key={r.id}
                to="/eventos/$id"
                params={{ id: e.id }}
                className="flex items-center gap-4 p-4 hover:bg-card"
              >
                <div className={cn("flex size-12 flex-col items-center justify-center rounded-md ring-1", style.ring)}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {format(new Date(e.fecha_inicio), "MMM", { locale })}
                  </div>
                  <div className="text-display text-lg font-black leading-none">
                    {format(new Date(e.fecha_inicio), "d")}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.titulo}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{format(new Date(e.fecha_inicio), "HH:mm")}</span>
                    {e.ubicacion && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="size-3" /> {e.ubicacion}
                      </span>
                    )}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<ResponseStatus, string> = {
  confirmado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  rechazado: "bg-red-500/15 text-red-300 border-red-500/40",
  duda: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  convocado: "bg-muted text-muted-foreground border-border",
};

function StatusPill({ status }: { status: ResponseStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", STATUS_STYLES[status])}>
      {t(`callups.response_${status}`)}
    </span>
  );
}
