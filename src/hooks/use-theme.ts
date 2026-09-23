import { useCallback, useSyncExternalStore } from "react";

/**
 * El tema: claro, oscuro, o el del sistema.
 *
 * Tres estados y no dos a propósito. Con un interruptor de dos posiciones,
 * quien tiene el móvil en automático pierde el automático en cuanto lo toca
 * una vez; «sistema» es un valor real y es el de partida.
 *
 * El valor vive fuera de React, en `localStorage` más un juego de oyentes,
 * porque lo leen dos sitios a la vez —el botón y el `<html>`— y porque el
 * servidor no tiene `localStorage`: en la primera pasada devuelve el valor
 * neutro y React se encarga de la segunda. Es el mismo patrón que
 * `use-active-team`.
 *
 * Quien pinta la clase en el `<html>` no es esto: es el script que va en el
 * documento (ver `routes/__root.tsx`), que corre antes del primer pintado.
 * Aquí solo se vuelve a aplicar cuando alguien cambia el valor.
 */

export type Tema = "light" | "dark" | "system";

export const TEMA_KEY = "teamup:theme";

const oyentes = new Set<() => void>();

function esTema(v: unknown): v is Tema {
  return v === "light" || v === "dark" || v === "system";
}

function leer(): Tema {
  try {
    const v = localStorage.getItem(TEMA_KEY);
    return esTema(v) ? v : "system";
  } catch {
    // Ventana privada o almacenamiento bloqueado: se trabaja sin recordar.
    return "system";
  }
}

function suscribir(fn: () => void) {
  oyentes.add(fn);
  // Y si se cambia el tema en otra pestaña, esta se entera también.
  window.addEventListener("storage", fn);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  // Con «sistema» elegido, cambiar el tema del móvil tiene que repintar.
  media.addEventListener("change", fn);
  return () => {
    oyentes.delete(fn);
    window.removeEventListener("storage", fn);
    media.removeEventListener("change", fn);
  };
}

/** Oscuro de verdad: el elegido, o el del sistema cuando toca decidirlo él. */
export function esOscuro(tema: Tema): boolean {
  if (tema === "dark") return true;
  if (tema === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function aplicar(tema: Tema) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", esOscuro(tema));
}

export function setTema(tema: Tema) {
  try {
    localStorage.setItem(TEMA_KEY, tema);
  } catch {
    // Sin almacenamiento no se recuerda entre visitas, pero sí en esta.
  }
  aplicar(tema);
  oyentes.forEach((fn) => fn());
}

export function useTheme() {
  const tema = useSyncExternalStore(suscribir, leer, () => "system" as Tema);

  // `useSyncExternalStore` avisa cuando cambia el sistema, pero quien pone la
  // clase es `setTema`; con «sistema» elegido hay que volver a aplicarla.
  const oscuro = esOscuro(tema);
  if (typeof document !== "undefined") {
    const yaEsta = document.documentElement.classList.contains("dark");
    if (yaEsta !== oscuro) document.documentElement.classList.toggle("dark", oscuro);
  }

  const cambiar = useCallback((v: Tema) => setTema(v), []);

  return { tema, oscuro, setTema: cambiar };
}
