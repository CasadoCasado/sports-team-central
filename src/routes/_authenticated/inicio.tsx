import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Shield, Users, Calendar, Bell, ClipboardList, Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/inicio")({
  component: Inicio,
});

function Inicio() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { data: profile } = useProfile();

  const { data: teams } = useQuery({
    queryKey: ["my-teams", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, status, teams:team_id(id, nombre, logo_url, descripcion)")
        .eq("user_id", user!.id)
        .eq("status", "activo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingInvites } = useQuery({
    queryKey: ["my-invitations-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("team_invitations")
        .select("id", { count: "exact", head: true })
        .eq("invited_user_id", user!.id)
        .eq("status", "pendiente");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const hasTeam = (teams?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-display text-3xl font-black tracking-tight sm:text-4xl">
          {t("dashboard.welcome", { name: profile?.nombre || "" })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("dashboard.welcomeSubtitle")}</p>
      </div>

      {!hasTeam && (
        <div className="surface-card p-6">
          <p className="text-sm text-muted-foreground">{t("dashboard.noTeamAlert")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile?.preferred_role === "capitan" && (
              <Link
                to="/mi-equipo"
                className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"
              >
                {t("team.create")}
              </Link>
            )}
            {(pendingInvites ?? 0) > 0 && (
              <Link
                to="/notificaciones"
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-widest hover:border-primary/40"
              >
                {t("notifications.title")} ({pendingInvites})
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Shield />} label={t("nav.miEquipo")} value={teams?.length ?? 0} to="/mi-equipo" />
        <StatCard icon={<Bell />} label={t("notifications.title")} value={pendingInvites ?? 0} to="/notificaciones" />
        <StatCard icon={<Calendar />} label={t("nav.calendario")} value="—" to="/calendario" />
        <StatCard icon={<Vote />} label={t("nav.encuestas")} value="—" to="/encuestas" />
      </div>

      {hasTeam && (
        <div>
          <h2 className="text-display mb-4 text-xl font-bold uppercase tracking-tight">
            {t("nav.miEquipo")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams!.map((tm) => {
              const team = Array.isArray(tm.teams) ? tm.teams[0] : tm.teams;
              if (!team) return null;
              return (
                <Link
                  key={tm.team_id}
                  to="/mi-equipo"
                  className="surface-card group flex items-start gap-4 p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Shield className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-display truncate text-lg font-bold">{team.nombre}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {tm.role}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="surface-card group flex flex-col gap-3 p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:size-4">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-display text-3xl font-black">{value}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
    </Link>
  );
}
