import { useTranslation } from "react-i18next";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type Tema } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPCIONES: { valor: Tema; icono: typeof Sun; clave: string }[] = [
  { valor: "light", icono: Sun, clave: "theme.light" },
  { valor: "dark", icono: Moon, clave: "theme.dark" },
  { valor: "system", icono: Monitor, clave: "theme.system" },
];

/**
 * Claro, oscuro o el del sistema.
 *
 * Es un menú y no un interruptor de dos posiciones porque «sistema» es un
 * estado real: quien tiene el móvil en automático no debería perderlo por
 * tocar el botón una vez. El icono del botón enseña lo que se está viendo,
 * no lo que está elegido, salvo en «sistema», que enseña el monitor.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { tema, oscuro, setTema } = useTheme();

  const Icono = tema === "system" ? Monitor : oscuro ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("theme.label")}
        title={t("theme.label")}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icono className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {OPCIONES.map(({ valor, icono: Op, clave }) => (
          <DropdownMenuItem
            key={valor}
            className="min-h-11 gap-2.5"
            onClick={() => setTema(valor)}
          >
            <Op
              className={cn("size-4", tema === valor ? "text-primary" : "text-muted-foreground")}
              aria-hidden="true"
            />
            <span className={cn(tema === valor && "font-semibold")}>{t(clave)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
