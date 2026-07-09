importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
importScripts("/firebase-messaging-sw-config.js");

const firebaseConfig = self.firebaseMessagingConfig || {};
const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);

const notificationUrlFromPayload = (payload) => {
  const data = payload.data || {};

  return (
    data.url ||
    data.web_url ||
    (data.shipment_id
      ? `/customer/shipments/${data.shipment_id}`
      : "/customer/notifications")
  );
};

if (hasFirebaseConfig) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) {
      return;
    }

    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || data.title || "Boxygo";

    self.registration.showNotification(title, {
      body: notification.body || data.body || "",
      icon: notification.icon || "/pwa-icons/manifest-icon-192.maskable.png",
      badge: "/pwa-icons/manifest-icon-192.maskable.png",
      data: {
        url: notificationUrlFromPayload(payload),
      },
    });
  });
} else {
  console.warn("Firebase Messaging service worker is missing configuration.");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/customer/notifications",
    self.location.origin
  ).href;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }

        return undefined;
      })
  );
});
