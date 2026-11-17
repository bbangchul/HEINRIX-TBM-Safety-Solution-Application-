/* global firebase, importScripts */

importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const encodedFirebaseConfig = params.get("firebaseConfig");

if (encodedFirebaseConfig) {
  try {
    const firebaseConfig = JSON.parse(atob(encodedFirebaseConfig));
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload?.data?.title || "안전한하루 알림";
      const body = payload?.data?.body || "새 회사 승인 요청이 도착했습니다.";
      const link = payload?.data?.link || "/admin/company-approval-requests";
      const tag = payload?.data?.tag || "company-approval-request";

      self.registration.showNotification(title, {
        body,
        tag,
        requireInteraction: true,
        data: {
          link,
        },
      });
    });
  } catch (error) {
    console.error("[firebase-messaging-sw] init failed", error);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/admin/company-approval-requests";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }

      return undefined;
    })
  );
});
