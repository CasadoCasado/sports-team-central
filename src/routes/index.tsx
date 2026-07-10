import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { LangToggle } from "@/components/lang-toggle";
import { Shield, Users, Calendar, MessagesSquare, ClipboardList, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const features = [
    { icon: Shield, key: "team" },
    { icon: Users, key: "members" },
    { icon: Calendar, key: "cal" },
    { icon: ClipboardList, key: "call" },
    { icon: MessagesSquare, key: "chat" },
    { icon: BarChart3, key: "stats" },
  ] as const;

  const featureLabels: Record<string, string> = {
    team: t("nav.miEquipo"),
    members: t("nav.miembros"),
    cal: t("nav.calendario"),
    call: t("nav.convocatorias"),
    chat: t("nav.comunicaciones"),
    stats: t("nav.estadisticas"),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary">
            <div className="size-3.5 rotate-45 rounded-sm bg-primary-foreground" />
          </div>
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
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("auth.signup")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <section className="text-center">
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            {t("app.name")}
          </span>
          <h1 className="text-display mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            {t("app.tagline")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Calendario, convocatorias, encuestas, chat y estadísticas — todo lo que tu equipo
            necesita para funcionar como un club profesional.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("auth.signup")}
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border bg-card px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors hover:border-primary/50"
            >
              {t("auth.login")}
            </Link>
          </div>
        </section>

        <section className="mt-24 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="surface-card flex flex-col items-start gap-3 p-6 transition-colors hover:border-primary/40"
            >
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <p className="text-display text-lg font-bold">{featureLabels[key]}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
