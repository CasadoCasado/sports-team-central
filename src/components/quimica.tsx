import type React from "react";
import { useTranslation } from "react-i18next";
import { Check, Lock, Sparkles } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useDarQuimica } from "@/hooks/use-quimica";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

/**
 * La química del lado del jugador: con quién le gusta jugar en una
 * convocatoria.
 *
 * Se da a una persona apuntada, solo una, y solo mientras la convocatoria
 * esté abierta. Es privada: la ve quien reparte las pistas y nadie más. La
 * regla vive en el servidor (`apps/events/quimica.py`); aquí solo se pinta.
 */

export type Candidato = {
  user_id: string;
  nombre: string;
  rol: string;
};

/** El aviso violeta que explica qué es y quién lo ve. */
export function QuimicaAviso({
  cerrada,
  mia,
  className,
}: {
  cerrada: boolean;
  mia?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (cerrada) {
    return (
      <div className={cn("flex gap-3 border-b border-border bg-muted p-4 text-sm", className)}>
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p>
          <strong>{t("quimica.cerradaTitulo")}</strong>{" "}
          {mia ? t("quimica.cerradaConMia", { name: mia }) : t("quimica.cerradaSinMia")}
        </p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex gap-3 border-b border-evt-social/30 bg-evt-social/10 p-4 text-sm",
        className,
      )}
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-evt-social" aria-hidden="true" />
      <div className="space-y-1">
        <p>
          <strong className="text-evt-social">{t("quimica.pregunta")}</strong>{" "}
          {t("quimica.explica")}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3 shrink-0" aria-hidden="true" />
          {t("quimica.privada")}
        </p>
      </div>
    </div>
  );
}

/** El botón ✦ de cada compañero. */
export function QuimicaBoton({
  eventId,
  candidato,
  mia,
  cerrada,
}: {
  eventId: string;
  candidato: Candidato;
  mia: string | null;
  cerrada: boolean;
}) {
  const { t } = useTranslation();
  const dar = useDarQuimica();
  const on = mia === candidato.user_id;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={cerrada || dar.isPending}
      onClick={() => dar.mutate({ eventId, targetId: on ? null : candidato.user_id })}
      aria-label={t("quimica.conNombre", { name: candidato.nombre })}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evt-social disabled:cursor-not-allowed",
        on
          ? "border-evt-social bg-evt-social text-white"
          : "border-border bg-card text-muted-foreground hover:border-evt-social/50 hover:text-evt-social disabled:opacity-50",
      )}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      {on && t("quimica.nombre")}
    </button>
  );
}

/** La lista de apuntados con su botón, para el panel. */
function Filas({
  eventId,
  candidatos,
  mia,
  cerrada,
}: {
  eventId: string;
  candidatos: Candidato[];
  mia: string | null;
  cerrada: boolean;
}) {
  const { t } = useTranslation();
  if (candidatos.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t("quimica.nadieMas")}</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {candidatos.map((c) => (
        <li
          key={c.user_id}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5",
            mia === c.user_id && "bg-evt-social/10",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold break-words">{c.nombre}</p>
            <p className="text-xs text-muted-foreground">{c.rol}</p>
          </div>
          <QuimicaBoton eventId={eventId} candidato={c} mia={mia} cerrada={cerrada} />
        </li>
      ))}
    </ul>
  );
}

/**
 * El panel para dar química: sube desde abajo en el móvil y sale centrado en
 * escritorio. Se abre solo al apuntarse desde Enfrentamientos, y al tocar
 * «Cambiar».
 */
export function QuimicaPanel({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  candidatos,
  mia,
  recienApuntado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  candidatos: Candidato[];
  mia: string | null;
  recienApuntado: boolean;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const cuerpo = (Titulo: React.ElementType, Descripcion: React.ElementType) => (
    <div className="space-y-3">
      {recienApuntado && (
        <p className="flex items-center gap-2 rounded-lg bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {t("quimica.teHasApuntado", { title: eventTitle })}
        </p>
      )}
      <Titulo className="text-display flex items-center gap-2 text-lg font-extrabold">
        <Sparkles className="size-5 text-evt-social" aria-hidden="true" />
        {t("quimica.pregunta")}
      </Titulo>
      <Descripcion className="text-sm text-muted-foreground">{t("quimica.explica")}</Descripcion>
      <Filas eventId={eventId} candidatos={candidatos} mia={mia} cerrada={false} />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3 shrink-0" aria-hidden="true" />
        {t("quimica.privada")}
      </p>
      <Button
        onClick={() => onOpenChange(false)}
        variant={mia ? "default" : "outline"}
        className="min-h-11 w-full text-2xs font-bold uppercase tracking-widest"
      >
        {mia ? t("quimica.listo") : t("quimica.ahoraNo")}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[88dvh] rounded-t-2xl border-border bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="overflow-y-auto pt-4">{cuerpo(DrawerTitle, DrawerDescription)}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        {cuerpo(DialogTitle, DialogDescription)}
      </DialogContent>
    </Dialog>
  );
}
