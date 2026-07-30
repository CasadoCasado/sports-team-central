import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Home,
  Users,
  UserCircle2,
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { LangToggle } from "./lang-toggle";

import { cn } from "@/lib/utils";
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
    queryFn: async () => {
      const [{ count: notifCount }, { count: invCount }, managed] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("read", false),
        supabase
          .from("team_invitations")
          .select("id", { count: "exact", head: true })
          .eq("invited_user_id", user!.id)
          .eq("status", "pendiente")
          .eq("es_solicitud", false),
        supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user!.id)
          .eq("status", "activo")
          .in("role", ["capitan", "co_capitan", "entrenador", "delegado"]),
      ]);
      const teamIds = (managed.data ?? []).map((r) => r.team_id);
      let reqCount = 0;
      if (teamIds.length > 0) {
        const { count } = await supabase
          .from("team_invitations")
          .select("id", { count: "exact", head: true })
          .in("team_id", teamIds)
          .eq("es_solicitud", true)
          .eq("status", "pendiente");
        reqCount = count ?? 0;
      }
      return (notifCount ?? 0) + (invCount ?? 0) + reqCount;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["shell-unread", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_invitations" },
        () => {
          qc.invalidateQueries({ queryKey: ["shell-unread", user.id] });
          qc.invalidateQueries({ queryKey: ["join-requests", user.id] });
          qc.invalidateQueries({ queryKey: ["invitations", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const isAdmin = useIsAdmin();

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: t("nav.principal"),
      items: [
        { to: "/inicio", label: t("nav.inicio"), icon: Home },
        { to: "/mi-equipo", label: t("nav.miEquipo"), icon: Shield },
        { to: "/miembros", label: t("nav.miembros"), icon: Users },
        { to: "/calendario", label: t("nav.calendario"), icon: Calendar },
        { to: "/perfil", label: t("nav.perfil"), icon: UserCircle2 },
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
      ],
    },
    {
      label: t("nav.recursos"),
      items: [
        { to: "/galeria", label: t("nav.galeria"), icon: ImageIcon },
        { to: "/documentos", label: t("nav.documentos"), icon: FileText },
        { to: "/pagos", label: t("nav.pagos"), icon: Wallet },
        { to: "/comunicaciones", label: t("nav.comunicaciones"), icon: MessagesSquare },
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

  async function signOut() {
    await supabase.auth.signOut();
    toast.success(t("auth.logoutSuccess"));
    navigate({ to: "/auth", replace: true });
  }

  const initials =
    ((profile?.nombre?.[0] ?? "") + (profile?.apellidos?.[0] ?? "")).toUpperCase() || "U";

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Sidebar — signature ink surface */}
      <aside
        id="main-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-[color:var(--color-ink)] text-[color:var(--color-ink-foreground)] transition-transform xl:sticky xl:top-0 xl:h-dvh xl:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegación principal"
      >
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary shadow-[0_6px_20px_-6px_color-mix(in_oklab,var(--color-primary)_60%,transparent)]">
            <div className="size-3.5 rotate-45 rounded-[3px] bg-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-display text-base font-bold uppercase tracking-[0.14em]">
              {t("app.name")}
            </span>
            <span className="mt-1 text-3xs font-semibold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
              Team OS
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
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
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
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
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-md xl:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)] xl:hidden"
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
            <Link
              to="/notificaciones"
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:text-foreground"
              aria-label={`${t("nav.notificaciones")}${(unreadCount ?? 0) > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            >
              <Bell className="size-4" aria-hidden="true" />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-foreground shadow-[var(--shadow-rose)]" aria-hidden="true">
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

        <main className="flex-1 p-4 xl:p-8">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

export { UserCircle2 };

