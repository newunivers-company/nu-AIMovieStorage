import { useRef, useState } from "react";
import {
  type EasingCurve,
  EASING_PRESETS,
  easingFromSpeedHandle,
  easingSpeedHandles,
  sampleEasing,
  sampleEasingSpeed,
} from "@/lib/cameraMoves";

/**
 * 속도 그래프 에디터 — 애프터이펙트의 그래프 에디터와 같은 방식입니다.
 *
 * # 두 가지 보기
 *
 * 애프터이펙트에는 «값 그래프» 와 «속도 그래프» 가 따로 있습니다. 여기도 같습니다.
 *
 * - **속도**(기본) — 곡선의 **기울기**를 그립니다. 이즈 인·아웃이면 «0 에서 올라갔다
 * 다시 0 으로» 라 **포물선**이 됩니다. 1 이 등속(평균 속도)입니다.
 * - **진행률** — 0 에서 1 로 올라가는 S 자. 「지금 얼마나 왔는가」.
 *
 * 사람이 실제로 느끼는 것은 «얼마나 왔는가» 가 아니라
 * «지금 얼마나 빠른가» 라서, 기본을 속도 쪽으로 둡니다.
 *
 * # 손잡이는 두 보기에서 같은 것을 만집니다
 *
 * 속이 같은 3차 베지어 하나라, 어느 쪽에서 끌어도 결과는 같은 곡선입니다. 다만 뜻이
 * 다르게 읽힙니다 — 진행률에서는 «제어점», 속도에서는 «출발·도착 속도와 영향»입니다.
 * (변환은 `easingSpeedHandles` / `easingFromSpeedHandle`.)
 */
