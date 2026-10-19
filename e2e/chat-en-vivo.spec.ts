import { test, expect, type APIRequestContext } from "@playwright/test";

import {
  API_URL,
  bearer,
  completeOnboarding,
  loginAs,
  seedCaptainWithTeam,
  signUp,
  uniqueEmail,
  type Session,
} from "./session";

/**
 * El chat abierto se entera solo de lo nuevo, sin recargar y sin pedir la
 * conversación entera cada vez (C2).
 */

/** El canal general del equipo, que crea la capitana. */
async function canalGeneral(api: APIRequestContext, capitana: Session, teamId: string) {
  const res = await api.post(`${API_URL}/chat-channels/`, {
    headers: bearer(capitana),
    data: { team_id: teamId, nombre: "General", scope: "general" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

async function escribir(api: APIRequestContext, quien: Session, canal: string, texto: string) {
  const res = await api.post(`${API_URL}/chat-messages/`, {
    headers: bearer(quien),
    data: { channel_id: canal, contenido: texto },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

test("un mensaje de otro aparece solo, pidiendo únicamente lo nuevo", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "chat-vivo");
  const jugadora = await signUp(request, uniqueEmail("chat-vivo-j"), "Iria", "Vivo");
  await completeOnboarding(request, jugadora);
  const invitacion = await request.post(`${API_URL}/team-invitations/`, {
    headers: bearer(capitana),
    data: { team_id: team.id, invited_user_id: jugadora.userId },
  });
  const { id } = (await invitacion.json()) as { id: string };
  await request.post(`${API_URL}/team-invitations/${id}/accept/`, { headers: bearer(jugadora) });
  const canal = await canalGeneral(request, capitana, team.id);
  await escribir(request, capitana, canal, "Mañana a las 19:00 en la pista 3");

  const pedidas: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/chat-messages/") && r.method() === "GET") pedidas.push(r.url());
  });
  await loginAs(page, capitana);
  await page.goto("/comunicaciones");
  await expect(page.getByText("Mañana a las 19:00 en la pista 3")).toBeVisible({
    timeout: 20_000,
  });

  // Otra persona escribe desde su móvil: aparece sin recargar.
  await escribir(request, jugadora, canal, "Allí estaré");
  await expect(page.getByText("Allí estaré")).toBeVisible({ timeout: 15_000 });

  // La primera petición trae la conversación; las siguientes, solo lo nuevo.
  expect(new URL(pedidas[0]).searchParams.get("order")).toBe("-created_at");
  const siguientes = pedidas.slice(1).map((u) => new URL(u).searchParams);
  expect(siguientes.length).toBeGreaterThan(0);
  for (const params of siguientes) expect(params.get("created_at__gt")).toBeTruthy();
});

test("con más de 200 mensajes, los últimos siguen saliendo", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { session: capitana, team } = await seedCaptainWithTeam(request, "chat-200");
  const canal = await canalGeneral(request, capitana, team.id);
  // 200 de antes, de veinte en veinte (entre ellos el orden da igual), y
  // luego 5 nuevos, uno detrás de otro. Antes se veían los 200 más antiguos,
  // así que los nuevos no salían nunca.
  for (let tanda = 0; tanda < 10; tanda++) {
    await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        escribir(request, capitana, canal, `Viejo ${tanda * 20 + n + 1}`),
      ),
    );
  }
  for (let n = 1; n <= 5; n++) await escribir(request, capitana, canal, `Nuevo ${n}`);

  await loginAs(page, capitana);
  await page.goto("/comunicaciones");
  await expect(page.getByText("Nuevo 5", { exact: true })).toBeVisible({ timeout: 20_000 });
  for (let n = 1; n <= 4; n++) {
    await expect(page.getByText(`Nuevo ${n}`, { exact: true })).toBeAttached();
  }
  // Los 200 más recientes: los 5 nuevos y 195 de los viejos.
  await expect(page.getByText(/^Viejo \d+$/)).toHaveCount(195);
});
