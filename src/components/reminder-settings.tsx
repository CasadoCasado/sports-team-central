import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS: { hours: number; key: "1h" | "2h" | "6h" | "24h" | "48h" | "72h" }[] = [
  { hours: 1, key: "1h" },
  { hours: 2, key: "2h" },
  { hours: 6, key: "6h" },
  { hours: 24, key: "24h" },
  { hours: 48, key: "48h" },
  { hours: 72, key: "72h" },
];

export function ReminderSettings() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { data: profile, refetch } = useProfile();
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = (profile as { reminder_hours?: number[] } | null)?.reminder_hours;
    setSelected(Array.isArray(current) ? [...current].sort((a, b) => a - b) : [24]);
  }, [profile]);

  function toggle(h: number) {
    setSelected((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h].sort((a, b) => a - b),
    );
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await api.patch("/profiles/me/", { reminder_hours: selected });
      toast.success(t("reminders.saved"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h2 className="text-2xs font-bold uppercase tracking-widest text-primary">
          {t("reminders.title")}
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("reminders.description")}</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const active = selected.includes(o.hours);
          return (
            <button
              key={o.hours}
              type="button"
              onClick={() => toggle(o.hours)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {t(`reminders.${o.key}`)}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{t("reminders.none")}</p>
      )}
      <div className="mt-4">
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
        >
          {t("profile.save")}
        </Button>
      </div>
    </section>
  );
}
