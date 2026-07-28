import { useTranslation } from "react-i18next";
import { Minus, Plus, Type } from "lucide-react";
import { useFontScale } from "@/hooks/use-font-scale";

export function FontSizeControl() {
  const { t } = useTranslation();
  const { percent, canIncrease, canDecrease, increase, decrease, reset } = useFontScale();

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-[var(--shadow-card)]"
      role="group"
      aria-label={t("a11y.fontSize")}
    >
      <button
        type="button"
        onClick={decrease}
        disabled={!canDecrease}
        aria-label={t("a11y.fontSizeDecrease")}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={reset}
        aria-label={`${t("a11y.fontSizeReset")} (${percent}%)`}
        title={`${t("a11y.fontSize")}: ${percent}%`}
        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Type className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline tabular-nums">{percent}%</span>
      </button>
      <button
        type="button"
        onClick={increase}
        disabled={!canIncrease}
        aria-label={t("a11y.fontSizeIncrease")}
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
