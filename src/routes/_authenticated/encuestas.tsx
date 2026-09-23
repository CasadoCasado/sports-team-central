import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2, Vote as VoteIcon, X, Lock, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import type { Poll as ApiPoll, PollOption } from "@/lib/types";
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
  head: () => ({
    meta: [
      { title: "Encuestas | TeamUp" },
      { name: "description", content: "Vota en las encuestas del equipo y consulta los resultados en tiempo real." },
      { property: "og:title", content: "Encuestas | TeamUp" },
      { property: "og:description", content: "Vota en las encuestas del equipo y consulta los resultados en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Encuestas,
});

type Poll = ApiPoll;
type Option = PollOption;

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
    queryFn: () =>
      api.get<Poll[]>("/polls/", { team_id: teamId!, order: "-created_at" }),
  });

  const pollIds = useMemo(() => (polls ?? []).map((p) => p.id), [polls]);

  // Cada encuesta trae las opciones que ha votado el usuario, así que saber a
  // cuáles ha respondido ya no necesita otra consulta.
  const votedSet = useMemo(
    () => new Set((polls ?? []).filter((p) => p.my_votes.length > 0).map((p) => p.id)),
    [polls],
  );

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
        <div className="min-w-0">
          <h1 className="text-display text-2xl font-black tracking-tight sm:text-3xl">
            {t("polls.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("polls.subtitle")}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TeamPicker />
          {isManager && teamId && <NewPollDialog teamId={teamId} />}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t("polls.title")}
        className="flex flex-wrap gap-2 border-b border-border"
      >
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              "relative -mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-xs font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === tb.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tb.label}
            {tb.badge ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-2xs font-black text-primary-foreground">
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

  // Las opciones y sus recuentos llegan con la encuesta.
  const options = poll.options;

  const totals = useMemo(
    () => new Map(options.map((o) => [o.id, o.vote_count])),
    [options],
  );
  const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0);
  const uniqueVoters = poll.voter_count;
  const myVotes = useMemo(() => new Set(poll.my_votes), [poll.my_votes]);

  const isClosed = isPollClosed(poll);

  // Votar lo resuelve el servidor: quitar el voto anterior en las encuestas de
  // opción única, o desmarcar si se vuelve a pulsar lo ya votado. Eran hasta
  // tres escrituras desde el navegador.
  async function vote(optionId: string) {
    if (!user || isClosed) return;
    try {
      await api.post(`/polls/${poll.id}/vote/`, { option_id: optionId });
      qc.invalidateQueries({ queryKey: ["polls", poll.team_id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function toggleClose() {
    try {
      await api.patch(`/polls/${poll.id}/`, { closed: !poll.closed });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : t("common.error"));
    }
    toast.success(poll.closed ? t("polls.reopened") : t("polls.closedToast"));
    qc.invalidateQueries({ queryKey: ["polls", poll.team_id] });
  }

  async function cancel() {
    if (!confirm(t("polls.cancelConfirm"))) return;
    try {
      await api.delete(`/polls/${poll.id}/`);
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : t("common.error"));
    }
    toast.success(t("polls.cancelled"));
    qc.invalidateQueries({ queryKey: ["polls", poll.team_id] });
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
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                <Lock className="size-3" /> {t("polls.closed")}
              </span>
            ) : hasVoted ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-primary">
                <CheckCircle2 className="size-3" /> {t("polls.voted")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-warn">
                <Clock className="size-3" /> {t("polls.pendingLabel")}
              </span>
            )}
            {poll.multi_select && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-primary">
                {t("polls.multi")}
              </span>
            )}
            {poll.anonymous && (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("polls.anonymous")}
              </span>
            )}
          </div>
          {poll.descripcion && (
            <p className="mt-1 text-sm text-muted-foreground">{poll.descripcion}</p>
          )}
          {poll.closes_at && (
            <p className="mt-1 text-xxs uppercase tracking-widest text-muted-foreground">
              {t("polls.closesOn", { date: new Date(poll.closes_at).toLocaleString() })}
            </p>
          )}
        </div>
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            {canCloseManually && (
              <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={toggleClose}>
                {poll.closed ? t("polls.reopen") : t("polls.close")}
              </Button>
            )}
            {!canCloseManually && poll.closed && (
              <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={toggleClose}>
                {t("polls.reopen")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={cancel}
              className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-h-9"
            >
              <Trash2 className="size-4" aria-hidden="true" /> {t("polls.cancel")}
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
              aria-pressed={selected}
              aria-label={`${opt.texto} — ${pct}% (${count})`}
              className={cn(
                "group relative flex min-h-12 w-full items-center overflow-hidden rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
              <div className="relative flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selected && <CheckCircle2 className="size-4 text-primary" />}
                  <span className="text-sm font-medium">{opt.texto}</span>
                </div>
                <div className="flex items-center gap-3 text-xxs font-bold uppercase tracking-widest text-muted-foreground">
                  <span>{count}</span>
                  <span className="text-primary">{pct}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <footer className="flex items-center justify-between text-xxs uppercase tracking-widest text-muted-foreground">
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
      // La encuesta y sus opciones se crean juntas o no se crea ninguna: antes
      // eran dos inserciones y podía quedar una encuesta sin nada que votar.
      await api.post("/polls/", {
        team_id: teamId,
        pregunta: pregunta.trim(),
        descripcion: descripcion.trim() || null,
        multi_select: multi,
        anonymous: anon,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        options: cleanOpts,
      });
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
                      className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${t("common.delete")} ${i + 1}`}
                    >
                      <X className="size-4" aria-hidden="true" />
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
