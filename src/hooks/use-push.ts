import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

/**
 * Suscripción del navegador a las notificaciones push.
 *
 * Antes esto pasaba por funciones de servidor de TanStack que hablaban con
 * Supabase; ahora las suscripciones son de la API de Django y basta con
 * llamarla. El envío de los avisos lo decide el servidor, no el navegador.
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushState = "unsupported" | "denied" | "granted" | "default" | "unknown";

export function usePush() {
  const [state, setState] = useState<PushState>("unknown");
  const [busy, setBusy] = useState(false);

  const getKey = useCallback(() => api.get<{ key: string | null }>("/push/vapid-key/"), []);
  const saveSub = useCallback(
    (data: { endpoint: string; p256dh: string; auth: string; user_agent?: string }) =>
      api.post("/push-subscriptions/", data),
    [],
  );
  const delSub = useCallback(
    (endpoint: string) => api.post("/push-subscriptions/unsubscribe/", { endpoint }),
    [],
  );

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PushState);
  }, [supported]);

  const ensureRegistration = useCallback(async () => {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    // En producción /sw.js incluye la lógica de push; en preview/dev se usa el SW de push directo.
    const url = import.meta.env.PROD ? "/sw.js" : "/sw-push.js";
    return navigator.serviceWorker.register(url, { scope: "/" });
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setState(perm as PushState);
      if (perm !== "granted") return false;

      const { key } = await getKey();
      if (!key) throw new Error("El servidor no tiene las notificaciones push configuradas");

      const reg = await ensureRegistration();
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }
      const json = sub.toJSON();
      await saveSub({
        endpoint: sub.endpoint,
        p256dh: (json.keys?.p256dh as string) || bufToB64Url(sub.getKey("p256dh")),
        auth: (json.keys?.auth as string) || bufToB64Url(sub.getKey("auth")),
        user_agent: navigator.userAgent,
      });
      return true;
    } finally {
      setBusy(false);
    }
  }, [supported, getKey, saveSub, ensureRegistration]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await delSub(sub.endpoint).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }, [supported, delSub]);

  // Silently re-sync subscription if already granted (keeps DB fresh).
  useEffect(() => {
    if (!supported || state !== "granted") return;
    (async () => {
      try {
        const reg = await ensureRegistration();
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const json = sub.toJSON();
        await saveSub({
          endpoint: sub.endpoint,
          p256dh: (json.keys?.p256dh as string) || bufToB64Url(sub.getKey("p256dh")),
          auth: (json.keys?.auth as string) || bufToB64Url(sub.getKey("auth")),
          user_agent: navigator.userAgent,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    })();
  }, [supported, state, ensureRegistration, saveSub]);

  return { state, supported, busy, subscribe, unsubscribe };
}
