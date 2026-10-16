/**
 * La mano con la que juega alguien: diestro o zurdo.
 *
 * Se guarda en `profile.mano_dominante`, que fue un campo de texto libre hasta
 * que el perfil pasó a ofrecer solo estas dos opciones. Por eso en la base de
 * datos puede haber «diestro», «Diestra», «Zurdo» o «right», y `manoDe` lo lee
 * todo igual, como `ladoDe` con el lado: sin tener que migrarlo.
 */

export type Mano = "diestro" | "zurdo";

export const MANOS: Mano[] = ["diestro", "zurdo"];

export function manoDe(mano: string | null | undefined): Mano | null {
  if (!mano) return null;
  const texto = mano.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (texto.includes("zurd") || texto.includes("left") || texto.includes("izquierd"))
    return "zurdo";
  if (texto.includes("diestr") || texto.includes("right") || texto.includes("derech"))
    return "diestro";
  return null;
}
