import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useActiveTeam } from "@/hooks/use-active-team";

export function EmptyTeamState() {
  const { t } = useTranslation();
  const { isLoading } = useActiveTeam();
  if (isLoading) return null;
  return (
    <div className="mx-auto max-w-xl">
      <div className="surface-card flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Shield className="size-7" />
        </div>
        <p className="text-sm text-muted-foreground">{t("common.noTeamSelected")}</p>
        <Link
          to="/mi-equipo"
          className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"
        >
          {t("nav.miEquipo")}
        </Link>
      </div>
    </div>
  );
}
