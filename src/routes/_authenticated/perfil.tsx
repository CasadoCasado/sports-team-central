import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PushSettings } from "@/components/push-settings";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

function Perfil() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { data: profile, refetch } = useProfile();

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
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
      const { error } = await supabase
        .from("profiles")
        .update({
          nombre: nombre.trim(),
          apellidos: apellidos.trim(),
          telefono: telefono.trim() || null,
          ciudad: ciudad.trim() || null,
          posicion: posicion.trim() || null,
          mano_dominante: mano.trim() || null,
          nivel: nivel.trim() || null,
          descripcion: descripcion.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("profile.updated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-display text-3xl font-black tracking-tight">{t("profile.title")}</h1>

      <form onSubmit={save} className="space-y-6">
        <section className="surface-card p-6">
          <h2 className="text-[10px] mb-4 font-bold uppercase tracking-widest text-primary">
            {t("profile.personal")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nombre">{t("auth.nombre")}</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="apellidos">{t("auth.apellidos")}</Label>
              <Input id="apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="telefono">{t("profile.telefono")}</Label>
              <Input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} />
            </div>
            <div>
              <Label htmlFor="ciudad">{t("profile.ciudad")}</Label>
              <Input id="ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} maxLength={100} />
            </div>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-[10px] mb-4 font-bold uppercase tracking-widest text-primary">
            {t("profile.sports")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="posicion">{t("profile.posicion")}</Label>
              <Input id="posicion" value={posicion} onChange={(e) => setPosicion(e.target.value)} maxLength={50} />
            </div>
            <div>
              <Label htmlFor="mano">{t("profile.manoDominante")}</Label>
              <Input id="mano" value={mano} onChange={(e) => setMano(e.target.value)} maxLength={20} />
            </div>
            <div>
              <Label htmlFor="nivel">{t("profile.nivel")}</Label>
              <Input id="nivel" value={nivel} onChange={(e) => setNivel(e.target.value)} maxLength={30} />
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
          className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
        >
          {t("profile.save")}
        </Button>
      </form>

      <PushSettings />
    </div>
  );
}
