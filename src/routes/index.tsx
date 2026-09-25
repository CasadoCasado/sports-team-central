import type React from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Sparkles,
  ClipboardList,
  CalendarDays,
  Trophy,
  BarChart3,
  Wallet,
  MessageSquare,
  Images,
  ArrowRight,
  Check,
  X,
  Lock,
  Plus,
} from "lucide-react";
import { hasSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeamUp — Gestiona tu equipo de pádel" },
      {
        name: "description",
        content:
          "Convocatorias, química, cuotas, resultados y chat para tu equipo de pádel, en una sola plataforma. Gratis para empezar.",
      },
      { property: "og:title", content: "TeamUp — Tu equipo, sin caos de WhatsApp" },
      {
        property: "og:description",
        content:
          "Convocatorias, química, cuotas, resultados y chat para tu equipo de pádel, en una sola plataforma.",
      },
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

/* ── Datos de la página ─────────────────────────────────────────────── */

const MODULOS = [
  {
    icon: ClipboardList,
    t: "Convocatorias",
    d: "Publica el partido, la gente se apunta y ves las plazas en tiempo real. Se acabó el «¿quién falta?».",
    tag: "Apuntarse en 1 clic",
  },
  {
    icon: Sparkles,
    t: "Química",
    d: "Cada jugador dice con quién le gusta jugar. El capitán lo tiene en cuenta al repartir las parejas.",
    tag: "Privado hasta cerrar",
  },
  {
    icon: CalendarDays,
    t: "Calendario y entrenos",
    d: "Partidos, entrenamientos y eventos en una agenda compartida, con recordatorios automáticos.",
    tag: "Recordatorios push",
  },
  {
    icon: Trophy,
    t: "Competiciones",
    d: "Rey de pista, americano o por partidos. Se apunta el resultado y sale la clasificación sola.",
    tag: "3 formatos",
  },
  {
    icon: BarChart3,
    t: "Estadísticas y logros",
    d: "Asistencia, victorias y rachas. Insignias y ranking del equipo para picarse un poco.",
    tag: "Ranking del equipo",
  },
  {
    icon: Wallet,
    t: "Cuotas y pagos",
    d: "Controla quién ha pagado la cuota o el partido sin perseguir a nadie ni cuadrar un Excel.",
    tag: "Sin perseguir a nadie",
  },
  {
    icon: MessageSquare,
    t: "Comunicaciones",
    d: "Chat del equipo en tiempo real y encuestas para decidir hora, pista o cena de fin de temporada.",
    tag: "Chat + encuestas",
  },
  {
    icon: Images,
    t: "Galería y documentos",
    d: "Fotos de los partidos y los papeles del equipo (fichas, normas, actas) guardados y a mano.",
    tag: "Todo a mano",
  },
] as const;

const APUNTADOS = [
  { av: "MD", nm: "Miguel D.", sd: "Revés", delay: "0.2s" },
  { av: "JR", nm: "Javi R.", sd: "Drive", delay: "0.55s" },
  { av: "AP", nm: "Ana P.", sd: "Revés", delay: "0.9s" },
  { av: "LC", nm: "Lucía C.", sd: "Drive", delay: "1.25s" },
] as const;

const BENEFICIOS = [
  {
    n: "−90%",
    h: "Menos mensajes",
    p: "Una convocatoria sustituye la ristra de «¿vienes?» del grupo.",
  },
  { n: "1 clic", h: "Confirmar", p: "Apuntarse, elegir lado y dar química, todo desde el móvil." },
  { n: "0 €", h: "Para empezar", p: "Crea el equipo gratis. Sin tarjeta ni permanencia." },
  { n: "100%", h: "Al día", p: "Quién viene, quién ha pagado y cómo va la liga, siempre visible." },
] as const;

const PASOS = [
  {
    h: "Crea tu equipo",
    p: "Regístrate, ponle nombre y escudo. O únete a uno que ya exista desde la lista de equipos.",
  },
  {
    h: "Invita a la gente",
    p: "Comparte el enlace. Cada uno completa su perfil, su lado y su química.",
  },
  {
    h: "Publica y juega",
    p: "Lanza convocatorias, apunta resultados y deja que las estadísticas se llenen solas.",
  },
] as const;

const TESTIMONIOS = [
  {
    av: "MD",
    nm: "Miguel D.",
    rol: "Capitán · Los Niños (Málaga)",
    q: "Montar la convocatoria del sábado me llevaba media tarde de WhatsApp. Ahora la publico y me olvido.",
  },
  {
    av: "AP",
    nm: "Ana P.",
    rol: "Jugadora · 6ª división",
    q: "Lo de la química es un puntazo. Las parejas salen mucho mejor y nadie se enfada.",
  },
  {
    av: "JR",
    nm: "Javi R.",
    rol: "Tesorero del equipo",
    q: "Las cuotas dejaron de ser un drama. Veo quién ha pagado de un vistazo.",
  },
] as const;

const FAQS = [
  {
    q: "¿Cuánto cuesta?",
    a: "Empezar es gratis: creas tu equipo, invitas a la gente y usas convocatorias, química, chat y estadísticas sin coste. Sin tarjeta.",
    open: true,
  },
  {
    q: "¿Sirve solo para pádel?",
    a: "Está pensado y afinado para equipos amateur de pádel. La estructura vale para otros deportes de equipo, pero hoy el foco es el pádel.",
  },
  {
    q: "¿Tengo que ser capitán para usarlo?",
    a: "No. Puedes crear tu propio equipo o unirte a uno que ya exista buscándolo en la lista y pidiendo entrar.",
  },
  {
    q: "¿Funciona en el móvil?",
    a: "Sí. Va en cualquier navegador del móvil, la tablet o el ordenador, y recibes avisos push de convocatorias y cambios.",
  },
] as const;

/* ── Página ─────────────────────────────────────────────────────────── */

function Landing() {
  return (
    <div className="aurora min-h-screen">
      <style>{AURORA_CSS}</style>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-[var(--bd)] bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="mr-auto flex items-center gap-2.5">
            <span className="grad-bg grid size-9 place-items-center rounded-xl text-white shadow-[0_8px_24px_-8px_var(--v)]">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="text-display text-xl font-extrabold tracking-tight">TeamUp</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--mut)] md:flex">
            <a href="#modulos" className="transition-colors hover:text-[var(--tx)]">
              Módulos
            </a>
            <a href="#como" className="transition-colors hover:text-[var(--tx)]">
              Cómo funciona
            </a>
            <a href="#precio" className="transition-colors hover:text-[var(--tx)]">
              Precio
            </a>
            <a href="#faq" className="transition-colors hover:text-[var(--tx)]">
              FAQ
            </a>
          </nav>
          <Link
            to="/auth"
            className="hidden text-sm font-semibold text-[var(--mut)] transition-colors hover:text-[var(--tx)] sm:inline"
          >
            Entrar
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="grad-bg inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_var(--v)] transition-transform hover:-translate-y-0.5"
          >
            Crear mi equipo
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--surf)] px-3 py-1.5 text-2xs font-bold uppercase tracking-[0.18em] text-[var(--v-ink)]">
              <Sparkles className="size-3.5" aria-hidden="true" /> Para equipos amateur de pádel
            </span>
            <h1 className="text-display mt-5 text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
              Tu equipo, <span className="grad-text">sin caos</span> de WhatsApp.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--mut)]">
              Convocatorias, parejas con química, cuotas, resultados y chat. Todo lo de «quién viene
              el sábado» en un solo sitio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="grad-bg inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-[0_14px_40px_-14px_var(--v)] transition-transform hover:-translate-y-0.5"
              >
                Crear mi equipo <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-[var(--tx)] ring-1 ring-inset ring-[var(--bd)] transition-colors hover:bg-[var(--surf)]"
              >
                Probar sin cuenta
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-[var(--mut)]">
              <span>
                <span className="tracking-[2px] text-[var(--v-ink)]">★★★★★</span> Lo usan equipos
                reales
              </span>
              <span>· Gratis para empezar</span>
              <span>· Sin tarjeta</span>
            </div>
          </div>

          {/* Teléfono con demo de convocatoria */}
          <div className="justify-self-center">
            <div
              className="relative aspect-[300/610] w-[min(300px,82vw)] rounded-[38px] p-3 shadow-[0_40px_90px_-40px_rgba(0,0,0,.7)] ring-2 ring-inset ring-[var(--bd)]"
              style={{ background: "rgba(255,255,255,.05)" }}
            >
              <div
                className="absolute inset-3 flex flex-col overflow-hidden rounded-[28px]"
                style={{ background: "#0d0e1e" }}
              >
                <div className="grad-bg px-4 pb-3 pt-4 text-white">
                  <div className="text-2xs font-bold tracking-wide opacity-90">
                    CONVOCATORIA · SÁB 20:00
                  </div>
                  <div className="text-display mt-0.5 text-lg font-extrabold">Liga · Pista 3</div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  {APUNTADOS.map((p) => (
                    <div
                      key={p.av}
                      className="slot flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 ring-inset ring-[var(--bd)]"
                      style={{ background: "rgba(255,255,255,.05)", animationDelay: p.delay }}
                    >
                      <span className="grad-bg grid size-7 place-items-center rounded-full text-2xs font-extrabold text-white">
                        {p.av}
                      </span>
                      <span className="text-xs font-bold text-[var(--tx)]">{p.nm}</span>
                      <span className="ml-auto text-3xs font-extrabold uppercase tracking-wide text-[var(--v-ink)]">
                        {p.sd}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 opacity-60 ring-1 ring-inset ring-[var(--bd)]">
                    <span className="grid size-7 place-items-center rounded-full bg-[var(--bd)] text-2xs font-extrabold text-[var(--mut)]">
                      <Plus className="size-3.5" />
                    </span>
                    <span className="text-xs font-bold text-[var(--mut)]">Plaza libre</span>
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="grad-bg w-full rounded-xl py-2.5 text-center text-xs font-bold text-white">
                    Apuntarme · quedan 4 plazas
                  </div>
                </div>
              </div>
              <span className="floaty absolute -right-2 -top-2 rounded-full px-3 py-1.5 text-2xs font-extrabold text-white shadow-lg grad-bg">
                <Sparkles className="mr-1 inline size-3" /> Química ✓
              </span>
              <span className="absolute -left-3 bottom-14 rounded-full bg-white px-3 py-1.5 text-2xs font-extrabold text-[#0a0a14] shadow-lg">
                Push enviado
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* STRIP */}
      <div
        className="border-y border-[var(--bd)]"
        style={{ background: "color-mix(in oklab, var(--bg) 60%, #000)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-9 gap-y-4 px-4 py-6 text-center sm:px-6">
          {[
            ["18", "Módulos"],
            ["0 €", "Para empezar"],
            ["Tiempo real", "Chat y avisos"],
            ["Adiós Excel", "Cuotas al día"],
            ["1 clic", "Confirmar"],
          ].map(([b, s]) => (
            <div key={s} className="flex flex-col items-center gap-0.5">
              <span className="text-display text-xl font-extrabold tabular-nums text-[var(--tx)]">
                {b}
              </span>
              <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-[var(--mut)]">
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MÓDULOS */}
      <section id="modulos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SecHead eyebrow="Todo lo que hace" title="Un sitio para cada cosa del equipo">
          Deja de saltar entre WhatsApp, notas y hojas de cálculo. TeamUp reúne la gestión, la
          comunicación y la competición.
        </SecHead>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map(({ icon: Icon, t, d, tag }) => (
            <div
              key={t}
              className="glass group rounded-[22px] p-6 transition-transform hover:-translate-y-1"
            >
              <span
                className="mb-4 grid size-11 place-items-center rounded-xl text-[var(--v-ink)]"
                style={{ background: "color-mix(in oklab, var(--v) 16%, transparent)" }}
              >
                <Icon className="size-[22px]" aria-hidden="true" />
              </span>
              <h3 className="text-display text-lg font-extrabold tracking-tight">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--mut)]">{d}</p>
              <div className="mt-3 text-2xs font-extrabold uppercase tracking-[0.08em] text-[var(--v-ink)]">
                {tag}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DEEP DIVE 1 — convocatorias */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Convocatorias</Eyebrow>
            <h3 className="text-display mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Publica el partido. El resto se apunta solo.
            </h3>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--mut)]">
              Creas la convocatoria una vez y cada jugador confirma desde su móvil. Ves quién viene,
              quién falta y cuántas plazas quedan, al momento.
            </p>
            <ul className="mt-5 flex flex-col gap-3">
              {[
                "Cada uno elige su lado: revés, drive o los dos.",
                "Aviso automático cuando quedan pocas plazas.",
                "Confirmas la convocatoria y todos reciben el push.",
              ].map((li) => (
                <Item key={li}>{li}</Item>
              ))}
            </ul>
          </div>
          <Mock title="Sábado · Liga 20:00" badge="6/8">
            {[
              ["Miguel D. · Revés", "Confirmado", "100%"],
              ["Javi R. · Drive", "Confirmado", "100%"],
              ["Ana P. · Revés", "Confirmada", "100%"],
              ["Carlos M.", "Pendiente", "40%"],
            ].map(([nm, st, w]) => (
              <Row key={nm} nm={nm} right={st} w={w} />
            ))}
          </Mock>
        </div>
      </section>

      {/* DEEP DIVE 2 — química + clasificación */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 flex flex-col gap-4 lg:order-1">
            <Mock
              title="¿Con quién tienes química?"
              icon={<Sparkles className="size-4 text-[var(--v-ink)]" />}
            >
              <div className="flex flex-wrap gap-2 p-1">
                {[
                  ["JR", "Javi R.", true],
                  ["AP", "Ana P.", false],
                  ["LC", "Lucía C.", false],
                  ["CM", "Carlos M.", false],
                ].map(([av, nm, on]) => (
                  <span
                    key={av as string}
                    className={
                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset " +
                      (on
                        ? "grad-bg text-white ring-transparent"
                        : "text-[var(--tx)] ring-[var(--bd)]")
                    }
                    style={on ? undefined : { background: "rgba(255,255,255,.05)" }}
                  >
                    <span
                      className={
                        "grid size-5 place-items-center rounded-full text-3xs font-extrabold " +
                        (on ? "bg-white/25 text-white" : "text-[var(--v-ink)]")
                      }
                      style={
                        on
                          ? undefined
                          : { background: "color-mix(in oklab, var(--v) 16%, transparent)" }
                      }
                    >
                      {av as string}
                    </span>
                    {nm as string}
                  </span>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 px-1 text-2xs text-[var(--mut)]">
                <Lock className="size-3" /> Solo lo ve quien reparte las pistas.
              </p>
            </Mock>
            <Mock title="Rey de pista · Clasificación">
              {[
                ["Miguel D.", "28 pts", "100%", true],
                ["Ana P.", "24 pts", "82%", false],
                ["Javi R.", "21 pts", "70%", false],
              ].map(([nm, pts, w, lead], i) => (
                <Row
                  key={nm as string}
                  pos={i + 1}
                  nm={nm as string}
                  right={pts as string}
                  w={w as string}
                  lead={lead as boolean}
                />
              ))}
            </Mock>
          </div>
          <div className="order-1 lg:order-2">
            <Eyebrow>Química y competición</Eyebrow>
            <h3 className="text-display mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Parejas que funcionan. Clasificación que se llena sola.
            </h3>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--mut)]">
              Cada jugador marca con quién tiene química —solo lo ve quien reparte las pistas—. Y al
              meter el resultado, la tabla del rey de pista se actualiza sin tocar nada.
            </p>
            <ul className="mt-5 flex flex-col gap-3">
              {[
                "Química privada, editable hasta cerrar la convocatoria.",
                "Rey de pista, americano o por partidos.",
                "Podio y ranking del equipo automáticos.",
              ].map((li) => (
                <Item key={li}>{li}</Item>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section
        className="relative overflow-hidden border-y border-[var(--bd)]"
        style={{
          background:
            "radial-gradient(100% 130% at 50% 0%, color-mix(in oklab, var(--v) 14%, transparent), transparent 55%), color-mix(in oklab, var(--bg) 55%, #000)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <SecHead eyebrow="Por qué cambiarte" title="Menos gestión, más pádel">
            Lo que antes eran diez mensajes y una hoja de cálculo, aquí es un toque.
          </SecHead>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map((b) => (
              <div key={b.h} className="glass rounded-[18px] p-6">
                <div className="text-display grad-text text-4xl font-black tabular-nums">{b.n}</div>
                <h4 className="text-display mt-3 text-base font-extrabold">{b.h}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--mut)]">{b.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SecHead eyebrow="Cómo funciona" title="De cero a equipo en 3 pasos" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PASOS.map((s, i) => (
            <div key={s.h} className="glass rounded-[22px] p-7">
              <span className="grad-bg text-display mb-4 grid size-9 place-items-center rounded-xl text-sm font-black text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h4 className="text-display text-lg font-extrabold">{s.h}</h4>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mut)]">{s.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARATIVA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <SecHead eyebrow="Antes y después" title="TeamUp vs. el grupo de WhatsApp" />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="glass rounded-[22px] p-7">
            <h4 className="text-display mb-4 text-xl font-extrabold">Solo con WhatsApp</h4>
            <ul className="flex flex-col gap-3 text-sm font-medium text-[var(--mut)]">
              {[
                "«¿Quién viene el sábado?» × 20 mensajes",
                "La lista se pierde entre memes y audios",
                "Las cuotas, en una hoja aparte que nadie mira",
                "Los resultados y la liga, en otra web",
              ].map((li) => (
                <li key={li} className="flex items-start gap-2.5">
                  <X className="mt-0.5 size-[18px] shrink-0 text-[var(--mut)]" />
                  {li}
                </li>
              ))}
            </ul>
          </div>
          <div className="grad-bg rounded-[22px] p-7 text-white shadow-[0_30px_60px_-30px_var(--v)]">
            <h4 className="text-display mb-4 text-xl font-extrabold">Con TeamUp</h4>
            <ul className="flex flex-col gap-3 text-sm font-semibold">
              {[
                "Una convocatoria y las plazas se llenan solas",
                "Quién viene y su lado, siempre claro",
                "Cuotas al día, sin perseguir a nadie",
                "Resultados, química y stats en el mismo sitio",
              ].map((li) => (
                <li key={li} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-[18px] shrink-0" />
                  {li}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <SecHead eyebrow="Lo que dicen" title="Capitanes que ya no persiguen a nadie" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TESTIMONIOS.map((tm) => (
            <div key={tm.nm} className="glass flex flex-col gap-4 rounded-[22px] p-6">
              <div className="tracking-[2px] text-[var(--v-ink)]">★★★★★</div>
              <p className="text-[15px] font-medium leading-relaxed">«{tm.q}»</p>
              <div className="mt-auto flex items-center gap-3">
                <span
                  className="grid size-9 place-items-center rounded-full text-sm font-extrabold text-[var(--v-ink)]"
                  style={{ background: "color-mix(in oklab, var(--v) 16%, transparent)" }}
                >
                  {tm.av}
                </span>
                <div>
                  <b className="block text-sm">{tm.nm}</b>
                  <span className="text-xs text-[var(--mut)]">{tm.rol}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ + PRECIO */}
      <section id="faq" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <SecHead eyebrow="Precio y dudas" title="Gratis para empezar" anchor="precio">
          Crea tu equipo sin pagar nada. Sin tarjeta, sin permanencia.
        </SecHead>
        <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-2.5">
          {FAQS.map((f) => (
            <details
              key={f.q}
              open={(f as { open?: boolean }).open}
              className="glass group rounded-2xl px-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-[15px] font-bold">
                {f.q}
                <Plus className="ml-auto size-5 text-[var(--v-ink)] transition-transform group-open:rotate-45" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-[var(--mut)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section
        className="relative overflow-hidden border-t border-[var(--bd)]"
        style={{
          background:
            "radial-gradient(90% 130% at 50% -10%, color-mix(in oklab, var(--v) 34%, transparent), transparent 55%), var(--bg)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-28">
          <h2 className="text-display mx-auto max-w-[16ch] text-4xl font-black tracking-tight sm:text-6xl">
            Deja el caos. Monta tu equipo hoy.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-[var(--mut)]">
            Tu primera convocatoria puede estar publicada en cinco minutos.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="grad-bg inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-[0_14px_40px_-14px_var(--v)] transition-transform hover:-translate-y-0.5"
            >
              Crear mi equipo gratis <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-[var(--tx)] ring-1 ring-inset ring-[var(--bd)] transition-colors hover:bg-[var(--surf)]"
            >
              Probar sin cuenta
            </Link>
          </div>
          <p className="mt-5 text-sm text-[var(--mut)]">
            Sin tarjeta · Sin permanencia · Listo en minutos
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="border-t border-[var(--bd)]"
        style={{ background: "color-mix(in oklab, var(--bg) 70%, #000)" }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grad-bg grid size-9 place-items-center rounded-xl text-white">
                <Sparkles className="size-5" />
              </span>
              <span className="text-display text-xl font-extrabold tracking-tight">TeamUp</span>
            </div>
            <p className="max-w-[30ch] text-sm leading-relaxed text-[var(--mut)]">
              La plataforma para gestionar tu equipo deportivo. Todo lo de «quién viene el sábado»,
              en un sitio.
            </p>
          </div>
          <FootCol
            title="Producto"
            items={["Módulos", "Convocatorias", "Química", "Competiciones"]}
          />
          <FootCol
            title="Equipo"
            items={["Crear equipo", "Unirse a un equipo", "Probar sin cuenta", "Ayuda"]}
          />
          <FootCol
            title="Recursos"
            items={["Guía rápida", "Novedades", "Privacidad", "Contacto"]}
          />
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-[var(--bd)] px-4 py-5 text-xs text-[var(--mut)] sm:px-6">
          <span>© 2026 TeamUp</span>
          <span>Hecho para equipos amateur de pádel</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Piezas reutilizables ───────────────────────────────────────────── */

function SecHead({
  eyebrow,
  title,
  anchor,
  children,
}: {
  eyebrow: string;
  title: string;
  anchor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <span
        id={anchor}
        className="inline-flex items-center justify-center gap-2 text-2xs font-extrabold uppercase tracking-[0.2em] text-[var(--v-ink)]"
      >
        <Sparkles className="size-3.5" aria-hidden="true" /> {eyebrow}
      </span>
      <h2 className="text-display mx-auto mt-3.5 max-w-[20ch] text-3xl font-black tracking-tight sm:text-5xl">
        {title}
      </h2>
      {children && (
        <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-[var(--mut)]">
          {children}
        </p>
      )}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-2xs font-extrabold uppercase tracking-[0.2em] text-[var(--v-ink)]">
      <Sparkles className="size-3.5" aria-hidden="true" /> {children}
    </span>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] font-medium">
      <span
        className="grid size-[22px] shrink-0 place-items-center rounded-md text-[var(--v-ink)]"
        style={{ background: "color-mix(in oklab, var(--v) 16%, transparent)" }}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </span>
      {children}
    </li>
  );
}

function Mock({
  title,
  badge,
  icon,
  children,
}: {
  title: string;
  badge?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass overflow-hidden rounded-[22px]">
      <div className="text-display flex items-center gap-2.5 border-b border-[var(--bd)] px-4 py-3.5 text-[15px] font-extrabold">
        {icon}
        {title}
        {badge && (
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-2xs font-bold text-[var(--v-ink)] ring-1 ring-inset ring-[var(--bd)]"
            style={{ background: "color-mix(in oklab, var(--v) 12%, transparent)" }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">{children}</div>
    </div>
  );
}

function Row({
  pos,
  nm,
  right,
  w,
  lead,
}: {
  pos?: number;
  nm: string;
  right: string;
  w: string;
  lead?: boolean;
}) {
  return (
    <div
      className={
        "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold ring-1 ring-inset " +
        (lead ? "ring-[var(--v)]" : "ring-[var(--bd)]")
      }
      style={{
        background: lead
          ? "color-mix(in oklab, var(--v) 14%, transparent)"
          : "rgba(255,255,255,.04)",
      }}
    >
      <span
        className={
          "text-display w-5 text-center tabular-nums " +
          (lead ? "text-[var(--v-ink)]" : "text-[var(--mut)]")
        }
      >
        {pos ?? "✓"}
      </span>
      <span className="truncate">{nm}</span>
      <span className="tabular-nums text-[var(--mut)]">{right}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--bd)" }}>
        <span className="bar-i grad-bg block h-full" style={{ "--w": w } as React.CSSProperties} />
      </span>
    </div>
  );
}

function FootCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h5 className="mb-3.5 text-2xs font-bold uppercase tracking-[0.14em] text-[var(--mut)]">
        {title}
      </h5>
      <ul className="flex flex-col gap-2.5 text-sm text-[var(--mut)]">
        {items.map((it) => (
          <li key={it}>
            <a href="#modulos" className="transition-colors hover:text-[var(--tx)]">
              {it}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Estilos de Aurora (violeta de la química) ──────────────────────── */

const AURORA_CSS = `
.aurora{
  --v: var(--color-evt-social);
  --v-ink: color-mix(in oklab, var(--color-evt-social) 78%, white);
  --grad: linear-gradient(120deg, color-mix(in oklab, var(--v) 82%, #2e1065), var(--v) 50%, color-mix(in oklab, var(--v) 60%, #f5d0fe));
  --bg:#0a0a14; --surf:rgba(255,255,255,.05); --bd:#26243f; --tx:#eef0fb; --mut:#9aa0c4;
  background:var(--bg); color:var(--tx); color-scheme:dark;
}
.aurora .grad-text{ background:var(--grad); -webkit-background-clip:text; background-clip:text; color:transparent; }
.aurora .grad-bg{ background:var(--grad); }
.aurora .glass{ background:var(--surf); border:1px solid var(--bd); backdrop-filter:blur(8px); }
.aurora .hero-glow{
  background:
    radial-gradient(85% 90% at 12% -5%, color-mix(in oklab, var(--v) 32%, transparent), transparent 55%),
    radial-gradient(70% 80% at 100% 12%, color-mix(in oklab, var(--v) 18%, transparent), transparent 52%),
    var(--bg);
}
.aurora .slot{ opacity:0; transform:translateY(6px); animation:aurora-slot .5s ease forwards; }
@keyframes aurora-slot{ to{ opacity:1; transform:none; } }
.aurora .floaty{ animation:aurora-float 4s ease-in-out infinite; }
@keyframes aurora-float{ 50%{ transform:translateY(-8px); } }
.aurora .bar-i{ width:0; animation:aurora-grow 1.3s ease .2s forwards; }
@keyframes aurora-grow{ to{ width:var(--w); } }
@media (prefers-reduced-motion: reduce){
  .aurora *{ animation:none !important; }
  .aurora .slot{ opacity:1; transform:none; }
  .aurora .bar-i{ width:var(--w); }
}
`;
