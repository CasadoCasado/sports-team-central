/**
 * Registro guardado del service worker de TeamUp.
 * Solo se registra en producción real: nunca en dev, iframe o previews de Lovable.
 */
const SW_URL = "/sw.js";
const LEGACY_SW_URL = "/sw-push.js";

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

async function unregisterAppWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  for (const reg of regs) {
    const url = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
    if (url.endsWith(SW_URL) || url.endsWith(LEGACY_SW_URL)) await reg.unregister().catch(() => {});
  }
}

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isBlockedContext()) {
    await unregisterAppWorkers();
    return;
  }
  // El SW antiguo solo de push queda sustituido por /sw.js, que importa la misma lógica.
  const legacy = await navigator.serviceWorker.getRegistration(LEGACY_SW_URL).catch(() => null);
  if (legacy && (legacy.active?.scriptURL ?? "").endsWith(LEGACY_SW_URL)) {
    await legacy.unregister().catch(() => {});
  }
  await navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {});
}
