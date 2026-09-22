import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import type { Vector3Value } from "@/lib/composition";

/**
 * 구도잡기 패널의 공통 조각들.
 *
 * # 입력란이 왜 문자열을 들고 있나
 *
 * 값을 곧바로 숫자로 바꿔 상위 상태에 넣으면 `-` 하나만 친 순간
 * `Number("-")` 가 NaN 이라 0 으로 되돌아가서 **음수를 입력할 수 없습니다.**
 * 편집 중에는 문자열을 그대로 들고 있다가 유효한 숫자가 될 때만 위로 올립니다.
 *
 * 이름 입력란도 같은 이유로 지연시킵니다 — 글자를 칠 때마다 상위 상태를
 * 바꾸면 3D 씬 전체가 다시 만들어져서 화면이 깜박입니다.
 */

export const FIELD_STYLE = {
  background: "oklch(0.18 0.012 265)",
  border: "1px solid oklch(1 0 0 / 9%)",
  color: "oklch(0.82 0.01 265)",
} as const;

export const ZERO_VECTOR: Vector3Value = { x: 0, y: 0, z: 0 };
export const ONE_VECTOR: Vector3Value = { x: 1, y: 1, z: 1 };

const AXIS_KEYS: Array<keyof Vector3Value> = ["x", "y", "z"];

/** 소수점·음수를 허용하는 숫자 입력란. */
export function NumberInput({
  value,
  step = 0.1,
  min,
  onChange,
}: {
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={shown}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^-?\d*\.?\d*$/.test(next)) return;
        setDraft(next);
        const parsed = Number(next);
        if (next !== "" && next !== "-" && next !== "." && !Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const base = Number(shown) || 0;
        let next = base + (event.key === "ArrowUp" ? step : -step);
        if (min !== undefined) next = Math.max(min, next);
        next = Number(next.toFixed(3));
        setDraft(String(next));
        onChange(next);
      }}
      className="h-8 w-full rounded-md px-2 text-xs outline-none"
      style={FIELD_STYLE}
    />
  );
}

/** 각도 입력란(도 단위). */
export function DegreeInput({
  value,
  step = 5,
  onChange,
}: {
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value));

  return (
    <input
      type="text"
      inputMode="numeric"
      value={shown}
      onChange={(event) => {
        const next = event.target.value;
        // 음수 기호만 있거나 비어 있는 중간 상태를 허용합니다.
        if (!/^-?\d*$/.test(next)) return;
        setDraft(next);
        if (next !== "" && next !== "-") onChange(Number(next));
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const base = Number(shown === "" || shown === "-" ? 0 : shown);
        const next = base + (event.key === "ArrowUp" ? step : -step);
        setDraft(String(next));
        onChange(next);
      }}
      className="h-7 w-full rounded-md px-2 text-xs outline-none"
      style={FIELD_STYLE}
    />
  );
}

/**
 * 이름 입력란.
 *
 * 편집 중에는 로컬에만 담아두고, 포커스를 잃거나 Enter 를 누를 때 한 번만 반영합니다.
 */
export function NameInput({
  value,
  placeholder,
  onCommit,
  ...rest
}: {
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "onKeyDown"
>) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  const commit = () => {
    setDraft(null);
    if (shown !== value) onCommit(shown);
  };

  return (
    <input
      {...rest}
      value={shown}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Escape") {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      className="h-8 w-full rounded-md px-2 text-xs outline-none"
      style={FIELD_STYLE}
    />
  );
}

/**
 * 3축 수치 입력. 각 축 라벨 옆에 **그 축만** 되돌리는 초기화 버튼이 붙습니다.
 * 전체 초기화 하나로는 「Z 만 잘못 건드렸는데 X·Y 까지 날아가는」 문제가 생깁니다.
 */
/**
 * 화면에 보이는 축 ↔ 안에서 쓰는 축.
 *
 * # 왜 바꿔야 하나
 *
 * three.js 는 **Y가 위아래**입니다. 그런데 이 앱을 쓰는 사람은 블렌더를
 * 씁니다. 블렌더는 **Z가 위아래**예요. 화면에 three.js 축을 그대로 내보내면
 * 「Z축이 위 아래 아니야?」 가 됩니다 — 높이를 바꾸려고 Z 를 건드렸는데
 * 인물이 앞뒤로 움직입니다.
 *
 * 그래서 **보이는 값만** 블렌더 규약으로 옮깁니다. 안쪽 계산은 three.js
 * 그대로 둡니다. 둘 다 오른손 좌표계라 아래 한 줄이면 정확히 옮겨집니다.
 *
 * 보이는 X = 안쪽 x (좌우)
 * 보이는 Y = −안쪽 z (앞뒤)
 * 보이는 Z = 안쪽 y (위아래)
 */
