import { FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { COLLECTIONS } from "./collections";
import { getDb } from "./firebase-admin";

const MAX_FCM_TOKENS_PER_USER = 10;
const STALE_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

interface PushTarget {
  uid: string;
  tokens: string[];
}

export interface CompanyApprovalPushInput {
  requestId: string;
  companyId: string;
  requesterUid: string;
  reason?: string | null;
}

function normalizeFcmTokens(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalized = item.trim();
    if (normalized.length === 0) {
      continue;
    }

    deduped.add(normalized);
    if (deduped.size >= MAX_FCM_TOKENS_PER_USER) {
      break;
    }
  }

  return Array.from(deduped);
}

async function listSuperAdminPushTargets(): Promise<PushTarget[]> {
  const snapshot = await getDb()
    .collection(COLLECTIONS.users)
    .where("role", "==", "super_admin")
    .where("status", "==", "active")
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as {
        fcmTokens?: unknown;
        notificationSettings?: { companyApprovalPushEnabled?: unknown } | undefined;
      };

      if (data.notificationSettings?.companyApprovalPushEnabled === false) {
        return null;
      }

      const tokens = normalizeFcmTokens(data.fcmTokens);
      if (tokens.length === 0) {
        return null;
      }

      return {
        uid: doc.id,
        tokens,
      } satisfies PushTarget;
    })
    .filter((target): target is PushTarget => target !== null);
}

async function pruneInvalidTokens(tokensByUid: Map<string, string[]>): Promise<void> {
  if (tokensByUid.size === 0) {
    return;
  }

  const db = getDb();
  const operations = Array.from(tokensByUid.entries()).map(async ([uid, staleTokens]) => {
    const ref = db.collection(COLLECTIONS.users).doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data() as { fcmTokens?: unknown } | undefined;
    const currentTokens = normalizeFcmTokens(data?.fcmTokens);
    const staleTokenSet = new Set(staleTokens);
    const nextTokens = currentTokens.filter((token) => !staleTokenSet.has(token));

    await ref.update({
      fcmTokens: nextTokens,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });
  });

  await Promise.all(operations);
}

export async function sendCompanyApprovalRequestedPush(input: CompanyApprovalPushInput): Promise<void> {
  const targets = await listSuperAdminPushTargets();
  if (targets.length === 0) {
    return;
  }

  const flattenedTargets = targets.flatMap((target) =>
    target.tokens.map((token) => ({ uid: target.uid, token }))
  );

  const response = await getMessaging().sendEachForMulticast({
    tokens: flattenedTargets.map((item) => item.token),
    data: {
      title: "새 회사 승인 요청",
      body: `${input.companyId} / 요청자 ${input.requesterUid}${input.reason ? ` / ${input.reason}` : ""}`,
      link: "/admin/company-approval-requests",
      requestId: input.requestId,
      companyId: input.companyId,
      requesterUid: input.requesterUid,
      reason: input.reason ?? "",
      tag: `company-approval-request-${input.requestId}`,
    },
    webpush: {
      fcmOptions: {
        link: "/admin/company-approval-requests",
      },
      headers: {
        Urgency: "high",
      },
    },
  });

  const staleTokensByUid = new Map<string, string[]>();

  response.responses.forEach((item, index) => {
    if (item.success) {
      return;
    }

    const errorCode = item.error?.code;
    if (!errorCode || !STALE_TOKEN_ERROR_CODES.has(errorCode)) {
      return;
    }

    const failedTarget = flattenedTargets[index];
    if (!failedTarget) {
      return;
    }

    const current = staleTokensByUid.get(failedTarget.uid) ?? [];
    current.push(failedTarget.token);
    staleTokensByUid.set(failedTarget.uid, current);
  });

  await pruneInvalidTokens(staleTokensByUid);
}

export function mergeFcmTokens(existingTokens: unknown, incomingToken: string): string[] {
  const merged = [incomingToken, ...normalizeFcmTokens(existingTokens)];
  return normalizeFcmTokens(merged);
}

export function removeFcmToken(existingTokens: unknown, tokenToRemove: string): string[] {
  return normalizeFcmTokens(existingTokens).filter((token) => token !== tokenToRemove);
}
