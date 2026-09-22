import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { Picture } from "@/components/picture";
import type { Team, TeamInvitation } from "@/lib/types";
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
    queryFn: () =>
      api.get<Team[]>("/teams/", {
        discover: onlyOpen ? 1 : undefined,
        deporte: sport === "all" ? undefined : sport,
        search: q.trim() || undefined,
        order: "nombre",
        limit: 30,
      }),
  });

  const visibleTeams = useMemo(() => {
    if (competitionId === "all") return teams ?? [];
    return (teams ?? []).filter((tm) => regByTeam.has(tm.id));
  }, [teams, competitionId, regByTeam]);


  const { data: pendingReqs } = useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = await api.get<TeamInvitation[]>("/team-invitations/", {
        mine: 1,
        es_solicitud: true,
        status: "pendiente",
      });
      return new Set(rows.map((r) => r.team_id));
    },
  });

  async function requestJoin(teamId: string) {
    if (!user) return;
    try {
      await api.post("/team-invitations/", {
        team_id: teamId,
        invited_user_id: user.id,
        role: "jugador",
        es_solicitud: true,
      });
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
              <Picture
                url={tm.logo_url}
                alt=""
                className="size-10 rounded bg-primary/10 text-primary"
                fallback={<Shield className="size-5" />}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{tm.nombre}</p>
                <p className="text-xxs text-muted-foreground">
                  {sportLabel(tm.deporte, i18n.language)}
                  {tm.ciudad ? ` · ${tm.ciudad}` : ""}
                </p>
                {reg && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-3xs font-bold uppercase tracking-widest">
                    <span className="rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-primary">
                      {reg.competition_nombre}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                      {reg.category_nombre}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                      {reg.division_nombre}
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
