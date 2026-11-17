export interface MinimalAuthContext {
  uid: string;
  token?: Record<string, unknown>;
}

export function requireAuth(auth: MinimalAuthContext | null | undefined): asserts auth is MinimalAuthContext {
  if (!auth?.uid) {
    throw new Error("UNAUTHENTICATED");
  }
}
