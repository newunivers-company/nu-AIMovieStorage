import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <p className="text-sm font-semibold text-white">없는 화면입니다</p>
      <p className="text-xs" style={{ color: "oklch(0.55 0.01 265)" }}>
        주소가 바뀌었거나 아직 만들지 않은 곳입니다.
      </p>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="rounded-lg px-3 py-2 text-xs font-semibold text-white gradient-primary"
      >
        프로젝트 목록으로
      </button>
    </div>
  );
}
