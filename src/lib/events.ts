import type { EventType } from "@/lib/types";

export type { EventType };

/**
 * Semantic type styling driven by CSS tokens defined in styles.css.
 * `color` is the raw token used inline for chips/dots.
 * Tailwind classes use arbitrary values that reference the same tokens
 * so light/dark themes and future re-tinting stay in one place.
 */
export const eventTypeStyles: Record<
  EventType,
  {
    token: string;
    dot: string;
    badge: string;
    band: string;
    ring: string;
    soft: string;
  }
> = {
  entrenamiento: {
    token: "var(--color-evt-entreno)",
    dot: "bg-[var(--color-evt-entreno)]",
    badge:
      "bg-[color-mix(in_oklab,var(--color-evt-entreno)_14%,transparent)] text-[var(--color-evt-entreno)] border-[color-mix(in_oklab,var(--color-evt-entreno)_45%,transparent)]",
    band: "event-band-entreno",
    ring: "ring-[color-mix(in_oklab,var(--color-evt-entreno)_45%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--color-evt-entreno)_10%,transparent)]",
  },
  partido: {
    token: "var(--color-evt-partido)",
    dot: "bg-[var(--color-evt-partido)]",
    badge:
      "bg-[color-mix(in_oklab,var(--color-evt-partido)_15%,transparent)] text-[var(--color-evt-partido)] border-[color-mix(in_oklab,var(--color-evt-partido)_50%,transparent)]",
    band: "event-band-partido",
    ring: "ring-[color-mix(in_oklab,var(--color-evt-partido)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--color-evt-partido)_10%,transparent)]",
  },
  torneo: {
    token: "var(--color-evt-torneo)",
    dot: "bg-[var(--color-evt-torneo)]",
    badge:
      "bg-[color-mix(in_oklab,var(--color-evt-torneo)_15%,transparent)] text-[var(--color-evt-torneo)] border-[color-mix(in_oklab,var(--color-evt-torneo)_50%,transparent)]",
    band: "event-band-torneo",
    ring: "ring-[color-mix(in_oklab,var(--color-evt-torneo)_50%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--color-evt-torneo)_10%,transparent)]",
  },
  reunion: {
    token: "var(--color-evt-reunion)",
    dot: "bg-[var(--color-evt-reunion)]",
    badge:
      "bg-[color-mix(in_oklab,var(--color-evt-reunion)_14%,transparent)] text-[var(--color-evt-reunion)] border-[color-mix(in_oklab,var(--color-evt-reunion)_45%,transparent)]",
    band: "event-band-reunion",
    ring: "ring-[color-mix(in_oklab,var(--color-evt-reunion)_45%,transparent)]",
    soft: "bg-[color-mix(in_oklab,var(--color-evt-reunion)_10%,transparent)]",
  },
  otro: {
    token: "var(--color-muted-foreground)",
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
    band: "border-l-[3px] border-l-border",
    ring: "ring-border",
    soft: "bg-muted",
  },
};

export function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
