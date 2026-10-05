/**
 * En el móvil la ventana no se amplía ni se arrastra de lado: solo sube y baja.
 *
 * El viewport ya pide `user-scalable=no`, pero Safari en el iPhone no lo
 * respeta para el pellizco, y ampliada la página se arrastraba de lado a lado.
 * Aquí se frena a mano:
 *
 * - el pellizco: los `gesture*` de Safari y cualquier arrastre con dos dedos;
 * - el arrastre lateral, salvo que empiece dentro de algo que de verdad se
 *   desplaza de lado (una tabla ancha, una fila de pestañas) o que gestiona su
 *   propio arrastre (`touch-action: none`: tableros, deslizadores).
 *
 * Devuelve la función que lo quita.
 */
export function fijarPantalla(): () => void {
  if (typeof document === "undefined") return () => {};

  const cancelar = (e: Event) => e.preventDefault();

  let inicio: { x: number; y: number } | null = null;
  // Se decide con el primer movimiento y vale para todo el gesto.
  let lateralBloqueado: boolean | null = null;

  const desplazaDeLado = (el: Element | null) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.touchAction === "none") return true;
      if (n instanceof HTMLInputElement && n.type === "range") return true;
      if (
        (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
        n.scrollWidth > n.clientWidth + 1
      )
        return true;
    }
    return false;
  };

  const alEmpezar = (e: TouchEvent) => {
    const t = e.touches[0];
    inicio = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    lateralBloqueado = null;
  };

  const alMover = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault();
      return;
    }
    const t = e.touches[0];
    if (!inicio || !t) return;
    if (lateralBloqueado === null) {
      const dx = Math.abs(t.clientX - inicio.x);
      const dy = Math.abs(t.clientY - inicio.y);
      if (dx < 4 && dy < 4) return;
      lateralBloqueado = dx > dy && !desplazaDeLado(e.target as Element);
    }
    if (lateralBloqueado && e.cancelable) e.preventDefault();
  };

  const opciones = { passive: false } as const;
  document.addEventListener("gesturestart", cancelar, opciones);
  document.addEventListener("gesturechange", cancelar, opciones);
  document.addEventListener("gestureend", cancelar, opciones);
  document.addEventListener("touchstart", alEmpezar, { passive: true });
  document.addEventListener("touchmove", alMover, opciones);

  return () => {
    document.removeEventListener("gesturestart", cancelar);
    document.removeEventListener("gesturechange", cancelar);
    document.removeEventListener("gestureend", cancelar);
    document.removeEventListener("touchstart", alEmpezar);
    document.removeEventListener("touchmove", alMover);
  };
}
