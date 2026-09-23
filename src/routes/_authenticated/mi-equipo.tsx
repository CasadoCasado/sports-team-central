import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, Shield, Trash2, Upload, Users } from "lucide-react";
import { api } from "@/lib/api";
import { ImageUpload } from "@/components/image-upload";
import { traducirErrorDeImagen } from "@/lib/images";
import { MANAGER_ROLES, type Team, type TeamMember, type TeamRole } from "@/lib/types";
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
  head: () => ({
    meta: [
      { title: "Mi equipo | TeamUp" },
      { name: "description", content: "Crea o gestiona tu equipo, controla inscripciones y solicitudes de nuevos jugadores." },
      { property: "og:title", content: "Mi equipo | TeamUp" },
      { property: "og:description", content: "Crea o gestiona tu equipo, controla inscripciones y solicitudes de nuevos jugadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
    queryFn: () =>
      api.get<TeamMember[]>("/team-members/", { mine: 1, status: "activo" }),
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
      // El escudo se sube después de crear el equipo: la ruta del fichero
      // cuelga de su identificador, que hasta entonces no existe.
      const team = await api.post<Team>("/teams/", {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        deporte: deporte || null,
        ciudad: ciudad.trim() || null,
      });
      if (logoFile) {
        const form = new FormData();
        form.append("file", logoFile);
        await api.upload(`/teams/${team.id}/logo/`, form);
      }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">{t("nav.miEquipo")}</h1>
        <Button
          onClick={() => setCreating(true)}
          className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
        >
          + {t("team.create")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {memberships!.map((m) => {
          const team = m.team;
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
  team: Team;
  role: string;
  currentUserId: string | null;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const isManager = MANAGER_ROLES.includes(role as TeamRole);
  const [deleting, setDeleting] = useState(false);
  const [togglingIns, setTogglingIns] = useState(false);
  const isOwner = !!currentUserId && team.owner_id === currentUserId;
  const inscripcionesAbiertas = team.inscripciones_abiertas !== false;

  const { data: members } = useQuery({
    queryKey: ["team-members-count", team.id],
    // El recuento viene ya con el equipo, así que no hace falta consultarlo.
    queryFn: async () => team.member_count ?? 0,
  });

  async function toggleInscripciones() {
    setTogglingIns(true);
    try {
      await api.patch(`/teams/${team.id}/`, {
        inscripciones_abiertas: !inscripcionesAbiertas,
      });
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
      await api.delete(`/teams/${team.id}/`);
      toast.success(t("team.deleted"));
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  // `null` quita el escudo; un fichero lo pone o lo sustituye.
  const logo = useMutation({
    mutationFn: async (file: File | null) => {
      if (file === null) return api.delete(`/teams/${team.id}/logo/`);
      const form = new FormData();
      form.append("file", file);
      return api.upload(`/teams/${team.id}/logo/`, form);
    },
    onSuccess: (_d: unknown, file: File | null) => {
      toast.success(file ? t("images.saved") : t("images.removed"));
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      qc.invalidateQueries({ queryKey: ["active-team-memberships"] });
    },
    onError: (e: Error) => toast.error(traducirErrorDeImagen(e.message, t)),
  });

  return (
    <div className="surface-card min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border p-4 sm:gap-4 sm:p-6">
        <ImageUpload
          url={team.logo_url}
          alt={team.nombre}
          fallback={<Shield className="size-8" />}
          canEdit={isManager}
          busy={logo.isPending}
          onPick={(file) => logo.mutate(file)}
          onRemove={() => logo.mutate(null)}
        />
        <div className="min-w-0 flex-1">
          {/* Sin `truncate`: el nombre de un club no se entiende cortado por la
              mitad («Club Depor…»), y aquí es el título de la tarjeta. */}
          <h3 className="text-display text-xl font-black break-words sm:text-2xl">{team.nombre}</h3>
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
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
        <p className="border-b border-border p-4 text-sm text-muted-foreground sm:p-6">
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
      {/* Tres columnas en un móvil dejan setenta píxeles por celda, y ahí
          «Santiago de Compostela» se queda en «Santiago d…». En vertical cada
          dato se lee entero; desde `sm` vuelven a ir en fila. */}
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
      <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-medium">
        {icon}
        <span className="min-w-0 break-words">{value}</span>
      </div>
    </div>
  );
}
