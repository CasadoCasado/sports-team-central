import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORTS, sportLabel } from "@/lib/sports";

export function TeamDiscovery({
  onlyOpen = false,
  heading,
  subtitle,
}: {
  onlyOpen?: boolean;
  heading?: string;
  subtitle?: string;
} = {}) {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const [sport, setSport] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data: teams, isLoading } = useQuery({
    queryKey: ["team-discovery", sport, q, onlyOpen],
    queryFn: async () => {
      let query = supabase
        .from("teams")
        .select("id, nombre, logo_url, deporte, ciudad, descripcion, inscripciones_abiertas")
        .order("nombre")
        .limit(30);
      if (onlyOpen) query = query.eq("inscripciones_abiertas", true);
      if (sport !== "all") query = query.eq("deporte", sport);
      if (q.trim()) query = query.ilike("nombre", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingReqs } = useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select("team_id, status")
        .eq("invited_user_id", user!.id)
        .eq("es_solicitud", true)
        .eq("status", "pendiente");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.team_id));
    },
  });

  async function requestJoin(teamId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from("team_invitations").insert({
        team_id: teamId,
        invited_user_id: user.id,
        invited_by: user.id,
        role: "jugador",
        status: "pendiente",
        es_solicitud: true,
      });
      if (error) throw error;
      toast.success(t("team.requestSent"));
      qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <div className="surface-card p-6">
      <h3 className="text-display text-xl font-bold">
        {heading ?? (onlyOpen ? t("team.openTeamsTitle") : t("team.discoverTitle"))}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {subtitle ?? (onlyOpen ? t("team.openTeamsSubtitle") : t("team.discoverSubtitle"))}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("team.searchByName")}
            className="pl-9"
          />
        </div>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("team.allSports")}</SelectItem>
            {SPORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {sportLabel(s.value, i18n.language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
        {!isLoading && (teams?.length ?? 0) === 0 && (
          <p className="text-xs text-muted-foreground">
            {onlyOpen ? t("team.noOpenTeams") : t("members.noResults")}
          </p>
        )}
        {teams?.map((tm) => {
          const alreadyRequested = pendingReqs?.has(tm.id);
          const closed = tm.inscripciones_abiertas === false;
          return (
            <div
              key={tm.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              {tm.logo_url ? (
                <img src={tm.logo_url} alt="" className="size-10 rounded object-cover" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded bg-primary/10 text-primary">
                  <Shield className="size-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{tm.nombre}</p>
                <p className="text-xxs text-muted-foreground">
                  {sportLabel(tm.deporte, i18n.language)}
                  {tm.ciudad ? ` · ${tm.ciudad}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                disabled={alreadyRequested || closed}
                onClick={() => requestJoin(tm.id)}
                className="bg-primary text-primary-foreground uppercase text-2xs font-bold tracking-widest hover:opacity-90"
              >
                {closed
                  ? t("team.closedToJoin")
                  : alreadyRequested
                    ? t("team.requestPending")
                    : t("team.requestJoin")}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
