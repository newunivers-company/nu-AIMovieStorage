import type { OrbitAxis, ShotKind } from "@/lib/cameraMoves";

/**
 * 샷 프리셋 미리보기 아이콘.
 *
 * 이름만으로는 "트럭"과 "팬"의 차이가 잘 안 옵니다. 카메라가 어떻게 움직이는지
 * 작은 도식으로 반복 재생해 보여줍니다. CSS 애니메이션이라 프리셋을 수십 개 깔아도
 * 렌더 비용이 거의 없습니다(자바스크립트 루프 없음).
 *
 * 도식은 위에서 내려다본 평면도 기준입니다.
 * - 주황 점 : 피사체(앵커)
 * - 흰 삼각형: 카메라와 시야
 */
export function ShotPreviewIcon({ kind, axis, amount, active }: {
  kind: ShotKind;
  axis?: OrbitAxis;
  amount: number;
  active?: boolean;
}) {
  const subject = "#ff9f5a";
  const camera = active ? "#e9ddff" : "#8b93a7";
  const trail = active ? "oklch(0.78 0.18 290 / 55%)" : "oklch(0.60 0.02 265 / 40%)";
  // 방향이 반대인 프리셋은 애니메이션을 거꾸로 재생합니다.
  const reverse = amount < 0 ? "reverse" : "normal";

  const cameraShape = (
    <g>
      <path d="M -3.4 2.2 L 0 -3.2 L 3.4 2.2 Z" fill={camera} />
      <path d="M -6 -5.5 L 0 -2.6 L 6 -5.5" fill="none" stroke={camera} strokeWidth={0.8} opacity={0.55} />
    </g>
  );

  return (
    <svg viewBox="0 0 56 34" className="h-full w-full" aria-hidden>
      <style>{`
        @keyframes sp-dolly { 0%,8% { transform: translateY(0); } 55%,100% { transform: translateY(-8px); } }
        @keyframes sp-orbit-y { 0%,6% { transform: rotate(0deg); } 60%,100% { transform: rotate(150deg); } }
        @keyframes sp-orbit-x { 0%,6% { transform: scaleY(1) translateY(0); } 60%,100% { transform: scaleY(-0.35) translateY(-3px); } }
        @keyframes sp-pan { 0%,8% { transform: rotate(-26deg); } 58%,100% { transform: rotate(26deg); } }
        @keyframes sp-truck { 0%,8% { transform: translateX(-9px); } 58%,100% { transform: translateX(9px); } }
        @keyframes sp-crane { 0%,8% { transform: translateY(4px) scale(0.86); } 58%,100% { transform: translateY(-4px) scale(1.12); } }
        @keyframes sp-zoom { 0%,8% { transform: scale(1); opacity: .5; } 58%,100% { transform: scale(0.5); opacity: 1; } }
        @keyframes sp-idle { 0%,100% { opacity: .75; } 50% { opacity: 1; } }
        .sp-anim { animation-duration: 2.6s; animation-iteration-count: infinite; animation-timing-function: cubic-bezier(.42,0,.58,1); }
      `}</style>

      {/* 피사체 */}
      <circle cx={28} cy={12} r={2.6} fill={subject} />
      <circle cx={28} cy={12} r={6} fill="none" stroke={subject} strokeWidth={0.6} opacity={0.3} />

      {kind === "dolly" && (
        <>
          <line x1={28} y1={16} x2={28} y2={28} stroke={trail} strokeWidth={1} strokeDasharray="2 2" />
          <g className="sp-anim" style={{ animationName: "sp-dolly", animationDirection: reverse, transformOrigin: "28px 26px" }} transform="translate(28 26)">
            {cameraShape}
          </g>
        </>
      )}

      {kind === "orbit" && (
        <>
          <ellipse cx={28} cy={12} rx={14} ry={axis === "x" ? 9 : 12} fill="none" stroke={trail} strokeWidth={1} strokeDasharray="2 2" />
          <g
            className="sp-anim"
            style={{
              animationName: axis === "x" ? "sp-orbit-x" : "sp-orbit-y",
              animationDirection: reverse,
              transformOrigin: "28px 12px",
            }}
          >
            <g transform="translate(28 26)">{cameraShape}</g>
          </g>
        </>
      )}

      {kind === "pan" && (
        <g className="sp-anim" style={{ animationName: "sp-pan", animationDirection: reverse, transformOrigin: "28px 27px" }}>
          <g transform="translate(28 27)">{cameraShape}</g>
          <path d="M 28 24 L 16 6 M 28 24 L 40 6" stroke={trail} strokeWidth={1} fill="none" />
        </g>
      )}

      {kind === "truck" && (
        <>
          <line x1={17} y1={27} x2={39} y2={27} stroke={trail} strokeWidth={1} strokeDasharray="2 2" />
          <g className="sp-anim" style={{ animationName: "sp-truck", animationDirection: reverse }}>
            <g transform="translate(28 27)">{cameraShape}</g>
          </g>
        </>
      )}

      {kind === "crane" && (
        <>
          <line x1={28} y1={20} x2={28} y2={31} stroke={trail} strokeWidth={1} strokeDasharray="2 2" />
          <g className="sp-anim" style={{ animationName: "sp-crane", animationDirection: reverse, transformOrigin: "28px 27px" }}>
            <g transform="translate(28 27)">{cameraShape}</g>
          </g>
        </>
      )}

      {kind === "zoom" && (
        <>
          <g transform="translate(28 27)">{cameraShape}</g>
          <g className="sp-anim" style={{ animationName: "sp-zoom", animationDirection: reverse, transformOrigin: "28px 24px" }}>
            <path d="M 28 24 L 14 5 M 28 24 L 42 5" stroke={trail} strokeWidth={1.2} fill="none" />
          </g>
        </>
      )}

      {kind === "static" && (
        <g className="sp-anim" style={{ animationName: "sp-idle" }}>
          <g transform="translate(28 27)">{cameraShape}</g>
        </g>
      )}
    </svg>
  );
}
