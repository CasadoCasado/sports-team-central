import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { invalidateUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configura tu cuenta | TeamUp" },
      { name: "description", content: "Completa tu perfil y elige si buscas equipo o quieres crear el tuyo en TeamUp." },
      { property: "og:title", content: "Configura tu cuenta | TeamUp" },
      { property: "og:description", content: "Completa tu perfil y elige si buscas equipo o quieres crear el tuyo en TeamUp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // La primera pantalla ya no pregunta el rol en abstracto, sino qué se viene a
  // hacer: unirse a un equipo que ya existe o crear el tuyo. Cada intención se
  // guarda como `preferred_role` —«unirse» es jugador, «crear» es capitán— para
  // no tocar el resto de la app, que sigue mirando ese campo (p. ej.
  // `canCreateTeam` en «Mi equipo»).
  const [intent, setIntent] = useState<"unirse" | "crear" | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!intent) return;
    setLoading(true);
    try {
      await api.patch("/profiles/me/", {
        preferred_role: intent === "crear" ? "capitan" : "jugador",
        onboarding_completed: true,
      });
      // El guardián de /_authenticated mira `onboarding_completed` del usuario
      // cacheado; sin refrescarlo, la navegación rebotaría aquí otra vez.
      invalidateUser();
      // Cada intención aterriza donde toca: quien crea, en el formulario de
      // equipo abierto; quien se une, en «Mi equipo», que sin equipo enseña la
      // lista de equipos abiertos para buscar dónde meterse.
      if (intent === "crear") {
        navigate({ to: "/mi-equipo", search: { crear: true }, replace: true });
      } else {
        navigate({ to: "/mi-equipo", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-display text-3xl font-black tracking-tight sm:text-5xl">
            {t("onboarding.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("onboarding.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            selected={intent === "unirse"}
            onClick={() => setIntent("unirse")}
            icon={<Search className="size-6" />}
            title={t("onboarding.unirse")}
            description={t("onboarding.unirseDesc")}
          />
          <RoleCard
            selected={intent === "crear"}
            onClick={() => setIntent("crear")}
            icon={<Shield className="size-6" />}
            title={t("onboarding.crear")}
            description={t("onboarding.crearDesc")}
          />
        </div>

        <div className="mt-8 flex justify-center sm:mt-10">
          <Button
            onClick={submit}
            disabled={!intent || loading}
            className="h-auto w-full bg-primary px-8 py-4 text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90 sm:w-auto sm:py-6"
          >
            {t("onboarding.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface-card group relative flex flex-col gap-4 p-8 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary"
          : "hover:border-primary/40",
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-card text-muted-foreground group-hover:text-primary",
        )}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-display text-2xl font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
