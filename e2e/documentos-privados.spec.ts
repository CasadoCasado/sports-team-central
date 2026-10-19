import { test, expect } from "@playwright/test";

import {
  API_URL,
  bearer,
  loginAs,
  seedCaptainWithTeam,
  seedPlayerInTeam,
  type Session,
} from "./session";

/** Solo el token: `bearer()` pone `Content-Type: application/json` y pisaría
 * el multipart de la subida. */
const token = (s: Session) => ({ Authorization: `Bearer ${s.access}` });

/**
 * Los documentos del equipo son privados: no tienen dirección fija y se
 * descargan con un enlace que da la API a quien es del equipo, que caduca y
 * que siempre descarga, nunca abre el fichero como página.
 *
 * La subida desde la web sigue en obras (ver maintenance.spec), así que el
 * documento se sube por la API.
 */
test("un jugador descarga un documento del equipo y alguien de fuera no consigue enlace", async ({
  page,
  request,
}) => {
  const { session: capitan, team } = await seedCaptainWithTeam(request, "docs");
  const jugador = await seedPlayerInTeam(request, "docs-j", team.id, capitan);

  const subida = await request.post(`${API_URL}/documents/`, {
    headers: token(capitan),
    multipart: {
      team_id: team.id,
      file: {
        name: "Acta de enero.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 acta"),
      },
    },
  });
  expect(subida.status(), await subida.text()).toBe(201);
  const doc = (await subida.json()) as { id: string; url?: string };
  expect(doc.url).toBeUndefined();

  await loginAs(page, jugador);
  await page.goto("/documentos");
  await expect(page.getByText("Acta de enero.pdf")).toBeVisible({ timeout: 20_000 });

  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /descargar/i }).click(),
  ]);
  expect(descarga.suggestedFilename()).toBe("Acta de enero.pdf");
  // La pantalla no se mueve: el enlace descarga, no navega.
  await expect(page).toHaveURL(/\/documentos/);

  // Alguien de otro equipo no consigue enlace aunque sepa el id.
  const { session: ajeno } = await seedCaptainWithTeam(request, "docs-ajeno");
  const enlace = await request.get(`${API_URL}/documents/${doc.id}/enlace/`, {
    headers: bearer(ajeno),
  });
  expect(enlace.status()).toBe(403);
});

test("una página web disfrazada de documento no se puede subir", async ({ request }) => {
  const { session: capitan, team } = await seedCaptainWithTeam(request, "docs-html");
  const res = await request.post(`${API_URL}/documents/`, {
    headers: token(capitan),
    multipart: {
      team_id: team.id,
      file: {
        name: "acta.html",
        mimeType: "application/pdf",
        buffer: Buffer.from("<script>alert(1)</script>"),
      },
    },
  });
  expect(res.status()).toBe(400);
  expect(await res.text()).toContain("document_type_not_allowed");
});
