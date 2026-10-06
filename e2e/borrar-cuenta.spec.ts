import { test, expect } from "@playwright/test";

import {
  API_URL,
  PASSWORD,
  bearer,
  loginAs,
  seedCaptainWithTeam,
  seedPlayerInTeam,
} from "./session";

/**
 * Borrar la cuenta desde el perfil (lo exigen Apple, Google y la RGPD). Antes
 * de confirmar se ve qué pasa con cada equipo; sin la contraseña no se borra.
 */
test("la capitana borra su cuenta y el equipo pasa a la co-capitana", async ({ page, request }) => {
  const { session: capitana, team } = await seedCaptainWithTeam(request, "borrar");
  const cocap = await seedPlayerInTeam(request, "borrar-cocap", team.id, capitana, {
    nombre: "Iria",
    apellidos: "Souto",
    role: "co_capitan",
  });

  // Nada de diálogos del navegador: la ventana es la nuestra.
  page.on("dialog", (d) => {
    throw new Error(`Diálogo del navegador: ${d.message()}`);
  });
  await loginAs(page, capitana);
  await page.goto("/perfil");
  await page.getByRole("button", { name: /^borrar mi cuenta$/i }).click();

  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText(new RegExp(`${team.nombre} pasa a Iria Souto`, "i"), {
    timeout: 20_000,
  });

  // Con la contraseña mal, no.
  await dialogo.getByLabel(/contraseña/i).fill("no-es-esta");
  await dialogo.getByRole("button", { name: /para siempre/i }).click();
  await expect(dialogo.getByRole("alert")).toHaveText(/no es correcta/i);

  await dialogo.getByLabel(/contraseña/i).fill(PASSWORD);
  await dialogo.getByRole("button", { name: /para siempre/i }).click();
  await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
  await expect(page.getByText(/tu cuenta se ha borrado/i)).toBeVisible();

  // Ya no entra, y el equipo es de la co-capitana.
  const login = await request.post(`${API_URL}/auth/login/`, {
    data: { email: capitana.email, password: PASSWORD },
  });
  expect(login.status()).toBe(401);
  const res = await request.get(`${API_URL}/teams/${team.id}/`, { headers: bearer(cocap) });
  expect(res.ok(), await res.text()).toBe(true);
  expect(((await res.json()) as { owner_id: string }).owner_id).toBe(cocap.userId);
});
