import teamupLogo from "@/assets/teamup-logo.png.asset.json";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LangToggle } from "@/components/lang-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeamUp — Gestiona tu equipo de pádel" },
      { name: "description", content: "Calendario, convocatorias, encuestas, chat, resultados y pagos para tu equipo de pádel, en una sola plataforma." },
      { property: "og:title", content: "TeamUp — Gestiona tu equipo de pádel" },
      { property: "og:description", content: "Calendario, convocatorias, encuestas, chat, resultados y pagos para tu equipo de pádel, en una sola plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();



  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={teamupLogo.url} alt="TeamUp" className="size-8 object-contain" width={32} height={32} />
          <span className="text-display text-lg font-extrabold uppercase tracking-tight">
            {t("app.name")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Link
            to="/auth"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-card"
          >
            {t("auth.login")}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="btn-primary-brand rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
          >
            {t("auth.signup")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <section className="hero-band px-6 py-16 text-center sm:px-12 sm:py-20">
          <img
            src={teamupLogo.url}
            alt="TeamUp"
            className="mx-auto size-16 object-contain sm:size-20"
            width={80}
            height={80}
          />
          <span className="mt-6 inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-2xs font-bold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
            {t("app.name")}
          </span>
          <h1 className="text-display mx-auto mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            <span className="text-gradient-brand">{t("app.tagline")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-[color:var(--color-ink-muted)] sm:text-lg">
            Calendario, convocatorias, encuestas, chat y estadísticas — todo lo que tu equipo
            necesita para funcionar como un club profesional.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="btn-primary-brand rounded-md px-6 py-3 text-sm font-bold uppercase tracking-widest"
            >
              {t("auth.signup")}
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-widest text-[color:var(--color-ink-foreground)] transition-colors hover:bg-white/10"
            >
              {t("auth.login")}
            </Link>
            <Link
              to="/demo"
              className="rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-widest text-[color:var(--color-ink-foreground)] transition-colors hover:bg-white/10"
            >
              {t("nav.demo")}
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
