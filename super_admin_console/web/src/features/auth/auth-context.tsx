import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseAuth } from "../../lib/firebase/client";
import { missingFirebaseConfigKeys } from "../../lib/firebase/config";
import type { AuthSession, AuthStatus } from "../../lib/types/auth";
import { parseClaims } from "../../lib/utils/claims";
import {
  getAllowedSuperAdminIdentityLabel,
  getAllowedSuperAdminEnvironmentsLabel,
  getPreferredHostedDomain,
  isAllowedSuperAdminEmail,
  isAllowedSuperAdminEnvironment,
} from "../../lib/utils/auth-policy";

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  isFirebaseReady: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const allowedIdentityLabel = getAllowedSuperAdminIdentityLabel();
const allowedEnvironmentLabel = getAllowedSuperAdminEnvironmentsLabel();
const e2eBypassAuth = import.meta.env.VITE_E2E_BYPASS_AUTH === "true";
const bypassEnvironment =
  import.meta.env.VITE_APP_ENV === "dev" || import.meta.env.VITE_APP_ENV === "stg" || import.meta.env.VITE_APP_ENV === "prod"
    ? import.meta.env.VITE_APP_ENV
    : "dev";

function domainNotAllowedMessage(): string {
  return `허용되지 않은 이메일 계정입니다. 허용 계정/도메인: ${allowedIdentityLabel}`;
}

function environmentNotAllowedMessage(): string {
  return `허용되지 않은 인증 환경입니다. 허용 환경: ${allowedEnvironmentLabel}`;
}

async function buildSession(user: User): Promise<AuthSession> {
  const tokenResult = await user.getIdTokenResult(true);
  const claims = parseClaims(tokenResult);

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    claims,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFirebaseReady = Boolean(firebaseAuth);

  useEffect(() => {
    if (e2eBypassAuth) {
      setError(null);
      setSession({
        uid: "e2e_super_admin",
        email: "e2e-super-admin@heinrix.com",
        displayName: "E2E Super Admin",
        claims: {
          role: "super_admin",
          mfaVerified: true,
          environment: bypassEnvironment,
          companyIds: [],
          projectIds: [],
        },
      });
      setStatus("authenticated");
      return;
    }

    const auth = firebaseAuth;
    if (!auth) {
      setStatus("unauthenticated");
      setSession(null);
      const missingKeys = missingFirebaseConfigKeys();
      setError(`Firebase 환경변수가 누락되었습니다: ${missingKeys.join(", ")}`);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setError(null);
        if (!user) {
          setStatus("unauthenticated");
          setSession(null);
          return;
        }

        if (!isAllowedSuperAdminEmail(user.email)) {
          await signOut(auth);
          setStatus("unauthenticated");
          setSession(null);
          setError(domainNotAllowedMessage());
          return;
        }

        const built = await buildSession(user);
        if (!isAllowedSuperAdminEnvironment(built.claims.environment)) {
          await signOut(auth);
          setStatus("unauthenticated");
          setSession(null);
          setError(environmentNotAllowedMessage());
          return;
        }

        setSession(built);
        setStatus("authenticated");
      } catch (e) {
        setStatus("unauthenticated");
        setSession(null);
        setError(e instanceof Error ? e.message : "인증 상태 확인 중 오류가 발생했습니다.");
      }
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (e2eBypassAuth) {
      return;
    }

    const auth = firebaseAuth;
    if (!auth) {
      throw new Error("FIREBASE_NOT_CONFIGURED");
    }

    const provider = new GoogleAuthProvider();
    const hostedDomain = getPreferredHostedDomain();
    provider.setCustomParameters({
      prompt: "select_account",
      ...(hostedDomain ? { hd: hostedDomain } : {}),
    });

    const credential = await signInWithPopup(auth, provider);
    if (!isAllowedSuperAdminEmail(credential.user.email)) {
      await signOut(auth);
      throw new Error(domainNotAllowedMessage());
    }

    const built = await buildSession(credential.user);
    if (!isAllowedSuperAdminEnvironment(built.claims.environment)) {
      await signOut(auth);
      throw new Error(environmentNotAllowedMessage());
    }
  }, []);

  const logout = useCallback(async () => {
    if (e2eBypassAuth) {
      setSession(null);
      setStatus("unauthenticated");
      return;
    }

    const auth = firebaseAuth;
    if (!auth) {
      return;
    }

    await signOut(auth);
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const refreshClaims = useCallback(async () => {
    if (e2eBypassAuth) {
      return;
    }

    const auth = firebaseAuth;
    if (!auth?.currentUser) {
      setStatus("unauthenticated");
      setSession(null);
      return;
    }

    if (!isAllowedSuperAdminEmail(auth.currentUser.email)) {
      await signOut(auth);
      setStatus("unauthenticated");
      setSession(null);
      setError(domainNotAllowedMessage());
      return;
    }

    const refreshed = await buildSession(auth.currentUser);
    if (!isAllowedSuperAdminEnvironment(refreshed.claims.environment)) {
      await signOut(auth);
      setStatus("unauthenticated");
      setSession(null);
      setError(environmentNotAllowedMessage());
      return;
    }

    setSession(refreshed);
    setStatus("authenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      error,
      isFirebaseReady,
      loginWithGoogle,
      logout,
      refreshClaims,
    }),
    [status, session, error, isFirebaseReady, loginWithGoogle, logout, refreshClaims]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
