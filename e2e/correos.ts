import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Los correos que manda el backend en desarrollo, guardados como ficheros en
 * backend/correos/ (ver EMAIL_BACKEND en settings).
 */
const CORREOS = join(process.cwd(), "..", "backend", "correos");

/** El primer enlace que case con `patron` en el último correo a `email`. */
export function enlaceDe(email: string, patron: RegExp): string | null {
  let ficheros: string[] = [];
  try {
    ficheros = readdirSync(CORREOS).map((f) => join(CORREOS, f));
  } catch {
    return null;
  }
  ficheros.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const f of ficheros) {
    const texto = readFileSync(f, "utf8");
    if (!texto.includes(`To: ${email}`)) continue;
    const m = texto.match(patron);
    if (m) return m[0];
  }
  return null;
}
