import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Wallet, Check, Clock, Trash2, User } from "lucide-react";
import { api } from "@/lib/api";
import type { FeePayment, TeamFee, TeamMember } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/pagos")({
  head: () => ({
    meta: [
      { title: "Pagos | TeamUp" },
      { name: "description", content: "Controla las cuotas del equipo y el estado de pago de cada jugador." },
      { property: "og:title", content: "Pagos | TeamUp" },
      { property: "og:description", content: "Controla las cuotas del equipo y el estado de pago de cada jugador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagos,
});

type Fee = {
  id: string;
  concepto: string;
  amount: number;
  currency: string;
  due_date: string | null;
  individual: boolean;
  created_at: string;
};

type Payment = {
  id: string;
  fee_id: string;
  user_id: string;
  status: string;
  paid_at: string | null;
};

function Pagos() {
  const { t } = useTranslation();
  const { active, isManager } = useActiveTeam();
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: fees } = useQuery<Fee[]>({
    queryKey: ["fees", active?.team_id],
    enabled: !!active,
    queryFn: async () => {
      const rows = await api.get<TeamFee[]>("/team-fees/", {
        team_id: active!.team_id,
        order: "-created_at",
      });
      // El importe llega como cadena decimal, para no perder céntimos por el
      // camino; la UI lo pinta como número.
      return rows.map((f) => ({ ...f, amount: Number(f.amount) }));
    },
  });

  const feeIds = fees?.map((f) => f.id) ?? [];
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["fee-payments", feeIds.join(",")],
    enabled: feeIds.length > 0,
    queryFn: () => api.get<FeePayment[]>("/fee-payments/", { fee_id__in: feeIds }),
  });

  const { data: members } = useQuery({
    queryKey: ["team-members-fees", active?.team_id],
    enabled: !!active && isManager,
    queryFn: async () => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        team_id: active!.team_id,
        status: "activo",
      });
      return rows.map((m) => ({ user_id: m.user_id, profile: m.profile }));
    },
  });

  const [open, setOpen] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Vacío: la cuota es de todo el equipo. Con gente: solo para ellos, y a
  // cada uno le llega un aviso.
  const [paraPersonas, setParaPersonas] = useState(false);
  const [destinatarios, setDestinatarios] = useState<string[]>([]);

  const createFee = useMutation({
    mutationFn: async () => {
      if (!active || !user) throw new Error("No team");
      await api.post("/team-fees/", {
        team_id: active.team_id,
        concepto,
        amount,
        due_date: dueDate || null,
        ...(paraPersonas ? { user_ids: destinatarios } : {}),
      });
    },
    onSuccess: () => {
      toast.success(
        paraPersonas
          ? t("fees.createdIndividual", { count: destinatarios.length })
          : t("fees.created"),
      );
      setOpen(false);
      setConcepto("");
      setAmount("");
      setDueDate("");
      setParaPersonas(false);
      setDestinatarios([]);
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["fee-payments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const togglePaid = useMutation({
    // La fila del pago puede no existir todavía: `set-status` la crea o la
    // actualiza, que es lo que hacía el upsert.
    mutationFn: ({ feeId, userId, paid }: { feeId: string; userId: string; paid: boolean }) =>
      api.post("/fee-payments/set-status/", {
        fee_id: feeId,
        user_id: userId,
        paid,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-payments"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const deleteFee = useMutation({
    mutationFn: (id: string) => api.delete(`/team-fees/${id}/`),
    onSuccess: () => {
      toast.success(t("fees.deleted"));
      qc.invalidateQueries({ queryKey: ["fees"] });
    },
  });

  if (!active) {
    return (
      <div className="mx-auto max-w-xl surface-card p-12 text-center">
        <p className="text-sm text-muted-foreground">{t("common.noTeamSelected")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
            {t("nav.pagos")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("fees.subtitle")}</p>
        </div>
        {isManager && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground uppercase text-2xs tracking-widest font-bold">
                <Plus className="mr-2 size-4" />
                {t("fees.create")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("fees.create")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("fees.concept")}</Label>
                  <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                  <div>
                    <Label>{t("fees.amount")} (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("fees.dueDate")}</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("fees.forWhom")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[false, true].map((personas) => (
                      <button
                        key={String(personas)}
                        type="button"
                        onClick={() => setParaPersonas(personas)}
                        className={cn(
                          "min-h-10 rounded-md border px-3 text-xs font-bold uppercase tracking-widest transition",
                          paraPersonas === personas
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {personas ? t("fees.forPeople") : t("fees.forTeam")}
                      </button>
                    ))}
                  </div>
                </div>
                {paraPersonas && (
                  <div className="space-y-2">
                    <div>
                      <Label>{t("fees.pickPeople")}</Label>
                      <p className="text-xs text-muted-foreground">{t("fees.pickPeopleHint")}</p>
                    </div>
                    <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                      {members?.map((m) => {
                        const marcado = destinatarios.includes(m.user_id);
                        return (
                          <label
                            key={m.user_id}
                            className="flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted"
                          >
                            <Checkbox
                              checked={marcado}
                              onCheckedChange={() =>
                                setDestinatarios((d) =>
                                  marcado ? d.filter((x) => x !== m.user_id) : [...d, m.user_id],
                                )
                              }
                            />
                            <span className="min-w-0 flex-1 text-sm break-words">
                              {m.profile?.nombre} {m.profile?.apellidos}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => createFee.mutate()}
                  disabled={
                    !concepto ||
                    !amount ||
                    (paraPersonas && destinatarios.length === 0) ||
                    createFee.isPending
                  }
                >
                  {t("common.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(fees?.length ?? 0) === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 p-16 text-center">
          <Wallet className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("fees.empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fees?.map((fee) => {
            const feePayments = payments?.filter((p) => p.fee_id === fee.id) ?? [];
            const myPayment = feePayments.find((p) => p.user_id === user?.id);
            const myPaid = myPayment?.status === "pagado";
            const paidCount = feePayments.filter((p) => p.status === "pagado").length;
            // La individual solo cuenta a quien va dirigida; la de equipo, a todos.
            const cobrados = fee.individual
              ? (members ?? []).filter((m) => feePayments.some((p) => p.user_id === m.user_id))
              : members;

            return (
              <div key={fee.id} className="surface-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border p-4">
                  <div className="min-w-[8rem] flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold break-words">
                      {fee.concepto}
                      {fee.individual && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-primary">
                          <User className="size-3" />
                          {t("fees.individual")}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fee.due_date
                        ? t("fees.dueOn", { date: new Date(fee.due_date).toLocaleDateString() })
                        : t("fees.noDueDate")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-display text-xl font-black text-primary">
                      {fee.amount.toFixed(2)} €
                    </p>
                    {isManager && (
                      <p className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                        {paidCount} / {cobrados?.length ?? 0} {t("fees.paid")}
                      </p>
                    )}
                  </div>
                  {isManager && (
                    <button
                      onClick={async () => {
                        if (await confirmar({ title: t("confirm.deleteFeeTitle"), description: t("confirm.noUndo"), confirmLabel: t("confirm.delete"), tone: "danger" })) deleteFee.mutate(fee.id);
                      }}
                      aria-label={t("common.delete")}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:size-9"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                {isManager && cobrados ? (
                  <div className="divide-y divide-border">
                    {cobrados.map((m) => {
                      const paid =
                        feePayments.find((p) => p.user_id === m.user_id)?.status === "pagado";
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 p-3">
                          <span className="min-w-0 flex-1 text-sm break-words">
                            {m.profile?.nombre} {m.profile?.apellidos}
                          </span>
                          <button
                            onClick={() =>
                              togglePaid.mutate({
                                feeId: fee.id,
                                userId: m.user_id,
                                paid: !paid,
                              })
                            }
                            className={cn(
                              "flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-2xs font-bold uppercase tracking-widest transition",
                              paid
                                ? "bg-primary/20 text-primary"
                                : "bg-card text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {paid ? <Check className="size-3" /> : <Clock className="size-3" />}
                            {paid ? t("fees.paid") : t("fees.pending")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <span className="text-sm text-muted-foreground">{t("fees.myStatus")}</span>
                    {/* Solo lectura: el pago lo marca la gestión, que es quien
                        cobra. Antes cada uno podía marcarse como pagado. */}
                    <span
                      className={cn(
                        "flex min-h-10 shrink-0 items-center gap-1.5 rounded-md px-4 text-xs font-bold uppercase tracking-widest",
                        myPaid ? "bg-primary/20 text-primary" : "bg-card text-muted-foreground",
                      )}
                    >
                      {myPaid ? <Check className="size-3" /> : <Clock className="size-3" />}
                      {myPaid ? t("fees.paid") : t("fees.pending")}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
