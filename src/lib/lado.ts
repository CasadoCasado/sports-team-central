/**
 * El lado de la pista en el que juega alguien: revés, derecha o los dos.
 *
 * Se guarda en `profile.posicion`, que fue un campo de texto libre hasta que
 * el perfil pasó a ofrecer solo estas tres opciones. Por eso lo que hay en la
 * base de datos puede ser «Revés», «reves», «drive» o «juego de derecha», y
 * `ladoDe` lo lee todo igual: así lo que la gente escribió a mano se sigue
 * viendo bien sin tener que migrarlo.
 */

export type Lado = "reves" | "derecha" | "ambos";

export const LADOS: Lado[] = ["reves", "derecha", "ambos"];

export function ladoDe(posicion: string | null | undefined): Lado | null {
  if (!posicion) return null;
  const texto = posicion
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const reves = texto.includes("reves") || texto.includes("backhand");
  const derecha =
    texto.includes("derecha") || texto.includes("drive") || texto.includes("forehand");
  if (
    texto.includes("ambos") ||
    texto.includes("los dos") ||
    texto.includes("indistint") ||
    (reves && derecha)
  ) {
    return "ambos";
  }
  if (reves) return "reves";
  if (derecha) return "derecha";
  return null;
}
