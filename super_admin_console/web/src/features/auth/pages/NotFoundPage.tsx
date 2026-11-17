import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="center-screen">
      <div className="status-card">
        <h2>페이지를 찾을 수 없습니다</h2>
        <p>요청한 경로가 존재하지 않습니다.</p>
        <Link to="/admin" className="text-link">
          관리자 홈으로 이동
        </Link>
      </div>
    </div>
  );
}
