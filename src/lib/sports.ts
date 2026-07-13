export const SPORTS = [
  { value: "futbol", labelEs: "Fútbol", labelEn: "Football" },
  { value: "baloncesto", labelEs: "Baloncesto", labelEn: "Basketball" },
  { value: "voleibol", labelEs: "Voleibol", labelEn: "Volleyball" },
  { value: "padel", labelEs: "Pádel", labelEn: "Padel" },
  { value: "tenis", labelEs: "Tenis", labelEn: "Tennis" },
] as const;

export type SportValue = (typeof SPORTS)[number]["value"];

export function sportLabel(value: string | null | undefined, lang: string): string {
  if (!value) return "—";
  const s = SPORTS.find((x) => x.value === value);
  if (!s) return value;
  return lang.startsWith("en") ? s.labelEn : s.labelEs;
}
