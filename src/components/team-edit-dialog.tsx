import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Los datos de un equipo, para corregirlos: un nombre mal escrito, un cambio
 * de ciudad o de club donde se juega.
 *
 * El deporte no se cambia: de momento todo es pádel, y pasar un equipo de un
 * deporte a otro dejaría sus partidos y resultados sin sentido. El escudo
 * tampoco va aquí: se cambia tocándolo en la tarjeta, que lo sube al momento.
 */
export function TeamEditDialog({
  team,
  open,
  onOpenChange,
}: {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(team.nombre);
  const [ciudad, setCiudad] = useState(team.ciudad ?? "");
  const [instalacion, setInstalacion] = useState(team.instalacion ?? "");
  const [descripcion, setDescripcion] = useState(team.descripcion ?? "");

  // Cada vez que se abre, desde lo que hay guardado: si se cerró a medias,
  // no se queda lo que se había escrito y no se guardó.
  useEffect(() => {
    if (!open) return;
    setNombre(team.nombre);
    setCiudad(team.ciudad ?? "");
    setInstalacion(team.instalacion ?? "");
    setDescripcion(team.descripcion ?? "");
  }, [open, team]);

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/teams/${team.id}/`, {
        nombre: nombre.trim(),
        ciudad: ciudad.trim() || null,
        instalacion: instalacion.trim() || null,
        descripcion: descripcion.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t("team.updated"));
      // El nombre sale en el selector de equipo, el menú y el buscador.
      qc.invalidateQueries({ queryKey: ["my-teams-full"] });
      qc.invalidateQueries({ queryKey: ["my-teams"] });
      qc.invalidateQueries({ queryKey: ["active-team-memberships"] });
      qc.invalidateQueries({ queryKey: ["team-discovery"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("team.editTitle")}</DialogTitle>
          <DialogDescription>{t("team.editHint")}</DialogDescription>
        </DialogHeader>
        <form
          id="team-edit"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar.mutate();
          }}
        >
          <div>
            <Label htmlFor="team-edit-nombre">{t("team.nombre")}</Label>
            <Input
              id="team-edit-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="team-edit-ciudad">{t("team.ciudad")}</Label>
              <Input
                id="team-edit-ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="team-edit-instalacion">{t("team.instalacion")}</Label>
              <Input
                id="team-edit-instalacion"
                value={instalacion}
                onChange={(e) => setInstalacion(e.target.value)}
                maxLength={100}
                placeholder={t("team.instalacionPlaceholder")}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="team-edit-descripcion">{t("team.descripcion")}</Label>
            <Textarea
              id="team-edit-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={500}
              placeholder={t("team.descripcionPlaceholder")}
              rows={4}
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={guardar.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="team-edit" disabled={guardar.isPending || !nombre.trim()}>
            {t("team.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
