import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef, useState } from "react";
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
  Menu,
  X,
  Shield,
  Swords,
  Medal,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { signOut as clearSession } from "@/lib/auth";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { AccountMenu } from "./account-menu";
import { LOGO_URL } from "@/lib/brand";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const CLAVE_FIJADA = "teamup:barra-fijada";

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
  // En escritorio la barra va plegada en una franja de iconos. Se abre por
  // encima del contenido sin moverlo (`abierta`), o se fija abierta como
  // columna (`fijada`, recordado en este navegador).
  const [abierta, setAbierta] = useState(false);
  const [fijada, setFijada] = useState(false);
  useEffect(() => {
    try {
      setFijada(window.localStorage.getItem(CLAVE_FIJADA) === "1");
    } catch {
      // Ventana privada: plegada, que es lo de por defecto.
    }
  }, []);
  function fijar(v: boolean) {
    setFijada(v);
    setAbierta(false);
    setEncima(false);
    try {
      window.localStorage.setItem(CLAVE_FIJADA, v ? "1" : "0");
    } catch {
      // Ventana privada: vale para esta visita.
    }
  }
  // Con el ratón encima, la franja también se abre por encima, con un
  // pequeño retraso para que cruzarla de camino a otra cosa no la despliegue,
  // y otro al salir para que un tropiezo del ratón no la cierre.
  const [encima, setEncima] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  function alEntrar(e: ReactPointerEvent) {
    if (e.pointerType !== "mouse" || fijada) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEncima(true), 150);
  }
  function alSalir(e: ReactPointerEvent) {
    if (e.pointerType !== "mouse") return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEncima(false), 250);
  }
  function plegar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    setAbierta(false);
    setEncima(false);
  }
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);
  /** Solo cuenta desde `lg`: en móvil la barra es el cajón de siempre. */
  const plegada = !fijada && !abierta && !encima;

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

  // Cierra el menú móvil (y la barra abierta encima) al navegar, y bloquea el
  // scroll de fondo mientras el cajón está abierto.
  useEffect(() => {
    setMobileOpen(false);
    setAbierta(false);
    setEncima(false);
  }, [pathname]);

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierta]);

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
          tocando fuera».

          Desde `lg` va plegada en una franja de iconos de 72 px: la barra
          entera se comía 256 px de contenido, y en pantallas como el tablero
          PRO se notaba. Se abre por encima, sin mover la página, y se puede
          fijar abierta. Es `fixed` también en escritorio; el hueco que ocupa
          en la fila lo guarda el separador de debajo. */}
      <aside
        id="main-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[85vw] shrink-0 flex-col overscroll-contain bg-[color:var(--color-ink)] pb-[env(safe-area-inset-bottom)] text-[color:var(--color-ink-foreground)] transition-[transform,width] duration-200 will-change-transform lg:max-w-none lg:translate-x-0 lg:pb-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          plegada ? "lg:w-[4.5rem]" : "lg:w-64",
          !fijada && !plegada && "lg:shadow-2xl",
        )}
        aria-label="Navegación principal"
        aria-hidden={undefined}
        onPointerEnter={alEntrar}
        onPointerLeave={alSalir}
      >
        <div className={cn("flex h-16 items-center gap-3 px-6", plegada && "lg:justify-center lg:px-0")}>
          <img
            src={LOGO_URL}
            alt="TeamUp"
            className="size-9 shrink-0 object-contain"
            decoding="async"
            width={36}
            height={36}
          />

          <div className={cn("flex flex-col leading-none", plegada && "lg:hidden")}>
            <span className="text-display text-base font-bold uppercase tracking-[0.14em]">
              {t("app.name")}
            </span>
            <span className="mt-1 text-3xs font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
              Sports Management
            </span>
          </div>
        </div>

        {/* Abrir, fijar o plegar: solo en escritorio. */}
        <div className={cn("hidden px-3 lg:flex", plegada ? "justify-center" : "justify-between gap-1")}>
          {plegada ? (
            <button
              type="button"
              onClick={() => setAbierta(true)}
              aria-label={t("nav.abrirBarra")}
              title={t("nav.abrirBarra")}
              aria-expanded={false}
              aria-controls="main-sidebar"
              className="inline-flex size-10 items-center justify-center rounded-lg text-[color:var(--color-ink-muted)] hover:bg-white/[0.06] hover:text-white"
            >
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fijar(!fijada)}
                aria-pressed={fijada}
                title={fijada ? t("nav.soltarBarra") : t("nav.fijarBarra")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-2xs font-bold uppercase tracking-widest text-[color:var(--color-ink-muted)] hover:bg-white/[0.06] hover:text-white"
              >
                {fijada ? (
                  <PinOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Pin className="size-3.5" aria-hidden="true" />
                )}
                {fijada ? t("nav.soltarBarra") : t("nav.fijarBarra")}
              </button>
              {!fijada && (
                <button
                  type="button"
                  onClick={plegar}
                  aria-label={t("nav.cerrarBarra")}
                  title={t("nav.cerrarBarra")}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[color:var(--color-ink-muted)] hover:bg-white/[0.06] hover:text-white"
                >
                  <PanelLeftClose className="size-4" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>

        <nav
          className={cn(
            "scrollbar-none flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-3",
            plegada && "lg:space-y-2 lg:overflow-x-visible lg:px-2",
          )}
        >
          {groups.map((group, gi) => (
            <div key={group.label}>
              <div
                className={cn(
                  "px-3 pb-1.5 text-2xs font-bold uppercase tracking-[0.22em] text-[color:var(--color-ink-muted)]",
                  plegada && "lg:sr-only",
                )}
              >
                {group.label}
              </div>
              {plegada && gi > 0 && (
                <div aria-hidden="true" className="mx-3 mb-2 hidden h-px bg-white/10 lg:block" />
              )}
              <div className="space-y-0.5">
                {groups.length > 0 && group.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      title={plegada ? item.label : undefined}
                      className={cn(
                        "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        plegada && "lg:justify-center lg:px-0",

                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-[color:var(--color-ink-muted)] hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />
                      )}
                      <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-primary" : "text-[color:var(--color-ink-muted)] group-hover:text-white")} />
                      {/* Plegada, el nombre sigue ahí para los lectores de
                          pantalla; a la vista lo da el `title`. */}
                      <span className={cn("truncate", plegada && "lg:sr-only")}>{item.label}</span>
                      {UNDER_MAINTENANCE[item.to] && (
                        <span
                          className={cn(
                            "ml-auto flex shrink-0 items-center",
                            plegada && "lg:absolute lg:right-2 lg:top-2",
                          )}
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
            title={plegada ? `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim() : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.05]",
              plegada && "lg:justify-center",
            )}
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              {initials}
            </div>
            <div className={cn("min-w-0 flex-1", plegada && "lg:sr-only")}>
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

      {/* Abierta encima en escritorio: pulsar fuera la pliega otra vez. */}
      {abierta && !fijada && (
        <button
          type="button"
          tabIndex={-1}
          className="fixed inset-0 z-30 hidden bg-black/20 lg:block"
          onClick={() => setAbierta(false)}
          aria-label={t("nav.cerrarBarra")}
        />
      )}

      {/* El hueco de la barra en la fila: la franja, o la barra entera si
          está fijada. Abierta encima no lo ensancha, para no mover la página. */}
      <div
        aria-hidden="true"
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 lg:block",
          fijada ? "lg:w-64" : "lg:w-[4.5rem]",
        )}
      />

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
            {/* Con el cajón cerrado, el logo solo estaba dentro de él. */}
            <Link to="/inicio" className="flex items-center gap-2 lg:hidden">
              <img
                src={LOGO_URL}
                alt=""
                className="size-7 object-contain"
                width={28}
                height={28}
                decoding="async"
              />
              <span className="text-display text-sm font-bold uppercase tracking-[0.14em]">
                {t("app.name")}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
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
            <AccountMenu
              initials={initials}
              nombre={profile?.nombre}
              apellidos={profile?.apellidos}
              email={profile?.email}
              onSignOut={signOut}
            />
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


