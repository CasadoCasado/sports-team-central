import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Vote as VoteIcon, X, Lock, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/encuestas")({
  component: Encuestas,
});

type Poll = {
  id: string;
  team_id: string;
  created_by: string;
  pregunta: string;
  descripcion: string | null;
  multi_select: boolean;
  anonymous: boolean;
  closes_at: string | null;
  closed: boolean;
  created_at: string;
};
type Option = { id: string; poll_id: string; texto: string; posicion: number };
type VoteRow = { id: string; poll_id: string; option_id: string; user_id: string };

type TabKey = "pending" | "active" | "closed" | "all";

function isPollClosed(poll: Poll): boolean {
  return poll.closed || (!!poll.closes_at && new Date(poll.closes_at).getTime() < Date.now());
}

function Encuestas() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { active, isManager } = useActiveTeam();
  const teamId = active?.team.id;
  const [tab, setTab] = useState<TabKey>("pending");

  const { data: polls } = useQuery({
    queryKey: ["polls", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<Poll[]> => {
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .eq("team_id", teamId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Poll[];
    },
  });

  const pollIds = useMemo(() => (polls ?? []).map((p) => p.id), [polls]);

  const { data: myVotes } = useQuery({
    queryKey: ["my-poll-votes", teamId, user?.id, pollIds.join(",")],
    enabled: !!user && pollIds.length > 0,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("poll_votes")
        .select("poll_id")
        .eq("user_id", user!.id)
        .in("poll_id", pollIds);
      if (error) throw error;
      return new Set((data ?? []).map((v) => v.poll_id as string));
    },
  });

  const votedSet = myVotes ?? new Set<string>();

  const filtered = useMemo(() => {
    const list = polls ?? [];
    switch (tab) {
      case "pending":
        return list.filter((p) => !isPollClosed(p) && !votedSet.has(p.id));
      case "active":
        return list.filter((p) => !isPollClosed(p));
      case "closed":
        return list.filter((p) => isPollClosed(p));
      case "all":
      default:
        return list;
    }
  }, [polls, tab, votedSet]);

  const pendingCount = useMemo(
    () => (polls ?? []).filter((p) => !isPollClosed(p) && !votedSet.has(p.id)).length,
    [polls, votedSet],
  );

  if (!active) return <EmptyTeamState />;

  const emptyMsg =
    tab === "pending"
      ? t("polls.noPending")
      : tab === "active"
        ? t("polls.noActive")
        : tab === "closed"
          ? t("polls.noClosed")
          : t("polls.empty");

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "pending", label: t("polls.tabPending"), badge: pendingCount || undefined },
    { key: "active", label: t("polls.tabActive") },
    { key: "closed", label: t("polls.tabClosed") },
    { key: "all", label: t("polls.tabAll") },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-black tracking-tight">
            {t("polls.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("polls.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamPicker />
          {isManager && teamId && <NewPollDialog teamId={teamId} />}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
              tab === tb.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tb.label}
            {tb.badge ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
                {tb.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <VoteIcon className="size-7" />
          </div>
          <p className="text-sm text-muted-foreground">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              isManager={isManager}
              hasVoted={votedSet.has(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PollCard({
  poll,
  isManager,
  hasVoted,
}: {
  poll: Poll;
  isManager: boolean;
  hasVoted: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: options } = useQuery({
    queryKey: ["poll-options", poll.id],
    queryFn: async (): Promise<Option[]> => {
      const { data, error } = await supabase
        .from("poll_options")
        .select("*")
        .eq("poll_id", poll.id)
        .order("posicion");
      if (error) throw error;
      return (data ?? []) as Option[];
    },
  });

  const { data: votes } = useQuery({
    queryKey: ["poll-votes", poll.id],
    queryFn: async (): Promise<VoteRow[]> => {
      const { data, error } = await supabase
        .from("poll_votes")
        .select("*")
        .eq("poll_id", poll.id);
      if (error) throw error;
      return (data ?? []) as VoteRow[];
    },
  });

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    (votes ?? []).forEach((v) => map.set(v.option_id, (map.get(v.option_id) ?? 0) + 1));
    return map;
  }, [votes]);
  const totalVotes = votes?.length ?? 0;
  const uniqueVoters = new Set((votes ?? []).map((v) => v.user_id)).size;
  const myVotes = useMemo(
    () => new Set((votes ?? []).filter((v) => v.user_id === user?.id).map((v) => v.option_id)),
    [votes, user],
  );

  const isClosed = isPollClosed(poll);

  async function vote(optionId: string) {
    if (!user || isClosed) return;
    const already = myVotes.has(optionId);
    try {
      if (already) {
        const { error } = await supabase
          .from("poll_votes")
          .delete()
          .eq("option_id", optionId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        if (!poll.multi_select && myVotes.size > 0) {
          const { error: delErr } = await supabase
            .from("poll_votes")
            .delete()
            .eq("poll_id", poll.id)
            .eq("user_id", user.id);
          if (delErr) throw delErr;
        }
        const { error } = await supabase.from("poll_votes").insert({
          poll_id: poll.id,
          option_id: optionId,
          user_id: user.id,
        });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["poll-votes", poll.id] });
      qc.invalidateQueries({ queryKey: ["my-poll-votes", poll.team_id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function toggleClose() {
    const { error } = await supabase
      .from("polls")
      .update({ closed: !poll.closed })
      .eq("id", poll.id);
    if (error) return toast.error(error.message);
    toast.success(poll.closed ? t("polls.reopened") : t("polls.closedToast"));
    qc.invalidateQueries({ queryKey: ["polls", poll.team_id] });
  }

  async function cancel() {
    if (!confirm(t("polls.cancelConfirm"))) return;
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);
    if (error) return toast.error(error.message);
    toast.success(t("polls.cancelled"));
    qc.invalidateQueries({ queryKey: ["polls", poll.team_id] });
    qc.invalidateQueries({ queryKey: ["my-poll-votes", poll.team_id] });
  }

  const pastDeadline = !!poll.closes_at && new Date(poll.closes_at).getTime() < Date.now();
  const canCloseManually = isManager && !pastDeadline;

  return (
    <article className="surface-card space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-display text-lg font-black tracking-tight">{poll.pregunta}</h2>
            {isClosed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Lock className="size-3" /> {t("polls.closed")}
              </span>
            ) : hasVoted ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <CheckCircle2 className="size-3" /> {t("polls.voted")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                <Clock className="size-3" /> {t("polls.pendingLabel")}
              </span>
            )}
            {poll.multi_select && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                {t("polls.multi")}
              </span>
            )}
            {poll.anonymous && (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("polls.anonymous")}
              </span>
            )}
          </div>
          {poll.descripcion && (
            <p className="mt-1 text-sm text-muted-foreground">{poll.descripcion}</p>
          )}
          {poll.closes_at && (
            <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("polls.closesOn", { date: new Date(poll.closes_at).toLocaleString() })}
            </p>
          )}
        </div>
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            {canCloseManually && (
              <Button variant="outline" size="sm" onClick={toggleClose}>
                {poll.closed ? t("polls.reopen") : t("polls.close")}
              </Button>
            )}
            {!canCloseManually && poll.closed && (
              <Button variant="outline" size="sm" onClick={toggleClose}>
                {t("polls.reopen")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={cancel}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" /> {t("polls.cancel")}
            </Button>
          </div>
        )}
      </header>

      <div className="space-y-2">
        {(options ?? []).map((opt) => {
          const count = totals.get(opt.id) ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const selected = myVotes.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={isClosed}
              className={cn(
                "group relative w-full overflow-hidden rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50",
                isClosed && "cursor-not-allowed opacity-80",
              )}
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all",
                  selected ? "bg-primary/20" : "bg-muted/40",
                )}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selected && <CheckCircle2 className="size-4 text-primary" />}
                  <span className="text-sm font-medium">{opt.texto}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span>{count}</span>
                  <span className="text-primary">{pct}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <footer className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>{t("polls.votesCount", { count: totalVotes })}</span>
        <span>{t("polls.votersCount", { count: uniqueVoters })}</span>
      </footer>
    </article>
  );
}

function NewPollDialog({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [multi, setMulti] = useState(false);
  const [anon, setAnon] = useState(false);
  const [closesAt, setClosesAt] = useState("");
  const [opts, setOpts] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setPregunta("");
    setDescripcion("");
    setMulti(false);
    setAnon(false);
    setClosesAt("");
    setOpts(["", ""]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const cleanOpts = opts.map((o) => o.trim()).filter(Boolean);
    if (!pregunta.trim() || cleanOpts.length < 2) {
      toast.error(t("polls.needTwoOptions"));
      return;
    }
    setSaving(true);
    try {
      const { data: poll, error } = await supabase
        .from("polls")
        .insert({
          team_id: teamId,
          created_by: user.id,
          pregunta: pregunta.trim(),
          descripcion: descripcion.trim() || null,
          multi_select: multi,
          anonymous: anon,
          closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: optErr } = await supabase.from("poll_options").insert(
        cleanOpts.map((texto, i) => ({ poll_id: poll.id, texto, posicion: i })),
      );
      if (optErr) throw optErr;
      toast.success(t("polls.created"));
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["polls", teamId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground uppercase tracking-widest font-bold">
          <Plus className="size-4" /> {t("polls.create")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("polls.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="p-q">{t("polls.question")}</Label>
            <Input id="p-q" value={pregunta} onChange={(e) => setPregunta(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <Label htmlFor="p-d">{t("polls.description")}</Label>
            <Textarea id="p-d" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div>
            <Label>{t("polls.options")}</Label>
            <div className="space-y-2">
              {opts.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={o}
                    onChange={(e) => setOpts((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder={t("polls.optionPlaceholder", { n: i + 1 })}
                    maxLength={120}
                  />
                  {opts.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOpts((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-md border border-border p-2 text-muted-foreground hover:text-destructive"
                      aria-label={t("common.delete")}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setOpts((prev) => [...prev, ""])}
              disabled={opts.length >= 10}
            >
              <Plus className="size-3.5" /> {t("polls.addOption")}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border border-border p-3">
              <Checkbox checked={multi} onCheckedChange={(v) => setMulti(!!v)} />
              <span className="text-sm">{t("polls.multi")}</span>
            </label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3">
              <Checkbox checked={anon} onCheckedChange={(v) => setAnon(!!v)} />
              <span className="text-sm">{t("polls.anonymous")}</span>
            </label>
          </div>
          <div>
            <Label htmlFor="p-c">{t("polls.closesAt")}</Label>
            <Input id="p-c" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground uppercase tracking-widest font-bold"
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
