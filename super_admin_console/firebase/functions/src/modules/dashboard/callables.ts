import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber } from "../../shared/input";

interface DashboardOverviewInput {
  recentLimit?: number;
}

type DashboardWarningLevel = "info" | "warning" | "danger";

interface DashboardWarning {
  code: string;
  level: DashboardWarningLevel;
  title: string;
  description: string;
  count?: number;
}

interface DashboardKpi {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  activeProjects: number;
  pendingDeletionRequests: number;
  inReviewDeletionRequests: number;
}

interface DashboardOverviewResult {
  kpi: DashboardKpi;
  warnings: DashboardWarning[];
  recentDeletionRequests: Array<Record<string, unknown>>;
  recentAuditLogs: Array<Record<string, unknown>>;
  generatedAt: string;
}

async function getCount(query: FirebaseFirestore.Query): Promise<number> {
  const snapshot = await query.count().get();
  return Number(snapshot.data().count ?? 0);
}

function buildWarnings(kpi: DashboardKpi): DashboardWarning[] {
  const warnings: DashboardWarning[] = [];

  if (kpi.pendingDeletionRequests > 0) {
    warnings.push({
      code: "pending_deletion_requests",
      level: kpi.pendingDeletionRequests >= 10 ? "danger" : "warning",
      title: "삭제 요청 대기 건 존재",
      description: "요청 대기 건이 남아 있습니다. 정책 SLA 내 처리 여부를 확인해 주세요.",
      count: kpi.pendingDeletionRequests,
    });
  }

  if (kpi.inReviewDeletionRequests > 0) {
    warnings.push({
      code: "in_review_deletion_requests",
      level: kpi.inReviewDeletionRequests >= 10 ? "danger" : "warning",
      title: "검토 중 삭제 요청 존재",
      description: "검토 단계가 누적되고 있습니다. 담당자 할당 및 처리 우선순위를 점검해 주세요.",
      count: kpi.inReviewDeletionRequests,
    });
  }

  if (kpi.totalUsers > 0 && kpi.disabledUsers >= kpi.activeUsers) {
    warnings.push({
      code: "disabled_ratio_high",
      level: "warning",
      title: "비활성 사용자 비중 높음",
      description: "비활성 사용자 수가 활성 사용자 수 이상입니다. 계정 정리/운영 정책을 확인해 주세요.",
      count: kpi.disabledUsers,
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      code: "healthy",
      level: "info",
      title: "현재 운영 경고 없음",
      description: "핵심 지표 기준으로 즉시 대응이 필요한 경고가 없습니다.",
    });
  }

  return warnings;
}

export const adminGetDashboardOverview = withSuperAdminCallable<
  DashboardOverviewInput,
  DashboardOverviewResult
>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const recentLimit = clampLimit(readNumber(input, "recentLimit", { required: false, min: 1, max: 20 }), 6, 20);

  const db = getDb();
  const usersCollection = db.collection(COLLECTIONS.users);
  const projectsCollection = db.collection(COLLECTIONS.projects);
  const deletionRequestsCollection = db.collection(COLLECTIONS.deletionRequests);

  const [
    totalUsers,
    activeUsers,
    disabledUsers,
    activeProjects,
    pendingDeletionRequests,
    inReviewDeletionRequests,
    recentDeletionRequestsSnapshot,
    recentAuditLogsSnapshot,
  ] = await Promise.all([
    getCount(usersCollection),
    getCount(usersCollection.where("status", "==", "active")),
    getCount(usersCollection.where("status", "==", "disabled")),
    getCount(projectsCollection.where("status", "==", "active")),
    getCount(deletionRequestsCollection.where("status", "==", "requested")),
    getCount(deletionRequestsCollection.where("status", "==", "in_review")),
    deletionRequestsCollection.orderBy("createdAt", "desc").limit(recentLimit).get(),
    db.collection(COLLECTIONS.auditLogs).orderBy("createdAt", "desc").limit(recentLimit).get(),
  ]);

  const kpi: DashboardKpi = {
    totalUsers,
    activeUsers,
    disabledUsers,
    activeProjects,
    pendingDeletionRequests,
    inReviewDeletionRequests,
  };

  return {
    kpi,
    warnings: buildWarnings(kpi),
    recentDeletionRequests: recentDeletionRequestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    recentAuditLogs: recentAuditLogsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    generatedAt: new Date().toISOString(),
  };
});
