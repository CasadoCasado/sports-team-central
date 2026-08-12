import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, LifeBuoy, Lightbulb } from "lucide-react";
import { HELP_SECTIONS } from "@/lib/help-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ayuda")({
  validateSearch: (search: Record<string, unknown>) => ({
    screen: typeof search["screen"] === "string" ? (search["screen"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ayuda | TeamUp" },
      {
        name: "description",
        content:
          "Guía contextual de TeamUp: cómo usar Mi Equipo, Calendario, Convocatorias, Encuestas y el chat del equipo.",
      },
      { property: "og:title", content: "Ayuda | TeamUp" },
      {
        property: "og:description",
        content:
          "Guía contextual de TeamUp: cómo usar Mi Equipo, Calendario, Convocatorias, Encuestas y el chat del equipo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ayuda,
});

function Ayuda() {
  const { t, i18n } = useTranslation();
  const { screen } = Route.useSearch();
  const en = i18n.language?.startsWith("en");
  const pick = (v: { es: string; en: string }) => (en ? v.en : v.es);

  useEffect(() => {
    if (!screen) return;
    const el = document.getElementById(`help-${screen}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [screen]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="size-5" />
          </div>
          <h1 className="text-display text-3xl font-black tracking-tight">{t("help.title")}</h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("help.intro")}</p>
        <nav className="flex flex-wrap gap-2" aria-label={t("help.title")}>
          {HELP_SECTIONS.map((s) => (
            <Link
              key={s.id}
              to="/ayuda"
              search={{ screen: s.id }}
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-2xs font-bold uppercase tracking-widest transition-colors",
                screen === s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {pick(s.title)}
            </Link>
          ))}
        </nav>
      </header>

      {HELP_SECTIONS.map((s) => (
        <section
          key={s.id}
          id={`help-${s.id}`}
          className={cn(
            "surface-card scroll-mt-24 space-y-4 p-6",
            screen === s.id && "ring-2 ring-primary",
          )}
        >
          <div className="space-y-1">
            <h2 className="text-display text-xl font-black tracking-tight">{pick(s.title)}</h2>
            <p className="text-sm text-muted-foreground">{pick(s.summary)}</p>
          </div>

          <div>
            <h3 className="text-2xs font-bold uppercase tracking-widest text-primary">
              {t("help.steps")}
            </h3>
            <ol className="mt-2 space-y-2">
              {s.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span>{pick(step)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-3 rounded-xl bg-muted/50 p-4">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{pick(s.example)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {s.links.map((l) => (
              <Button key={l.to} asChild size="sm" variant="outline">
                <Link to={l.to}>
                  {pick(l)}
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
