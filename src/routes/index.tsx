import { LOGO_URL } from "@/lib/brand";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { hasSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
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
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (hasSession()) throw redirect({ to: "/inicio" });
  },
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();



  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* En un móvil de 360 px no caben el logotipo con la palabra y los tres
          controles: el nombre se solapaba con el selector de idioma y «Crear
          cuenta» se salía de la pantalla. Debajo de `sm` se queda solo el
          escudo, y los botones aprietan el texto y el espaciado. */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src={LOGO_URL} alt="TeamUp" className="size-8 shrink-0 object-contain" width={32} height={32} />
          <span className="text-display hidden truncate text-lg font-extrabold uppercase tracking-tight sm:inline">
            {t("app.name")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LangToggle />
            <ThemeToggle />
          <Link
            to="/auth"
            className="inline-flex min-h-10 items-center rounded-md border border-border px-2.5 text-2xs font-bold uppercase tracking-wider transition-colors hover:bg-card sm:px-3 sm:text-xs sm:tracking-widest"
          >
            {t("auth.login")}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="btn-primary-brand inline-flex min-h-10 items-center rounded-md px-3 text-2xs font-bold uppercase tracking-wider sm:px-4 sm:text-xs sm:tracking-widest"
          >
            {t("auth.signup")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-24">
        <section className="hero-band px-5 py-12 text-center sm:px-12 sm:py-20">
          <img
            src={LOGO_URL}
            alt="TeamUp"
            className="mx-auto size-16 object-contain sm:size-20"
            width={80}
            height={80}
          />
          <span className="mt-6 inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-2xs font-bold uppercase tracking-[0.28em] text-[color:var(--color-ink-muted)]">
            {t("app.name")}
          </span>
          <h1 className="text-display mx-auto mt-5 max-w-3xl text-3xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            <span className="text-gradient-brand">{t("app.tagline")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-[color:var(--color-ink-muted)] sm:text-lg">
            Calendario, convocatorias, encuestas, chat y estadísticas — todo lo que tu equipo
            necesita para funcionar como un club profesional.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center">
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
