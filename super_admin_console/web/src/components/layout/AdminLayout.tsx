import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ADMIN_ROUTES } from "../../app/admin-routes";
import { useAuth } from "../../features/auth/auth-context";
import { adminApi } from "../../lib/api/admin-api";
import { syncWebPushToken, unregisterStoredWebPushToken } from "../../lib/firebase/messaging";
import type { CompanyApprovalRequestDoc } from "../../lib/types/firestore";
import { ROLE_LABELS } from "../../lib/types/rbac";

interface LiveCompanyApprovalRequest {
  id: string;
  companyId: string;
  companyName?: string | null;
  requesterUid: string;
  requesterName?: string | null;
  reason?: string | null;
}

interface NotificationToast {
  id: string;
  title: string;
  description: string;
}

const COMPANY_APPROVAL_READ_STORAGE_KEY_PREFIX = "heinrix:companyApprovalRequests:seen:";

function loadSeenRequestIds(uid: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(`${COMPANY_APPROVAL_READ_STORAGE_KEY_PREFIX}${uid}`);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function persistSeenRequestIds(uid: string, seenIds: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      `${COMPANY_APPROVAL_READ_STORAGE_KEY_PREFIX}${uid}`,
      JSON.stringify(Array.from(seenIds).slice(-500))
    );
  } catch {
    // Ignore local persistence errors for non-critical notification state.
  }
}

function playNotificationTone(): void {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  try {
    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.22);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.24);

    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined);
    }, 320);
  } catch {
    // Ignore browser autoplay/runtime errors for non-critical notification sound.
  }
}

