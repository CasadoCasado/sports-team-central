/**
 * La página a la que lleva el enlace que un gestor manda por WhatsApp.
 *
 * Es pública: quien la abre aún no suele tener cuenta. Enseña a qué equipo le
 * invitan y le deja crearse la cuenta —o entrar con la suya— para acabar
 * directamente dentro del equipo. Con la sesión ya iniciada basta un botón.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link2Off, MapPin, Shield, Users } from "lucide-react";

import { LOGO_URL } from "@/lib/brand";
import { ApiError, mediaUrl } from "@/lib/api";
import { hasSession } from "@/lib/auth";
import { getJoinPreview, joinTeamByCode } from "@/lib/join-team";
import { setActiveTeamId } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unirse/$codigo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Únete a tu equipo | TeamUp" },
      {
        name: "description",
        content: "Te han invitado a un equipo en TeamUp. Crea tu cuenta y entra directamente.",
      },
      { property: "og:title", content: "Únete a tu equipo en TeamUp" },
      {
        property: "og:description",
        content:
          "Entrenos, partidos y convocatorias, todo en un sitio. Crea tu cuenta y entra directamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinTeam,
});

function JoinTeam() {
  const { codigo } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const logged = hasSession();
  const [joining, setJoining] = useState(false);

  const {
    data: team,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["join-preview", codigo],
    queryFn: () => getJoinPreview(codigo),
    retry: false,
  });

  async function join() {
    setJoining(true);
    try {
      const res = await joinTeamByCode(codigo);
      await qc.invalidateQueries();
      toast.success(t("joinLink.joined", { team: res.nombre }));
      navigate({ to: "/mi-equipo", replace: true });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(
        status === 403
          ? t("joinLink.expelled")
          : err instanceof Error
            ? err.message
            : t("common.error"),
      );
      setJoining(false);
    }
  }

  function goToTeam() {
    if (team?.id) setActiveTeamId(team.id);
    navigate({ to: "/mi-equipo" });
  }

  const iniciales = (team?.nombre ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <img
            src={LOGO_URL}
            alt="TeamUp"
            className="size-8 object-contain"
            width={32}
            height={32}
          />
          <span className="text-display text-lg font-extrabold uppercase tracking-tight">
            {t("app.name")}
          </span>
        </Link>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground">{t("joinLink.loading")}</p>
        ) : error || !team ? (
          <div className="surface-card flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Link2Off className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-display text-2xl font-black">{t("joinLink.invalidTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("joinLink.invalidBody")}</p>
            <Button asChild variant="outline">
              <Link to={logged ? "/inicio" : "/"}>{t("joinLink.backHome")}</Link>
            </Button>
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="relative overflow-hidden bg-[color:var(--color-ink)] px-6 py-8 text-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full opacity-30"
                style={{
                  background:
                    "radial-gradient(circle, var(--color-primary) 0%, var(--color-accent) 60%, transparent 72%)",
                }}
              />
              <div className="relative flex flex-col items-center gap-4">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
                  {team.logo_url ? (
                    <img src={mediaUrl(team.logo_url)} alt="" className="size-full object-cover" />
                  ) : iniciales ? (
                    <span className="text-display text-2xl font-extrabold">{iniciales}</span>
                  ) : (
                    <Shield className="size-8" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-muted)]">
                    {team.invita
                      ? t("joinLink.invitedBy", { name: team.invita })
                      : t("joinLink.invited")}
                  </p>
                  <h1 className="text-display mt-2 text-3xl font-black tracking-tight text-white break-words">
                    {team.nombre}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-[color:var(--color-ink-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" aria-hidden="true" />
                    {t("joinLink.membersCount", { count: team.member_count })}
                  </span>
                  {team.ciudad && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {team.ciudad}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 p-6">
              {team.ya_miembro ? (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    {t("joinLink.alreadyMember")}
                  </p>
                  <Button
                    onClick={goToTeam}
                    className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
                  >
                    {t("joinLink.goToTeam")}
                  </Button>
                </>
              ) : logged ? (
                <Button
                  onClick={join}
                  disabled={joining}
                  className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
                >
                  {t("joinLink.join")}
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    className="w-full bg-primary text-primary-foreground uppercase tracking-widest font-bold hover:opacity-90"
                  >
                    <Link to="/auth" search={{ mode: "signup", unirse: codigo }}>
                      {t("joinLink.signupAndJoin")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full uppercase tracking-widest font-bold"
                  >
                    <Link to="/auth" search={{ mode: "login", unirse: codigo }}>
                      {t("joinLink.haveAccount")}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
