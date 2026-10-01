/**
 * Lo que se ve mientras llegan los datos de PRO: una pelota que bota sobre la
 * pista azul, de un lado a otro de la red. Es la animación de la bienvenida a
 * PRO del lienzo de diseño. Sin movimiento si el sistema lo pide.
 */

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export function CargandoPro({ texto, className }: { texto?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-4 py-10", className)}
    >
      <div className="relative aspect-[5/2] w-full max-w-[320px] overflow-hidden rounded-lg bg-[#1d4fa3] shadow-[inset_0_0_0_3px_rgb(190_215_255/0.35)]">
        <div className="absolute inset-[6%] border-2 border-white/85" />
        <div className="absolute inset-y-[3%] left-1/2 w-[3px] -translate-x-1/2 bg-white/80" />
        <div className="absolute inset-y-[6%] left-[16%] w-0.5 bg-white/85" />
        <div className="absolute inset-y-[6%] right-[16%] w-0.5 bg-white/85" />
        <div className="absolute inset-x-[16%] top-1/2 h-0.5 bg-white/85" />
        {/* La pelota va de un lado a otro y bota; la sombra se encoge cuando sube. */}
        <div className="pro-avance absolute bottom-[16%] -ml-3">
          <div className="pro-sombra mx-auto mt-[26px] h-1.5 w-5 rounded-full bg-black/45" />
          <div className="pro-bote absolute bottom-1 left-0 size-6 rounded-full bg-[#d7f24b] shadow-[inset_-3px_-3px_0_rgb(0_0_0/0.12)]">
            <span className="absolute -left-2 top-1 size-5 rounded-full border-2 border-transparent border-r-white/80" />
            <span className="absolute left-3 -top-1 size-5 rounded-full border-2 border-transparent border-l-white/80" />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{texto ?? t("pro.cargando")}</p>
    </div>
  );
}
