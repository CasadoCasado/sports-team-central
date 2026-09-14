import { defineConfig, devices } from "@playwright/test";

const CHROMIUM = process.env["E2E_CHROMIUM_PATH"];

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    viewport: { width: 1280, height: 1000 },
    locale: "es-ES",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // En las máquinas donde no se pudo bajar el navegador que trae
        // Playwright (WSL sin salida al CDN, por ejemplo), se le apunta a un
        // Chromium ya instalado:
        //   E2E_CHROMIUM_PATH=~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx playwright test
        ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
      },
    },
  ],
});
