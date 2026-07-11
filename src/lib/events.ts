import type { Database } from "@/integrations/supabase/types";

export type EventType = Database["public"]["Enums"]["event_type"];

export const eventTypeStyles: Record<EventType, { dot: string; badge: string; ring: string }> = {
  entrenamiento: {
    dot: "bg-sky-400",
    badge: "bg-sky-400/10 text-sky-300 border-sky-400/30",
    ring: "ring-sky-400/40",
  },
  partido: {
    dot: "bg-primary",
    badge: "bg-primary/15 text-primary border-primary/40",
    ring: "ring-primary/40",
  },
  reunion: {
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    ring: "ring-amber-400/40",
  },
  otro: {
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
    ring: "ring-border",
  },
};

export function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
