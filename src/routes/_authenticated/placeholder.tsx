import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";

export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="surface-card flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Construction className="size-8" />
        </div>
        <h1 className="text-display text-3xl font-black tracking-tight">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Este módulo llegará en la próxima fase. Sigue con tu equipo y las invitaciones mientras
          tanto.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {t("common.loading").replace("...", "")} — Próximamente
        </p>
      </div>
    </div>
  );
}
