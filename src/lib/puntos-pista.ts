/**
 * Lo que vale cada pista en el marcador de un partido de pádel, escrito como
 * se dice: «3, 3, 2, 2, 2». Se pone en la competición y lo heredan sus
 * partidos; un partido suelto puede llevar el suyo.
 */

/** «3, 3, 2 2 2» → [3, 3, 2, 2, 2]; vacío → null; algo que no cuadra → undefined. */
export function leerPuntosPista(texto: string): number[] | null | undefined {
  const trozos = texto.split(/[\s,;]+/).filter(Boolean);
  if (trozos.length === 0) return null;
  const valores = trozos.map(Number);
  return valores.every((v) => Number.isInteger(v) && v >= 1 && v <= 10) ? valores : undefined;
}

/** [3, 3, 2, 2, 2] → «3, 3, 2, 2, 2». */
export const escribirPuntosPista = (puntos: number[] | null | undefined) => puntos?.join(", ") ?? "";