export function AdminLayout() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [pendingCompanyApprovalCount, setPendingCompanyApprovalCount] = useState(0);
  const [unreadCompanyApprovalCount, setUnreadCompanyApprovalCount] = useState(0);
  const [notificationToasts, setNotificationToasts] = useState<NotificationToast[]>([]);
  const initializedRef = useRef(false);
  const knownRequestIdsRef = useRef<Set<string>>(new Set());
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const currentRequestedIdsRef = useRef<string[]>([]);
  const toastTimeoutsRef = useRef<number[]>([]);

  const markRequestsAsSeen = (requestIds: string[]) => {
    if (!session?.uid || requestIds.length === 0) {
      return;
    }

    const nextSeenIds = new Set(seenRequestIdsRef.current);
    let changed = false;
    for (const requestId of requestIds) {
      if (!nextSeenIds.has(requestId)) {
        nextSeenIds.add(requestId);
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    seenRequestIdsRef.current = nextSeenIds;
    persistSeenRequestIds(session.uid, nextSeenIds);
    setUnreadCompanyApprovalCount(
      currentRequestedIdsRef.current.filter((requestId) => !nextSeenIds.has(requestId)).length
    );
  };

  useEffect(() => {
    if (!session?.uid) {
      setPendingCompanyApprovalCount(0);
      setUnreadCompanyApprovalCount(0);
      setNotificationToasts([]);
      initializedRef.current = false;
      knownRequestIdsRef.current = new Set();
      seenRequestIdsRef.current = new Set();
      currentRequestedIdsRef.current = [];
      return;
    }

    seenRequestIdsRef.current = loadSeenRequestIds(session.uid);
    let disposed = false;

    const applyRequests = (requests: CompanyApprovalRequestDoc[]) => {
      const currentRequests: LiveCompanyApprovalRequest[] = requests.map((row) => ({
        id: row.id,
        companyId: row.companyId || "-",
        companyName: row.companyName ?? null,
        requesterUid: row.requesterUid,
        requesterName: row.requesterName ?? null,
        reason: row.reason ?? row.rejectReason ?? null,
      }));

      const nextIds = new Set(currentRequests.map((row) => row.id));
      currentRequestedIdsRef.current = currentRequests.map((row) => row.id);
      setPendingCompanyApprovalCount(currentRequests.length);
      setUnreadCompanyApprovalCount(
        currentRequests.filter((row) => !seenRequestIdsRef.current.has(row.id)).length
      );

      if (!initializedRef.current) {
        initializedRef.current = true;
        knownRequestIdsRef.current = nextIds;
        return;
      }

      const addedRequests = currentRequests.filter((row) => !knownRequestIdsRef.current.has(row.id));
      knownRequestIdsRef.current = nextIds;

      if (addedRequests.length === 0) {
        return;
      }

      playNotificationTone();
      setNotificationToasts((prev) => {
        const nextToasts = [...prev];

        for (const row of addedRequests) {
          nextToasts.unshift({
            id: row.id,
            title: "새 회사 승인 요청",
            description: `${row.companyName ?? row.companyId} / 요청자 ${row.requesterName ?? row.requesterUid}`,
          });
        }

        return nextToasts.slice(0, 4);
      });

      for (const row of addedRequests) {
        const timeoutId = window.setTimeout(() => {
          markRequestsAsSeen([row.id]);
          setNotificationToasts((prev) => prev.filter((toast) => toast.id !== row.id));
        }, 6000);
        toastTimeoutsRef.current.push(timeoutId);
      }
    };

    const pollRequests = async () => {
      try {
        const requests = await adminApi.listCompanyApprovalRequests({
          limit: 100,
          status: "pending",
        });
        if (!disposed) {
          applyRequests(requests);
        }
      } catch {
        if (!disposed) {
          setPendingCompanyApprovalCount(0);
          setUnreadCompanyApprovalCount(0);
        }
      }
    };

    void pollRequests();
    const intervalId = window.setInterval(() => {
      void pollRequests();
    }, 30000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [session?.uid]);

  useEffect(() => {
    if (!location.pathname.startsWith("/admin/company-approval-requests")) {
      return;
    }

    markRequestsAsSeen(currentRequestedIdsRef.current);
    setNotificationToasts([]);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      for (const timeoutId of toastTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!session?.uid) {
      return;
    }

    void syncWebPushToken(session.uid).catch(() => undefined);
  }, [session?.uid]);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-box">
          <img className="brand-app-icon" src="/assets/icon.png" alt="" />
          <div>
            <img className="brand-wordmark" src="/assets/anha-jeonhanharu-logo.png" alt="안전한하루" />
            <p>Super Admin</p>
          </div>
        </div>

        <nav className="side-nav" aria-label="관리자 메뉴">
          {ADMIN_ROUTES.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              end={route.path === "/admin"}
              className={({ isActive }) => (isActive ? "side-link active" : "side-link")}
            >
              {route.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h2>관리자 콘솔</h2>
            <p>heinrix.com Firebase 운영 영역</p>
          </div>
          <div className="admin-topbar-actions">
            <Link
              to="/admin/company-approval-requests"
              className="notification-link"
              onClick={() => {
                markRequestsAsSeen(currentRequestedIdsRef.current);
                setNotificationToasts([]);
              }}
            >
              <span className="notification-link-label">회사 승인 요청</span>
              <span className={`notification-badge ${unreadCompanyApprovalCount > 0 ? "has-pending" : ""}`}>
                {unreadCompanyApprovalCount}
              </span>
            </Link>
            {pendingCompanyApprovalCount > 0 && (
              <small className="notification-meta">대기 {pendingCompanyApprovalCount}건</small>
            )}
          </div>
          <div className="admin-user-box">
            <span>{session?.displayName ?? session?.email ?? session?.uid}</span>
            <small>{session?.claims.role ? ROLE_LABELS[session.claims.role] : "권한 없음"}</small>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (session?.uid) {
                    await unregisterStoredWebPushToken(session.uid);
                  }
                  await logout();
                })();
              }}
            >
              로그아웃
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {notificationToasts.map((toast) => (
          <div key={toast.id} className="toast-card">
            <div className="toast-content">
              <strong>{toast.title}</strong>
              <p>{toast.description}</p>
              <Link
                to="/admin/company-approval-requests"
                className="toast-link"
                onClick={() => {
                  markRequestsAsSeen([toast.id]);
                  setNotificationToasts((prev) => prev.filter((item) => item.id !== toast.id));
                }}
              >
                요청 화면 열기
              </Link>
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => {
                markRequestsAsSeen([toast.id]);
                setNotificationToasts((prev) => prev.filter((item) => item.id !== toast.id));
              }}
              aria-label="알림 닫기"
            >
              닫기
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
