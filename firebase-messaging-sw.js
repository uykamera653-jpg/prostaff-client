/* PROSTAFF Web Push service worker
   Bu fayl GitHub Pages root'ida turishi shart: /firebase-messaging-sw.js
   Firebase v10 bilan ishlaydi.  */

self.addEventListener("install", () => {
  // tez aktiv bo‘lishi uchun
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

/* FCM HTTP v1 orqali kelgan background xabarlar uchun
   payload.data ichidagi qiymatlarni notifikatsiya sifatida ko‘rsatamiz. */
self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title =
      (data.notification && data.notification.title) ||
      (data.data && data.data.title) ||
      "PROSTAFF";
    const body =
      (data.notification && data.notification.body) ||
      (data.data && data.data.body) ||
      "Yangi xabar";
    const icon =
      (data.notification && data.notification.icon) ||
      "/favicon.png";

    const urlToOpen =
      (data.notification && data.notification.click_action) ||
      (data.data && data.data.click_action) ||
      "/";

    const options = {
      body,
      icon,
      data: { url: urlToOpen },
      badge: "/favicon.png",
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_) {
    // yutib yuboramiz
  }
});

/* notifikatsiyaga bosilganda mijoz oynasini ochish/yakunlash */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clis) => {
      for (const c of clis) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          c.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
