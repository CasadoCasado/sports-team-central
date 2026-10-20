/**
 * Las claves que la web guarda en el navegador, del nombre viejo al nuevo.
 *
 * Hasta octubre de 2026 la app se llamaba TeamUp y guardaba la sesión, el tema,
 * la guía vista, la barra fijada y el modo PRO como `teamup:…`. Ahora son
 * `teamsup:…`. Sin esto, al cambiar el nombre todo el mundo habría perdido la
 * sesión y vuelto a ver la guía de bienvenida. Se copia cada clave vieja a la
 * nueva (si la nueva no existe ya) y se borra la vieja; después no hace nada.
 */

const ANTIGUO = "teamup:";
const NUEVO = "teamsup:";

export function migrarClavesLocales() {
  if (typeof window === "undefined") return;
  try {
    const viejas: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave?.startsWith(ANTIGUO)) viejas.push(clave);
    }
    for (const vieja of viejas) {
      const nueva = NUEVO + vieja.slice(ANTIGUO.length);
      const valor = localStorage.getItem(vieja);
      if (valor !== null && localStorage.getItem(nueva) === null)
        localStorage.setItem(nueva, valor);
      localStorage.removeItem(vieja);
    }
  } catch {
    // Ventana privada o almacenamiento bloqueado: no hay nada que migrar.
  }
}
