/* Pelbu Suites — staff PWA service worker (push + notification clicks). */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Pelbu Suites", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Pelbu Suites";
  const options = {
    body: data.body || "You have a new staff update.",
    icon: "/icons/staff-icon.svg",
    tag: data.tag || "pelbu-staff",
    data: { url: data.url || "/staff" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/staff";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/staff") && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    }),
  );
});
