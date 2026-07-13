import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/miembros")({
  component: Miembros,
});

function Miembros() {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();

  // Load teams the current user manages (owner/capitan/entrenador/delegado)
  const { data: managedTeams } = useQuery({
    queryKey: ["managed-teams", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, role, teams:team_id(id, nombre)")
        .eq("user_id", user!.id)
        .in("role", ["capitan", "entrenador", "delegado"])
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        team_id: r.team_id,
        role: r.role,
        team: Array.isArray(r.teams) ? r.teams[0] : r.teams,
      }));
    },
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedTeamId && managedTeams && managedTeams.length > 0) {
      setSelectedTeamId(managedTeams[0].team_id);
    }
  }, [managedTeams, selectedTeamId]);

  const { data: members } = useQuery({
    queryKey: ["team-members-list", selectedTeamId],
    enabled: !!selectedTeamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, role, status, profiles:user_id(id, nombre, apellidos, email, avatar_url)")
        .eq("team_id", selectedTeamId!)
        .eq("status", "activo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [searchBy, setSearchBy] = useState<"nombre" | "email">("nombre");
  const [query, setQuery] = useState("");
  const [inviteRole, setInviteRole] = useState<"jugador" | "entrenador" | "delegado">("jugador");
  const debounced = useDebounced(query, 300);

  const currentUserRole = managedTeams?.find((mt) => mt.team_id === selectedTeamId)?.role;
  const canManageRoles = currentUserRole === "capitan";

  async function changeRole(memberId: string, newRole: "capitan" | "entrenador" | "delegado" | "jugador") {
    const { error } = await supabase
      .from("team_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("members.roleUpdated"));
    qc.invalidateQueries({ queryKey: ["team-members-list"] });
  }

  async function removeMember(memberId: string) {
    if (!confirm(t("members.removeConfirm"))) return;
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("members.removed"));
    qc.invalidateQueries({ queryKey: ["team-members-list"] });
  }

  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search", searchBy, debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const q = supabase.from("profiles").select("id, nombre, apellidos, email").limit(20);
      const term = `%${debounced}%`;
      const { data, error } =
        searchBy === "email"
          ? await q.ilike("email", term)
          : await q.or(`nombre.ilike.${term},apellidos.ilike.${term}`);
      if (error) throw error;
      return (data ?? []).filter((u) => u.id !== user?.id);
    },
  });

  async function invite(userId: string) {
    if (!selectedTeamId || !user) return;
    try {
      const { error } = await supabase.from("team_invitations").insert({
        team_id: selectedTeamId,
        invited_user_id: userId,
        invited_by: user.id,
        role: inviteRole,
      });
      if (error) throw error;

      const team = managedTeams?.find((tt) => tt.team_id === selectedTeamId)?.team;
      await supabase.from("notifications").insert({
        user_id: userId,
        tipo: "invitation",
        titulo: t("notifications.invitationTitle"),
        cuerpo: `${team?.nombre ?? ""}`,
        link: "/notificaciones",
      });

      toast.success(t("members.invited"));
      qc.invalidateQueries({ queryKey: ["team-members-list"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error");
      if (msg.includes("duplicate")) {
        toast.error(t("members.pending"));
      } else {
        toast.error(msg);
      }
    }
  }

  if (!managedTeams || managedTeams.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
          <Users className="size-10 text-muted-foreground" />
          <h2 className="text-display text-xl font-bold">{t("members.empty")}</h2>
          <p className="text-sm text-muted-foreground">{t("team.noTeamCapitan")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-display text-3xl font-black tracking-tight">{t("members.title")}</h1>
        {managedTeams.length > 1 && (
          <select
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            {managedTeams.map((mt) => (
              <option key={mt.team_id} value={mt.team_id}>
                {mt.team?.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Current members */}
      <div className="surface-card">
        <div className="border-b border-border p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("members.title")} ({members?.length ?? 0})
          </h2>
        </div>
        <div className="divide-y divide-border">
          {(members ?? []).map((m) => {
            const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            if (!p) return null;
            return (
              <div key={m.id} className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border">
                  {(p.nombre?.[0] ?? "") + (p.apellidos?.[0] ?? "")}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">
                    {p.nombre} {p.apellidos}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                {canManageRoles && p.id !== user?.id ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as "capitan" | "entrenador" | "delegado" | "jugador")}
                      className="rounded-md border border-border bg-card px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary"
                    >
                      <option value="jugador">{t("roles.jugador")}</option>
                      <option value="entrenador">{t("roles.entrenador")}</option>
                      <option value="delegado">{t("roles.delegado")}</option>
                      <option value="capitan">{t("roles.capitan")}</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("members.remove")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : (
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                    {t(`roles.${m.role}`)}
                  </span>
                )}
            );
          })}
          {(members?.length ?? 0) === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("members.empty")}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="surface-card p-6">
        <h2 className="text-display mb-4 text-xl font-bold">
          <UserPlus className="mr-2 inline size-5 text-primary" />
          {t("members.search")}
        </h2>

        <div className="mb-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">{t("members.searchBy")}:</span>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              checked={searchBy === "nombre"}
              onChange={() => setSearchBy("nombre")}
              className="accent-primary"
            />
            {t("members.byName")}
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              checked={searchBy === "email"}
              onChange={() => setSearchBy("email")}
              className="accent-primary"
            />
            {t("members.byEmail")}
          </label>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="mt-4 space-y-2">
          {debounced.length < 2 && (
            <p className="text-xs text-muted-foreground">{t("members.typeToSearch")}</p>
          )}
          {isFetching && (
            <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
          )}
          {results?.length === 0 && debounced.length >= 2 && !isFetching && (
            <p className="text-xs text-muted-foreground">{t("members.noResults")}</p>
          )}
          {(results ?? []).map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-3 rounded-md border border-border bg-background/50 p-3",
              )}
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border">
                {(r.nombre?.[0] ?? "") + (r.apellidos?.[0] ?? "")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {r.nombre} {r.apellidos}
                </p>
                <p className="truncate text-xs text-muted-foreground">{r.email}</p>
              </div>
              <Button
                size="sm"
                onClick={() => invite(r.id)}
                className="bg-primary text-primary-foreground uppercase tracking-widest text-[10px] font-bold hover:opacity-90"
              >
                {t("members.sendInvite")}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
