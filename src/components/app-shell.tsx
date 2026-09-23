import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { UNDER_MAINTENANCE } from "@/lib/feature-flags";
import { GuidedTour, useGuidedTour } from "@/components/guided-tour";
import {
  Home,
  Users,
  Calendar,
  Dumbbell,
  Trophy,
  ClipboardList,
  Vote,
  BarChart3,
  Image as ImageIcon,
  FileText,
  Wallet,
  MessagesSquare,
  Bell,
  LogOut,
  Menu,
  X,
  Shield,
  Swords,
  Medal,
  LifeBuoy,
} from "lucide-react";
import { api } from "@/lib/api";
import { signOut as clearSession } from "@/lib/auth";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";
import { LOGO_URL } from "@/lib/brand";

import { cn } from "@/lib/utils";
import { helpSectionForPath } from "@/lib/help-content";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useProfile();
  const { user } = useSession();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadCount } = useQuery({
    queryKey: ["shell-unread", user?.id],
    enabled: !!user,
    // Antes esto se refrescaba solo, con una suscripción de Realtime a
    // `notifications` y `team_invitations`. Django no empuja cambios, así que
    // el contador se vuelve a pedir cada minuto y al volver a la pestaña.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const badge = await api.get<{ total: number }>("/notifications/badge/");
      return badge.total;
    },
  });

  // Cierra el menú móvil al navegar y bloquea el scroll de fondo mientras está abierto.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isAdmin = useIsAdmin();


  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: t("nav.principal"),
      items: [
        { to: "/inicio", label: t("nav.inicio"), icon: Home },
        { to: "/mi-equipo", label: t("nav.miEquipo"), icon: Shield },
        { to: "/miembros", label: t("nav.miembros"), icon: Users },
        { to: "/calendario", label: t("nav.calendario"), icon: Calendar },
      ],
    },
    {
      label: t("nav.gestion"),
      items: [
        { to: "/entrenamientos", label: t("nav.entrenamientos"), icon: Dumbbell },
        { to: "/enfrentamientos", label: t("nav.enfrentamientos"), icon: Swords },
        { to: "/competiciones", label: t("nav.competiciones"), icon: Trophy },
        { to: "/convocatorias", label: t("nav.convocatorias"), icon: ClipboardList },
        { to: "/encuestas", label: t("nav.encuestas"), icon: Vote },
        { to: "/resultados", label: t("nav.resultados"), icon: BarChart3 },
        { to: "/estadisticas", label: t("nav.estadisticas"), icon: BarChart3 },
        { to: "/logros", label: t("nav.logros"), icon: Medal },
      ],
    },
    {
      label: t("nav.recursos"),
      items: [
        { to: "/galeria", label: t("nav.galeria"), icon: ImageIcon },
        { to: "/documentos", label: t("nav.documentos"), icon: FileText },
        { to: "/pagos", label: t("nav.pagos"), icon: Wallet },
        { to: "/comunicaciones", label: t("nav.comunicaciones"), icon: MessagesSquare },
        { to: "/ayuda", label: t("nav.ayuda"), icon: LifeBuoy },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: t("nav.admin"),
            items: [
              {
                to: "/admin/competiciones",
                label: t("nav.adminCompeticiones"),
                icon: Trophy,
              },
            ] as NavItem[],
          },
        ]
      : []),
  ];

  function signOut() {
    clearSession();
    qc.clear();
    toast.success(t("auth.logoutSuccess"));
    navigate({ to: "/auth", replace: true });
  }

  const tour = useGuidedTour();

  const initials =
    ((profile?.nombre?.[0] ?? "") + (profile?.apellidos?.[0] ?? "")).toUpperCase() || "U";

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* La barra lateral.

          Es un cajón que entra desde la izquierda en móvil y tableta vertical,
          y una columna fija desde `lg`. El corte estaba en `xl` (1280 px), así
          que una tableta en horizontal —1024, que es el iPad— se quedaba con
          el cajón y un botón de menú aunque le sobrara sitio para las dos
          cosas: con 1024 y 256 de barra quedan 768 de contenido, tanto como
          una tableta vertical entera.

          El ancho del cajón se limita a 85vw para que en un móvil estrecho
          siempre asome un trozo del fondo: es lo que dice «esto se cierra
          tocando fuera». Fija ya no hace falta y vuelve a los 256. */}
      <aside
        id="main-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[85vw] shrink-0 flex-col overscroll-contain bg-[color:var(--color-ink)] pb-[env(safe-area-inset-bottom)] text-[color:var(--color-ink-foreground)] transition-transform duration-200 will-change-transform lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:max-w-none lg:translate-x-0 lg:pb-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegación principal"
        aria-hidden={undefined}
      >
        <div className="flex h-16 items-center gap-3 px-6">
          <img
            src={LOGO_URL}
            alt="TeamUp"
            className="size-9 shrink-0 object-contain"
            decoding="async"
            width={36}
            height={36}
          />

          <div className="flex flex-col leading-none">
            <span className="text-display text-base font-bold uppercase tracking-[0.14em]">
              {t("app.name")}
            </span>
            <span className="mt-1 text-3xs font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
              Sports Management
            </span>
          </div>
        </div>

        <nav className="scrollbar-none flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-3">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1.5 text-2xs font-bold uppercase tracking-[0.22em] text-[color:var(--color-ink-muted)]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {groups.length > 0 && group.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",

                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-[color:var(--color-ink-muted)] hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />
                      )}
                      <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-primary" : "text-[color:var(--color-ink-muted)] group-hover:text-white")} />
                      <span className="truncate">{item.label}</span>
                      {UNDER_MAINTENANCE[item.to] && (
                        <span
                          className="ml-auto flex shrink-0 items-center"
                          title={t("maintenance.badge")}
                        >
                          <span
                            aria-hidden="true"
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: "var(--color-evt-torneo)" }}
                          />
                          <span className="sr-only">{t("maintenance.badge")}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <Link
            to="/perfil"
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.05]"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {profile?.nombre} {profile?.apellidos}
              </p>
              <p className="truncate text-2xs text-[color:var(--color-ink-muted)]">{profile?.email}</p>
            </div>
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border/70 bg-background/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)] lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              aria-controls="main-sidebar"
            >
              {mobileOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            
            <LangToggle />
            <ThemeToggle />
            <Link
              to="/ayuda"
              search={{ screen: helpSectionForPath(pathname) }}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:text-foreground"
              aria-label={t("help.contextual")}
              title={t("help.contextual")}
            >
              <LifeBuoy className="size-4" aria-hidden="true" />
            </Link>
            <Link
              to="/notificaciones"
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:text-foreground"
              aria-label={`${t("nav.notificaciones")}${(unreadCount ?? 0) > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            >
              <Bell className="size-4" aria-hidden="true" />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-foreground shadow-[var(--shadow-brand)]" aria-hidden="true">
                  {unreadCount! > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">{t("auth.logout")}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 xl:p-8">
          <div className="animate-fade-in-up">{children}</div>
        </main>

      </div>
      {tour.ready && <GuidedTour open={tour.open} onFinish={tour.finish} />}
    </div>
  );
}


