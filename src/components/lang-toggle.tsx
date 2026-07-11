import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function LangToggle() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const lang = mounted && i18n.language.startsWith("en") ? "en" : "es";
  const toggle = () => i18n.changeLanguage(lang === "es" ? "en" : "es");
  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle language"
      suppressHydrationWarning
    >
      <span className={lang === "es" ? "text-primary" : ""} suppressHydrationWarning>ES</span>
      <span className="opacity-40">/</span>
      <span className={lang === "en" ? "text-primary" : ""} suppressHydrationWarning>EN</span>
    </button>
  );
}
