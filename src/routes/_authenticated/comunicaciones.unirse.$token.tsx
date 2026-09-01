import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/comunicaciones/unirse/$token")({
  head: () => ({
    meta: [
      { title: "Unirse a un canal | TeamUp" },
      { name: "description", content: "Acepta la invitación para entrar en un canal de comunicación del equipo." },
      { property: "og:title", content: "Unirse a un canal | TeamUp" },
      { property: "og:description", content: "Acepta la invitación para entrar en un canal de comunicación del equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinChannel,
});

function JoinChannel() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string>("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      // Port de la función SQL `join_channel_by_token`: sigue exigiendo ser
      // del equipo, el enlace solo ahorra que un gestor te añada a mano.
      try {
        await api.post("/chat-channels/join/", { token });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        // 400 es un enlace que no vale; 403, alguien de fuera del equipo.
        setMessage(
          status === 400
            ? t("chat.inviteInvalid")
            : status === 403
              ? t("chat.notTeamMember")
              : t("chat.joinFailed"),
        );
        setStatus("error");
        return;
      }
      toast.success(t("chat.joinedChannel"));
      navigate({ to: "/comunicaciones" });
    })();
  }, [token, navigate, t]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Link2 className="size-6" />
      </div>
      {status === "loading" ? (
        <>
          <h1 className="text-display text-2xl font-black">{t("chat.joiningChannel")}</h1>
          <p className="text-sm text-muted-foreground">{t("chat.pleaseWait")}</p>
        </>
      ) : (
        <>
          <h1 className="text-display text-2xl font-black">{t("chat.joinFailedTitle")}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <button
            onClick={() => navigate({ to: "/comunicaciones" })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase tracking-widest text-primary-foreground"
          >
            {t("chat.backToChannels")}
          </button>
        </>
      )}
    </div>
  );
}
