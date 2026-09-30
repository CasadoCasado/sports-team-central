import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

import {
  API_URL,
  PASSWORD,
  bearer,
  completeOnboarding,
  loginAs,
  seedCaptainWithTeam,
  signUp,
  uniqueEmail,
  type Session,
} from "./session";

/**
 * El enlace para unirse que el capitán manda por WhatsApp: quien lo abre se
 * crea la cuenta y entra directamente en el equipo, sin onboarding ni
 * solicitud que aceptar.
 */

async function codigoDe(api: APIRequestContext, capitana: Session, teamId: string) {
  const res = await api.get(`${API_URL}/teams/${teamId}/enlace/`, { headers: bearer(capitana) });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { codigo: string }).codigo;
}

async function estaEnSuEquipo(page: Page, nombre: string, { tutorial = false } = {}) {
  await expect(page).toHaveURL(/\/mi-equipo/, { timeout: 20_000 });
  await expect(page.getByText(`¡Ya estás en ${nombre}!`)).toBeVisible();
  if (tutorial) {
    // A quien acaba de llegar le sale el tutorial, pero sin mandarle a
    // buscar equipo: ya tiene uno.
    const tour = page.getByRole("dialog");
    await expect(tour).toBeVisible();
    await expect(tour.getByRole("heading", { name: "Consulta el calendario" })).toBeVisible();
    await tour.getByRole("button", { name: "Saltar tutorial" }).click();
  }
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
}

test("la capitana manda el enlace por WhatsApp desde la tarjeta del equipo", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "wa");
  const codigo = await codigoDe(request, capitana, team.id);
  await loginAs(page, capitana);
  await page.context().route("https://wa.me/**", (r) => r.fulfill({ body: "WhatsApp" }));
  await page.goto("/mi-equipo");

  await expect(page.getByText("Invita por WhatsApp")).toBeVisible({ timeout: 20_000 });
  const [wa] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("button", { name: /enviar por whatsapp/i }).click(),
  ]);
  const texto = new URL(wa.url()).searchParams.get("text") ?? "";
  expect(texto).toContain("¡Únete a Equipo wa en TeamUp!");
  expect(texto).toContain(`/unirse/${codigo}`);
});

test("alguien sin cuenta abre el enlace, se registra y entra directamente", async ({
  page,
  request,
}) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "alta");
  const codigo = await codigoDe(request, capitana, team.id);

  await page.goto(`/unirse/${codigo}`);
  await expect(page.getByRole("heading", { name: "Equipo alta" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /crear cuenta y unirme/i }).click();

  await expect(
    page.getByText("Al crear tu cuenta entrarás directamente en Equipo alta."),
  ).toBeVisible();
  await page.locator("#nombre").fill("Nueva");
  await page.locator("#apellidos").fill("Jugadora");
  await page.locator("#email").fill(uniqueEmail("alta-nueva"));
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#confirm").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();

  // Sin pasar por el onboarding: derecho a su equipo.
  await estaEnSuEquipo(page, "Equipo alta", { tutorial: true });
  const members = await request.get(`${API_URL}/team-members/`, {
    headers: bearer(capitana),
    params: { team_id: team.id, status: "activo" },
  });
  const nombres = ((await members.json()) as { profile: { nombre: string } | null }[]).map(
    (m) => m.profile?.nombre,
  );
  expect(nombres).toContain("Nueva");
});

test("con la cuenta ya abierta basta un botón", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "boton");
  const codigo = await codigoDe(request, capitana, team.id);
  const jugador = await signUp(request, uniqueEmail("boton-j"));
  await completeOnboarding(request, jugador);
  await loginAs(page, jugador);

  await page.goto(`/unirse/${codigo}`);
  await page.getByRole("button", { name: /unirme al equipo/i }).click();
  await estaEnSuEquipo(page, "Equipo boton");

  // Volver a abrirlo ya no ofrece unirse otra vez.
  await page.goto(`/unirse/${codigo}`);
  await expect(page.getByText("Ya eres de este equipo.")).toBeVisible({ timeout: 20_000 });
});

test("con cuenta pero sin sesión: entra y queda dentro", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "login");
  const codigo = await codigoDe(request, capitana, team.id);
  const jugador = await signUp(request, uniqueEmail("login-j"));

  await page.goto(`/unirse/${codigo}`);
  await page.getByRole("link", { name: /ya tengo cuenta/i }).click();
  await expect(page.getByText("Al entrar te unirás a Equipo login.")).toBeVisible();
  await page.locator("#email").fill(jugador.email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();

  // Aunque nunca completó el onboarding, el enlace ya dice a qué viene.
  await estaEnSuEquipo(page, "Equipo login", { tutorial: true });
});

test("un enlace cambiado deja de valer", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "viejo");
  const viejo = await codigoDe(request, capitana, team.id);
  await request.post(`${API_URL}/teams/${team.id}/enlace/`, { headers: bearer(capitana) });

  await page.goto(`/unirse/${viejo}`);
  await expect(page.getByRole("heading", { name: "Este enlace ya no vale" })).toBeVisible({
    timeout: 20_000,
  });
});
