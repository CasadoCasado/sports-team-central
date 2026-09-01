import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Hash, Link2, Lock, Plus, RefreshCw, Send, Settings, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatChannel, ChatChannelMember, ChatMessage, TeamMember } from "@/lib/types";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamPicker } from "@/components/team-picker";
import { EmptyTeamState } from "@/components/empty-team-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comunicaciones")({
  head: () => ({
    meta: [
      { title: "Comunicaciones | TeamUp" },
      { name: "description", content: "Chat del equipo con canales públicos y privados e invitaciones por enlace." },
      { property: "og:title", content: "Comunicaciones | TeamUp" },
      { property: "og:description", content: "Chat del equipo con canales públicos y privados e invitaciones por enlace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Comunicaciones,
});

type Channel = {
  id: string;
  team_id: string;
  nombre: string;
  scope: "general" | "staff" | "custom";
  invite_token: string | null;
};

type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  contenido: string;
  edited: boolean;
  created_at: string;
};

type TeamMemberOption = {
  user_id: string;
  role: string;
  nombre: string | null;
  apellidos: string | null;
  avatar_url: string | null;
};

function useTeamMemberOptions(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-member-options", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<TeamMemberOption[]> => {
      const rows = await api.get<TeamMember[]>("/team-members/", {
        team_id: teamId!,
        status: "activo",
      });
      return rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        nombre: r.profile?.nombre ?? null,
        apellidos: r.profile?.apellidos ?? null,
        avatar_url: r.profile?.avatar_url ?? null,
      }));
    },
  });
}

