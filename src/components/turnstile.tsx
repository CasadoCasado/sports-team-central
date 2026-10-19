/**
 * Turnstile, el antibots de Cloudflare, para el registro.
 *
 * Solo con `VITE_TURNSTILE_SITE_KEY` (variable de compilación): sin ella no se
 * pinta nada, no se carga el script de Cloudflare y el backend tampoco lo pide
 * (desarrollo y e2e). La respuesta del reto la comprueba el backend con su
 * clave secreta (`apps/accounts/turnstile.py`).
 *
 * Cada respuesta vale una sola vez: si el registro falla, hay que montar el
 * componente de nuevo (cambiándole la `key`) para tener otra.
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { TURNSTILE_SITE_KEY as SITE_KEY } from "@/lib/turnstile";

type Widget = {
  render: (elemento: HTMLElement, opciones: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Widget;
  }
}

let cargando: Promise<Widget> | null = null;

function cargarScript(): Promise<Widget> {
  cargando ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject());
    script.onerror = () => {
      cargando = null;
      reject();
    };
    document.head.appendChild(script);
  });
  return cargando;
}

export function Turnstile({ onRespuesta }: { onRespuesta: (respuesta: string | null) => void }) {
  const { i18n } = useTranslation();
  const caja = useRef<HTMLDivElement>(null);
  // La función puede cambiar en cada render; el widget se monta una vez.
  const avisar = useRef(onRespuesta);
  avisar.current = onRespuesta;

  useEffect(() => {
    if (!SITE_KEY) return;
    let id: string | undefined;
    let desmontado = false;
    cargarScript()
      .then((widget) => {
        if (desmontado || !caja.current) return;
        id = widget.render(caja.current, {
          sitekey: SITE_KEY,
          language: i18n.language.startsWith("en") ? "en" : "es",
          theme: "auto",
          callback: (respuesta: string) => avisar.current(respuesta),
          "expired-callback": () => avisar.current(null),
          "error-callback": () => avisar.current(null),
        });
      })
      .catch(() => avisar.current(null));
    return () => {
      desmontado = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [i18n.language]);

  if (!SITE_KEY) return null;
  return <div ref={caja} className="flex min-h-[65px] justify-center" />;
}
