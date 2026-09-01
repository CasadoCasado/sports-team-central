import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  ClipboardList,
  Vote,
  Trophy,
  Flame,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Home,
  Medal,
  Lock,
} from "lucide-react";
import { LOGO_URL } from "@/lib/brand";
import { LangToggle } from "@/components/lang-toggle";
import { cn } from "@/lib/utils";
import { BADGES } from "@/lib/achievements";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Modo invitado | TeamUp" },
      {
        name: "description",
        content:
          "Prueba TeamUp sin crear cuenta: calendario, convocatorias, encuestas y logros con datos de ejemplo.",
      },
      { property: "og:title", content: "Prueba TeamUp sin crear cuenta" },
      {
        property: "og:description",
        content: "Explora el calendario, las convocatorias, las encuestas y los logros con un equipo de ejemplo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

type TabId = "inicio" | "calendario" | "convocatorias" | "encuestas" | "logros";

const DEMO_EVENTS = [
  { day: "Lun 12", time: "19:30", title: "Entrenamiento técnico", place: "Club Norte · Pista 3", kind: "entrenamiento" },
  { day: "Mié 14", time: "20:00", title: "Entrenamiento físico", place: "Club Norte · Pista 1", kind: "entrenamiento" },
  { day: "Sáb 17", time: "10:00", title: "TeamUp Padel vs Racket Club", place: "Club Sur · 3 pistas", kind: "enfrentamiento" },
  { day: "Dom 25", time: "09:00", title: "Torneo de primavera", place: "Ciudad Deportiva", kind: "torneo" },
];

const DEMO_SQUAD = [
  { name: "Lucía Ferrer", status: "confirmado" as const, court: 1 },
  { name: "Marc Soler", status: "confirmado" as const, court: 1 },
  { name: "Ana Ruiz", status: "duda" as const, court: 2 },
  { name: "Javi Molina", status: "confirmado" as const, court: 2 },
  { name: "Pau Vidal", status: "rechazado" as const, court: null },
  { name: "Nerea Gil", status: "confirmado" as const, court: 3 },
];

const DEMO_POLL = {
  question: "¿Qué día preferís el entrenamiento extra?",
  options: [
    { label: "Martes 21:00", votes: 7 },
    { label: "Jueves 20:00", votes: 4 },
    { label: "Viernes 19:00", votes: 2 },
  ],
};

const DEMO_UNLOCKED = ["debut", "streak3", "attendance10"];

const DEMO_LEADERBOARD = [
  { name: "Lucía Ferrer", played: 18, wins: 13 },
  { name: "Marc Soler", played: 17, wins: 11 },
  { name: "Nerea Gil", played: 15, wins: 9 },
  { name: "Javi Molina", played: 14, wins: 7 },
];

function DemoPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("inicio");

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "inicio", label: t("nav.inicio"), icon: Home },
    { id: "calendario", label: t("nav.calendario"), icon: Calendar },
    { id: "convocatorias", label: t("nav.convocatorias"), icon: ClipboardList },
    { id: "encuestas", label: t("nav.encuestas"), icon: Vote },
    { id: "logros", label: t("nav.logros"), icon: Medal },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="TeamUp" className="size-8 object-contain" width={32} height={32} />
            <span className="text-display text-lg font-extrabold uppercase tracking-tight">
              {t("app.name")}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="btn-primary-brand rounded-md px-4 py-2 text-xs font-bold uppercase tracking-widest"
            >
              {t("auth.signup")}
            </Link>
          </div>
        </div>
      </header>

      <div className="border-b border-primary/20 bg-primary/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm">
            <span className="mr-2 rounded-full bg-primary/15 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-primary">
              {t("demo.badge")}
            </span>
            {t("demo.notice")}
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
          >
            {t("demo.cta")}
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-display text-2xl font-black uppercase tracking-tight">
            {t("demo.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("demo.subtitle")}</p>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label={t("demo.title")}>
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-bold uppercase tracking-widest transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {tab === "inicio" && <DemoInicio t={t} />}
        {tab === "calendario" && <DemoCalendario t={t} />}
        {tab === "convocatorias" && <DemoConvocatorias t={t} />}
        {tab === "encuestas" && <DemoEncuestas t={t} />}
        {tab === "logros" && <DemoLogros t={t} />}

        <section className="surface-card flex flex-col items-center gap-3 p-8 text-center">
          <h2 className="text-display text-lg font-bold uppercase tracking-tight">
            {t("demo.footerTitle")}
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">{t("demo.footerText")}</p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="btn-primary-brand rounded-md px-6 py-3 text-sm font-bold uppercase tracking-widest"
          >
            {t("auth.signup")}
          </Link>
        </section>
      </main>
    </div>
  );
}

