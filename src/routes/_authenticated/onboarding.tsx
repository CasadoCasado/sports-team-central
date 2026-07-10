import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [role, setRole] = useState<"capitan" | "jugador" | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!role) return;
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No user");
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_role: role, onboarding_completed: true })
        .eq("id", u.user.id);
      if (error) throw error;
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-10 text-center">
          <h1 className="text-display text-4xl font-black tracking-tight sm:text-5xl">
            {t("onboarding.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("onboarding.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            selected={role === "capitan"}
            onClick={() => setRole("capitan")}
            icon={<Shield className="size-6" />}
            title={t("onboarding.capitan")}
            description={t("onboarding.capitanDesc")}
          />
          <RoleCard
            selected={role === "jugador"}
            onClick={() => setRole("jugador")}
            icon={<UserIcon className="size-6" />}
            title={t("onboarding.jugador")}
            description={t("onboarding.jugadorDesc")}
          />
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            onClick={submit}
            disabled={!role || loading}
            className="bg-primary px-8 py-6 text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
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
