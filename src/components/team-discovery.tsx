import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import {
  categoriesCatalogQuery,
  competitionsCatalogQuery,
  openRegistrationsQuery,
} from "@/lib/official-competitions";
import { statusBadgeClass } from "@/components/official-registrations-section";

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
  const [competitionId, setCompetitionId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: competitions } = useQuery(competitionsCatalogQuery);
  const { data: allCategories } = useQuery(categoriesCatalogQuery);
  const categories = useMemo(
    () => (allCategories ?? []).filter((c) => c.competition_id === competitionId),
    [allCategories, competitionId],
  );

  const { data: registrations } = useQuery(
    openRegistrationsQuery({
      competitionId: competitionId === "all" ? undefined : competitionId,
      categoryId: categoryId === "all" ? undefined : categoryId,
    }),
  );

  const regByTeam = useMemo(() => {
    const map = new Map<string, NonNullable<typeof registrations>[number]>();
    for (const r of registrations ?? []) if (!map.has(r.team_id)) map.set(r.team_id, r);
    return map;
  }, [registrations]);

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

  const visibleTeams = useMemo(() => {
    if (competitionId === "all") return teams ?? [];
    return (teams ?? []).filter((tm) => regByTeam.has(tm.id));
  }, [teams, competitionId, regByTeam]);


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
          <SelectTrigger aria-label={t("team.allSports")}><SelectValue /></SelectTrigger>
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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("registrations.competition")}
          </p>
          <Select
            value={competitionId}
            onValueChange={(v) => {
              setCompetitionId(v);
              setCategoryId("all");
            }}
          >
            <SelectTrigger aria-label={t("registrations.competition")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("registrations.allCompetitions")}</SelectItem>
              {competitions?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {competitionId !== "all" && (
          <div>
            <p className="mb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("registrations.category")}
            </p>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger aria-label={t("registrations.category")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("registrations.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
        {!isLoading && visibleTeams.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {onlyOpen ? t("team.noOpenTeams") : t("members.noResults")}
          </p>
        )}
        {visibleTeams.map((tm) => {
          const alreadyRequested = pendingReqs?.has(tm.id);
          const closed = tm.inscripciones_abiertas === false;
          const reg = regByTeam.get(tm.id);
          return (
            <div
              key={tm.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3"
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
                {reg && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-3xs font-bold uppercase tracking-widest">
                    <span className="rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-primary">
                      {reg.official_competitions?.nombre}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                      {reg.official_competition_categories?.nombre}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                      {reg.official_competition_divisions?.nombre}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 ${statusBadgeClass(reg.status)}`}>
                      {t(`registrations.status.${reg.status}`)}
                    </span>
                  </div>
                )}
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
