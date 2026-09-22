/**
 * Poner, cambiar y quitar una imagen pequeña: el escudo de un equipo o la foto
 * de perfil de una persona.
 *
 * Se pueden quitar a propósito. Antes el escudo solo se podía elegir al crear
 * el equipo, así que uno que saliera mal —o que dejara de cargar— se quedaba
 * ahí para siempre sin forma de arreglarlo desde la web.
 */

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Lo que acepta el servidor; se repite aquí para avisar antes de subir. */
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAXIMO = 5 * 1024 * 1024;

export function ImageUpload({
  url,
  alt,
  fallback,
  redonda,
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
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  // Una URL guardada puede apuntar a un fichero que ya no está. Sin esto se
  // vería el icono de imagen rota del navegador, que es lo que pasaba.
  const [rota, setRota] = useState(false);
  const src = mediaUrl(url);
  const enseñaImagen = !!src && !rota;

  function elegir(file: File | null | undefined) {
    if (!file) return;
    if (!TIPOS.includes(file.type)) return alert(t("images.errType"));
    if (file.size > MAXIMO) return alert(t("images.errSize"));
    setRota(false);
    onPick(file);
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex size-16 shrink-0 items-center justify-center overflow-hidden bg-primary/10 text-primary ring-1 ring-border",
          redonda ? "rounded-full" : "rounded-lg",
        )}
      >
        {enseñaImagen ? (
          <img
            src={src}
            alt={alt}
            onError={() => setRota(true)}
            className="size-full object-cover"
          />
        ) : (
          fallback
        )}
      </div>

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
          {rota && url && (
            <span className="text-2xs text-muted-foreground">{t("images.broken")}</span>
          )}
        </div>
      )}
    </div>
  );
}
