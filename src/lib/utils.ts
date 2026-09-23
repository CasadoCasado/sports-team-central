import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * «Los Niños» → «LN». El hueco de un escudo cuando no hay imagen.
 *
 * Con las imágenes cerradas, ahí iba un escudo genérico igual para todos los
 * equipos, que no identifica ninguno. Las iniciales sí, y es lo que ya se hace
 * con las personas en el resto de la web. Dos letras: es lo que cabe en el
 * cuadrado sin encoger la tipografía.
 */
export function inicialesDe(nombre: string) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return palabras
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
