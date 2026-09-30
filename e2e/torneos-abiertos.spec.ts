import { test, expect, type APIRequestContext } from "@playwright/test";

import { API_URL, bearer, loginAs, seedCaptainWithTeam } from "./session";

/**
 * Torneos abiertos: un equipo organiza con sede y los demás se apuntan desde
 * su lista de competiciones, en «Torneos fuera de casa».
 */

/** Nombres únicos: la base de los e2e guarda los torneos de otras pasadas. */
const unico = (nombre: string) => `${nombre} ${Math.random().toString(36).slice(2, 8)}`;

const VIGO = "36057";
const LUGO = "27028";
const MALAGA = "29067";
const MARBELLA = "29069";

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
  // Elegir el municipio pone su provincia.
  await expect(dlg.locator("#comp-provincia")).toContainText("Pontevedra");
  await expect(dlg.locator("#comp-localidad")).toContainText("Vigo");
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

/** Tres torneos abiertos de un mismo organizador: Málaga, Marbella y Lugo. */
async function tresTorneos(request: APIRequestContext) {
  const { session: org, team: organizador } = await seedCaptainWithTeam(request, "org-loc");
  const nombres = {
    malaga: unico("Open de Málaga"),
    marbella: unico("Open de Marbella"),
    lugo: unico("Open de Lugo"),
  };
  for (const [nombre, localidad] of [
    [nombres.malaga, MALAGA],
    [nombres.marbella, MARBELLA],
    [nombres.lugo, LUGO],
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
  return nombres;
}

test("se buscan por provincia y, dentro de ella, por localidad", async ({ page, request }) => {
  const n = await tresTorneos(request);
  const { session: cap } = await seedCaptainWithTeam(request, "busca-loc");
  const torneo = (nombre: string) => page.locator("article", { hasText: nombre });
  const provincia = page.getByRole("combobox", { name: "Provincia" });
  const localidad = page.getByRole("combobox", { name: "Localidad" });

  await loginAs(page, cap);
  await page.goto("/competiciones");
  // Sin provincia en el perfil, se ven todos.
  await expect(torneo(n.lugo)).toBeVisible({ timeout: 20_000 });
  await expect(torneo(n.malaga)).toBeVisible();

  // Málaga: todos los de la provincia.
  await provincia.click();
  await page.getByPlaceholder("Busca una provincia…").fill("malaga");
  await page.getByRole("option", { name: "Málaga" }).click();
  await expect(torneo(n.malaga)).toBeVisible();
  await expect(torneo(n.marbella)).toBeVisible();
  await expect(torneo(n.lugo)).toHaveCount(0);

  // Málaga y Marbella: solo los de Marbella. El desplegable ya solo ofrece
  // municipios de Málaga.
  await localidad.click();
  await page.getByPlaceholder("Busca un municipio…").fill("lugo");
  await expect(page.getByRole("option", { name: /^Lugo\b/ })).toHaveCount(0);
  await page.getByPlaceholder("Busca un municipio…").fill("marbella");
  await page.getByRole("option", { name: "Marbella" }).click();
  await expect(torneo(n.marbella)).toBeVisible();
  await expect(torneo(n.malaga)).toHaveCount(0);

  // Quitar la localidad vuelve a toda la provincia; quitar la provincia, a todo.
  await localidad.click();
  await page.getByRole("option", { name: "Todas las localidades" }).click();
  await expect(torneo(n.malaga)).toBeVisible();
  await expect(torneo(n.lugo)).toHaveCount(0);
  await provincia.click();
  await page.getByRole("option", { name: "Todas las provincias" }).click();
  await expect(torneo(n.lugo)).toBeVisible();
});

test("la provincia del perfil es la que se busca de primeras", async ({ page, request }) => {
  const n = await tresTorneos(request);
  const { session: cap } = await seedCaptainWithTeam(request, "perfil-loc");

  await loginAs(page, cap);
  await page.goto("/perfil");
  // En el perfil ya no hay ciudad: solo la provincia, de la lista.
  await expect(page.locator("#ciudad")).toHaveCount(0);
  await page.locator("#provincia").click({ timeout: 20_000 });
  await page.getByPlaceholder("Busca una provincia…").fill("lugo");
  await page.getByRole("option", { name: "Lugo" }).click();
  await page.locator("form").getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Perfil actualizado")).toBeVisible();

  await page.goto("/competiciones");
  await expect(page.getByRole("combobox", { name: "Provincia" })).toContainText("Lugo");
  await expect(page.locator("article", { hasText: n.lugo })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("article", { hasText: n.malaga })).toHaveCount(0);
});
