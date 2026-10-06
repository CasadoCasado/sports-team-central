/**
 * Arrastrar con el dedo solo después de mantener pulsado.
 *
 * En una tira que se desliza de lado (el banquillo del móvil), si el arrastre
 * empezara al tocar, deslizar la tira cogería a un jugador. Así:
 *
 * - tocar sigue siendo tocar (el clic llega normal);
 * - mover el dedo de lado antes de tiempo desliza la tira;
 * - mantener pulsado un momento sin moverlo coge al jugador para arrastrarlo.
 *
 * La tira la desliza esto, no el navegador: las fichas llevan
 * `touch-action: none`, porque una vez que el navegador empieza a desplazar,
 * ni Chrome ni Safari dejan pararlo para convertirlo en un arrastre.
 */

/** Lo que hay que mantener pulsado, y lo que se puede mover el dedo mientras. */
const ESPERA_MS = 350;
const TOLERANCIA_PX = 8;

/**
 * Espera la pulsación larga del puntero que empieza en `e`. Si aguanta, llama
 * a `activar`. Si antes se mueve de lado, desliza `tira` (y avisa con
 * `alDeslizar`, para que el clic del final no cuente como un toque).
 */
export function esperarPulsacionLarga(
  e: { pointerId: number; clientX: number; clientY: number },
  activar: () => void,
  tira?: HTMLElement | null,
  alDeslizar?: () => void,
) {
  // Tocar la tira mientras aún se desliza la para, como una lista normal.
  pararInercia?.();
  const { pointerId, clientX: x0, clientY: y0 } = e;
  const inicioTira = tira?.scrollLeft ?? 0;
  let deslizando = false;
  let ultimo = { x: x0, t: performance.now() };
  let velocidad = 0; // px por ms, positiva hacia la derecha

  const reloj = window.setTimeout(() => {
    limpiar();
    activar();
  }, ESPERA_MS);

  const alMover = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const dx = ev.clientX - x0;
    const dy = ev.clientY - y0;
    if (!deslizando) {
      if (Math.hypot(dx, dy) <= TOLERANCIA_PX) return;
      window.clearTimeout(reloj);
      if (!tira || Math.abs(dx) < Math.abs(dy)) return limpiar();
      deslizando = true;
      alDeslizar?.();
    }
    tira!.scrollLeft = inicioTira - dx;
    const ahora = performance.now();
    if (ahora > ultimo.t) velocidad = (ev.clientX - ultimo.x) / (ahora - ultimo.t);
    ultimo = { x: ev.clientX, t: ahora };
  };
  const alAcabar = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    limpiar();
    if (deslizando && tira) inercia(tira, velocidad);
  };
  function limpiar() {
    window.clearTimeout(reloj);
    window.removeEventListener("pointermove", alMover);
    window.removeEventListener("pointerup", alAcabar);
    window.removeEventListener("pointercancel", alAcabar);
  }
  window.addEventListener("pointermove", alMover);
  window.addEventListener("pointerup", alAcabar);
  window.addEventListener("pointercancel", alAcabar);
}

/** La inercia en marcha, si la hay: un toque nuevo la para. */
let pararInercia: (() => void) | null = null;

/** Al soltar deslizando, la tira sigue un poco y frena, como la de verdad. */
function inercia(tira: HTMLElement, velocidad: number) {
  if (Math.abs(velocidad) <= 0.1) return;
  let v = velocidad;
  let antes = performance.now();
  let marco = 0;
  const paso = (ahora: number) => {
    const dt = Math.min(ahora - antes, 32);
    antes = ahora;
    tira.scrollLeft -= v * dt;
    v *= Math.pow(0.95, dt / 16);
    if (Math.abs(v) > 0.02) marco = requestAnimationFrame(paso);
    else pararInercia = null;
  };
  marco = requestAnimationFrame(paso);
  pararInercia = () => {
    cancelAnimationFrame(marco);
    pararInercia = null;
  };
}

/** Un pequeño aviso al cogerlo, donde el teléfono lo permite. */
export function vibrarAlCoger() {
  try {
    navigator.vibrate?.(25);
  } catch {
    // Sin vibración: no pasa nada.
  }
}
