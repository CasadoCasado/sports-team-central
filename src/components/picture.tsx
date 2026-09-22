/**
 * El hueco de una imagen: el escudo de un equipo o la foto de una persona.
 *
 * Enseña la imagen si hay y si las imágenes están abiertas; si no, el dibujo
 * de siempre. Está en un sitio para que todos los huecos de la web se
 * comporten igual, que antes cada pantalla lo resolvía por su cuenta.
 *
 * El `onError` importa: una URL guardada puede apuntar a un fichero que ya no
 * está, y sin esto sale el icono de imagen rota del navegador.
 */

import { useEffect, useState } from "react";

import { mediaUrl } from "@/lib/api";
import { FEATURES } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export function Picture({
  url,
  alt,
  fallback,
  className,
  imgClassName,
}: {
  url: string | null | undefined;
  alt: string;
  /** El dibujo de siempre: un escudo para un equipo, iniciales para alguien. */
  fallback: React.ReactNode;
  className?: string;
  imgClassName?: string;
}) {
  const [rota, setRota] = useState(false);
  useEffect(() => setRota(false), [url]);

  const src = FEATURES.images ? mediaUrl(url) : undefined;
  const enseñaImagen = !!src && !rota;

  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden", className)}>
      {enseñaImagen ? (
        <img
          src={src}
          alt={alt}
          onError={() => setRota(true)}
          className={cn("size-full object-cover", imgClassName)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
