import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "@/lib/push.functions";

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

  const getKey = useServerFn(getVapidPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const delSub = useServerFn(deletePushSubscription);

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
    const existing = await navigator.serviceWorker.getRegistration("/sw-push.js");
    if (existing) return existing;
    return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setState(perm as PushState);
      if (perm !== "granted") return false;

      const { key } = await getKey();
      if (!key) throw new Error("VAPID key missing");

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
        data: {
          endpoint: sub.endpoint,
          p256dh: (json.keys?.p256dh as string) || bufToB64Url(sub.getKey("p256dh")),
          auth: (json.keys?.auth as string) || bufToB64Url(sub.getKey("auth")),
          userAgent: navigator.userAgent,
        },
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
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await delSub({ data: { endpoint: sub.endpoint } }).catch(() => {});
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
          data: {
            endpoint: sub.endpoint,
            p256dh: (json.keys?.p256dh as string) || bufToB64Url(sub.getKey("p256dh")),
            auth: (json.keys?.auth as string) || bufToB64Url(sub.getKey("auth")),
            userAgent: navigator.userAgent,
          },
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    })();
  }, [supported, state, ensureRegistration, saveSub]);

  return { state, supported, busy, subscribe, unsubscribe };
}
