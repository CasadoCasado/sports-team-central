import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Check, Dumbbell, MapPin, Plus, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { EventResponse, TeamEvent } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { EventFormDialog } from "@/components/event-form-dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/entrenamientos")({
  head: () => ({
    meta: [
      { title: "Entrenamientos | TeamUp" },
      { name: "description", content: "Consulta los entrenamientos programados y apúntate a las sesiones de tu equipo." },
      { property: "og:title", content: "Entrenamientos | TeamUp" },
      { property: "og:description", content: "Consulta los entrenamientos programados y apúntate a las sesiones de tu equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trainings,
});

function Trainings() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { user } = useSession();
  const { active, isManager } = useActiveTeam();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const now = useMemo(() => new Date().toISOString(), []);

  const { data } = useQuery({
    queryKey: ["events", active?.team_id, "entrenamiento"],
    enabled: !!active,
    queryFn: () =>
      api.get<TeamEvent[]>("/events/", {
        team_id: active!.team_id,
        tipo: "entrenamiento",
        order: "fecha_inicio",
      }),
  });

  const eventIds = (data ?? []).map((e) => e.id);
  const { data: responses } = useQuery({
    queryKey: ["training-responses", active?.team_id, eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: () =>
      api.get<EventResponse[]>("/event-responses/", { event_id__in: eventIds }),
  });

  const countsByEvent = new Map<string, number>();
  const myRespByEvent = new Map<string, string>();
  (responses ?? []).forEach((r) => {
    countsByEvent.set(r.event_id, (countsByEvent.get(r.event_id) ?? 0) + 1);
    if (r.user_id === user?.id) myRespByEvent.set(r.event_id, r.id);
  });

  const signUp = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) return;
      await api.post("/event-responses/respond/", {
        event_id: eventId,
        status: "confirmado",
      });
    },
    onSuccess: () => {
      toast.success(t("callups.signedUp"));
      qc.invalidateQueries({ queryKey: ["training-responses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: (respId: string) => api.delete(`/event-responses/${respId}/`),
    onSuccess: () => {
      toast.success(t("callups.withdrawn"));
      qc.invalidateQueries({ queryKey: ["training-responses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (!active) return <EmptyTeamState />;

  const upcoming = (data ?? []).filter((e) => e.fecha_inicio >= now);
  const past = (data ?? []).filter((e) => e.fecha_inicio < now).reverse();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
            {t("nav.entrenamientos")}
          </h1>
          <div className="mt-1"><TeamPicker /></div>
        </div>
        {isManager && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            <Plus className="mr-1 size-4" />
            {t("events.create")}
          </Button>
        )}
      </div>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("events.upcoming")}
        </div>
        {upcoming.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">{t("events.empty")}</p>
        )}
        <div className="divide-y divide-border">
          {upcoming.map((e) => {
            const myRespId = myRespByEvent.get(e.id);
            const count = countsByEvent.get(e.id) ?? 0;
            return (
              <div key={e.id} className="flex items-center gap-4 p-4 hover:bg-card">
                <Link
                  to="/eventos/$id"
                  params={{ id: e.id }}
                  className="flex flex-1 min-w-0 items-center gap-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-md bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/30">
                    <Dumbbell className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.titulo}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xxs text-muted-foreground">
                      <span>{format(new Date(e.fecha_inicio), "PPP HH:mm", { locale })}</span>
                      {e.ubicacion && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="size-3" /> {e.ubicacion}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" /> {count}
                      </span>
                    </div>
                  </div>
                </Link>
                {myRespId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => withdraw.mutate(myRespId)}
                    className="uppercase text-2xs font-bold tracking-widest"
                  >
                    <Check className="mr-1 size-3" /> {t("callups.withdraw")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => signUp.mutate(e.id)}
                    className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
                  >
                    {t("callups.signUp")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {past.length > 0 && (
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("events.past")}
          </div>
          <div className="divide-y divide-border">
            {past.map((e) => (
              <Link
                key={e.id}
                to="/eventos/$id"
                params={{ id: e.id }}
                className="flex items-center gap-4 p-4 opacity-70 hover:bg-card hover:opacity-100"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-card ring-1 ring-border">
                  <Dumbbell className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{e.titulo}</p>
                  <p className="text-xxs text-muted-foreground">
                    {format(new Date(e.fecha_inicio), "PPP", { locale })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <EventFormDialog
          open={creating}
          onOpenChange={setCreating}
          teamId={active.team_id}
          initial={{ tipo: "entrenamiento" }}
        />
      )}
    </div>
  );
}
