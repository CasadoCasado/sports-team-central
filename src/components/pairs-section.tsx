/**
 * El histórico de parejas: quién ha jugado con quién y cómo les ha ido.
 *
 * Sale entero del servidor (`/api/stats/pairs/`), que lo saca de las pistas
 * de la convocatoria y sus marcadores: aquí no se apunta nada. Cada pareja se
 * despliega para ver su historial partido a partido. Con `mine` son las
 * parejas de quien mira, y cada fila nombra solo al compañero.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { ChevronDown, Crown, Users } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PairHistoryItem, PairStats, Profile } from "@/lib/types";

/** Cuántas parejas se ven antes de pedir el resto. */
const VISIBLES = 5;

const nameOf = (p: Profile) => `${p.nombre} ${p.apellidos}`.trim() || "—";

export function PairsSection({
  teamId,
  mine = false,
  currentUserId,
}: {
  teamId: string;
  mine?: boolean;
  currentUserId?: string;
}) {
  const { t } = useTranslation();
  const [todas, setTodas] = useState(false);

  const { data: pairs } = useQuery({
    queryKey: ["pair-stats", teamId, mine],
    queryFn: () =>
      api.get<PairStats[]>("/stats/pairs/", { team_id: teamId, ...(mine ? { me: 1 } : {}) }),
  });

  const lista = pairs ?? [];
  const shown = todas ? lista : lista.slice(0, VISIBLES);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border p-4 sm:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Users className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-display text-lg font-bold uppercase tracking-tight">
            {t(mine ? "stats.pairs.mineTitle" : "stats.pairs.title")}
          </h3>
          <p className="text-xxs text-muted-foreground">
            {t(mine ? "stats.pairs.mineSubtitle" : "stats.pairs.subtitle")}
          </p>
        </div>
      </div>

      {pairs && lista.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{t("stats.pairs.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((pair) => (
            <PairRow
              key={pair.jugadores.map((j) => j.id).join("-")}
              pair={pair}
              mine={mine}
              currentUserId={currentUserId}
            />
          ))}
        </ul>
      )}

      {lista.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          className="flex min-h-11 w-full items-center justify-center border-t border-border text-2xs font-bold uppercase tracking-widest text-primary hover:bg-card"
        >
          {todas ? t("stats.pairs.showLess") : t("stats.pairs.showAll", { count: lista.length })}
        </button>
      )}
    </div>
  );
}

function PairRow({
  pair,
  mine,
  currentUserId,
}: {
  pair: PairStats;
  mine: boolean;
  currentUserId?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const companero = pair.jugadores.find((j) => j.id !== currentUserId) ?? pair.jugadores[1];
  const titulo = mine
    ? t("stats.pairs.with", { name: nameOf(companero) })
    : pair.jugadores.map(nameOf).join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold break-words">{titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xxs text-muted-foreground">
            {pair.partidos > 0 && (
              <span>
                {t("stats.pairs.matches", { count: pair.partidos })} ·{" "}
                {t("stats.pairs.record", { won: pair.ganados, lost: pair.perdidos })}
              </span>
            )}
            {pair.noches_rey > 0 && (
              <span className="inline-flex items-center gap-1">
                <Crown className="size-3 text-warn" aria-hidden="true" />
                {pair.veces_reyes > 0 &&
                  `${t("stats.pairs.crowns", { count: pair.veces_reyes })} · `}
                {t("stats.pairs.nights", { count: pair.noches_rey })}
              </span>
            )}
          </p>
        </div>
        {pair.win_pct !== null && (
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-xs font-black tabular-nums",
              pair.win_pct >= 50 ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger",
            )}
          >
            {pair.win_pct}%
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="bg-muted/30 px-4 pb-3 sm:px-5">
          <p className="pt-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("stats.pairs.history")}
          </p>
          <ul className="mt-2 space-y-1.5">
            {pair.historial.map((item) => (
              <HistoryItem key={`${item.tipo}-${item.event_id}-${item.pista}`} item={item} />
            ))}
          </ul>
          {pair.noches_rey > 0 && (
            <p className="mt-2 text-xxs text-muted-foreground">{t("stats.pairs.reyNote")}</p>
          )}
        </div>
      )}
    </li>
  );
}

function HistoryItem({ item }: { item: PairHistoryItem }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? enUS : esLocale;
  const fecha = format(new Date(item.fecha), "d MMM yyyy", { locale });

  const partido = item.tipo === "partido";
  const bien = partido ? item.ganado : item.reyes;
  const etiqueta = partido
    ? t(item.ganado ? "stats.pairs.won" : "stats.pairs.lost")
    : t(item.reyes ? "stats.pairs.kings" : "stats.pairs.challengers");

  return (
    <li>
      <Link
        to="/eventos/$id"
        params={{ id: item.event_id }}
        className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:bg-card"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {partido && item.rival ? t("stats.pairs.vs", { rival: item.rival }) : item.titulo}
          </p>
          <p className="text-xxs text-muted-foreground">
            {fecha} · {t("stats.pairs.court", { n: item.pista })}
            {partido && item.sets && (
              <span className="font-bold tabular-nums text-foreground"> · {item.sets}</span>
            )}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-bold uppercase tracking-widest",
            bien ? "border-ok/40 bg-ok/10 text-ok" : "border-border text-muted-foreground",
          )}
        >
          {!partido && <Crown className="size-3" aria-hidden="true" />}
          {etiqueta}
        </span>
      </Link>
    </li>
  );
}
