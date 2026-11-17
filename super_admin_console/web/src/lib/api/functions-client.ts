import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseAuth } from "../firebase/client";
import { firebaseApp } from "../firebase/client";

const functions = firebaseApp
  ? getFunctions(firebaseApp, import.meta.env.VITE_FUNCTIONS_REGION ?? "asia-northeast3")
  : null;

export const isFunctionsReady = Boolean(functions);

export async function callCallable<TRequest, TResponse>(name: string, payload: TRequest): Promise<TResponse> {
  if (!functions) {
    throw new Error("FUNCTIONS_NOT_CONFIGURED");
  }

  const callable = httpsCallable<TRequest, TResponse>(functions, name);
  const result = await callable(payload);
  return result.data;
}

export async function postFunctionJson<TRequest extends object, TResponse>(
  name: string,
  payload: TRequest
): Promise<TResponse> {
  if (!firebaseApp) {
    throw new Error("FUNCTIONS_NOT_CONFIGURED");
  }

  const currentUser = firebaseAuth?.currentUser;
  if (!currentUser) {
    throw new Error("UNAUTHENTICATED");
  }

  const idToken = await currentUser.getIdToken();
  const region = import.meta.env.VITE_FUNCTIONS_REGION ?? "asia-northeast3";
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FUNCTIONS_NOT_CONFIGURED");
  }

  const url = `https://${region}-${projectId}.cloudfunctions.net/${name}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = { raw: rawText };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${rawText}`);
  }

  if (typeof body !== "object" || body === null) {
    throw new Error(`Invalid JSON response: ${rawText}`);
  }

  return body as TResponse;
}
