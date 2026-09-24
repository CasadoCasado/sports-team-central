import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  LifeBuoy,
  LogOut,
  Monitor,
  Moon,
  Sun,
  User,
} from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme, type Tema } from "@/hooks/use-theme";
import { helpSectionForPath } from "@/lib/help-content";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TEMAS: { valor: Tema; icono: typeof Sun; clave: string }[] = [
  { valor: "light", icono: Sun, clave: "theme.light" },
  { valor: "dark", icono: Moon, clave: "theme.dark" },
  { valor: "system", icono: Monitor, clave: "theme.system" },
];

type Props = {
  initials: string;
  nombre?: string | null;
  apellidos?: string | null;
  email?: string | null;
  onSignOut: () => void;
};

/**
 * El menú de la cuenta: perfil, idioma, tema, ayuda y cerrar sesión.
 *
 * Antes eran cinco botones sueltos en la cabecera, y en un móvil no cabían.
 * Ahora queda solo el avatar, y todo lo demás vive aquí dentro.
 *
 * En móvil es un panel que sube desde abajo, a mano del pulgar; en escritorio,
 * un desplegable bajo el avatar. Es un `Popover` y no un `DropdownMenu` porque
 * lleva controles de dos y tres posiciones dentro, y el menú de Radix se come
 * el tabulador: con teclado no se podría llegar a ellos.
 *
 * Cerrar sesión pide confirmación. En la cabecera estaba a un toque, justo
 * al lado de la campana, y se pulsaba sin querer.
 */
export function AccountMenu({ initials, nombre, apellidos, email, onSignOut }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Al navegar desde dentro (perfil, ayuda) el menú se cierra solo.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Cada vez que se abre, empieza por la lista y no por la confirmación.
  useEffect(() => {
    if (!open) setConfirmando(false);
  }, [open]);

  const nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ");

  const cuerpo = confirmando ? (
    <div className="flex flex-col gap-3 px-2 pb-1 pt-3">
      <p className="text-sm">{t("account.confirmLogout")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="min-h-11 flex-1 rounded-lg border border-border bg-muted text-sm font-semibold transition-colors hover:bg-muted/70"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onSignOut();
          }}
          className="min-h-11 flex-1 rounded-lg bg-destructive text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
        >
          {t("auth.logout")}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col py-1.5">
      <Link to="/perfil" onClick={() => setOpen(false)} className={FILA_ENLACE}>
        <ContenidoEnlace icono={User}>{t("nav.perfil")}</ContenidoEnlace>
      </Link>
      <Fila icono={Globe} etiqueta={t("account.language")}>
        <SelectorIdioma />
      </Fila>
      <SelectorTema />
      <Link
        to="/ayuda"
        search={{ screen: helpSectionForPath(pathname) }}
        onClick={() => setOpen(false)}
        className={FILA_ENLACE}
      >
        <ContenidoEnlace icono={LifeBuoy}>{t("nav.ayuda")}</ContenidoEnlace>
      </Link>
      <div className="my-1 h-px bg-border" />
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        {t("auth.logout")}
      </button>
    </div>
  );

  const cabecera = (
    Titulo: typeof DrawerTitle | "p",
    Descripcion: typeof DrawerDescription | "p",
  ) => (
    <div className="flex items-center gap-3 border-b border-border px-2 pb-3">
      <Avatar initials={initials} className="size-11 text-sm" />
      <div className="min-w-0">
        <Titulo className="truncate text-sm font-bold leading-tight">
          {nombreCompleto || t("nav.perfil")}
        </Titulo>
        {email && (
          <Descripcion className="truncate text-xs text-muted-foreground">{email}</Descripcion>
        )}
      </div>
    </div>
  );

  const disparador = (
    <button
      type="button"
      aria-label={t("account.menu")}
      title={t("account.menu")}
      onClick={isMobile ? () => setOpen(true) : undefined}
      className="inline-flex min-h-11 items-center gap-2 rounded-full p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:border md:border-border md:bg-card md:pr-3 md:shadow-[var(--shadow-card)]"
    >
      <Avatar initials={initials} className="size-9 text-xs" />
      {nombre && (
        <span className="hidden max-w-32 truncate text-sm font-semibold md:inline">{nombre}</span>
      )}
      <ChevronDown className="hidden size-3.5 text-muted-foreground md:inline" aria-hidden="true" />
    </button>
  );

  if (isMobile) {
    return (
      <>
        {disparador}
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent className="rounded-t-2xl border-border bg-popover px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="pt-4">{cabecera(DrawerTitle, DrawerDescription)}</div>
            {cuerpo}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{disparador}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 rounded-xl p-2 pt-3">
        {cabecera("p", "p")}
        {cuerpo}
      </PopoverContent>
    </Popover>
  );
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary ring-1 ring-primary/30",
        className,
      )}
    >
      {initials}
    </span>
  );
}

function Fila({
  icono: Icono,
  etiqueta,
  children,
}: {
  icono: typeof Sun;
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 px-2 text-sm">
      <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{etiqueta}</span>
      {children}
    </div>
  );
}

const FILA_ENLACE =
  "flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm transition-colors hover:bg-muted";

function ContenidoEnlace({ icono: Icono, children }: { icono: typeof Sun; children: ReactNode }) {
  return (
    <>
      <Icono className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
    </>
  );
}

const SEGMENTO =
  "inline-flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-[var(--shadow-card)]";

function SelectorIdioma() {
  const { i18n, t } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : "es";
  return (
    <div
      role="group"
      aria-label={t("account.language")}
      className="inline-flex gap-0.5 rounded-lg border border-border bg-muted p-0.5"
    >
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => i18n.changeLanguage(l)}
          className={SEGMENTO}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function SelectorTema() {
  const { t } = useTranslation();
  const { tema, oscuro, setTema } = useTheme();
  const Icono = tema === "system" ? Monitor : oscuro ? Moon : Sun;
  return (
    <Fila icono={Icono} etiqueta={t("theme.label")}>
      <div
        role="group"
        aria-label={t("theme.label")}
        className="inline-flex gap-0.5 rounded-lg border border-border bg-muted p-0.5"
      >
        {TEMAS.map(({ valor, icono: Op, clave }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={tema === valor}
            aria-label={t(clave)}
            title={t(clave)}
            onClick={() => setTema(valor)}
            className={SEGMENTO}
          >
            <Op className="size-3.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </Fila>
  );
}
