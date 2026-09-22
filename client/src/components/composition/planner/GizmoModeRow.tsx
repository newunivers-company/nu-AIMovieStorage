import type { TransformConstraint } from "@/components/composition/CompositionViewport";

/**
 * **수치 입력 — 지금 무엇을 만질까.** 이동·회전·크기와 자유·바닥·높이 제한.
 *
 * 수치 입력은 고른 것 바로 아래, 자리 칸 바로 위에 붙입니다 — 무엇을 만지는지와 그 값이
 * 한눈에 이어집니다. 인물 칸과 소품 칸이 **같은 줄**을 씁니다(CLAUDE.md 규칙 1).
 *
 * 인물은 크기를 여기서 바꾸지 않습니다(키가 정합니다) — 그 칸만 꺼 둡니다.
 */
export function GizmoModeRow({
  transformMode,
  setTransformMode,
  transformConstraint,
  setTransformConstraint,
  scaleDisabled,
}: {
  transformMode: "translate" | "rotate" | "scale";
  setTransformMode: (mode: "translate" | "rotate" | "scale") => void;
  transformConstraint: TransformConstraint;
  setTransformConstraint: (constraint: TransformConstraint) => void;
  /** 인물은 크기를 키로 정합니다 — 그때 «크기» 를 잠급니다. */
  scaleDisabled?: boolean;
}) {
  return (
    <div data-tour="layout-gizmo-mode" className="mb-2 space-y-1">
      <p className="text-[10px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
        수치 입력
      </p>
      <div className="grid grid-cols-3 gap-1">
        {(
          [
            { id: "translate", label: "이동" },
            { id: "rotate", label: "회전" },
            { id: "scale", label: "크기" },
          ] as const
        ).map((item) => {
          const on = transformMode === item.id;
          const disabled = item.id === "scale" && scaleDisabled;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => setTransformMode(item.id)}
              className="rounded-md px-2 py-1.5 text-[10px] disabled:opacity-30"
              style={{
                background: on ? "oklch(0.62 0.22 290 / 20%)" : "oklch(1 0 0 / 4%)",
                color: on ? "oklch(0.84 0.19 290)" : "oklch(0.64 0.01 265)",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(
          [
            { id: "free", label: "자유" },
            { id: "ground", label: "바닥" },
            { id: "height", label: "높이" },
          ] as const
        ).map((item) => {
          const on = transformConstraint === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTransformConstraint(item.id)}
              title={
                item.id === "ground"
                  ? "바닥에 붙여 좌우·앞뒤로만"
                  : item.id === "height"
                    ? "위아래로만"
                    : "세 축 모두"
              }
              className="rounded-md px-2 py-1.5 text-[10px]"
              style={{
                background: on ? "oklch(0.55 0.15 200 / 20%)" : "oklch(1 0 0 / 4%)",
                color: on ? "oklch(0.80 0.13 200)" : "oklch(0.64 0.01 265)",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GizmoModeRow;
