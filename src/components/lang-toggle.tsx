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
      className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground sm:min-h-9"
      aria-label="Toggle language"
      suppressHydrationWarning
    >
      <span className={lang === "es" ? "text-primary" : ""} suppressHydrationWarning>ES</span>
      <span className="opacity-40">/</span>
      <span className={lang === "en" ? "text-primary" : ""} suppressHydrationWarning>EN</span>
    </button>
  );
}
