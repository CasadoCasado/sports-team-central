import { useCallback, useEffect, useState } from "react";

export const FONT_SCALES = [0.9, 1, 1.1, 1.25] as const;
export type FontScale = (typeof FONT_SCALES)[number];

const STORAGE_KEY = "fontScale";
const BASE_PX = 16;

function clampScale(value: number): FontScale {
  const match = FONT_SCALES.find((s) => Math.abs(s - value) < 0.001);
  return match ?? 1;
}

function apply(scale: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${BASE_PX * scale}px`;
}

export function useFontScale() {
  const [scale, setScale] = useState<FontScale>(1);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    const initial = Number.isFinite(saved) && saved > 0 ? clampScale(saved) : 1;
    setScale(initial);
    apply(initial);
  }, []);

  const update = useCallback((next: FontScale) => {
    setScale(next);
    apply(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const index = FONT_SCALES.indexOf(scale);

  const increase = useCallback(() => {
    if (index < FONT_SCALES.length - 1) update(FONT_SCALES[index + 1]);
  }, [index, update]);

  const decrease = useCallback(() => {
    if (index > 0) update(FONT_SCALES[index - 1]);
  }, [index, update]);

  const reset = useCallback(() => update(1), [update]);

  return {
    scale,
    percent: Math.round(scale * 100),
    canIncrease: index < FONT_SCALES.length - 1,
    canDecrease: index > 0,
    increase,
    decrease,
    reset,
  };
}
