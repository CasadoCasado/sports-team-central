import { test, expect } from "@playwright/test";

import { loginAs, seedCaptainWithTeam } from "./session";

/**
 * En un partido o un entreno el fin se pone solo, hora y media después del
 * inicio; se puede alargar o acortar, y al mover el inicio se conserva la
 * duración. Lo que no se puede es acabar antes de empezar.
 */
test("el fin se pone solo a la hora y media y nunca antes del inicio", async ({
  page,
  request,
}) => {
  const { session } = await seedCaptainWithTeam(request, "hora-fin");
  await loginAs(page, session);
  await page.goto("/calendario");
  const dia = page.getByRole("button", { name: /^crear evento el .*\b15\b/i }).first();
  await expect(dia).toBeVisible({ timeout: 20_000 });
  await dia.click();

  const dialogo = page.getByRole("dialog");
  const [inicio, fin] = [
    dialogo.locator('input[type="datetime-local"]').nth(0),
    dialogo.locator('input[type="datetime-local"]').nth(1),
  ];
  // Desde el calendario llega el inicio, y con él el fin, hora y media después.
  const [, hh, mm] = /T(\d{2}):(\d{2})$/.exec(await inicio.inputValue())!;
  const total = Number(hh) * 60 + Number(mm) + 90;
  const esperado = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  await expect(fin).toHaveValue(new RegExp(`T${esperado}$`));

  // El ejemplo: 10/10/2026 a las 11:30 acaba a las 13:00.
  await inicio.fill("2026-10-10T11:30");
  await expect(fin).toHaveValue("2026-10-10T13:00");
  await expect(dialogo.getByText("Dura 1 h 30 min")).toBeVisible();

  // Se alarga a las 14:00 y al mover el inicio se conservan las dos horas y media.
  await fin.fill("2026-10-10T14:00");
  await expect(dialogo.getByText("Dura 2 h 30 min")).toBeVisible();
  await inicio.fill("2026-10-10T12:00");
  await expect(fin).toHaveValue("2026-10-10T14:30");

  // Acabar antes de empezar, no.
  await dialogo.getByRole("textbox").first().fill("Partido al revés");
  await fin.fill("2026-10-09T13:00");
  await dialogo.getByRole("button", { name: /^crear$/i }).click();
  // El propio navegador lo frena (la casilla tiene el inicio como mínimo) y
  // el formulario no se envía; si alguno lo dejara pasar, lo para el
  // formulario y, al final, el servidor.
  expect(await fin.evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);
  await expect(dialogo).toBeVisible();
  await expect(page.getByText(/evento creado/i)).toHaveCount(0);
});
