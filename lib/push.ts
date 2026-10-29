import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import { supabase } from "./supabase";

export async function enablePush() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) throw new Error("Ye browser push support nahi karta");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notification permission nahi mili");
  const app = getApps()[0] ?? initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(app), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
  const { error } = await supabase.rpc("save_device_token", { p_token: token });
  if (error) throw error;
}
