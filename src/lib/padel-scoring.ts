/**
 * Reglas oficiales de pádel + resolución automática de enfrentamientos.
 * Lógica reutilizable: sirve para cualquier número de pistas (1, 3, 5, 7...).
 */

export type Side = "local" | "visitante";
export type SetPair = { local: number | null; visitante: number | null };

export type SetValidity = "empty" | "incomplete" | "invalid" | "ok";

/** Un set es válido si acaba 6-x (x<=4), 7-5 o 7-6 (tie-break). */
export function validateSet(a: number | null, b: number | null): SetValidity {
  if (a == null && b == null) return "empty";
  if (a == null || b == null) return "incomplete";
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "invalid";
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 6 && lo <= 4) return "ok";
  if (hi === 7 && (lo === 5 || lo === 6)) return "ok";
  return "invalid";
}

/** 1 = gana local, 2 = gana visitante, null = set no resuelto. */
export function setWinner(a: number | null, b: number | null): 1 | 2 | null {
  if (validateSet(a, b) !== "ok") return null;
  return (a as number) > (b as number) ? 1 : 2;
}

/** Ganador de una pista al mejor de 3 sets. */
export function courtWinner(sets: SetPair[]): 1 | 2 | null {
  let local = 0;
  let visitante = 0;
  for (const s of sets) {
    const w = setWinner(s.local, s.visitante);
    if (w === 1) local++;
    else if (w === 2) visitante++;
  }
  if (local >= 2) return 1;
  if (visitante >= 2) return 2;
  return null;
}

/** Ganador de una pista con marcador simple (deportes no pádel). */
export function simpleCourtWinner(a: number | null, b: number | null): 1 | 2 | null {
  if (a == null || b == null || a === b) return null;
  return a > b ? 1 : 2;
}

export type CourtValidationError =
  | { pista: number; code: "set1" | "set2" | "set3Required" | "set3NotAllowed" };

/** Valida una pista de pádel; devuelve null si está vacía o es correcta. */
export function validatePadelCourt(pista: number, sets: SetPair[]): CourtValidationError | null {
  const v = sets.map((s) => validateSet(s.local, s.visitante));
  if (v.every((x) => x === "empty")) return null;
  if (v[0] !== "ok") return { pista, code: "set1" };
  if (v[1] !== "ok") return { pista, code: "set2" };
  const w1 = setWinner(sets[0].local, sets[0].visitante);
  const w2 = setWinner(sets[1].local, sets[1].visitante);
  const tied = w1 !== w2;
  if (tied && v[2] !== "ok") return { pista, code: "set3Required" };
  if (!tied && v[2] !== "empty") return { pista, code: "set3NotAllowed" };
  return null;
}

export type TieOutcome = "victoria" | "derrota" | "empate" | null;

export type TieSummary = {
  won: number;
  lost: number;
  played: number;
  outcome: TieOutcome;
};

/**
 * Resultado global del enfrentamiento desde el punto de vista del equipo.
 * Mayoría de pistas resueltas = victoria. Nunca se edita a mano.
 */
export function tieSummary(courtWinners: (1 | 2 | null)[], teamIsLocal: boolean): TieSummary {
  const teamSide = teamIsLocal ? 1 : 2;
  let won = 0;
  let lost = 0;
  for (const w of courtWinners) {
    if (w == null) continue;
    if (w === teamSide) won++;
    else lost++;
  }
  const played = won + lost;
  const outcome: TieOutcome =
    played === 0 ? null : won > lost ? "victoria" : won < lost ? "derrota" : "empate";
  return { won, lost, played, outcome };
}
