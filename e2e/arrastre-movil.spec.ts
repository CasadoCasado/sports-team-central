import { test, expect, type Page } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  type Session,
} from "./session";

/**
 * Con el dedo, en el teléfono: el banquillo se desliza de lado sin coger a
 * nadie; para arrastrar a un jugador hay que mantenerlo pulsado. Y en PRO, la
 * ficha pasa al siguiente jugador deslizándola.
 */
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

/** Un dedo que se apoya en `de`, espera `espera` ms y se arrastra hasta `a`. */
async function dedo(
  page: Page,
  de: { x: number; y: number },
  a: { x: number; y: number },
  espera = 0,
) {
  const cdp = await page.context().newCDPSession(page);
  const punto = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: punto(de) });
  if (espera) await page.waitForTimeout(espera);
  const pasos = 12;
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: punto({
        x: de.x + ((a.x - de.x) * i) / pasos,
        y: de.y + ((a.y - de.y) * i) / pasos,
      }),
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const centro = (c: { x: number; y: number; width: number; height: number }) => ({
  x: c.x + c.width / 2,
  y: c.y + c.height / 2,
});

async function montar(
  request: Parameters<typeof seedCaptainWithTeam>[0],
  prefijo: string,
  conPro = true,
) {
  const { session: capitana, team } = await seedCaptainWithTeam(request, prefijo);
  const nombres = ["Iria", "Brais", "Uxía", "Antía", "Xoel", "Noa", "Breixo"];
  const gente: Session[] = [capitana];
  for (const [i, nombre] of nombres.entries()) {
    gente.push(
      await seedPlayerInTeam(request, `${prefijo}-${i}`, team.id, capitana, {
        nombre,
        apellidos: "Souto",
      }),
    );
  }
  if (conPro) {
    const pro = await request.post(`${API_URL}/teams/${team.id}/pro/`, {
      headers: bearer(capitana),
      data: { activo: true },
    });
    expect(pro.ok(), await pro.text()).toBe(true);
  }
  const res = await request.post(`${API_URL}/events/`, {
    headers: bearer(capitana),
    data: {
      team_id: team.id,
      tipo: "partido",
      titulo: "Jornada 6",
      rival: "Club Náutico",
      fecha_inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      requiere_convocatoria: true,
      padel_num_pistas: 2,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { id: eventId } = (await res.json()) as { id: string };
  for (const s of gente) {
    const r = await request.post(`${API_URL}/event-responses/respond/`, {
      headers: bearer(s),
      data: { event_id: eventId, status: "confirmado" },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }
  return { capitana, eventId };
}

test("el banquillo se desliza sin coger a nadie; mantener pulsado arrastra", async ({
  page,
  request,
}) => {
  const { capitana, eventId } = await montar(request, "arrastre-movil");
  await loginAs(page, capitana);
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("tab", { name: /pistas/i }).click();

  const banquillo = page.locator("[data-banquillo]");
  const tira = banquillo.locator("[data-drop-pro='pool']");
  await expect(tira.getByRole("button")).toHaveCount(8, { timeout: 20_000 });
  const pistas = page.getByRole("tab", { name: /pistas/i });
  await expect(pistas).toContainText("0/4");

  // Deslizar de lado empezando sobre un jugador: la tira se mueve y nadie
  // sale del banquillo.
  const primero = (await tira.getByRole("button").nth(1).boundingBox())!;
  await dedo(page, centro(primero), { x: centro(primero).x - 220, y: centro(primero).y });
  await expect.poll(() => tira.evaluate((el) => el.scrollLeft)).toBeGreaterThan(40);
  await expect(pistas).toContainText("0/4");

  // Mantener pulsado y arrastrar a la pista 1: ahí sí.
  await page.waitForTimeout(1200); // que acabe la inercia del deslizamiento
  await tira.evaluate((el) => el.scrollTo({ left: 0 }));
  const jugador = (await tira.getByRole("button").first().boundingBox())!;
  // La pista, en el centro: abajo la taparía la barra fija.
  await page
    .locator("[data-pista-pro='1']")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pista = (await page.locator("[data-pista-pro='1']").boundingBox())!;
  await dedo(page, centro(jugador), centro(pista), 600);
  await expect(pistas).toContainText("1/4");
});

test("en PRO, deslizar la ficha pasa al jugador siguiente", async ({ page, request }) => {
  const { capitana, eventId } = await montar(request, "ficha-movil");
  await loginAs(page, capitana);
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("tab", { name: /pro/i }).click();

  const ficha = page.locator("[data-ficha-deslizable]");
  await expect(ficha).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  const antes = (await ficha.getByRole("heading", { level: 3 }).first().textContent())!;
  await ficha.scrollIntoViewIfNeeded();
  const caja = (await ficha.boundingBox())!;
  const y = caja.y + 60;
  await dedo(page, { x: caja.x + caja.width - 30, y }, { x: caja.x + 30, y });
  await expect(ficha.getByRole("heading", { level: 3 }).first()).not.toHaveText(antes);

  // Y de vuelta, deslizando al otro lado.
  await page.waitForTimeout(400); // que acabe la animación de entrada
  const caja2 = (await ficha.boundingBox())!;
  await dedo(
    page,
    { x: caja2.x + 30, y: caja2.y + 60 },
    { x: caja2.x + caja2.width - 30, y: caja2.y + 60 },
  );
  await expect(ficha.getByRole("heading", { level: 3 }).first()).toHaveText(antes);
});

test("sin PRO, el banquillo funciona igual: deslizar no coge, mantener pulsado sí", async ({
  page,
  request,
}) => {
  const { capitana, eventId } = await montar(request, "arrastre-normal", false);
  await loginAs(page, capitana);
  await page.goto(`/eventos/${eventId}`);
  await page.getByRole("tab", { name: /pistas/i }).click();

  const tira = page.locator("[data-banquillo] [data-drop='pool']");
  await expect(tira.getByRole("button")).toHaveCount(8, { timeout: 20_000 });
  const pistas = page.getByRole("tab", { name: /pistas/i });

  const uno = (await tira.getByRole("button").nth(1).boundingBox())!;
  await dedo(page, centro(uno), { x: centro(uno).x - 200, y: centro(uno).y });
  await expect.poll(() => tira.evaluate((el) => el.scrollLeft)).toBeGreaterThan(40);
  await expect(pistas).toContainText("0/4");

  await page.waitForTimeout(1200); // que acabe la inercia del deslizamiento
  await tira.evaluate((el) => el.scrollTo({ left: 0 }));
  const jugador = (await tira.getByRole("button").first().boundingBox())!;
  // La pista, en el centro: abajo la taparía la barra fija.
  await page.locator("[data-drop='1']").evaluate((el) => el.scrollIntoView({ block: "center" }));
  const pista = (await page.locator("[data-drop='1']").boundingBox())!;
  await dedo(page, centro(jugador), centro(pista), 600);
  await expect(pistas).toContainText("1/4");
});
