import teamupLogo from "@/assets/teamup-logo.png.asset.json";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LangToggle } from "@/components/lang-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authSearchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nombre, apellidos },
          },
        });
        if (error) throw error;
        toast.success(t("auth.signupSuccess"));
        navigate({ to: "/onboarding", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.loginSuccess"));
        navigate({ to: "/inicio", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <img src={teamupLogo.url} alt="TeamUp" className="size-8 object-contain" width={32} height={32} />
            <span className="text-display text-lg font-extrabold uppercase tracking-tight">
              {t("app.name")}
            </span>
          </Link>

          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-display text-3xl font-black tracking-tight">
              {mode === "signup" ? t("auth.signup") : t("auth.login")}
            </h1>
            <LangToggle />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            {t("auth.google")}
          </button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("auth.or")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
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
              className="font-bold text-primary hover:underline"
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
