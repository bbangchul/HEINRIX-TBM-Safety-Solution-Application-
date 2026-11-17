import { FieldValue } from "firebase-admin/firestore";
import { withAuthenticatedCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { readInputObject, readString } from "../../shared/input";
import { mergeFcmTokens, removeFcmToken } from "../../shared/push-notifications";

type NotificationPermissionState = "granted" | "denied" | "default";

interface RegisterWebPushTokenInput {
  token: string;
  permission?: NotificationPermissionState;
}

interface UnregisterWebPushTokenInput {
  token: string;
  permission?: NotificationPermissionState;
}

interface WebPushTokenResult {
  updated: true;
  tokensCount: number;
}

function normalizePermissionState(value: string | undefined): NotificationPermissionState {
  if (value === "granted" || value === "denied" || value === "default") {
    return value;
  }
  return "default";
}

export const registerWebPushToken = withAuthenticatedCallable<
  RegisterWebPushTokenInput,
  WebPushTokenResult
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const token = readString(input, "token");
  const permission = normalizePermissionState(readString(input, "permission", { required: false }));

  if (!token) {
    throw new Error("INVALID_ARGUMENT");
  }

  const ref = getDb().collection(COLLECTIONS.users).doc(claims.uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const currentData = snapshot.data() as {
    fcmTokens?: unknown;
    notificationSettings?: Record<string, unknown> | undefined;
  } | undefined;
  const nextTokens = mergeFcmTokens(currentData?.fcmTokens, token);

  await ref.update({
    fcmTokens: nextTokens,
    notificationSettings: {
      ...(currentData?.notificationSettings ?? {}),
      companyApprovalPushEnabled: true,
      companyApprovalPushPermission: permission,
      companyApprovalPushChannel: "fcm_web",
      companyApprovalPushUpdatedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: claims.uid,
  });

  return { updated: true, tokensCount: nextTokens.length };
});

export const unregisterWebPushToken = withAuthenticatedCallable<
  UnregisterWebPushTokenInput,
  WebPushTokenResult
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const token = readString(input, "token");
  const permission = normalizePermissionState(readString(input, "permission", { required: false }));

  if (!token) {
    throw new Error("INVALID_ARGUMENT");
  }

  const ref = getDb().collection(COLLECTIONS.users).doc(claims.uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const currentData = snapshot.data() as {
    fcmTokens?: unknown;
    notificationSettings?: Record<string, unknown> | undefined;
  } | undefined;
  const nextTokens = removeFcmToken(currentData?.fcmTokens, token);

  await ref.update({
    fcmTokens: nextTokens,
    notificationSettings: {
      ...(currentData?.notificationSettings ?? {}),
      companyApprovalPushEnabled: nextTokens.length > 0 && permission !== "denied",
      companyApprovalPushPermission: permission,
      companyApprovalPushChannel: "fcm_web",
      companyApprovalPushUpdatedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: claims.uid,
  });

  return { updated: true, tokensCount: nextTokens.length };
});
