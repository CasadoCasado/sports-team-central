import { test, expect } from "@playwright/test";

/**
 * Modo claro y modo oscuro.
 *
 * Lo que se rompe sin hacer ruido es el script que pinta la clase antes del
 * primer pintado. Si deja de funcionar, la app sigue viéndose perfecta: solo
 * que abre en claro y salta a oscuro al hidratar, y eso en una captura no se
 * distingue de lo correcto. Por eso aquí se mira el `<html>` nada más cargar,
 * sin tocar nada y sin esperar a que React arranque.
 *
 * Se prueba en `/auth`, que es pública: el tema no depende de tener sesión.
 * Los contextos llevan `locale` a mano porque al crearlos aquí no heredan el
 * de la configuración, y sin él la app sale en inglés y los botones cambian
 * de nombre.
 */

const HTML_OSCURO = /(^|\s)dark(\s|$)/;

/**
 * Abre el menú del tema y elige una opción.
 *
 * Con reintento a propósito: la pantalla se sirve renderizada desde el
 * servidor, así que el botón existe en el marcado antes de que React lo haya
 * hidratado, y un clic de esos no abre nada. Es la misma carrera que documenta
 * `session.ts` para los formularios.
 */
async function elegirTema(page: import("@playwright/test").Page, opcion: RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: /^tema$/i }).click();
    await expect(page.getByRole("menuitem", { name: opcion })).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("menuitem", { name: opcion }).click();
}

test.describe("Tema claro y oscuro", () => {
  test("sin preferencia guardada, manda el sistema", async ({ browser }) => {
    for (const [esquema, esperado] of [
      ["dark", true],
      ["light", false],
    ] as const) {
      const ctx = await browser.newContext({ colorScheme: esquema, locale: "es-ES" });
      const page = await ctx.newPage();
      await page.goto("/auth", { waitUntil: "domcontentloaded" });

      const clase = (await page.locator("html").getAttribute("class")) ?? "";
      expect(HTML_OSCURO.test(clase), `sistema en ${esquema}`).toBe(esperado);

      // Y los controles nativos —scroll, selectores de fecha— van a juego.
      await expect(page.locator("html")).toHaveCSS("color-scheme", esquema);
      await ctx.close();
    }
  });

  test("lo elegido manda sobre el sistema, y aguanta la recarga", async ({ browser }) => {
    // El sistema en claro: si el tema elegido no se guardara, volvería a claro.
    const ctx = await browser.newContext({ colorScheme: "light", locale: "es-ES" });
    const page = await ctx.newPage();
    await page.goto("/auth");

    await expect(page.locator("html")).not.toHaveClass(HTML_OSCURO);

    await elegirTema(page, /^oscuro$/i);
    await expect(page.locator("html")).toHaveClass(HTML_OSCURO);

    await page.reload({ waitUntil: "domcontentloaded" });
    // Nada más cargar, antes de tocar nada: es el script del documento.
    const clase = (await page.locator("html").getAttribute("class")) ?? "";
    expect(HTML_OSCURO.test(clase)).toBe(true);

    // Y se puede volver al automático.
    await elegirTema(page, /sistema/i);
    await expect(page.locator("html")).not.toHaveClass(HTML_OSCURO);
    await ctx.close();
  });

  test("el fondo y el texto cambian de verdad, no solo la clase", async ({ browser }) => {
    const medir = async (esquema: "light" | "dark") => {
      const ctx = await browser.newContext({ colorScheme: esquema, locale: "es-ES" });
      const page = await ctx.newPage();
      await page.goto("/auth");
      const v = await page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        return { fondo: cs.backgroundColor, texto: cs.color };
      });
      await ctx.close();
      return v;
    };

    const claro = await medir("light");
    const oscuro = await medir("dark");
    expect(oscuro.fondo).not.toBe(claro.fondo);
    expect(oscuro.texto).not.toBe(claro.texto);
  });
});
