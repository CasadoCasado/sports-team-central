import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Wallet, Check, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pagos")({
  component: Pagos,
});

type Fee = {
  id: string;
  concepto: string;
  amount: number;
  currency: string;
  due_date: string | null;
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
      const { data, error } = await supabase
        .from("team_fees")
        .select("id, concepto, amount, currency, due_date, created_at")
        .eq("team_id", active!.team_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((f) => ({ ...f, amount: Number(f.amount) }));
    },
  });

  const feeIds = fees?.map((f) => f.id) ?? [];
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["fee-payments", feeIds.join(",")],
    enabled: feeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("id, fee_id, user_id, status, paid_at")
        .in("fee_id", feeIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["team-members-fees", active?.team_id],
    enabled: !!active && isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, profiles:user_id(id, nombre, apellidos)")
        .eq("team_id", active!.team_id)
        .eq("status", "activo");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        user_id: m.user_id,
        profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
      }));
    },
  });

  const [open, setOpen] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const createFee = useMutation({
    mutationFn: async () => {
      if (!active || !user) throw new Error("No team");
      const { error } = await supabase.from("team_fees").insert({
        team_id: active.team_id,
        created_by: user.id,
        concepto,
        amount: parseFloat(amount),
        due_date: dueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("fees.created"));
      setOpen(false);
      setConcepto("");
      setAmount("");
      setDueDate("");
      qc.invalidateQueries({ queryKey: ["fees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const togglePaid = useMutation({
    mutationFn: async ({ feeId, userId, paid }: { feeId: string; userId: string; paid: boolean }) => {
      const { error } = await supabase.from("fee_payments").upsert(
        {
          fee_id: feeId,
          user_id: userId,
          status: paid ? "pagado" : "pendiente",
          paid_at: paid ? new Date().toISOString() : null,
        },
        { onConflict: "fee_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fee-payments"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("common.error")),
  });

  const deleteFee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_fees").delete().eq("id", id);
      if (error) throw error;
    },
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
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
                <div className="grid grid-cols-2 gap-3">
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
                <Button
                  className="w-full"
                  onClick={() => createFee.mutate()}
                  disabled={!concepto || !amount || createFee.isPending}
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

            return (
              <div key={fee.id} className="surface-card overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b border-border p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{fee.concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {fee.due_date
                        ? t("fees.dueOn", { date: new Date(fee.due_date).toLocaleDateString() })
                        : t("fees.noDueDate")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-display text-xl font-black text-primary">
                      {fee.amount.toFixed(2)} €
                    </p>
                    {isManager && (
                      <p className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                        {paidCount} / {members?.length ?? 0} {t("fees.paid")}
                      </p>
                    )}
                  </div>
                  {isManager && (
                    <button
                      onClick={() => {
                        if (confirm(t("fees.deleteConfirm"))) deleteFee.mutate(fee.id);
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                {isManager && members ? (
                  <div className="divide-y divide-border">
                    {members.map((m) => {
                      const paid =
                        feePayments.find((p) => p.user_id === m.user_id)?.status === "pagado";
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 p-3">
                          <span className="flex-1 text-sm">
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
                              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-2xs font-bold uppercase tracking-widest transition",
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
                    <button
                      onClick={() =>
                        user &&
                        togglePaid.mutate({
                          feeId: fee.id,
                          userId: user.id,
                          paid: !myPaid,
                        })
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-widest transition",
                        myPaid
                          ? "bg-primary/20 text-primary"
                          : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {myPaid ? <Check className="size-3" /> : <Clock className="size-3" />}
                      {myPaid ? t("fees.markedPaid") : t("fees.markPaid")}
                    </button>
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
