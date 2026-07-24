import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  ClipboardList,
  CalendarDays,
  Clock,
} from "lucide-react";
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

type EventRow = {
  id: string;
  tipo: EventType;
  titulo: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  ubicacion?: string | null;
  rival?: string | null;
  requiere_convocatoria?: boolean;
  resultado_local?: number | null;
  resultado_visitante?: number | null;

};

type View = "month" | "week" | "list";

/** Build a map of dayKey -> events, expanding multi-day events across every day they span. */
function buildDayMap(events: EventRow[], gridStart: Date, gridEnd: Date) {
  const m = new Map<string, EventRow[]>();
  events.forEach((e) => {
    const start = startOfDay(new Date(e.fecha_inicio));
    const end = e.fecha_fin ? startOfDay(new Date(e.fecha_fin)) : start;
    const from = start < gridStart ? gridStart : start;
    const to = end > gridEnd ? gridEnd : end;
    if (to < from) return;
    eachDayOfInterval({ start: from, end: to }).forEach((d) => {
      const k = format(d, "yyyy-MM-dd");
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    });
  });
  return m;
}


function Calendario() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const { active, isManager } = useActiveTeam();
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<View>("month");
  const [creating, setCreating] = useState(false);

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = endOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end };
    }
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      return { start, end };
    }
    // list: 90-day window centered on today
    const today = startOfDay(new Date());
    return { start: today, end: addDays(today, 90) };
  }, [cursor, view]);

  const { data: events } = useQuery({
    queryKey: [
      "events",
      active?.team_id,
      view,
      range.start.toISOString(),
      range.end.toISOString(),
    ],
    enabled: !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, tipo, titulo, fecha_inicio, fecha_fin, ubicacion, rival, requiere_convocatoria",
        )
        .eq("team_id", active!.team_id)
        .lte("fecha_inicio", range.end.toISOString())
        .or(
          `fecha_fin.gte.${range.start.toISOString()},and(fecha_fin.is.null,fecha_inicio.gte.${range.start.toISOString()})`,
        )
        .order("fecha_inicio", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },

  });

  if (!active) return <EmptyTeamState />;

  const headerLabel =
    view === "week"
      ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d LLL", { locale })} — ${format(
          endOfWeek(cursor, { weekStartsOn: 1 }),
          "d LLL yyyy",
          { locale },
        )}`
      : view === "month"
        ? format(cursor, "LLLL yyyy", { locale })
        : t("nav.calendario");

  function shift(direction: 1 | -1) {
    setCursor((c) =>
      view === "week"
        ? direction > 0
          ? addWeeks(c, 1)
          : subWeeks(c, 1)
        : direction > 0
          ? addMonths(c, 1)
          : subMonths(c, 1),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {t("nav.calendario")}
          </div>
          <h1 className="text-display mt-1 text-3xl font-black tracking-tight md:text-4xl">
            {headerLabel}
          </h1>
          <div className="mt-2">
            <TeamPicker />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher view={view} setView={setView} t={t} />
          {isManager && (
            <Button
              onClick={() => setCreating(true)}
              className="btn-primary-rose uppercase tracking-widest font-bold"
            >
              <Plus className="mr-1 size-4" />
              {t("events.create")}
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar: nav + today + legend */}
      {view !== "list" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => shift(-1)}
              className="rounded-md border border-border bg-card p-2 transition-colors hover:bg-accent"
              aria-label={view === "week" ? t("events.prevWeek") : t("events.prevMonth")}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-accent"
            >
              {t("events.todayBtn")}
            </button>
            <button
              onClick={() => shift(1)}
              className="rounded-md border border-border bg-card p-2 transition-colors hover:bg-accent"
              aria-label={view === "week" ? t("events.nextWeek") : t("events.nextMonth")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Legend t={t} />
        </div>
      )}

      {view === "month" && (
        <MonthGrid
          cursor={cursor}
          locale={locale}
          events={events ?? []}
          t={t}
        />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} locale={locale} events={events ?? []} t={t} />
      )}
      {view === "list" && <EventList teamId={active.team_id} />}

      {creating && (
        <EventFormDialog
          open={creating}
          onOpenChange={setCreating}
          teamId={active.team_id}
        />
      )}
    </div>
  );
}

function ViewSwitcher({
  view,
  setView,
  t,
}: {
  view: View;
  setView: (v: View) => void;
  t: (k: string) => string;
}) {
  const items: { key: View; label: string }[] = [
    { key: "month", label: t("events.monthView") },
    { key: "week", label: t("events.weekView") },
    { key: "list", label: t("events.listView") },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[10px] font-bold uppercase tracking-widest">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setView(it.key)}
          className={cn(
            "rounded-sm px-3 py-1.5 transition-colors",
            view === it.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ t }: { t: (k: string) => string }) {
  const items: EventType[] = ["entrenamiento", "partido", "torneo", "reunion", "otro"];
  return (
    <div className="hidden items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:flex">
      <span>{t("events.legend")}</span>
      {items.map((k) => {
        const s = eventTypeStyles[k];
        return (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.dot)} />
            {t(`events.types.${k}`)}
          </span>
        );
      })}
    </div>
  );
}

/* ---------------- Month ---------------- */

function MonthGrid({
  cursor,
  locale,
  events,
  t,
}: {
  cursor: Date;
  locale: typeof esLocale;
  events: EventRow[];
  t: (k: string) => string;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );
  const byDay = useMemo(
    () => buildDayMap(events, gridStart, gridEnd),
    [events, gridStart, gridEnd],
  );

  const weekdays = eachDayOfInterval({
    start: gridStart,
    end: addDays(gridStart, 6),
  });

  return (
    <div className="surface-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-card/60 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {weekdays.map((d) => (
          <div key={d.toISOString()} className="px-2 py-2 text-center">
            {format(d, "EEE", { locale })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const outside = !isSameMonth(day, cursor);
          const today = isToday(day);
          return (
            <div
              key={key}
              className={cn(
                "min-h-28 border-b border-r border-border p-1.5 transition-colors",
                outside && "bg-card/40",
                today && "bg-[color-mix(in_oklab,var(--color-primary)_5%,transparent)]",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    today
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : outside
                        ? "text-muted-foreground/50"
                        : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </div>
                {dayEvents.length > 0 && !today && (
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((e) => {
                  const style = eventTypeStyles[e.tipo];
                  return (
                    <Link
                      key={e.id}
                      to="/eventos/$id"
                      params={{ id: e.id }}
                      className={cn(
                        "group flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-all hover:translate-x-0.5",
                        style.badge,
                      )}
                    >
                      <span
                        className={cn("size-1.5 shrink-0 rounded-full", style.dot)}
                      />
                      <span className="tabular-nums opacity-70">
                        {format(new Date(e.fecha_inicio), "HH:mm")}
                      </span>
                      <span className="truncate">{e.titulo}</span>
                    </Link>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] font-medium text-muted-foreground">
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Week ---------------- */

function WeekView({
  cursor,
  locale,
  events,
  t,
}: {
  cursor: Date;
  locale: typeof esLocale;
  events: EventRow[];
  t: (k: string) => string;
}) {
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end: addDays(start, 6) });

  const byDay = useMemo(() => {
    const m = new Map<string, EventRow[]>();
    events.forEach((e) => {
      const k = format(new Date(e.fecha_inicio), "yyyy-MM-dd");
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    });
    return m;
  }, [events]);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const list = byDay.get(key) ?? [];
        const today = isToday(d);
        return (
          <div
            key={key}
            className={cn(
              "surface-card flex flex-col p-3 hover-lift",
              today && "ring-2 ring-primary/50",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {format(d, "EEE", { locale })}
                </div>
                <div
                  className={cn(
                    "text-display text-2xl font-black leading-none",
                    today ? "text-primary" : "text-foreground",
                  )}
                >
                  {format(d, "d")}
                </div>
              </div>
              {list.length > 0 && (
                <span className="pill bg-muted text-muted-foreground">
                  {list.length}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {list.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("events.noEventsDay")}
                </p>
              ) : (
                list.map((e) => <WeekEventCard key={e.id} e={e} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekEventCard({ e }: { e: EventRow }) {
  const style = eventTypeStyles[e.tipo];
  const start = new Date(e.fecha_inicio);
  const end = e.fecha_fin ? new Date(e.fecha_fin) : null;
  return (
    <Link
      to="/eventos/$id"
      params={{ id: e.id }}
      className={cn(
        "block rounded-md border border-border bg-card p-2 pl-2.5 transition-all hover:shadow-md",
        style.band,
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Clock className="size-3" />
        <span className="tabular-nums">{format(start, "HH:mm")}</span>
        {end && (
          <span className="tabular-nums opacity-70">— {format(end, "HH:mm")}</span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", style.dot)} />
        <p className="truncate text-sm font-semibold">{e.titulo}</p>
      </div>
      {e.ubicacion && (
        <div className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="size-3" />
          <span className="truncate">{e.ubicacion}</span>
        </div>
      )}
      {e.rival && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          vs {e.rival}
        </div>
      )}
    </Link>
  );
}

/* ---------------- List ---------------- */

function EventList({ teamId }: { teamId: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const now = useMemo(() => new Date().toISOString(), []);
  const { data: upcoming } = useQuery({
    queryKey: ["events", teamId, "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, tipo, titulo, fecha_inicio, fecha_fin, ubicacion, rival, requiere_convocatoria",
        )
        .eq("team_id", teamId)
        .gte("fecha_inicio", now)
        .order("fecha_inicio", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });
  const { data: past } = useQuery({
    queryKey: ["events", teamId, "past"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, tipo, titulo, fecha_inicio, fecha_fin, ubicacion, rival, resultado_local, resultado_visitante",
        )
        .eq("team_id", teamId)
        .lt("fecha_inicio", now)
        .order("fecha_inicio", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title={t("events.upcoming")}>
        {upcoming?.length ? (
          upcoming.map((e) => <EventRowItem key={e.id} e={e} locale={locale} />)
        ) : (
          <p className="p-6 text-sm text-muted-foreground">{t("events.empty")}</p>
        )}
      </Section>
      <Section title={t("events.past")}>
        {past?.length ? (
          past.map((e) => (
            <EventRowItem key={e.id} e={e} locale={locale} past />
          ))
        ) : (
          <p className="p-6 text-sm text-muted-foreground">{t("events.empty")}</p>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function EventRowItem({
  e,
  locale,
  past,
}: {
  e: EventRow;
  locale: typeof esLocale;
  past?: boolean;
}) {
  const style = eventTypeStyles[e.tipo];
  const date = new Date(e.fecha_inicio);
  const end = e.fecha_fin ? new Date(e.fecha_fin) : null;
  const duration = end ? differenceInMinutes(end, date) : null;
  return (
    <Link
      to="/eventos/$id"
      params={{ id: e.id }}
      className={cn(
        "flex items-center gap-4 p-4 transition-colors hover:bg-accent/60",
        style.band,
      )}
    >
      <div
        className={cn(
          "flex size-14 shrink-0 flex-col items-center justify-center rounded-md bg-card ring-1",
          style.ring,
        )}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {format(date, "MMM", { locale })}
        </div>
        <div className="text-display text-xl font-black leading-none">
          {format(date, "d")}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "pill border",
              style.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", style.dot)} />
            {(
              {
                entrenamiento: "Entreno",
                partido: "Match",
                reunion: "Meeting",
                otro: "Other",
              } as Record<EventType, string>
            )[e.tipo]}
          </span>
          <p className="truncate text-sm font-semibold">{e.titulo}</p>
          {e.requiere_convocatoria && !past && (
            <ClipboardList className="size-3.5 text-primary" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3" />
            {format(date, "HH:mm")}
            {duration && duration > 0 ? ` · ${Math.round(duration / 60)}h` : ""}
          </span>
          {e.ubicacion && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="size-3" /> {e.ubicacion}
            </span>
          )}
          {e.rival && <span className="truncate">vs {e.rival}</span>}
        </div>
      </div>
      {past && (e.resultado_local != null || e.resultado_visitante != null) && (
        <div
          className={cn(
            "text-display shrink-0 rounded-md px-3 py-1.5 text-lg font-black tabular-nums",
            style.soft,
          )}
        >
          {e.resultado_local ?? "-"} : {e.resultado_visitante ?? "-"}
        </div>
      )}
    </Link>
  );
}
