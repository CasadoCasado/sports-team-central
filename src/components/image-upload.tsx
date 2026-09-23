/**
 * Poner, cambiar y quitar una imagen pequeña: el escudo de un equipo o la foto
 * de perfil de una persona.
 *
 * Se pueden quitar a propósito. Antes el escudo solo se podía elegir al crear
 * el equipo, así que uno que saliera mal —o que dejara de cargar— se quedaba
 * ahí para siempre sin forma de arreglarlo desde la web.
 */

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";

import { Picture } from "@/components/picture";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

/** Lo que acepta el servidor; se repite aquí para avisar antes de subir. */
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAXIMO = 5 * 1024 * 1024;

export function ImageUpload({
  url,
  alt,
  fallback,
  redonda,
  className,
  canEdit,
  busy,
  onPick,
  onRemove,
}: {
  url: string | null;
  alt: string;
  /** Lo que se enseña cuando no hay imagen, o cuando la que hay no carga. */
  fallback: React.ReactNode;
  redonda?: boolean;
  canEdit: boolean;
  busy?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  /** Para colocar el hueco sobre un fondo que no es el de la tarjeta. */
  className?: string;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  function elegir(file: File | null | undefined) {
    if (!file) return;
    if (!TIPOS.includes(file.type)) return alert(t("images.errType"));
    if (file.size > MAXIMO) return alert(t("images.errSize"));
    onPick(file);
  }

  const hueco = (
    <Picture
      url={url}
      alt={alt}
      fallback={fallback}
      className={cn(
        "size-14 shrink-0 bg-primary/10 text-primary ring-1 ring-border sm:size-16",
        redonda ? "rounded-full" : "rounded-lg",
        className,
      )}
    />
  );

  // Con las imágenes cerradas no hay nada que ofrecer: solo el hueco.
  if (!FEATURES.images) return hueco;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
      {hueco}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={TIPOS.join(",")}
            className="hidden"
            onChange={(e) => {
              elegir(e.target.files?.[0]);
              // Si no, elegir el mismo fichero dos veces no dispara nada.
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload className="mr-1 size-3.5" />
            {url ? t("images.change") : t("images.upload")}
          </Button>
          {url && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 className="mr-1 size-3.5" />
              {t("images.remove")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
