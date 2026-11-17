import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { callCallable, isFunctionsReady } from "../api/functions-client";
import { firebaseApp } from "./client";
import { firebaseConfig, firebaseMessagingVapidKey } from "./config";

const FCM_TOKEN_STORAGE_KEY_PREFIX = "heinrix:webPushToken:";
const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";

function getStoredTokenKey(uid: string): string {
  return `${FCM_TOKEN_STORAGE_KEY_PREFIX}${uid}`;
}

function loadStoredToken(uid: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(getStoredTokenKey(uid));
}

function persistStoredToken(uid: string, token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStoredTokenKey(uid), token);
}

function clearStoredToken(uid: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getStoredTokenKey(uid));
}

function buildServiceWorkerUrl(): string {
  const params = new URLSearchParams({
    firebaseConfig: btoa(JSON.stringify(firebaseConfig)),
  });

  return `${SERVICE_WORKER_PATH}?${params.toString()}`;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("SERVICE_WORKER_NOT_SUPPORTED");
  }

  return navigator.serviceWorker.register(buildServiceWorkerUrl());
}

export async function syncWebPushToken(uid: string): Promise<void> {
  if (!firebaseApp || !isFunctionsReady || typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported || !firebaseMessagingVapidKey) {
    return;
  }

  const currentPermission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  const existingStoredToken = loadStoredToken(uid);
  if (currentPermission !== "granted") {
    if (existingStoredToken) {
      await callCallable<{ token: string; permission: string }, { updated: true; tokensCount: number }>(
        "unregisterWebPushToken",
        {
          token: existingStoredToken,
          permission: currentPermission,
        }
      ).catch(() => undefined);
      clearStoredToken(uid);
    }
    return;
  }

  const serviceWorkerRegistration = await ensureServiceWorkerRegistration();
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: firebaseMessagingVapidKey,
    serviceWorkerRegistration,
  });

  if (!token) {
    return;
  }

  if (existingStoredToken && existingStoredToken !== token) {
    await callCallable<{ token: string; permission: string }, { updated: true; tokensCount: number }>(
      "unregisterWebPushToken",
      {
        token: existingStoredToken,
        permission: currentPermission,
      }
    ).catch(() => undefined);
  }

  await callCallable<{ token: string; permission: string }, { updated: true; tokensCount: number }>(
    "registerWebPushToken",
    {
      token,
      permission: currentPermission,
    }
  );

  persistStoredToken(uid, token);
}

export async function unregisterStoredWebPushToken(uid: string): Promise<void> {
  if (!firebaseApp || !isFunctionsReady || typeof window === "undefined") {
    clearStoredToken(uid);
    return;
  }

  const existingStoredToken = loadStoredToken(uid);
  if (!existingStoredToken) {
    return;
  }

  await callCallable<{ token: string; permission: string }, { updated: true; tokensCount: number }>(
    "unregisterWebPushToken",
    {
      token: existingStoredToken,
      permission: Notification.permission,
    }
  ).catch(() => undefined);

  const supported = await isSupported().catch(() => false);
  if (supported) {
    const messaging = getMessaging(firebaseApp);
    await deleteToken(messaging).catch(() => undefined);
  }

  clearStoredToken(uid);
}
