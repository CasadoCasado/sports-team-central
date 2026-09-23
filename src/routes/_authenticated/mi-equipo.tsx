import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Search, Settings, Shield, Trash2, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, inicialesDe } from "@/lib/utils";
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

  // Teniendo equipo, el panel de equipos abiertos empieza plegado: es un
  // bloque grande para algo que ya no se necesita. Sin equipo va abierto, que
  // ahí sí es lo que se viene a hacer.
  const [descubriendo, setDescubriendo] = useState(false);
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

        {/* Lo que antes era un botón de «Crear equipo» a secas. Con el menú, la
            cabecera deja sitio para las dos cosas que se pueden hacer aquí sin
            tener un equipo delante: crear uno o buscar dónde meterse. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("team.actions")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10"
          >
            <Settings className="size-[19px]" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="min-h-11 gap-2.5" onClick={() => setCreating(true)}>
              <Plus className="size-4 text-primary" aria-hidden="true" />
              {t("team.create")}
            </DropdownMenuItem>
            {/* Abre el panel además de bajar hasta él: plegado, el atajo
                llevaba a una cabecera cerrada y no se veía ni un equipo. */}
            <DropdownMenuItem
              className="min-h-11 gap-2.5"
              onClick={() => {
                setDescubriendo(true);
                requestAnimationFrame(() =>
                  document
                    .getElementById("descubrir")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                );
              }}
            >
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("team.discoverTitle")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Una sola columna a propósito. A dos, en un escritorio de 1280 cada
          tarjeta se queda en ~476 px —ancho de móvil— y los datos ya no caben
          en la banda, así que harían falta dos maquetaciones distintas para la
          misma tarjeta. Lo normal además es tener un equipo. */}
      <div className="grid gap-6">
        {memberships!.map((m) => {
          const team = m.team;
          if (!team) return null;
          return <TeamCard key={m.id} team={team} role={m.role} currentUserId={user?.id ?? null} />;
        })}
      </div>

      <div id="descubrir" className="scroll-mt-20">
        <TeamDiscovery
          onlyOpen
          collapsible={{ open: descubriendo, onOpenChange: setDescubriendo }}
        />
      </div>
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

  const iniciales = inicialesDe(team.nombre);

  const datos = [
    { label: t("team.members"), value: String(members ?? 0) },
    { label: t("team.deporte"), value: sportLabel(team.deporte, i18n.language) },
    { label: t("team.ciudad"), value: team.ciudad || "—" },
  ];

  const estado = inscripcionesAbiertas
    ? t("team.inscripcionesAbiertas")
    : t("team.inscripcionesCerradas");

  return (
    <article className="surface-raised min-w-0 overflow-hidden">
      {/* La banda del club.

          Los tres datos viven aquí desde `sm` y en una franja blanca debajo en
          el móvil. No es capricho: al lado del nombre solo caben con sitio de
          sobra, y en 390 px no lo hay; abajo, en cambio, la banda se quedaría
          medio vacía en una tableta. Es el mismo dato en el sitio que le toca
          a cada ancho. */}
      <div className="relative overflow-hidden bg-[color:var(--color-ink)] p-[18px] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full opacity-30 sm:-right-16 sm:-top-28 sm:size-[300px]"
          style={{
            background:
              "radial-gradient(circle, var(--color-primary) 0%, var(--color-accent) 60%, transparent 72%)",
          }}
        />

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("team.settings")}
              className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-xl bg-white/10 text-[color:var(--color-ink-foreground)] ring-1 ring-white/20 transition-colors hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-4 sm:top-4 sm:size-10"
            >
              <Settings className="size-[18px]" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="min-h-11 gap-2.5 text-destructive focus:text-destructive"
                disabled={deleting}
                onClick={deleteTeam}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t("team.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="relative">
          <div className="flex min-w-0 items-center gap-3.5 pr-14 sm:gap-[18px]">
            <ImageUpload
              url={team.logo_url}
              alt={team.nombre}
              className="size-[58px] rounded-2xl bg-white/10 text-white ring-white/20 sm:size-[72px]"
              fallback={
                iniciales ? (
                  <span className="text-display text-xl font-extrabold sm:text-2xl">{iniciales}</span>
                ) : (
                  <Shield className="size-7 sm:size-8" />
                )
              }
              canEdit={isManager}
              busy={logo.isPending}
              onPick={(file) => logo.mutate(file)}
              onRemove={() => logo.mutate(null)}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* Sin `truncate`: el nombre de un club no se entiende cortado
                    por la mitad («Club Depor…»), y aquí es el título. */}
                <h3 className="text-display text-2xl font-black tracking-tight text-white break-words sm:text-3xl">
                  {team.nombre}
                </h3>
                {/* Traducido, no el valor crudo: en crudo salía «CAPITAN» sin
                    tilde, y en inglés seguiría en español. */}
                <span className="pill bg-accent/20 text-[color:var(--color-accent)] ring-1 ring-accent/40">
                  {t(`roles.${role}`)}
                </span>
              </div>
            </div>
          </div>

          {team.descripcion && (
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
              {team.descripcion}
            </p>
          )}

          {/* A lo ancho y debajo, no al lado del nombre.

              Al lado se veía muy bien con «Los Niños» y «Málaga», y se caía
              con los datos de verdad: «Club Deportivo Compostela Pádel» más
              «Santiago de Compostela» dejaban la descripción en una palabra
              por línea, porque los datos no se encogen y el nombre sí. Aquí
              cada columna tiene un tercio de la tarjeta pase lo que pase. */}
          <div className="mt-5 hidden grid-cols-3 border-t border-white/10 pt-4 sm:grid">
            {datos.map((d, i) => (
              <div
                key={d.label}
                className={cn("min-w-0 px-4 text-center", i > 0 && "border-l border-white/10")}
              >
                <div className="text-display text-xl font-extrabold leading-tight text-white break-words lg:text-2xl">
                  {d.value}
                </div>
                <div className="mt-1.5 text-3xs font-bold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">
                  {d.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:hidden">
        {datos.map((d, i) => (
          <div
            key={d.label}
            className={cn("min-w-0 px-2.5 py-3.5 text-center", i > 0 && "border-l border-border")}
          >
            {/* 15 px y no 20: a 20, «Compostela» no entra en los ~99 px de
                una columna y se parte en «Compostel / a». */}
            <div className="text-display text-[15px] font-extrabold leading-tight break-words">
              {d.value}
            </div>
            <div className="mt-1.5 text-3xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {d.label}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3 sm:justify-between sm:px-5 sm:py-3.5">
        {/* El estado escrito solo cabe de `sm` en adelante; en el móvil lo
            lleva el punto del botón de la derecha. */}
        <span className="hidden items-center gap-2.5 text-xxs font-bold uppercase tracking-[0.10em] sm:inline-flex">
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              inscripcionesAbiertas ? "bg-accent" : "bg-muted-foreground/50",
            )}
          />
          {estado}
        </span>

        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <Link
            to="/miembros"
            className="btn-primary-brand inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-5 text-2xs font-bold uppercase tracking-[0.12em] sm:min-h-10 sm:flex-none"
          >
            {t("team.viewMembers")}
          </Link>

          {/* El botón dice «Inscripciones» y el punto dice cómo están; el
              `aria-label` dice lo que hace, que es lo que necesita quien no ve
              el punto. Solo para quien puede cambiarlo. */}
          {isOwner && (
            <button
              type="button"
              onClick={toggleInscripciones}
              disabled={togglingIns}
              aria-label={
                inscripcionesAbiertas
                  ? t("team.cerrarInscripciones")
                  : t("team.abrirInscripciones")
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-2xs font-bold uppercase tracking-[0.12em] transition-colors hover:bg-muted disabled:opacity-60 sm:min-h-10 sm:flex-none"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  inscripcionesAbiertas ? "bg-accent" : "bg-muted-foreground/50",
                )}
              />
              {t("team.inscripciones")}
            </button>
          )}
        </div>
      </div>

      {(isOwner || ["capitan", "co_capitan", "entrenador", "delegado"].includes(role)) && (
        <TeamJoinRequests teamId={team.id} compact />
      )}
    </article>
  );
}