type TFn = (k: string) => string;

function DemoInicio({ t }: { t: TFn }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="surface-card p-5">
        <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {t("demo.nextEvent")}
        </p>
        <p className="text-display mt-2 text-lg font-black">TeamUp Padel vs Racket Club</p>
        <p className="mt-1 text-sm text-muted-foreground">Sáb 17 · 10:00 · Club Sur</p>
      </div>
      <div className="surface-card p-5">
        <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {t("demo.confirmedPlayers")}
        </p>
        <p className="text-display mt-2 text-3xl font-black text-primary">4/6</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("demo.confirmedHint")}</p>
      </div>
      <div className="surface-card p-5">
        <p className="text-2xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {t("demo.season")}
        </p>
        <p className="text-display mt-2 text-3xl font-black">9-4</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("demo.seasonHint")}</p>
      </div>
    </div>
  );
}

function DemoCalendario({ t }: { t: TFn }) {
  return (
    <section className="surface-card divide-y divide-border">
      {DEMO_EVENTS.map((ev) => (
        <div key={ev.title} className="flex items-center gap-4 p-4">
          <div className="w-16 shrink-0 text-center">
            <p className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{ev.day}</p>
            <p className="text-display text-base font-black">{ev.time}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{ev.title}</p>
            <p className="truncate text-xs text-muted-foreground">{ev.place}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-widest",
              ev.kind === "enfrentamiento"
                ? "bg-primary/10 text-primary"
                : ev.kind === "torneo"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t(`demo.kind.${ev.kind}`)}
          </span>
        </div>
      ))}
    </section>
  );
}

function DemoConvocatorias({ t }: { t: TFn }) {
  const icon = {
    confirmado: <CheckCircle2 className="size-4 text-emerald-600" />,
    duda: <HelpCircle className="size-4 text-amber-500" />,
    rechazado: <XCircle className="size-4 text-destructive" />,
  };
  return (
    <section className="surface-card p-5">
      <h2 className="text-display text-sm font-bold uppercase tracking-[0.18em]">
        TeamUp Padel vs Racket Club
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Sáb 17 · 10:00 · Club Sur · 3 {t("demo.courts")}</p>
      <ul className="mt-4 divide-y divide-border">
        {DEMO_SQUAD.map((p) => (
          <li key={p.name} className="flex items-center gap-3 py-3">
            {icon[p.status]}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">
              {p.court ? `${t("demo.court")} ${p.court}` : "—"}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-md bg-primary/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground"
      >
        {t("demo.disabledAction")}
      </button>
    </section>
  );
}

function DemoEncuestas({ t }: { t: TFn }) {
  const total = DEMO_POLL.options.reduce((acc, o) => acc + o.votes, 0);
  return (
    <section className="surface-card p-5">
      <h2 className="text-display text-sm font-bold uppercase tracking-[0.18em]">
        {DEMO_POLL.question}
      </h2>
      <div className="mt-4 space-y-3">
        {DEMO_POLL.options.map((o) => {
          const pct = Math.round((o.votes / total) * 100);
          return (
            <div key={o.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{o.label}</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {total} {t("demo.votes")}
      </p>
    </section>
  );
}

function DemoLogros({ t }: { t: TFn }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : "es";
  const demoBadges = BADGES.slice(0, 6).map((b) => ({
    title: b.title[lang],
    desc: b.description[lang],
    unlocked: DEMO_UNLOCKED.includes(b.id),
  }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {demoBadges.map((b) => (
          <div
            key={b.title}
            className={cn(
              "rounded-xl border p-4",
              b.unlocked ? "border-primary/30 bg-primary/5" : "border-border bg-card/40 opacity-80",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  b.unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {b.unlocked ? <Flame className="size-5" /> : <Lock className="size-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{b.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <section className="surface-card p-5">
        <h2 className="text-display text-sm font-bold uppercase tracking-[0.18em]">
          {t("achievements.leaderboard")}
        </h2>
        <ul className="mt-4 divide-y divide-border">
          {DEMO_LEADERBOARD.map((row, i) => (
            <li key={row.name} className="flex items-center gap-3 py-3">
              <span className="w-6 text-sm font-bold text-muted-foreground">{i + 1}</span>
              <Trophy className={cn("size-4", i === 0 ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {row.played} {t("achievements.playedShort")}
              </span>
              <span className="text-sm font-bold text-primary">
                {row.wins} {t("achievements.winsShort")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
