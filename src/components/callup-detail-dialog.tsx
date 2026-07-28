import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Link } from "@tanstack/react-router";
import { Calendar as CalIcon, Clock, MapPin, ClipboardList, Trophy, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { eventTypeStyles, type EventType } from "@/lib/events";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSignUp?: (eventId: string) => void;
  onWithdraw?: (eventId: string) => void;
  signingUp?: boolean;
  withdrawing?: boolean;
  alreadySignedUp?: boolean;
};

export function CallupDetailDialog({
  eventId,
  open,
  onOpenChange,
  onSignUp,
  onWithdraw,
  signingUp,
  withdrawing,
  alreadySignedUp,
}: Props) {

  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;

  const { data: event, isLoading } = useQuery({
    queryKey: ["callup-detail", eventId],
    enabled: open && !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, tipo, titulo, descripcion, fecha_inicio, fecha_fin, ubicacion, rival, es_local, requiere_convocatoria, convocatoria_cierra_en, competitions:competition_id(nombre)",
        )
        .eq("id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const style = event ? eventTypeStyles[event.tipo as EventType] : null;
  const start = event ? new Date(event.fecha_inicio) : null;
  const end = event?.fecha_fin ? new Date(event.fecha_fin) : null;
  const cierre = event?.convocatoria_cierra_en ? new Date(event.convocatoria_cierra_en) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-display text-2xl font-black tracking-tight">
            {event?.titulo ?? t("common.loading")}
          </DialogTitle>
          {event && style && (
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest",
                    style.badge,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", style.dot)} />
                  {t(`events.types.${event.tipo}`)}
                </span>
                {event.rival && (
                  <span className="text-xs text-muted-foreground">
                    vs <span className="text-foreground font-semibold">{event.rival}</span>
                    {event.es_local != null && (
                      <span className="ml-2 text-2xs font-bold uppercase tracking-widest text-primary">
                        {event.es_local ? t("events.local") : t("events.visitante")}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading || !event || !start ? (
          <p className="py-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="space-y-3 py-2">
            <Row icon={<CalIcon className="size-4" />} label={t("events.fechaInicio")}>
              {format(start, "PPPP", { locale })}
            </Row>
            <Row icon={<Clock className="size-4" />} label={t("events.fechaFin")}>
              {format(start, "HH:mm")}
              {end && ` — ${format(end, "HH:mm")}`}
            </Row>
            {event.ubicacion && (
              <Row icon={<MapPin className="size-4" />} label={t("events.ubicacion")}>
                {event.ubicacion}
              </Row>
            )}
            {event.competitions && (
              <Row icon={<Trophy className="size-4" />} label={t("events.competicion")}>
                {(event.competitions as { nombre: string }).nombre}
              </Row>
            )}
            {cierre && (
              <Row icon={<ClipboardList className="size-4" />} label={t("events.cierreConvocatoria")}>
                {format(cierre, "PPP HH:mm", { locale })}
              </Row>
            )}
            {event.descripcion && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t("events.descripcion")}
                </p>
                <p className="whitespace-pre-wrap text-sm">{event.descripcion}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {event && (
            <Button variant="outline" asChild size="sm">
              <Link to="/eventos/$id" params={{ id: event.id }}>
                <ExternalLink className="mr-1 size-3.5" /> {t("events.detail")}
              </Link>
            </Button>
          )}
          {onSignUp && event && !alreadySignedUp && (
            <Button
              size="sm"
              disabled={signingUp}
              onClick={() => onSignUp(event.id)}
              className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
            >
              {t("callups.signUp")}
            </Button>
          )}
          {alreadySignedUp && (
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-widest text-emerald-400">
                {t("callups.signedUp")}
              </span>
              {onWithdraw && event && (!cierre || cierre > new Date()) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={withdrawing}
                      className="text-2xs font-bold uppercase tracking-widest"
                    >
                      {withdrawing ? t("callups.withdrawing") : t("callups.withdraw")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("callups.withdrawConfirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("callups.withdrawConfirmBody")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("callups.keepSignedUp")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onWithdraw(event.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t("callups.withdrawConfirmAction")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm">{children}</p>
      </div>
    </div>
  );
}
