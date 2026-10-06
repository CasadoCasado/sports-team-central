import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * Un teléfono, no una tableta: menos de 640 px de ancho. Cualquier teléfono
 * en vertical mide menos de 440, y la tableta más pequeña (iPad mini) 744.
 * Para lo que solo cambia en el teléfono y debe dejar la tableta como el
 * ordenador; va con `sm:` de Tailwind.
 */
const TELEFONO = 640;

export function useEsTelefono() {
  const [es, setEs] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TELEFONO - 1}px)`);
    const onChange = () => setEs(mql.matches);
    mql.addEventListener("change", onChange);
    setEs(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return es;
}