function Comunicaciones() {
  const { t } = useTranslation();
  const { active, isManager } = useActiveTeam();
  const teamId = active?.team.id;

  const { data: channels } = useQuery({
    queryKey: ["chat-channels", teamId],
    enabled: !!teamId,
    // La lista ya viene filtrada a los canales en los que se puede entrar: el
    // general, el de staff si gestionas, y los privados donde estés metido.
    queryFn: () => api.get<ChatChannel[]>("/chat-channels/", { team_id: teamId! }),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!channels?.length) return;
    if (!selectedId || !channels.find((c) => c.id === selectedId)) {
      setSelectedId(channels[0].id);
    }
  }, [channels, selectedId]);

  const selected = channels?.find((c) => c.id === selectedId) ?? null;

  if (!active) return <EmptyTeamState />;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-7xl flex-col gap-3 lg:h-[calc(100dvh-9rem)] lg:gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-display truncate text-2xl font-black tracking-tight sm:text-3xl">
            {t("chat.title")}
          </h1>
          <p className="hidden text-sm text-muted-foreground sm:block">{t("chat.subtitle")}</p>
        </div>
        <TeamPicker />
      </div>

      {/* Mobile channel strip */}
      <div className="surface-card flex shrink-0 items-center gap-2 overflow-hidden p-2 lg:hidden">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {channels?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                selectedId === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {c.scope === "staff" ? (
                <Lock className="size-3.5 shrink-0" />
              ) : c.scope === "general" ? (
                <Users className="size-3.5 shrink-0" />
              ) : (
                <Hash className="size-3.5 shrink-0" />
              )}
              <span className="max-w-32 truncate">{c.nombre}</span>
            </button>
          ))}
        </div>
        {isManager && teamId && (
          <div className="shrink-0">
            <NewChannelDialog teamId={teamId} />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="surface-card hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("chat.channels")}
            </span>
            {isManager && teamId && <NewChannelDialog teamId={teamId} />}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {channels?.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  selectedId === c.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                {c.scope === "staff" ? (
                  <Lock className="size-3.5 shrink-0" />
                ) : c.scope === "general" ? (
                  <Users className="size-3.5 shrink-0" />
                ) : (
                  <Hash className="size-3.5 shrink-0" />
                )}
                <span className="truncate font-medium">{c.nombre}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="surface-card flex min-w-0 flex-1 flex-col overflow-hidden">
          {selected ? (
            <ChannelView channel={selected} isManager={isManager} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t("chat.selectChannel")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


function MemberPicker({
  options,
  selected,
  onToggle,
  currentUserId,
}: {
  options: TeamMemberOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  currentUserId?: string;
}) {
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
      {options.length === 0 ? (
        <p className="p-2 text-xs text-muted-foreground">—</p>
      ) : (
        options.map((m) => {
          const name = `${m.nombre ?? ""} ${m.apellidos ?? ""}`.trim() || m.user_id.slice(0, 8);
          const isSelf = m.user_id === currentUserId;
          return (
            <label
              key={m.user_id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-card",
                isSelf && "opacity-70",
              )}
            >
              <Checkbox
                checked={selected.has(m.user_id) || isSelf}
                disabled={isSelf}
                onCheckedChange={() => !isSelf && onToggle(m.user_id)}
              />
              <span className="flex-1 truncate font-medium">{name}</span>
              <span className="text-2xs uppercase tracking-widest text-muted-foreground">
                {m.role}
              </span>
            </label>
          );
        })
      )}
    </div>
  );
}

function NewChannelDialog({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { data: options = [] } = useTeamMemberOptions(open ? teamId : undefined);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (selected.size === 0) {
      toast.error(t("chat.noMembersSelected"));
      return;
    }
    setSaving(true);
    try {
      const channel = await api.post<ChatChannel>("/chat-channels/", {
        team_id: teamId,
        nombre: nombre.trim(),
        scope: "custom",
      });

      const memberIds = new Set(selected);
      if (user) memberIds.add(user.id);
      await api.post("/chat-channel-members/set-members/", {
        channel_id: channel.id,
        user_ids: Array.from(memberIds),
      });

      toast.success(t("chat.channelCreated"));
      setNombre("");
      setSelected(new Set());
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["chat-channels", teamId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label={t("chat.newChannel")}
        >
          <Plus className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.newChannel")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div>
            <Label htmlFor="channel-name">{t("chat.channelName")}</Label>
            <Input
              id="channel-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>
          <div>
            <Label>{t("chat.selectMembers")}</Label>
            <MemberPicker
              options={options}
              selected={selected}
              onToggle={toggle}
              currentUserId={user?.id}
            />
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

function InviteLinkSection({ channel }: { channel: Channel }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(channel.invite_token);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(channel.invite_token);
  }, [channel.invite_token]);

  const link = token ? `${window.location.origin}/comunicaciones/unirse/${token}` : "";

  async function generate() {
    setBusy(true);
    try {
      // El token lo genera el servidor: uno aleatorio de verdad, no derivado
      // de Math.random() en el navegador.
      const updated = await api.post<ChatChannel>(
        `/chat-channels/${channel.id}/invite-token/`,
      );
      setToken(updated.invite_token);
      qc.invalidateQueries({ queryKey: ["chat-channels", channel.team_id] });
      toast.success(t("chat.inviteGenerated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api.post(`/chat-channels/${channel.id}/invite-token/`, { revoke: true });
      setToken(null);
      qc.invalidateQueries({ queryKey: ["chat-channels", channel.team_id] });
      toast.success(t("chat.inviteRevoked"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("chat.linkCopied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Link2 className="size-3.5 text-primary" />
        <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("chat.inviteLink")}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{t("chat.inviteLinkHelp")}</p>
      {token ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={link} readOnly className="flex-1 font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t("chat.copyLink")}>
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy}>
              <RefreshCw className="mr-1 size-3.5" />
              {t("chat.regenerate")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={revoke} disabled={busy}>
              {t("chat.revokeLink")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={generate}
          disabled={busy}
          className="bg-primary text-primary-foreground uppercase tracking-widest font-bold"
        >
          <Link2 className="mr-1 size-3.5" />
          {t("chat.generateLink")}
        </Button>
      )}
    </div>
  );
}

function ManageMembersDialog({
  channel,
  teamId,
}: {
  channel: Channel;
  teamId: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: options = [] } = useTeamMemberOptions(open ? teamId : undefined);

  const { data: currentMembers } = useQuery({
    queryKey: ["channel-members", channel.id],
    enabled: open,
    queryFn: async (): Promise<string[]> => {
      const rows = await api.get<ChatChannelMember[]>("/chat-channel-members/", {
        channel_id: channel.id,
      });
      return rows.map((r) => r.user_id);
    },
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (currentMembers) setSelected(new Set(currentMembers));
  }, [currentMembers]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) {
      toast.error(t("chat.noMembersSelected"));
      return;
    }
    setSaving(true);
    try {
      const current = new Set(currentMembers ?? []);
      const desired = new Set(selected);
      if (user) desired.add(user.id);

      // Se manda la lista final y el servidor calcula altas y bajas en una
      // transacción; antes eran dos escrituras desde el navegador.
      await api.post("/chat-channel-members/set-members/", {
        channel_id: channel.id,
        user_ids: Array.from(desired),
      });
      toast.success(t("chat.membersUpdated"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["channel-members", channel.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label={t("chat.manageMembers")}
          title={t("chat.manageMembers")}
        >
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("chat.manageMembers")} · #{channel.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <InviteLinkSection channel={channel} />
          <MemberPicker
            options={options}
            selected={selected}
            onToggle={toggle}
            currentUserId={user?.id}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground uppercase tracking-widest font-bold"
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelView({ channel, isManager }: { channel: Channel; isManager: boolean }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: me } = useProfile();

  const messagesKey = useMemo(() => ["chat-messages", channel.id] as const, [channel.id]);

  const { data: messages } = useQuery({
    queryKey: messagesKey,
    // Cada mensaje trae el perfil de su autor, así que ya no hace falta la
    // segunda consulta a `profiles`.
    queryFn: () =>
      api.get<ChatMessage[]>("/chat-messages/", {
        channel_id: channel.id,
        order: "created_at",
        limit: 200,
      }),
    // Sin Realtime, el chat se refresca cada pocos segundos mientras está abierto.
    refetchInterval: 5_000,
  });

  // El perfil del autor viene con cada mensaje; antes hacía falta pedirlos
  // aparte y cruzarlos por identificador.
  const profileMap = useMemo(() => {
    const map = new Map<
      string,
      { nombre: string | null; apellidos: string | null; avatar_url: string | null }
    >();
    (messages ?? []).forEach((m) => {
      if (m.profile) map.set(m.user_id, m.profile);
    });
    return map;
  }, [messages]);

  // Auto-scroll to bottom on new messages
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, channel.id]);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user) return;
    setSending(true);
    try {
      // El aviso al resto del canal lo manda el servidor, que sabe quién puede
      // leerlo (incluso en los canales privados).
      await api.post("/chat-messages/", {
        channel_id: channel.id,
        contenido: content,
      });
      setText("");
      qc.invalidateQueries({ queryKey: messagesKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("chat.deleteConfirm"))) return;
    try {
      await api.delete(`/chat-messages/${id}/`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      return;
    }
    qc.invalidateQueries({ queryKey: messagesKey });
  }

  async function removeChannel() {
    if (!confirm(t("chat.deleteChannelConfirm"))) return;
    try {
      await api.delete(`/chat-channels/${channel.id}/`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      return;
    }
    toast.success(t("chat.channelDeleted"));
    qc.invalidateQueries({ queryKey: ["chat-channels", channel.team_id] });
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-5 sm:py-3">
        {channel.scope === "staff" ? (
          <Lock className="size-4 shrink-0 text-primary" />
        ) : channel.scope === "general" ? (
          <Users className="size-4 shrink-0 text-primary" />
        ) : (
          <Hash className="size-4 shrink-0 text-primary" />
        )}
        <span className="text-display min-w-0 truncate font-bold uppercase tracking-tight">
          {channel.nombre}
        </span>
        {channel.scope === "staff" && (
          <span className="ml-1 hidden shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-primary sm:inline">
            {t("chat.staffOnly")}
          </span>
        )}
        {channel.scope === "custom" && (
          <span className="ml-1 hidden shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-primary sm:inline">
            {t("chat.privateChannel")}
          </span>
        )}
        {isManager && channel.scope === "custom" && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ManageMembersDialog channel={channel} teamId={channel.team_id} />
            <button
              onClick={removeChannel}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-destructive"
              aria-label={t("chat.deleteChannel")}
              title={t("chat.deleteChannel")}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </header>


      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        {(messages?.length ?? 0) === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("chat.empty")}
          </div>
        ) : (
          messages!.map((m, i) => {
            const prev = messages![i - 1];
            const sameAuthor = prev && prev.user_id === m.user_id &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
            const p = profileMap.get(m.user_id);
            const name = `${p?.nombre ?? ""} ${p?.apellidos ?? ""}`.trim() || t("chat.unknownUser");
            const initials = ((p?.nombre?.[0] ?? "") + (p?.apellidos?.[0] ?? "")).toUpperCase() || "?";
            const own = m.user_id === user?.id;
            const canDelete = own || isManager;
            return (
              <div key={m.id} className={cn("group flex gap-2 sm:gap-3", sameAuthor && "mt-0")}>
                <div className="w-8 shrink-0 sm:w-9">
                  {!sameAuthor && (
                    p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="size-8 rounded-full object-cover sm:size-9" />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-card text-xs font-bold ring-1 ring-border sm:size-9">
                        {initials}
                      </div>
                    )
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {!sameAuthor && (
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="truncate text-sm font-bold">{name}</span>
                      <span className="text-2xs uppercase tracking-widest text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{m.contenido}</p>
                    {canDelete && (
                      <button
                        onClick={() => remove(m.id)}
                        className="shrink-0 p-1 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border p-2 sm:p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder", { channel: channel.nombre })}
          maxLength={2000}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          disabled={sending || !text.trim()}
          className="shrink-0 bg-primary text-primary-foreground uppercase tracking-widest font-bold"
        >
          <Send className="size-4" />
        </Button>
      </form>

    </>
  );
}