export function EasingGraphEditor({
  curve,
  onChange,
}: {
  curve: EasingCurve;
  onChange: (curve: EasingCurve) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<1 | 2 | null>(null);
  /** 어느 그림을 볼지. 사용자가 요청한 포물선이 기본입니다. */
  const [mode, setMode] = useState<"speed" | "value">("speed");

  const size = 160;
  const pad = 18;
  const span = size - pad * 2;
  const speedMode = mode === "speed";

  const speedSamples = sampleEasingSpeed(curve, 48);
  const handles = easingSpeedHandles(curve);
  /*
    세로 눈금. 속도는 위로 얼마든 솟을 수 있어(급가속) 고정하면 곡선이 천장을 뚫습니다.
    가장 높은 값과 손잡이까지 담되 최소 2 는 보장합니다 — 등속선(1)이 화면 한가운데쯤
    와야 «빠른지 느린지» 가 한눈에 읽힙니다.
  */
  const speedTop = Math.max(
    2,
    ...speedSamples.map((sample) => sample.speed),
    handles.out.speed,
    handles.in.speed,
  );

  // 그래프 좌표 → 화면 좌표. y 는 위아래가 뒤집힙니다.
  const toScreen = (x: number, y: number) => ({
    x: pad + x * span,
    y: pad + (1 - y) * span,
  });
  /** 속도 값(1=등속)을 화면 y 로. */
  const speedToScreen = (t: number, speed: number) =>
    toScreen(t, speed / speedTop);

  const path = (
    speedMode
      ? speedSamples.map((sample) => speedToScreen(sample.t, sample.speed))
      : sampleEasing(curve, 40).map((sample) =>
          toScreen(sample.t, sample.value),
        )
  )
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

  const start = toScreen(0, 0);
  const end = toScreen(1, 1);
  const c1 = speedMode
    ? speedToScreen(handles.out.t, handles.out.speed)
    : toScreen(curve.p1x, curve.p1y);
  const c2 = speedMode
    ? speedToScreen(handles.in.t, handles.in.speed)
    : toScreen(curve.p2x, curve.p2y);
  /** 등속선 — 속도 보기에서는 y=1 의 가로줄, 진행률 보기에서는 대각선. */
  const evenLine = speedMode
    ? { a: speedToScreen(0, 1), b: speedToScreen(1, 1) }
    : { a: start, b: end };

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * size;
    const y = ((event.clientY - rect.top) / rect.height) * size;
    /*
      시간축은 **각자 절반까지**입니다 — 출발 손잡이는 0~0.5, 도착 손잡이는 0.5~1.

       애프터이펙트의 «영향(influence)» 도 두 손잡이가 서로를 넘지
      못합니다. 안 막으면 출발 손잡이가 도착 손잡이를 지나쳐 곡선이 스스로 접히고
      («되감기는» 무빙), 화면에서는 두 점이 겹쳐 어느 것을 잡았는지도 알 수 없습니다
      (2026-09-14 스크린샷에서 실제로 겹쳤습니다).
    */
    const raw = (x - pad) / span;
    const gx =
      dragging === 1
        ? Math.min(0.5, Math.max(0, raw))
        : Math.min(1, Math.max(0.5, raw));
    if (speedMode) {
      // 속도는 음수가 없습니다(뒤로 가는 무빙은 클립을 뒤집어 만듭니다).
      const speed = Math.max(0, (1 - (y - pad) / span) * speedTop);
      onChange(
        easingFromSpeedHandle(curve, dragging === 1 ? "out" : "in", {
          t: gx,
          speed,
        }),
      );
      return;
    }
    // 진행률축은 오버슛·예비동작을 위해 범위를 넘을 수 있게 둡니다.
    const gy = Math.min(1.6, Math.max(-0.6, 1 - (y - pad) / span));
    onChange(
      dragging === 1
        ? { ...curve, p1x: gx, p1y: gy }
        : { ...curve, p2x: gx, p2y: gy },
    );
  };

  const handle = (
    index: 1 | 2,
    point: { x: number; y: number },
    color: string,
  ) => (
    <g
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(index);
      }}
      style={{ cursor: "grab" }}
    >
      <circle cx={point.x} cy={point.y} r={9} fill="transparent" />
      <circle
        cx={point.x}
        cy={point.y}
        r={4}
        fill={color}
        stroke="#0b0d14"
        strokeWidth={1.2}
      />
    </g>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {/*
          보기 전환. 애프터이펙트도 한 곡선을 두 그림으로 보여 줍니다 —
          고치는 대상은 같고 읽는 방식만 다릅니다.
        */}
        {[
          {
            id: "speed" as const,
            label: "속도",
            hint: "기울기 — 포물선. 1이 등속",
          },
          { id: "value" as const, label: "진행률", hint: "0에서 1로 — S자" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            title={item.hint}
            className="rounded-md px-2 py-0.5 text-[9px] font-semibold"
            style={{
              background:
                mode === item.id
                  ? "oklch(0.62 0.22 290 / 26%)"
                  : "oklch(1 0 0 / 4%)",
              border: `1px solid ${mode === item.id ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 7%)"}`,
              color:
                mode === item.id
                  ? "oklch(0.86 0.17 290)"
                  : "oklch(0.60 0.01 265)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1">
        {EASING_PRESETS.map((preset) => {
          const active =
            Math.abs(preset.curve.p1x - curve.p1x) < 0.01 &&
            Math.abs(preset.curve.p1y - curve.p1y) < 0.01 &&
            Math.abs(preset.curve.p2x - curve.p2x) < 0.01 &&
            Math.abs(preset.curve.p2y - curve.p2y) < 0.01;
          return (
            <button
              key={preset.id}
              onClick={() => onChange({ ...preset.curve })}
              title={preset.hint}
              className="rounded-md px-1 py-1 text-[9px]"
              style={{
                background: active
                  ? "oklch(0.62 0.22 290 / 20%)"
                  : "oklch(1 0 0 / 4%)",
                border: `1px solid ${active ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 7%)"}`,
                color: active ? "oklch(0.84 0.19 290)" : "oklch(0.62 0.01 265)",
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        className="w-full rounded-md"
        style={{
          background: "oklch(0.11 0.008 265)",
          border: "1px solid oklch(1 0 0 / 8%)",
          touchAction: "none",
        }}
        onPointerMove={handleMove}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        {/* 격자 */}
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const h = toScreen(0, step);
          const v = toScreen(step, 0);
          return (
            <g key={step}>
              <line
                x1={pad}
                y1={h.y}
                x2={pad + span}
                y2={h.y}
                stroke="oklch(1 0 0 / 6%)"
                strokeWidth={0.6}
              />
              <line
                x1={v.x}
                y1={pad}
                x2={v.x}
                y2={pad + span}
                stroke="oklch(1 0 0 / 6%)"
                strokeWidth={0.6}
              />
            </g>
          );
        })}
        {/* 등속 기준선 — 속도 보기에서는 «1», 진행률 보기에서는 대각선. */}
        <line
          x1={evenLine.a.x}
          y1={evenLine.a.y}
          x2={evenLine.b.x}
          y2={evenLine.b.y}
          stroke="oklch(1 0 0 / 12%)"
          strokeWidth={0.8}
          strokeDasharray="3 3"
        />
        {speedMode && (
          <text
            x={pad + 2}
            y={speedToScreen(0, 1).y - 2}
            fontSize={6}
            fill="oklch(0.45 0.01 265)"
          >
            등속
          </text>
        )}

        {/* 제어선 — 손잡이가 어디에 매여 있는지 */}
        <line
          x1={speedMode ? speedToScreen(0, handles.out.speed).x : start.x}
          y1={speedMode ? speedToScreen(0, handles.out.speed).y : start.y}
          x2={c1.x}
          y2={c1.y}
          stroke="oklch(0.70 0.15 200 / 55%)"
          strokeWidth={1}
        />
        <line
          x1={speedMode ? speedToScreen(1, handles.in.speed).x : end.x}
          y1={speedMode ? speedToScreen(1, handles.in.speed).y : end.y}
          x2={c2.x}
          y2={c2.y}
          stroke="oklch(0.80 0.18 290 / 55%)"
          strokeWidth={1}
        />

        {/* 곡선 */}
        <path
          d={path}
          fill="none"
          stroke="oklch(0.82 0.19 290)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* 양 끝점 */}
        {!speedMode && (
          <>
            <circle
              cx={start.x}
              cy={start.y}
              r={3}
              fill="oklch(0.50 0.01 265)"
            />
            <circle cx={end.x} cy={end.y} r={3} fill="oklch(0.50 0.01 265)" />
          </>
        )}

        {handle(1, c1, "oklch(0.70 0.15 200)")}
        {handle(2, c2, "oklch(0.80 0.18 290)")}

        <text x={pad} y={size - 4} fontSize={7} fill="oklch(0.45 0.01 265)">
          시간 →
        </text>
        <text x={2} y={pad - 6} fontSize={7} fill="oklch(0.45 0.01 265)">
          {speedMode ? "속도" : "진행률"}
        </text>
      </svg>

      <p
        className="text-[9px] leading-relaxed"
        style={{ color: "oklch(0.45 0.01 265)" }}
      >
        {speedMode ? (
          <>
            <b>포물선의 높이가 곧 속도</b>입니다 — 점선(등속)보다 위면 빠르고
            아래면 느립니다. 손잡이를 <b>위아래</b>로 끌면 출발·도착 속도가,{" "}
            <b>좌우</b>로 끌면 그 속도가 미치는 범위(영향)가 바뀝니다.
          </>
        ) : (
          <>
            곡선의 기울기가 속도입니다. 점선(등속)보다 완만하면 느리고, 가파르면
            빠릅니다. 제어점을 위아래 범위 밖으로 끌면 오버슛·예비동작이 됩니다.
          </>
        )}
      </p>
    </div>
  );
}
