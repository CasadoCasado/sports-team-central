/* Teamsup: notificaciones push (lo importa sw.js) */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Las cachés de cuando la app se llamaba TeamUp (`teamup-pages`,
      // `teamup-fonts`): ahora son `teamsup-…` y las viejas no se usan.
      caches
        .keys()
        .then((nombres) =>
          Promise.all(nombres.filter((n) => n.startsWith("teamup-")).map((n) => caches.delete(n))),
        ),
    ]),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Teamsup", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Teamsup";
  const options = {
    body: payload.body || "",
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    tag: payload.tag,
    data: { url: payload.url || "/inicio" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
