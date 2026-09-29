import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Confirmaciones con nuestro modal, nunca el `confirm()` del navegador: ese
 * sale con el dominio en la cabecera («…workers.dev dice»), sin tema oscuro y
 * con los botones del sistema.
 *
 *   if (!(await confirmar({ title, description, confirmLabel, tone: "danger" }))) return;
 *
 * Se llama desde cualquier sitio, como el de siempre; `<ConfirmHost />`, montado
 * una vez en la raíz, es quien lo pinta.
 */

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** Texto del botón que confirma. Mejor el verbo («Borrar equipo») que «Aceptar». */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para lo que borra o saca a alguien: botón e icono en rojo. */
  tone?: "danger" | "default";
  icon?: ComponentType<{ className?: string }>;
};

type Peticion = ConfirmOptions & { resolver: (ok: boolean) => void };

let actual: Peticion | null = null;
const listeners = new Set<() => void>();

function avisar() {
  listeners.forEach((fn) => fn());
}

export function confirmar(opciones: ConfirmOptions): Promise<boolean> {
  return new Promise((resolver) => {
    // Si ya había uno abierto, ese se da por cancelado.
    actual?.resolver(false);
    actual = { ...opciones, resolver };
    avisar();
  });
}

function responder(ok: boolean) {
  if (!actual) return;
  actual.resolver(ok);
  actual = null;
  avisar();
}

function suscribir(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function ConfirmHost() {
  const { t } = useTranslation();
  const peticion = useSyncExternalStore(
    suscribir,
    () => actual,
    () => null,
  );

  // Se guarda la última para que el texto no desaparezca mientras el modal
  // hace su animación de salida.
  const [mostrada, setMostrada] = useState<Peticion | null>(null);
  useEffect(() => {
    if (peticion) setMostrada(peticion);
  }, [peticion]);

  const p = peticion ?? mostrada;
  const peligro = p?.tone === "danger";
  const Icono = p?.icon ?? (peligro ? Trash2 : AlertTriangle);

  return (
    <AlertDialog open={!!peticion} onOpenChange={(open) => !open && responder(false)}>
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:p-0">
        <AlertDialogHeader className="items-center gap-3 space-y-0 px-6 pb-6 pt-7 sm:items-start">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-12 place-items-center rounded-2xl ring-1",
              peligro
                ? "bg-destructive/10 text-destructive ring-destructive/25"
                : "bg-primary/10 text-primary ring-primary/25",
            )}
          >
            <Icono className="size-[22px]" />
          </span>
          <AlertDialogTitle className="text-display text-xl font-black tracking-tight">
            {p?.title}
          </AlertDialogTitle>
          {p?.description && (
            <AlertDialogDescription className="leading-relaxed">
              {p.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel className="mt-0 min-h-11 text-2xs font-bold uppercase tracking-widest sm:min-h-10">
            {p?.cancelLabel ?? t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => responder(true)}
            className={cn(
              "min-h-11 text-2xs font-bold uppercase tracking-widest sm:min-h-10",
              peligro
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:opacity-90",
            )}
          >
            {p?.confirmLabel ?? t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
