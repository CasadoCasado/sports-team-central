/**
 * Mientras se graba algo que tarda (crear un equipo, un partido…): la pelota
 * de PRO botando sobre la pista, a pantalla completa y por encima de los
 * diálogos, para que no parezca que la app se ha quedado parada.
 *
 * No sale si el guardado es casi instantáneo (`RETRASO`), y una vez fuera se
 * queda un mínimo (`MINIMO`): si no, en conexiones rápidas sería un parpadeo.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { CargandoPro } from "@/components/cargando-pro";

const RETRASO = 150;
const MINIMO = 500;

export function Guardando({ activo, texto }: { activo: boolean; texto?: string }) {
  const { t } = useTranslation();
  const visible = useVisibleSinParpadeo(activo);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div
      data-guardando
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 px-6 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="surface-card w-full max-w-sm px-6">
        <CargandoPro texto={texto ?? t("common.guardando")} />
      </div>
    </div>,
    document.body,
  );
}

function useVisibleSinParpadeo(activo: boolean) {
  const [visible, setVisible] = useState(false);
  const desde = useRef(0);

  useEffect(() => {
    if (activo) {
      if (visible) return;
      const id = setTimeout(() => {
        desde.current = Date.now();
        setVisible(true);
      }, RETRASO);
      return () => clearTimeout(id);
    }
    if (!visible) return;
    const falta = Math.max(0, MINIMO - (Date.now() - desde.current));
    const id = setTimeout(() => setVisible(false), falta);
    return () => clearTimeout(id);
  }, [activo, visible]);

  return visible;
}
