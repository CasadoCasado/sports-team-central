import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/hooks/use-push";

export function PushSettings() {
  const { t } = useTranslation();
  const { state, supported, busy, subscribe, unsubscribe } = usePush();

  const enabled = state === "granted";

  async function toggle() {
    try {
      if (enabled) {
        await unsubscribe();
        toast.success(t("push.disabled"));
      } else {
        const ok = await subscribe();
        if (ok) toast.success(t("push.enabled"));
        else if (state === "denied") toast.error(t("push.blocked"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <section className="surface-card p-6">
      <h2 className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary">
        {t("push.title")}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">{t("push.description")}</p>
      {!supported ? (
        <p className="text-sm text-muted-foreground">{t("push.unsupported")}</p>
      ) : state === "denied" ? (
        <p className="text-sm text-destructive">{t("push.blocked")}</p>
      ) : (
        <Button
          type="button"
          onClick={toggle}
          disabled={busy}
          variant={enabled ? "outline" : "default"}
          className="uppercase tracking-widest font-bold"
        >
          {enabled ? (
            <>
              <BellOff className="mr-2 size-4" /> {t("push.disable")}
            </>
          ) : (
            <>
              <Bell className="mr-2 size-4" /> {t("push.enable")}
            </>
          )}
        </Button>
      )}
    </section>
  );
}
