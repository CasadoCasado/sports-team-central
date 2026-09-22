import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * Todo lo que se pulsa tiene que enseñar la manita.
 *
 * Tailwind 4 pone `cursor: default` en los <button>, así que esto se rompe
 * solo: basta con que alguien escriba un <button> sin la clase. La regla que
 * lo arregla está en `styles.css`; esto comprueba que sigue en pie, midiendo
 * el cursor calculado de verdad en el navegador y no la clase escrita.
 */

/** Un recorrido por pantallas con botonera distinta. */
const RUTAS = ["/inicio", "/calendario", "/competiciones", "/miembros", "/mi-equipo", "/perfil"];

test("todo lo pulsable enseña la manita", async ({ page, request }) => {
  const { session } = await seedCaptainWithTeam(request, "cur");
  await loginAs(page, session);

  const malos: string[] = [];
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await page.waitForTimeout(800);
    const fallos = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('button, [role="button"], a[href]')) {
        if ((el as HTMLButtonElement).disabled) continue;
        if (el.getAttribute("aria-disabled") === "true") continue;
        if (!el.offsetParent) continue;
        const c = getComputedStyle(el).cursor;
        if (c !== "pointer")
          out.push(`${el.tagName}[${c}] "${(el.textContent ?? "").trim().slice(0, 28)}"`);
      }
      return out;
    });
    fallos.forEach((f) => malos.push(`${ruta} → ${f}`));
  }
  console.log(malos.length ? malos.join("\n") : "todo con manita");
  expect(malos, malos.join("\n")).toEqual([]);
});
