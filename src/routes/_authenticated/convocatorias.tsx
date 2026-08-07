import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { ClipboardList, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { eventTypeStyles, type EventType } from "@/lib/events";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type ResponseStatus = Database["public"]["Enums"]["response_status"];

export const Route = createFileRoute("/_authenticated/convocatorias")({
  head: () => ({
    meta: [
      { title: "Convocatorias | TeamUp" },
      { name: "description", content: "Revisa tus convocatorias abiertas, apúntate o cancela tu participación en cada evento." },
      { property: "og:title", content: "Convocatorias | TeamUp" },
      { property: "og:description", content: "Revisa tus convocatorias abiertas, apúntate o cancela tu participación en cada evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyCallups,
});

function MyCallups() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { user } = useSession();
  const qc = useQueryClient();

  // My active team ids
  const { data: teamIds } = useQuery({
    queryKey: ["my-team-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user!.id)
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((r) => r.team_id);
    },
  });

  // All upcoming partido/entrenamiento events for my teams (that require callup)
  const { data: events } = useQuery({
    queryKey: ["upcoming-callup-events", teamIds?.join(",")],
    enabled: !!teamIds && teamIds.length > 0,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, tipo, titulo, fecha_inicio, ubicacion, rival, team_id, requiere_convocatoria")
        .in("team_id", teamIds!)
        .in("tipo", ["partido", "entrenamiento", "torneo"])
        .gte("fecha_inicio", nowIso)
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((e) => e.requiere_convocatoria);
    },
  });

  // My existing responses for these events
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: myResponses } = useQuery({
    queryKey: ["my-responses-map", user?.id, eventIds.join(",")],
    enabled: !!user && eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_responses")
        .select("id, event_id, status, es_convocado")
        .eq("user_id", user!.id)
        .in("event_id", eventIds);
      if (error) throw error;
      const m = new Map<string, { id: string; status: ResponseStatus; es_convocado: boolean }>();
      (data ?? []).forEach((r) =>
        m.set(r.event_id, {
          id: r.id,
          status: r.status as ResponseStatus,
          es_convocado: !!r.es_convocado,
        }),
      );
      return m;
    },
  });

  const signUp = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) return;
      const { error } = await supabase.from("event_responses").insert({
        event_id: eventId,
        user_id: user.id,
        status: "confirmado",
        responded_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("callups.signedUp"));
      qc.invalidateQueries({ queryKey: ["my-responses-map"] });
      qc.invalidateQueries({ queryKey: ["my-callups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = events ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-display text-3xl font-black tracking-tight">{t("nav.convocatorias")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("callups.subtitle")}</p>
      </div>

      {list.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ClipboardList className="size-7" />
          </div>
          <p className="text-sm text-muted-foreground">{t("callups.empty")}</p>
        </div>
      ) : (
        <ul className="surface-card divide-y divide-border overflow-hidden">
          {list.map((e) => {
            const style = eventTypeStyles[e.tipo as EventType];
            const mine = myResponses?.get(e.id);
            return (
              <li
                key={e.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 sm:gap-4 sm:p-4"
              >
                <Link
                  to="/eventos/$id"
                  params={{ id: e.id }}
                  className="flex min-w-0 items-center gap-3 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4"
                >
                  <div className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-md ring-1", style.ring)}>
                    <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                      {format(new Date(e.fecha_inicio), "MMM", { locale })}
                    </div>
                    <div className="text-display text-lg font-black leading-none">
                      {format(new Date(e.fecha_inicio), "d")}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.titulo}</p>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xxs text-muted-foreground">
                      <span>{format(new Date(e.fecha_inicio), "HH:mm")}</span>
                      {e.ubicacion && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{e.ubicacion}</span>
                        </span>
                      )}
                      {e.rival && <span className="truncate">vs {e.rival}</span>}
                    </div>
                  </div>
                </Link>
                {mine ? (
                  <StatusPill status={mine.status} convocado={mine.es_convocado} />
                ) : (
                  <Button
                    onClick={() => signUp.mutate(e.id)}
                    disabled={signUp.isPending}
                    aria-label={`${t("callups.signUp")}: ${e.titulo}`}
                    className="btn-primary-brand min-h-11 shrink-0 px-4 text-2xs font-bold uppercase tracking-widest"
                  >
                    {t("callups.signUp")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

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

function StatusPill({ status, convocado }: { status: ResponseStatus; convocado: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={cn("rounded-full border px-2.5 py-1 text-2xs font-bold uppercase tracking-widest", STATUS_STYLES[status])}>
        {t(`callups.response_${status}`)}
      </span>
      {convocado && (
        <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-widest text-primary">
          ★ {t("callups.calledUp")}
        </span>
      )}
    </div>
  );
}