const SHOWN_AXES = [
  { shown: "x", inner: "x" as keyof Vector3Value, sign: 1, label: "X" },
  { shown: "y", inner: "z" as keyof Vector3Value, sign: -1, label: "Y" },
  { shown: "z", inner: "y" as keyof Vector3Value, sign: 1, label: "Z" },
] as const;

export function AxisVectorFields({
  value,
  defaults,
  unit,
  step,
  min,
  onChange,
  labels,
  zUp,
}: {
  value: Vector3Value;
  defaults: Vector3Value;
  /** "deg" 이면 라디안 ↔ 도 변환을 합니다 */
  unit?: "deg";
  step?: number;
  min?: number;
  onChange: (value: Vector3Value) => void;
  labels?: Record<keyof Vector3Value, string>;
  /**
   * **Z를 위아래로 보여 줍니다.** 인물·오브젝트의 위치와 회전에 씁니다.
   *
   * 뼈 관절 회전에는 쓰지 않습니다 — 관절은 뼈에 붙은 축이라 위아래라는
   * 개념 자체가 없습니다.
   */
  zUp?: boolean;
}) {
  const toDisplay = (raw: number) =>
    unit === "deg" ? Math.round((raw * 180) / Math.PI) : Number(raw.toFixed(3));
  const fromDisplay = (shown: number) => (unit === "deg" ? (shown * Math.PI) / 180 : shown);

  const axes = zUp
    ? SHOWN_AXES
    : AXIS_KEYS.map((key) => ({ shown: key, inner: key, sign: 1, label: key.toUpperCase() }));

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {axes.map(({ inner: key, sign, label }) => {
        const isDefault = Math.abs(value[key] - defaults[key]) < 1e-6;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span
                className="text-[10px] font-semibold"
                style={{ color: "oklch(0.45 0.01 265)" }}
              >
                {labels ? labels[key] : label}
                {unit === "deg" ? "°" : ""}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...value, [key]: defaults[key] })}
                disabled={isDefault}
                title={`${labels ? labels[key] : label} 축만 초기화`}
                className="rounded p-0.5 disabled:opacity-25"
                style={{ color: isDefault ? "oklch(0.38 0.01 265)" : "oklch(0.70 0.15 200)" }}
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            </div>
            <NumberInput
              value={toDisplay(value[key] * sign)}
              step={step ?? 0.1}
              min={min}
              onChange={(shown) => {
                const next = fromDisplay(shown) * sign;
                onChange({ ...value, [key]: min !== undefined ? Math.max(min, next) : next });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** 섹션 제목 한 줄. 축별 초기화가 따로 있으므로 여기서는 제목만 담당합니다. */
export function TransformRowHeader({ label }: { label: string }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold" style={{ color: "oklch(0.45 0.01 265)" }}>
      {label}
    </p>
  );
}

/**
 * 접었다 펼 수 있는 패널 섹션.
 *
 * 오른쪽 패널은 배경 이미지가 늘어나면 세로로 한없이 길어져 스크롤이 힘들어집니다.
 * 섹션 단위로 접을 수 있게 해서 필요한 영역만 펼쳐 쓰도록 합니다.
 */
export function PanelSection({
  title,
  count,
  open,
  onToggle,
  action,
  tour,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  /**
   * 튜토리얼 앵커(`data-tour`). 뿌리 <section> 에 답니다 — 접혀 있어도 머리줄은 그려지므로
   * 띄우는 쪽이 늘 잡을 수 있습니다. 이름은 `tutorials/ANCHORS.md` 표와 한 글자도 달라선 안 됩니다.
   */
  tour?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-tour={tour}
      style={{ borderTop: "1px solid oklch(1 0 0 / 7%)" }}
      className="pt-3 first:border-t-0 first:pt-0"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <button type="button" onClick={onToggle} className="flex flex-1 items-center gap-1.5 text-left">
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" style={{ color: "oklch(0.55 0.01 265)" }} />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "oklch(0.55 0.01 265)" }} />
          )}
          <span
            className="text-[11px] font-bold tracking-wide"
            style={{ color: "oklch(0.48 0.01 265)" }}
          >
            {title}
          </span>
          {typeof count === "number" && count > 0 && (
            <span
              className="rounded-full px-1.5 text-[9px] font-semibold"
              style={{ background: "oklch(1 0 0 / 8%)", color: "oklch(0.58 0.01 265)" }}
            >
              {count}
            </span>
          )}
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}

/** 고르기 버튼 한 줄. 패널마다 같은 모양이 반복돼서 하나로 뽑았습니다. */
export function ChoiceRow<T extends string>({
  value,
  options,
  onChange,
  columns = 3,
}: {
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const on = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.hint}
            className="rounded-md px-1 py-1.5 text-[10px]"
            style={{
              background: on ? "oklch(0.62 0.22 290 / 20%)" : "oklch(1 0 0 / 4%)",
              border: `1px solid ${on ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 7%)"}`,
              color: on ? "oklch(0.84 0.19 290)" : "oklch(0.64 0.01 265)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
