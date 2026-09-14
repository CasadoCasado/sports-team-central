import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aviso de «estamos trabajando en ello» para las secciones cuya subida de
 * ficheros está pausada. No tapa lo que ya hay: se pone encima del contenido
 * y explica por qué no aparece el botón de subir.
 */
export function MaintenanceNotice({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className={cn(
        "surface-card relative flex items-start gap-4 overflow-hidden p-5 pl-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: "var(--color-evt-torneo)" }}
      />
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: "color-mix(in oklab, var(--color-evt-torneo) 16%, transparent)",
          color: "var(--color-evt-torneo)",
        }}
      >
        <Construction className="size-5" />
      </div>
      <div className="min-w-0 space-y-1">
        <p
          className="text-2xs font-bold uppercase tracking-[0.22em]"
          style={{ color: "var(--color-evt-torneo)" }}
        >
          {t("maintenance.badge")}
        </p>
        <h2 className="text-display text-base font-bold">{title ?? t("maintenance.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {description ?? t("maintenance.description")}
        </p>
        {children}
      </div>
    </div>
  );
}
