import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  Users,
  Calendar,
  ClipboardList,
  MessagesSquare,
  Trophy,
  Search,
  Vote,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { cn } from "@/lib/utils";

type TourStep = { key: string; icon: LucideIcon; to?: string };

const MANAGER_STEPS: TourStep[] = [
  { key: "team", icon: Users, to: "/mi-equipo" },
  { key: "members", icon: Users, to: "/miembros" },
  { key: "calendar", icon: Calendar, to: "/calendario" },
  { key: "callups", icon: ClipboardList, to: "/convocatorias" },
  { key: "results", icon: Trophy, to: "/resultados" },
  { key: "chat", icon: MessagesSquare, to: "/comunicaciones" },
];

const PLAYER_STEPS: TourStep[] = [
  { key: "find", icon: Search, to: "/mi-equipo" },
  { key: "calendar", icon: Calendar, to: "/calendario" },
  { key: "signup", icon: ClipboardList, to: "/convocatorias" },
  { key: "polls", icon: Vote, to: "/encuestas" },
  { key: "badges", icon: Trophy, to: "/logros" },
  { key: "alerts", icon: Bell, to: "/notificaciones" },
];

const KEY_PREFIX = "teamup:tour-done:";

export function useGuidedTour() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(KEY_PREFIX + user.id);
    setReady(true);
    if (!done) setOpen(true);
  }, [user]);

  const finish = () => {
    if (user) localStorage.setItem(KEY_PREFIX + user.id, "1");
    setOpen(false);
  };

  const restart = () => setOpen(true);

  return { open, setOpen, finish, restart, ready };
}

export function GuidedTour({
  open,
  onFinish,
}: {
  open: boolean;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { isManager } = useActiveTeam();
  const [index, setIndex] = useState(0);

  const manager = isManager || profile?.preferred_role === "capitan";
  const steps = manager ? MANAGER_STEPS : PLAYER_STEPS;
  const role = manager ? "manager" : "player";
  const step = steps[Math.min(index, steps.length - 1)];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onFinish()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("tour.stepOf", { current: index + 1, total: steps.length })}
            </span>
          </div>
          <DialogTitle className="text-xl">
            {t(`tour.${role}.${step.key}.title`)}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t(`tour.${role}.${step.key}.desc`)}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= index ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 justify-start text-muted-foreground sm:justify-center"
            onClick={onFinish}
          >
            {t("tour.skip")}
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => setIndex((i) => i - 1)}
              >
                {t("tour.back")}
              </Button>
            )}
            {step.to && (
              <Button
                asChild
                variant="outline"
                className="min-h-11 flex-1"
                onClick={onFinish}
              >
                <Link to={step.to}>{t("tour.goTo")}</Link>
              </Button>
            )}
            <Button
              type="button"
              className="min-h-11 flex-1 bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:opacity-90"
              onClick={() => (isLast ? onFinish() : setIndex((i) => i + 1))}
            >
              {isLast ? t("tour.finish") : t("tour.next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
