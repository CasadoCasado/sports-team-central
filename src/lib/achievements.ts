export type ParticipationRow = {
  user_id: string;
  jugado: boolean;
  ganado: boolean | null;
  event_ganado: boolean | null;
  fecha: string;
  event_id: string;
};

export type PlayerTally = {
  userId: string;
  played: number;
  wins: number;
  losses: number;
  bestStreak: number;
  currentStreak: number;
  winRate: number;
};

/** Agrupa participaciones por jugador y calcula jugados, victorias y rachas. */
export function tallyParticipations(rows: ParticipationRow[]): Map<string, PlayerTally> {
  const byUser = new Map<string, ParticipationRow[]>();
  for (const row of rows) {
    if (!row.jugado) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const result = new Map<string, PlayerTally>();
  for (const [userId, list] of byUser) {
    // Una participación por evento (en pádel hay una fila por pista convocada).
    const perEvent = new Map<string, ParticipationRow>();
    for (const row of list) perEvent.set(row.event_id, row);
    const ordered = [...perEvent.values()].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    let wins = 0;
    let losses = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    for (const row of ordered) {
      const won = row.event_ganado ?? row.ganado;
      if (won === true) {
        wins += 1;
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else if (won === false) {
        losses += 1;
        currentStreak = 0;
      }
    }
    const played = ordered.length;
    result.set(userId, {
      userId,
      played,
      wins,
      losses,
      bestStreak,
      currentStreak,
      winRate: played > 0 ? Math.round((wins / played) * 100) : 0,
    });
  }
  return result;
}

export type BadgeDef = {
  id: string;
  icon: "trophy" | "flame" | "calendar" | "star" | "target" | "medal";
  title: { es: string; en: string };
  description: { es: string; en: string };
  /** Progreso actual y objetivo para desbloquear. */
  progress: (ctx: BadgeContext) => { value: number; goal: number };
};

export type BadgeContext = {
  tally: PlayerTally | null;
  attendance: { confirmed: number; called: number };
  isTeamTopWinner: boolean;
};

export const BADGES: BadgeDef[] = [
  {
    id: "debut",
    icon: "star",
    title: { es: "Debut", en: "Debut" },
    description: { es: "Juega tu primer enfrentamiento", en: "Play your first match" },
    progress: (c) => ({ value: c.tally?.played ?? 0, goal: 1 }),
  },
  {
    id: "regular",
    icon: "calendar",
    title: { es: "Habitual", en: "Regular" },
    description: { es: "Juega 10 enfrentamientos", en: "Play 10 matches" },
    progress: (c) => ({ value: c.tally?.played ?? 0, goal: 10 }),
  },
  {
    id: "veteran",
    icon: "medal",
    title: { es: "Veterano", en: "Veteran" },
    description: { es: "Juega 25 enfrentamientos", en: "Play 25 matches" },
    progress: (c) => ({ value: c.tally?.played ?? 0, goal: 25 }),
  },
  {
    id: "firstWin",
    icon: "trophy",
    title: { es: "Primera victoria", en: "First win" },
    description: { es: "Gana un enfrentamiento", en: "Win a match" },
    progress: (c) => ({ value: c.tally?.wins ?? 0, goal: 1 }),
  },
  {
    id: "streak3",
    icon: "flame",
    title: { es: "Racha x3", en: "Streak x3" },
    description: { es: "Gana 3 enfrentamientos seguidos", en: "Win 3 matches in a row" },
    progress: (c) => ({ value: c.tally?.bestStreak ?? 0, goal: 3 }),
  },
  {
    id: "streak5",
    icon: "flame",
    title: { es: "Racha x5", en: "Streak x5" },
    description: { es: "Gana 5 enfrentamientos seguidos", en: "Win 5 matches in a row" },
    progress: (c) => ({ value: c.tally?.bestStreak ?? 0, goal: 5 }),
  },
  {
    id: "attendance10",
    icon: "calendar",
    title: { es: "Siempre presente", en: "Always there" },
    description: { es: "Confirma 10 convocatorias", en: "Confirm 10 call-ups" },
    progress: (c) => ({ value: c.attendance.confirmed, goal: 10 }),
  },
  {
    id: "attendance25",
    icon: "target",
    title: { es: "Pilar del equipo", en: "Team pillar" },
    description: { es: "Confirma 25 convocatorias", en: "Confirm 25 call-ups" },
    progress: (c) => ({ value: c.attendance.confirmed, goal: 25 }),
  },
  {
    id: "mvp",
    icon: "trophy",
    title: { es: "MVP del equipo", en: "Team MVP" },
    description: {
      es: "Sé el jugador con más victorias del equipo",
      en: "Be the player with the most wins in the team",
    },
    progress: (c) => ({ value: c.isTeamTopWinner ? 1 : 0, goal: 1 }),
  },
];

export function evaluateBadges(ctx: BadgeContext) {
  return BADGES.map((badge) => {
    const { value, goal } = badge.progress(ctx);
    return {
      badge,
      value: Math.min(value, goal),
      goal,
      unlocked: value >= goal,
      pct: goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0,
    };
  });
}
