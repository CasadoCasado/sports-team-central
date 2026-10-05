/**
 * Los datos de la convocatoria PRO, tal como los da `/api/events/{id}/pro/`
 * (ver `apps/events/pro.py`).
 */

export type ParejaPro = {
  a: string;
  b: string;
  ganados: number;
  perdidos: number;
  prob: number;
  /** Derecha con revés (o alguien que juega en los dos) encajan; dos del
   * mismo lado, no. Null si falta el lado de alguno. */
  encaje: "encajan" | "mismo_lado" | null;
};

export type JugadorPro = {
  partidos: number;
  ganados: number;
  /** De la más antigua a la más reciente; `true` es pista ganada. */
  forma: boolean[];
  /** Jornadas del equipo desde la última que jugó; null si nunca. */
  sin_jugar: number | null;
  nivel: string | null;
  lado: "reves" | "derecha" | "ambos" | null;
};

export type PropuestaPro = {
  id: "victoria" | "equilibrada" | "rotacion";
  pistas: string[][];
  esperadas: number;
  descansan: string[];
};

export type TableroPro = {
  /** Jornadas jugadas por el equipo antes de esta. */
  jornadas: number;
  media: number;
  jugadores: Record<string, JugadorPro>;
  parejas: ParejaPro[];
  rival: {
    nombre: string;
    ganados: number;
    empatados: number;
    perdidos: number;
    ultimo: { fecha: string; nuestro: number | null; suyo: number | null } | null;
    parejas: { a: string; b: string; ganados: number; perdidos: number }[];
    /** Lo de cada uno de los de hoy contra este rival, con quien fuera. */
    jugadores: Record<string, { ganados: number; perdidos: number }>;
  } | null;
  quimica_mutua: [string, string][];
  /** Van aparte (`/propuestas/`): aquí llegan vacías. */
  propuestas: PropuestaPro[] | null;
};

export function parejaPro(pro: TableroPro, a: string, b: string) {
  return pro.parejas.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
}
