import { LOGO_URL } from "@/lib/brand";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { hasSession, signInWithPassword, signUp } from "@/lib/auth";
import { LangToggle } from "@/components/lang-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authSearchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión o crear cuenta | TeamUp" },
      { name: "description", content: "Accede a TeamUp para gestionar tu equipo: convocatorias, entrenamientos, resultados y comunicación." },
      { property: "og:title", content: "Iniciar sesión o crear cuenta | TeamUp" },
      { property: "og:description", content: "Accede a TeamUp para gestionar tu equipo: convocatorias, entrenamientos, resultados y comunicación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: authSearchSchema,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (hasSession()) throw redirect({ to: "/inicio" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [loading, setLoading] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const schema =
    mode === "signup"
      ? z
          .object({
            nombre: z.string().min(1, t("auth.required")),
            apellidos: z.string().min(1, t("auth.required")),
            email: z.string().email(t("auth.invalidEmail")),
            password: z.string().min(8, t("auth.passwordMin")),
            confirm: z.string(),
          })
          .refine((d) => d.password === d.confirm, {
            message: t("auth.passwordsDontMatch"),
            path: ["confirm"],
          })
      : z.object({
          email: z.string().email(t("auth.invalidEmail")),
          password: z.string().min(1, t("auth.required")),
        });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ nombre, apellidos, email, password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        // El alta deja la sesión iniciada, así que se va derecho al onboarding.
        await signUp({ email, password, nombre, apellidos });
        toast.success(t("auth.signupSuccess"));
        navigate({ to: "/onboarding", replace: true });
      } else {
        await signInWithPassword(email, password);
        toast.success(t("auth.loginSuccess"));
        navigate({ to: "/inicio", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <img src={LOGO_URL} alt="TeamUp" className="size-8 object-contain" width={32} height={32} />
            <span className="text-display text-lg font-extrabold uppercase tracking-tight">
              {t("app.name")}
            </span>
          </Link>

          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
              {mode === "signup" ? t("auth.signup") : t("auth.login")}
            </h1>
            <LangToggle />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <div>
                  <Label htmlFor="nombre">{t("auth.nombre")}</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={80}
                  />
                  {errors.nombre && <p className="mt-1 text-xs text-destructive">{errors.nombre}</p>}
                </div>
                <div>
                  <Label htmlFor="apellidos">{t("auth.apellidos")}</Label>
                  <Input
                    id="apellidos"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    maxLength={120}
                  />
                  {errors.apellidos && (
                    <p className="mt-1 text-xs text-destructive">{errors.apellidos}</p>
                  )}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password}</p>
              )}
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                {errors.confirm && (
                  <p className="mt-1 text-xs text-destructive">{errors.confirm}</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
            >
              {mode === "signup" ? t("auth.signup") : t("auth.login")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-md px-1 font-bold text-primary hover:underline"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? t("auth.loginHere") : t("auth.signupHere")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
