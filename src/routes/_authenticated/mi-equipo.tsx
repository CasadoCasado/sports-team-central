import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, Shield, Trash2, Upload, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORTS, sportLabel } from "@/lib/sports";
import { TeamDiscovery } from "@/components/team-discovery";
import { TeamJoinRequests } from "@/components/team-join-requests";

export const Route = createFileRoute("/_authenticated/mi-equipo")({
  component: MiEquipo,
});

function MiEquipo() {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const { data: memberships, isLoading } = useQuery({
    queryKey: ["my-teams-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(
          "id, team_id, role, status, teams:team_id(id, nombre, logo_url, descripcion, deporte, categoria, ciudad, instalacion, owner_id, inscripciones_abiertas)",
        )
        .eq("user_id", user!.id)
        .eq("status", "activo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const canCreateTeam = profile?.preferred_role === "capitan";

  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [deporte, setDeporte] = useState("padel");
  const [ciudad, setCiudad] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nombre.trim()) return;
    setSaving(true);
    try {
      let logo_url: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() ?? "png";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("team-logos")
          .upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("team-logos")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        logo_url = signed?.signedUrl ?? path;
      }
      const { error } = await supabase.from("teams").insert({
        owner_id: user.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        deporte: deporte || null,
        ciudad: ciudad.trim() || null,
        logo_url,
      });
      if (error) throw error;
      toast.success(t("team.created"));
      setCreating(false);
      setNombre("");
      setDescripcion("");
      setDeporte("padel");
      setCiudad("");
      setLogoFile(null);
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error");
      toast.error(msg.includes("sport_not_allowed") ? t("team.sportOnlyPadel") : msg);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  const hasTeams = (memberships?.length ?? 0) > 0;

  if (creating) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-display mb-6 text-3xl font-black tracking-tight">
          {t("team.createTitle")}
        </h1>
        <form onSubmit={createTeam} className="surface-card space-y-4 p-6">
          <div>
            <Label htmlFor="nombre">{t("team.nombre")}</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="logo">{t("team.logo")}</Label>
            <div className="mt-1 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold uppercase tracking-widest hover:border-primary/40">
                <Upload className="size-4" />
                {t("team.uploadLogo")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {logoFile && (
                <span className="text-xs text-muted-foreground">{logoFile.name}</span>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("team.deporte")}</Label>
              <Select value={deporte} onValueChange={setDeporte}>
                <SelectTrigger><SelectValue placeholder={t("team.selectSport")} /></SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value} disabled={s.value !== "padel"}>
                      {sportLabel(s.value, i18n.language)}
                      {s.value !== "padel" && (
                        <span className="ml-2 text-2xs uppercase tracking-widest text-muted-foreground">
                          {t("team.sportComingSoon")}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ciudad">{t("team.ciudad")}</Label>
              <Input id="ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} maxLength={100} />
            </div>
          </div>
          <div>
            <Label htmlFor="descripcion">{t("team.descripcion")}</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              placeholder={t("team.descripcionPlaceholder")}
              rows={4}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {t("team.create")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreating(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (!hasTeams) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="surface-card flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="size-8" />
          </div>
          <h2 className="text-display text-2xl font-bold">{t("team.noTeamYet")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {canCreateTeam ? t("team.noTeamCapitan") : t("team.noTeamJugador")}
          </p>
          <Button
            onClick={() => setCreating(true)}
            className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
          >
            {t("team.create")}
          </Button>
        </div>

        <TeamDiscovery onlyOpen />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display text-3xl font-black tracking-tight">{t("nav.miEquipo")}</h1>
        <Button
          onClick={() => setCreating(true)}
          className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
        >
          + {t("team.create")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {memberships!.map((m) => {
          const team = Array.isArray(m.teams) ? m.teams[0] : m.teams;
          if (!team) return null;
          return <TeamCard key={m.id} team={team} role={m.role} currentUserId={user?.id ?? null} />;
        })}
      </div>

      <TeamDiscovery onlyOpen />
    </div>
  );
}



function TeamCard({
  team,
  role,
  currentUserId,
}: {
  team: {
    id: string;
    nombre: string;
    logo_url: string | null;
    descripcion: string | null;
    deporte: string | null;
    ciudad: string | null;
    owner_id?: string;
    inscripciones_abiertas?: boolean;
  };
  role: string;
  currentUserId: string | null;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [togglingIns, setTogglingIns] = useState(false);
  const isOwner = !!currentUserId && team.owner_id === currentUserId;
  const inscripcionesAbiertas = team.inscripciones_abiertas !== false;

  const { data: members } = useQuery({
    queryKey: ["team-members-count", team.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team.id)
        .eq("status", "activo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  async function toggleInscripciones() {
    setTogglingIns(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ inscripciones_abiertas: !inscripcionesAbiertas })
        .eq("id", team.id);
      if (error) throw error;
      toast.success(t("team.inscripcionesUpdated"));
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["team-discovery"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setTogglingIns(false);
    }
  }

  async function deleteTeam() {
    const confirmMsg = t("team.deleteConfirm", { name: team.nombre });
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("teams").delete().eq("id", team.id);
      if (error) throw error;
      toast.success(t("team.deleted"));
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border p-6">
        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={team.nombre}
            className="size-16 rounded-lg object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="size-8" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-display truncate text-2xl font-black">{team.nombre}</h3>
          <p className="mt-1 text-2xs font-bold uppercase tracking-widest text-primary">
            {role}
          </p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={deleteTeam}
            disabled={deleting}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t("team.delete")}
          >
            <Trash2 className="size-4" />
            <span className="ml-1 hidden sm:inline uppercase text-2xs font-bold tracking-widest">
              {t("team.delete")}
            </span>
          </Button>
        )}
      </div>
      {team.descripcion && (
        <p className="border-b border-border p-6 text-sm text-muted-foreground">
          {team.descripcion}
        </p>
      )}
      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-2 rounded-full ${
                inscripcionesAbiertas ? "bg-primary" : "bg-muted-foreground/50"
              }`}
            />
            <span className="text-xxs font-bold uppercase tracking-widest">
              {inscripcionesAbiertas
                ? t("team.inscripcionesAbiertas")
                : t("team.inscripcionesCerradas")}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={togglingIns}
            onClick={toggleInscripciones}
            className="uppercase text-2xs font-bold tracking-widest"
          >
            {inscripcionesAbiertas
              ? t("team.cerrarInscripciones")
              : t("team.abrirInscripciones")}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-3 divide-x divide-border">
        <MetaCell label={t("team.members")} value={String(members ?? 0)} icon={<Users className="size-4" />} />
        <MetaCell label={t("team.deporte")} value={sportLabel(team.deporte, i18n.language)} />
        <MetaCell label={t("team.ciudad")} value={team.ciudad || "—"} />
      </div>
      {(isOwner || ["capitan", "co_capitan", "entrenador", "delegado"].includes(role)) && (
        <TeamJoinRequests teamId={team.id} compact />
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm font-medium">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
