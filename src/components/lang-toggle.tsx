import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LangToggle() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : "es";
  const toggle = () => i18n.changeLanguage(lang === "es" ? "en" : "es");
  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle language"
    >
      <span className={lang === "es" ? "text-primary" : ""}>ES</span>
      <span className="opacity-40">/</span>
      <span className={lang === "en" ? "text-primary" : ""}>EN</span>
    </button>
  );
}
