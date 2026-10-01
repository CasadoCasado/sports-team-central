/**
 * «Añadir invitado» en un entreno: alguien de fuera que viene a jugar, con su
 * nombre y su apodo. Queda apuntado y se le puede poner en pista o apuntar su
 * nota como a cualquiera, pero no es del equipo ni cuenta en la
 * clasificación. Si ya vino otro día con el mismo nombre y apodo, el servidor
 * lo reutiliza. Ver `POST /api/events/{id}/invitados/`.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InvitarAlEntreno({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apodo, setApodo] = useState("");

  const invitar = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/invitados/`, { nombre: nombre.trim(), apodo: apodo.trim() }),
    onSuccess: () => {
      toast.success(t("invitados.anadido", { nombre: nombre.trim() }));
      qc.invalidateQueries({ queryKey: ["event-responses", eventId] });
      setNombre("");
      setApodo("");
      setAbierto(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAbierto(true)}
        className="min-h-9 text-2xs font-bold uppercase tracking-widest"
      >
        <UserPlus className="mr-1.5 size-3.5" aria-hidden="true" />
        {t("invitados.anadir")}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nombre.trim()) invitar.mutate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{t("invitados.titulo")}</DialogTitle>
              <DialogDescription>{t("invitados.explica")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="invitado-nombre">{t("invitados.nombre")}</Label>
              <Input
                id="invitado-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invitado-apodo">{t("invitados.apodo")}</Label>
              <Input
                id="invitado-apodo"
                value={apodo}
                onChange={(e) => setApodo(e.target.value)}
                maxLength={40}
                placeholder={t("invitados.apodoPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!nombre.trim() || invitar.isPending}>
                {t("invitados.guardar")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
