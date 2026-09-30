import { test, expect } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Torneos abiertos: un equipo organiza con sede y los demás se apuntan desde
 * su lista de competiciones, en «Torneos fuera de casa».
 */

/** Nombres únicos: la base de los e2e guarda los torneos de otras pasadas. */
const unico = (nombre: string) => `${nombre} ${Math.random().toString(36).slice(2, 8)}`;

const VIGO = "36057";
const LUGO = "27028";

const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test("la capitana abre su torneo con sede y plazas", async ({ page, request }) => {
  const { session: capitana } = await seedCaptainWithTeam(request, "organiza-ui");
  const nombre = unico("Open de primavera");
  await loginAs(page, capitana);
  await page.goto("/competiciones");

  await page.getByRole("button", { name: /nueva competición/i }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("input").first().fill(nombre);
  await dlg.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Torneo", exact: true }).click();
  await dlg.locator("#comp-abierto").click();
  await dlg.locator("#comp-sede").fill("Club Náutico de Vigo");
  // La localidad sale de un desplegable con buscador, no se escribe a mano.
  await dlg.locator("#comp-localidad").click();
  await page.getByPlaceholder("Busca un municipio…").fill("vigo");
  await page.getByRole("option", { name: /^Vigo\b/ }).click();
  await expect(dlg.locator("#comp-localidad")).toContainText("Vigo (Pontevedra)");
  await dlg.locator("#comp-plazas").fill("6");
  await dlg.getByRole("button", { name: "Crear", exact: true }).click();

  const card = page.locator(".surface-card", { hasText: nombre });
  await expect(card).toContainText("Club Náutico de Vigo", { timeout: 20_000 });
  await expect(card).toContainText("0 de 6 equipos");
  await expect(card).toContainText("Vigo (Pontevedra)");
});

test("otro equipo se apunta y el organizador lo ve y puede quitarlo", async ({ page, request }) => {
  const { session: org, team: organizador } = await seedCaptainWithTeam(request, "org");
  const { session: cap } = await seedCaptainWithTeam(request, "visita");

  const nombre = unico("Open de Vigo");
  const res = await request.post(`${API_URL}/competitions/`, {
    headers: bearer(org),
    data: {
      team_id: organizador.id,
      nombre,
      tipo: "torneo",
      sede: "Club de Tenis Vigo",
      localidad: VIGO,
      abierto: true,
      plazas: 4,
      fecha_inicio: enDias(20),
      fecha_fin: enDias(21),
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const torneoId = ((await res.json()) as { id: string }).id;

  // El capitán del otro equipo lo encuentra y apunta al suyo.
  await loginAs(page, cap);
  await page.goto("/competiciones");
  const card = page.locator("article", { hasText: nombre });
  await expect(card).toContainText("Organiza Equipo org", { timeout: 20_000 });
  await expect(card).toContainText("Club de Tenis Vigo");
  await card.getByRole("button", { name: /apuntar a equipo visita/i }).click();
  await expect(card).toContainText("Apuntados");
  await expect(card).toContainText("1 de 4 equipos");

  // La organizadora lo ve en su torneo y lo quita, con nuestro aviso.
  await loginAs(page, org);
  await page.goto(`/competiciones/${torneoId}`);
  const inscritos = page.locator("section", { hasText: "Equipos inscritos" });
  await expect(inscritos).toContainText("Equipo visita", { timeout: 20_000 });
  await inscritos.getByRole("button", { name: /quitar a equipo visita/i }).click();
  const aviso = page.getByRole("alertdialog");
  await aviso.getByRole("button", { name: "Quitar", exact: true }).click();
  await expect(inscritos).toContainText("Todavía no se ha apuntado ningún equipo.");
});

test("los torneos fuera de casa se buscan por localidad", async ({ page, request }) => {
  const { session: org, team: organizador } = await seedCaptainWithTeam(request, "org-loc");
  const { session: cap } = await seedCaptainWithTeam(request, "busca-loc");

  const enVigo = unico("Open de Vigo");
  const enLugo = unico("Open de Lugo");
  for (const [nombre, localidad] of [
    [enVigo, VIGO],
    [enLugo, LUGO],
  ]) {
    const res = await request.post(`${API_URL}/competitions/`, {
      headers: bearer(org),
      data: {
        team_id: organizador.id,
        nombre,
        tipo: "torneo",
        sede: "Club",
        localidad,
        abierto: true,
        fecha_inicio: enDias(20),
      },
    });
    expect(res.ok(), await res.text()).toBe(true);
  }

  await loginAs(page, cap);
  await page.goto("/competiciones");
  await expect(page.locator("article", { hasText: enVigo })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("article", { hasText: enLugo })).toBeVisible();

  await page.getByRole("combobox", { name: "Localidad" }).click();
  await page.getByPlaceholder("Busca un municipio…").fill("lugo");
  await page.getByRole("option", { name: /^Lugo\b/ }).click();
  await expect(page.locator("article", { hasText: enLugo })).toBeVisible();
  await expect(page.locator("article", { hasText: enVigo })).toHaveCount(0);

  // Y se quita el filtro desde el mismo desplegable.
  await expect(page.getByRole("combobox", { name: "Localidad" })).toContainText("Lugo (Lugo)");
  await page.getByRole("combobox", { name: "Localidad" }).click();
  await page.getByRole("option", { name: "Todas las localidades" }).click();
  await expect(page.locator("article", { hasText: enVigo })).toBeVisible();
});
