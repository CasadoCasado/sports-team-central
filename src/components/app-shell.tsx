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
      const [{ count: notifCount }, { count: invCount }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("read", false),
        supabase
          .from("team_invitations")
          .select("id", { count: "exact", head: true })
          .eq("invited_user_id", user!.id)
          .eq("status", "pendiente"),
      ]);
      return (notifCount ?? 0) + (invCount ?? 0);
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
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

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
      {/* Sidebar */}
      <aside
        id="main-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-background/95 backdrop-blur transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navegación principal"
      >
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary">
            <div className="size-3.5 rotate-45 rounded-sm bg-primary-foreground" />
          </div>
          <span className="text-display text-lg font-extrabold uppercase tracking-tight">
            {t("app.name")}
          </span>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-card hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            to="/perfil"
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-card"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">
                {profile?.nombre} {profile?.apellidos}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{profile?.email}</p>
            </div>
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border p-2 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              aria-controls="main-sidebar"
            >
              {mobileOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <Link
              to="/notificaciones"
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`${t("nav.notificaciones")}${(unreadCount ?? 0) > 0 ? ` (${unreadCount} sin leer)` : ""}`}
            >
              <Bell className="size-4" aria-hidden="true" />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground" aria-hidden="true">
                  {unreadCount! > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">{t("auth.logout")}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export { UserCircle2 };
