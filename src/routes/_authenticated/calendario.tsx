import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, MapPin, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { EventFormDialog } from "@/components/event-form-dialog";
import { eventTypeStyles, type EventType } from "@/lib/events";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: Calendario,
});

function Calendario() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { active, isManager } = useActiveTeam();
  const [month, setMonth] = useState(() => new Date());
  const [view, setView] = useState<"month" | "list">("month");
  const [creating, setCreating] = useState(false);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: events } = useQuery({
    queryKey: ["events", active?.team_id, gridStart.toISOString(), gridEnd.toISOString()],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, tipo, titulo, fecha_inicio, fecha_fin, ubicacion, rival, requiere_convocatoria")
        .eq("team_id", active!.team_id)
        .gte("fecha_inicio", gridStart.toISOString())
        .lte("fecha_inicio", gridEnd.toISOString())
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);
  const eventsByDay = useMemo(() => {
    const m = new Map<string, typeof events>();
    (events ?? []).forEach((e) => {
      const k = format(new Date(e.fecha_inicio), "yyyy-MM-dd");
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    });
    return m;
  }, [events]);

  if (!active) return <EmptyTeamState />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">{t("nav.calendario")}</h1>
          <div className="mt-1"><TeamPicker /></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5 text-[10px] font-bold uppercase tracking-widest">
            <button
              onClick={() => setView("month")}
              className={cn("px-3 py-1.5 rounded-sm", view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {t("events.monthView")}
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("px-3 py-1.5 rounded-sm", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {t("events.listView")}
            </button>
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
      </div>

      {view === "month" ? (
        <div className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="rounded-md border border-border p-2 hover:bg-card"
              aria-label={t("events.prevMonth")}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-display text-lg font-bold uppercase tracking-tight">
              {format(month, "LLLL yyyy", { locale })}
            </div>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="rounded-md border border-border p-2 hover:bg-card"
              aria-label={t("events.nextMonth")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {eachDayOfInterval({ start: gridStart, end: new Date(gridStart.getTime() + 6 * 86400000) }).map((d) => (
              <div key={d.toISOString()} className="px-2 py-2 text-center">
                {format(d, "EEE", { locale })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) ?? [];
              const outside = !isSameMonth(day, month);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-24 border-b border-r border-border p-1.5 last:border-r-0",
                    outside && "bg-card/30",
                  )}
                >
                  <div className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    isToday(day) ? "bg-primary text-primary-foreground" : outside ? "text-muted-foreground/50" : "text-foreground",
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e) => {
                      const style = eventTypeStyles[e.tipo as EventType];
                      return (
                        <Link
                          key={e.id}
                          to="/eventos/$id"
                          params={{ id: e.id }}
                          className={cn(
                            "flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            style.badge,
                          )}
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
                          <span className="truncate">{e.titulo}</span>
                        </Link>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EventList teamId={active.team_id} />
      )}

      {creating && (
        <EventFormDialog open={creating} onOpenChange={setCreating} teamId={active.team_id} />
      )}
    </div>
  );
}

function EventList({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const now = useMemo(() => new Date().toISOString(), []);
  const { data: upcoming } = useQuery({
    queryKey: ["events", teamId, "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, tipo, titulo, fecha_inicio, ubicacion, rival, requiere_convocatoria")
        .eq("team_id", teamId)
        .gte("fecha_inicio", now)
        .order("fecha_inicio", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: past } = useQuery({
    queryKey: ["events", teamId, "past"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, tipo, titulo, fecha_inicio, ubicacion, rival, resultado_local, resultado_visitante")
        .eq("team_id", teamId)
        .lt("fecha_inicio", now)
        .order("fecha_inicio", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title={t("events.upcoming")}>
        {upcoming?.length ? upcoming.map((e) => <EventRow key={e.id} e={e} locale={locale} />) : (
          <p className="p-6 text-sm text-muted-foreground">{t("events.empty")}</p>
        )}
      </Section>
      <Section title={t("events.past")}>
        {past?.length ? past.map((e) => <EventRow key={e.id} e={e} locale={locale} past />) : (
          <p className="p-6 text-sm text-muted-foreground">{t("events.empty")}</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function EventRow({
  e,
  locale,
  past,
}: {
  e: {
    id: string;
    tipo: string;
    titulo: string;
    fecha_inicio: string;
    ubicacion?: string | null;
    rival?: string | null;
    requiere_convocatoria?: boolean;
    resultado_local?: number | null;
    resultado_visitante?: number | null;
  };
  locale: typeof esLocale;
  past?: boolean;
}) {
  const style = eventTypeStyles[e.tipo as EventType];
  const date = new Date(e.fecha_inicio);
  return (
    <Link
      to="/eventos/$id"
      params={{ id: e.id }}
      className="flex items-center gap-4 p-4 transition-colors hover:bg-card"
    >
      <div className={cn("flex size-14 flex-col items-center justify-center rounded-md ring-1", style.ring)}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {format(date, "MMM", { locale })}
        </div>
        <div className="text-display text-xl font-black leading-none">{format(date, "d")}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", style.dot)} />
          <p className="truncate text-sm font-semibold">{e.titulo}</p>
          {e.requiere_convocatoria && !past && (
            <ClipboardList className="size-3.5 text-primary" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{format(date, "HH:mm")}</span>
          {e.ubicacion && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="size-3" /> {e.ubicacion}
            </span>
          )}
          {e.rival && <span className="truncate">vs {e.rival}</span>}
        </div>
      </div>
      {past && (e.resultado_local != null || e.resultado_visitante != null) && (
        <div className="text-display text-lg font-black">
          {e.resultado_local ?? "-"} : {e.resultado_visitante ?? "-"}
        </div>
      )}
    </Link>
  );
}
