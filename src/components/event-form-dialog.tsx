import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventType, Team, TrainingFormat } from "@/lib/types";

const FORMATOS: TrainingFormat[] = ["rey_pista", "partidos", "americano"];
import { teamRegistrationsQuery } from "@/lib/official-competitions";


export type EventFormValues = {
  id?: string;
  tipo: EventType;
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string;
  rival: string;
  es_local: boolean;
  competition_id: string | null;
  registration_id: string | null;
  requiere_convocatoria: boolean;
  convocatoria_cierra_en: string;
  padel_num_pistas: number | null;
  formato_entreno: TrainingFormat | null;
};

const emptyValues = (): EventFormValues => ({
  tipo: "entrenamiento",
  titulo: "",
  descripcion: "",
  fecha_inicio: "",
  fecha_fin: "",
  ubicacion: "",
  rival: "",
  es_local: true,
  competition_id: null,
  registration_id: null,
  requiere_convocatoria: false,
  convocatoria_cierra_en: "",
  padel_num_pistas: null,
  formato_entreno: null,
});

export function EventFormDialog({
  open,
  onOpenChange,
  teamId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamId: string;
  initial?: Partial<EventFormValues>;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const [values, setValues] = useState<EventFormValues>({ ...emptyValues(), ...initial });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues({ ...emptyValues(), ...initial });
  }, [open, initial]);

  const { data: competitions } = useQuery({
    queryKey: ["competitions", teamId],
    enabled: !!teamId && open,
    queryFn: () =>
      api.get<{ id: string; nombre: string; formato: TrainingFormat | null }[]>(
        "/competitions/",
        { team_id: teamId, order: "-created_at" },
      ),
  });

  // Dentro de una competición manda su formato, así que el selector propio
  // solo tiene sentido —y solo se manda— cuando el entreno va suelto.
  const competicionElegida = competitions?.find((c) => c.id === values.competition_id);

  const { data: team } = useQuery({
    queryKey: ["team-sport", teamId],
    enabled: !!teamId && open,
    queryFn: () => api.get<Team>(`/teams/${teamId}/`),
  });
  const isPadel = team?.deporte === "padel";

  const { data: registrations } = useQuery({
    ...teamRegistrationsQuery(teamId),
    enabled: !!teamId && open,
  });

  const [officialCompetitionId, setOfficialCompetitionId] = useState<string | null>(null);

  // Distinct official competitions the team has previously registered in.
  const officialCompetitions = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string }>();
    for (const r of registrations ?? []) {
      if (!map.has(r.competition_id)) {
        map.set(r.competition_id, { id: r.competition_id, nombre: r.competition_nombre });
      }
    }
    return [...map.values()];
  }, [registrations]);

  // Only inscriptions belonging to the selected official competition are choosable.
  const filteredRegistrations = useMemo(
    () =>
      officialCompetitionId
        ? (registrations ?? []).filter((r) => r.competition_id === officialCompetitionId)
        : [],
    [registrations, officialCompetitionId],
  );

  // Preselect the competition of an already linked inscription (edit mode).
  useEffect(() => {
    if (!open) return;
    const current = (registrations ?? []).find((r) => r.id === values.registration_id);
    setOfficialCompetitionId(current?.competition_id ?? null);
  }, [open, registrations, values.registration_id]);

  // Drop a stale inscription if it no longer matches the selected competition.
  useEffect(() => {
    if (!values.registration_id) return;
    if (!filteredRegistrations.some((r) => r.id === values.registration_id)) {
      setValues((s) => ({ ...s, registration_id: null }));
    }
  }, [filteredRegistrations, values.registration_id]);

  const [registrationError, setRegistrationError] = useState<string | null>(null);

  useEffect(() => {
    setRegistrationError(null);
  }, [values.registration_id, officialCompetitionId, open]);




  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user");
      if (!values.titulo.trim()) throw new Error(t("auth.required"));
      if (!values.fecha_inicio) throw new Error(t("auth.required"));
      const payload = {
        team_id: teamId,
        tipo: values.tipo,
        titulo: values.titulo.trim(),
        descripcion: values.descripcion.trim() || null,
        fecha_inicio: new Date(values.fecha_inicio).toISOString(),
        fecha_fin: values.fecha_fin ? new Date(values.fecha_fin).toISOString() : null,
        ubicacion: values.ubicacion.trim() || null,
        rival: values.rival.trim() || null,
        es_local: values.tipo === "partido" ? values.es_local : null,
        competition_id: values.competition_id,
        registration_id: values.tipo === "partido" ? values.registration_id : null,
        requiere_convocatoria: values.requiere_convocatoria,
        convocatoria_cierra_en: values.convocatoria_cierra_en
          ? new Date(values.convocatoria_cierra_en).toISOString()
          : null,
        padel_num_pistas:
          isPadel && values.tipo === "partido" && values.padel_num_pistas
            ? values.padel_num_pistas
            : null,
        formato_entreno:
          values.tipo === "entrenamiento" && !values.competition_id
            ? values.formato_entreno
            : null,
      };
      if (values.id) {
        await api.patch(`/events/${values.id}/`, payload);
        return { updated: true };
      }
      // Al crear, el servidor avisa al resto del equipo (notificación y push).
      await api.post("/events/", payload);
      return { updated: false };
    },
    onSuccess: (r) => {
      toast.success(r.updated ? t("events.updated") : t("events.created"));
      qc.invalidateQueries({ queryKey: ["events"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      const msg = e.message || "";
      if (msg.includes("registration_team_mismatch") || msg.includes("invalid_registration")) {
        setRegistrationError(t("events.errors.registrationMismatch"));
        toast.error(t("events.errors.registrationMismatch"));
      } else if (msg.includes("registration_not_active")) {
        setRegistrationError(t("events.errors.registrationNotActive"));
        toast.error(t("events.errors.registrationNotActive"));
      } else {
        toast.error(msg || t("common.error"));
      }
    },


    onSettled: () => setSaving(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{values.id ? t("events.edit") : t("events.create")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            save.mutate();
          }}
        >
          <div>
            <Label>{t("events.tipo")}</Label>
            <Select
              value={values.tipo}
              onValueChange={(v) => setValues((s) => ({ ...s, tipo: v as EventType }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["entrenamiento", "partido", "torneo", "reunion", "otro"] as EventType[]).map((tp) => (
                  <SelectItem key={tp} value={tp}>{t(`events.types.${tp}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("events.titulo")}</Label>
            <Input
              value={values.titulo}
              onChange={(e) => setValues((s) => ({ ...s, titulo: e.target.value }))}
              required
              maxLength={120}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("events.fechaInicio")}</Label>
              <Input
                type="datetime-local"
                value={values.fecha_inicio}
                onChange={(e) => setValues((s) => ({ ...s, fecha_inicio: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>{t("events.fechaFin")}</Label>
              <Input
                type="datetime-local"
                value={values.fecha_fin}
                onChange={(e) => setValues((s) => ({ ...s, fecha_fin: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>{t("events.ubicacion")}</Label>
            <Input
              value={values.ubicacion}
              onChange={(e) => setValues((s) => ({ ...s, ubicacion: e.target.value }))}
              maxLength={200}
            />
          </div>
          {/* Un entrenamiento también puede colgar de una competición: es lo
              que hace que su resultado cuente para la clasificación. */}
          {(values.tipo === "partido" || values.tipo === "entrenamiento") && (
            <div>
              <Label>{t("events.competicion")}</Label>
              <Select
                value={values.competition_id ?? "none"}
                onValueChange={(v) =>
                  setValues((s) => ({ ...s, competition_id: v === "none" ? null : v }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("events.sinCompeticion")}</SelectItem>
                  {competitions?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {values.tipo === "entrenamiento" && (
                <p className="mt-1.5 text-xxs text-muted-foreground">
                  {t("events.competicionEntrenoHint")}
                </p>
              )}
            </div>
          )}
          {values.tipo === "entrenamiento" &&
            (values.competition_id ? (
              <p className="rounded-md border border-border p-3 text-xxs text-muted-foreground">
                {t("events.formatoDeLaCompeticion", {
                  formato: t(
                    `competitions.formatos.${competicionElegida?.formato ?? "ninguno"}`,
                  ),
                })}
              </p>
            ) : (
              <div>
                <Label>{t("events.formatoEntreno")}</Label>
                <Select
                  value={values.formato_entreno ?? "none"}
                  onValueChange={(v) =>
                    setValues((s) => ({
                      ...s,
                      formato_entreno: v === "none" ? null : (v as TrainingFormat),
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("competitions.formatos.ninguno")}</SelectItem>
                    {FORMATOS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(`competitions.formatos.${f}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xxs text-muted-foreground">
                  {t("events.formatoEntrenoHint")}
                </p>
              </div>
            ))}
          {values.tipo === "partido" && (
            <>
              <div>
                <Label>{t("events.rival")}</Label>
                <Input
                  value={values.rival}
                  onChange={(e) => setValues((s) => ({ ...s, rival: e.target.value }))}
                  maxLength={100}
                />
              </div>
              {(registrations?.length ?? 0) > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("events.competicionOficialTipo")}</Label>
                    <Select
                      value={officialCompetitionId ?? "none"}
                      onValueChange={(v) => {
                        setOfficialCompetitionId(v === "none" ? null : v);
                        setValues((s) => ({ ...s, registration_id: null }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("events.sinCompeticion")}</SelectItem>
                        {officialCompetitions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="registration_id"
                      className={registrationError ? "text-destructive" : undefined}
                    >
                      {t("events.competicionOficial")}
                    </Label>
                    <Select
                      value={values.registration_id ?? "none"}
                      disabled={!officialCompetitionId}
                      onValueChange={(v) =>
                        setValues((s) => ({ ...s, registration_id: v === "none" ? null : v }))
                      }
                    >
                      <SelectTrigger
                        id="registration_id"
                        aria-invalid={registrationError ? true : undefined}
                        aria-describedby={registrationError ? "registration_id-error" : undefined}
                        className={
                          registrationError
                            ? "border-destructive ring-2 ring-destructive/30 focus:ring-destructive"
                            : undefined
                        }
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("events.sinCompeticion")}</SelectItem>
                        {filteredRegistrations.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {[
                              r.category_nombre,
                              r.division_nombre,
                              r.temporada,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {registrationError && (
                      <p
                        id="registration_id-error"
                        role="alert"
                        className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive"
                      >
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>{registrationError}</span>
                      </p>
                    )}
                  </div>

                </div>
              )}

              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="es_local" className="cursor-pointer">{t("events.esLocal")}</Label>
                <Switch
                  id="es_local"
                  checked={values.es_local}
                  onCheckedChange={(v) => setValues((s) => ({ ...s, es_local: v }))}
                />
              </div>
              {isPadel && (
                <div>
                  <Label>{t("events.padelPistas")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={values.padel_num_pistas ?? ""}
                    onChange={(e) =>
                      setValues((s) => ({
                        ...s,
                        padel_num_pistas: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder={t("events.padelPistasHint")}
                  />
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="req_conv" className="cursor-pointer">{t("events.requiereConvocatoria")}</Label>
            <Switch
              id="req_conv"
              checked={values.requiere_convocatoria}
              onCheckedChange={(v) => setValues((s) => ({ ...s, requiere_convocatoria: v }))}
            />
          </div>
          {values.requiere_convocatoria && (
            <div>
              <Label>{t("events.cierreConvocatoria")}</Label>
              <Input
                type="datetime-local"
                value={values.convocatoria_cierra_en}
                onChange={(e) =>
                  setValues((s) => ({ ...s, convocatoria_cierra_en: e.target.value }))
                }
              />
            </div>
          )}
          <div>
            <Label>{t("events.descripcion")}</Label>
            <Textarea
              value={values.descripcion}
              onChange={(e) => setValues((s) => ({ ...s, descripcion: e.target.value }))}
              rows={3}
              maxLength={800}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {values.id ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
