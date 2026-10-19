import { test, expect } from "@playwright/test";

/**
 * Cuando el servidor corta por demasiados intentos (429), la web lo dice en
 * castellano y no con la frase en inglés de DRF. En local los límites van muy
 * altos para que los e2e no tropiecen, así que aquí se simula la respuesta;
 * los límites de verdad los prueban los tests del backend (tests_limites.py).
 */
test("tras demasiados intentos de entrar, el aviso sale en castellano", async ({ page }) => {
  await page.route("**/api/auth/login/", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "1800" },
      json: {
        // En inglés a propósito: el texto tiene que salir del código, no de aquí.
        detail: "Request was throttled. Expected available in 1800 seconds.",
        codigo: "demasiados_intentos",
        espera: 1800,
      },
    }),
  );
  await page.goto("/auth");
  await page.locator("#email").fill("alguien@e2e.test");
  await page.locator("#password").fill("una-contraseña");
  await page.getByRole("button", { name: /^entrar$|iniciar sesión/i }).click();
  await expect(
    page.getByText("Demasiados intentos. Espera un poco y vuelve a probar."),
  ).toBeVisible();
});
