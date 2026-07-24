import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/comunicaciones/unirse/$token")({
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
      const { data, error } = await supabase.rpc("join_channel_by_token", { _token: token });
      if (error || !data) {
        const code = error?.message ?? "";
        let msg = t("chat.joinFailed");
        if (code.includes("invalid_token")) msg = t("chat.inviteInvalid");
        else if (code.includes("not_team_member")) msg = t("chat.notTeamMember");
        setMessage(msg);
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
