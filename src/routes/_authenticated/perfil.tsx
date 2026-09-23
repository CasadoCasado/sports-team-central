import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import { invalidateUser } from "@/lib/auth";
import { traducirErrorDeImagen } from "@/lib/images";
import { ImageUpload } from "@/components/image-upload";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
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
import { PushSettings } from "@/components/push-settings";
import { ReminderSettings } from "@/components/reminder-settings";
import { FontSizeControl } from "@/components/font-size-control";
import { restartGuidedTour } from "@/components/guided-tour";
import { SPORTS, sportLabel } from "@/lib/sports";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil | TeamUp" },
      {
        name: "description",
        content:
          "Actualiza tus datos, recordatorios, notificaciones push y preferencias de la aplicación.",
      },
      { property: "og:title", content: "Perfil | TeamUp" },
      {
        property: "og:description",
        content:
          "Actualiza tus datos, recordatorios, notificaciones push y preferencias de la aplicación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const { data: profile, refetch } = useProfile();
  const qc = useQueryClient();

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [deporte, setDeporte] = useState("");
  const [posicion, setPosicion] = useState("");
  const [mano, setMano] = useState("");
  const [nivel, setNivel] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre ?? "");
      setApellidos(profile.apellidos ?? "");
      setTelefono(profile.telefono ?? "");
      setCiudad(profile.ciudad ?? "");
      setDeporte(profile.deporte ?? "");
      setPosicion(profile.posicion ?? "");
      setMano(profile.mano_dominante ?? "");
      setNivel(profile.nivel ?? "");
      setDescripcion(profile.descripcion ?? "");
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await api.patch("/profiles/me/", {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim() || null,
        ciudad: ciudad.trim() || null,
        deporte: deporte || null,
        posicion: posicion.trim() || null,
        mano_dominante: mano.trim() || null,
        nivel: nivel.trim() || null,
        descripcion: descripcion.trim() || null,
      });
      // El nombre se pinta en la barra lateral desde el usuario cacheado.
      invalidateUser();
      toast.success(t("profile.updated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  // `null` quita la foto; un fichero la pone o la sustituye.
  const avatar = useMutation({
    mutationFn: async (file: File | null) => {
      if (file === null) return api.delete("/profiles/me/avatar/");
      const form = new FormData();
      form.append("file", file);
      return api.upload("/profiles/me/avatar/", form);
    },
    onSuccess: (_d, file) => {
      toast.success(file ? t("images.saved") : t("images.removed"));
      // La foto se pinta también en el chat y en la barra lateral.
      invalidateUser();
      refetch();
      qc.invalidateQueries({ queryKey: ["team-member-options"] });
      qc.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (e: Error) => toast.error(traducirErrorDeImagen(e.message, t)),
  });

  const initials =
    ((profile?.nombre?.[0] ?? "") + (profile?.apellidos?.[0] ?? "")).toUpperCase() || "U";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">{t("profile.myProfile")}</h1>

      {/* Resumen de cuenta */}
      <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <ImageUpload
          url={profile?.avatar_url ?? null}
          alt={[profile?.nombre, profile?.apellidos].filter(Boolean).join(" ")}
          fallback={<span className="text-base font-bold">{initials}</span>}
          redonda
          canEdit
          busy={avatar.isPending}
          onPick={(file) => avatar.mutate(file)}
          onRemove={() => avatar.mutate(null)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-display truncate text-lg font-bold">
            {[profile?.nombre, profile?.apellidos].filter(Boolean).join(" ") || "—"}
          </p>
          <p className="mt-1 flex items-center gap-2 truncate text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{profile?.email ?? user?.email ?? "—"}</span>
          </p>
          <p className="mt-1 text-2xs font-bold uppercase tracking-widest text-primary">
            {t("profile.deporte")}: {sportLabel(profile?.deporte, i18n.language)}
          </p>
        </div>
      </section>

      <form onSubmit={save} className="space-y-6">
        <section className="surface-card p-6">
          <h2 className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary">
            {t("profile.personal")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nombre">{t("auth.nombre")}</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="apellidos">{t("auth.apellidos")}</Label>
              <Input
                id="apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input id="email" value={profile?.email ?? user?.email ?? ""} readOnly disabled />
            </div>
            <div>
              <Label htmlFor="telefono">{t("profile.telefono")}</Label>
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={30}
              />
            </div>
            <div>
              <Label htmlFor="ciudad">{t("profile.ciudad")}</Label>
              <Input
                id="ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary">
            {t("profile.sports")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="deporte">{t("profile.deporte")}</Label>
              <Select value={deporte} onValueChange={setDeporte}>
                <SelectTrigger id="deporte" className="min-h-11">
                  <SelectValue placeholder={t("profile.deportePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {i18n.language.startsWith("en") ? s.labelEn : s.labelEs}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="posicion">{t("profile.posicion")}</Label>
              <Input
                id="posicion"
                value={posicion}
                onChange={(e) => setPosicion(e.target.value)}
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="mano">{t("profile.manoDominante")}</Label>
              <Input
                id="mano"
                value={mano}
                onChange={(e) => setMano(e.target.value)}
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="nivel">{t("profile.nivel")}</Label>
              <Input
                id="nivel"
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="descripcion">{t("profile.descripcion")}</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              rows={4}
            />
          </div>
        </section>

        <Button
          type="submit"
          disabled={saving}
          className="min-h-11 w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90 sm:w-auto"
        >
          {t("profile.save")}
        </Button>
      </form>

      <section className="surface-card p-6">
        <h2 className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary">
          {t("profile.accessibility")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("profile.fontSizeHint")}</p>
          <FontSizeControl />
        </div>
      </section>

      <section className="surface-card p-6">
        <h2 className="text-2xs mb-4 font-bold uppercase tracking-widest text-primary">
          {t("tour.title")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("tour.restartHint")}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={restartGuidedTour}>
            {t("tour.restart")}
          </Button>
        </div>
      </section>

      <ReminderSettings />
      <PushSettings />
    </div>
  );
}
