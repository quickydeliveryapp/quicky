importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// TODO: Firebase Console > Project settings > Your apps (Web) se ye 4 values yahan paste karo
firebase.initializeApp({
  apiKey: "AIzaSyBwwNK1BiPU9UV1b3hPykBVfuhQ_YJ4dps",
  projectId: "quicky-delivery-app",
  messagingSenderId: "464622372034",
  appId: "1:464622372034:web:4a783ddce47fbb12cca75b",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Quicky", {
    body: d.body, tag: d.tag, data: { url: d.url || "/" },
    requireInteraction: true, vibrate: [300, 100, 300, 100, 600], icon: "/icon-192.png",
  });
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
