// Service Worker für Web Push (spec-Erweiterung: Tische sollen benachrichtigt
// werden, wenn ein Spieler zu ihnen umgesetzt wird - siehe
// progressive-web-apps.md). Bewusst als statische Datei in public/ statt über
// next-pwa generiert, siehe app/manifest.js für die Begründung.
// TEMPORÄR (Push-Debugging, siehe Chat): meldet jeden Schritt an
// /api/push/debug-log, weil die DevTools-Konsole des Service Workers auf
// diesem Rechner nicht zuverlässig erreichbar war. Nach Abschluss der
// Fehlersuche wieder auf die einfache try/catch-Version zurückbauen.
function debugLog(type, payload) {
  return fetch("/api/push/debug-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  }).catch(() => {});
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const raw = event.data ? await event.data.text() : null;
      await debugLog("push-received", { raw });
      try {
        if (!raw) return;
        const data = JSON.parse(raw);
        await self.registration.showNotification(data.title, {
          body: data.body,
          icon: data.icon || "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          vibrate: [100, 50, 100],
          data: { url: data.url || "/" },
        });
        await debugLog("push-shown", { title: data.title });
      } catch (err) {
        await debugLog("push-error", { message: err.message });
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
