/*
  타임라인이 쓰는 **상수와 작은 부품**들.

  `MoveTimeline.tsx` 가 3,400줄이 되면서 「이 상수가 어디 있더라」 를 찾는 데 시간이 더 걸렸습니다.
  그리는 일(레이어 줄)과 **말**(채널 이름·단위·프리셋)을 갈라 둡니다 — 여기 있는 것은 전부
  화면과 무관하게 혼자 말이 되는 것들입니다. (2026-09-17 분리)
*/

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { type CameraMove, type ShotPreset } from "@/lib/cameraMoves";

export const MOTION_CHANNELS = [
  { id: "position" as const, label: "이동", color: "oklch(0.86 0.16 90)" },
  { id: "rotation" as const, label: "회전", color: "oklch(0.78 0.16 200)" },
  { id: "scale" as const, label: "크기", color: "oklch(0.80 0.18 320)" },
  // 인물만 — 관절마다의 회전을 한 장에 담은 키(`MotionKey.bones`).
  { id: "pose" as const, label: "자세", color: "oklch(0.80 0.15 145)" },
];

/** 이 키가 **마지막**인가 — 뒤에 이어질 구간이 없는가. */
export const isLastKey = <T extends { id: string; time: number }>(keys: T[], key: T) =>
  !keys.some((item) => item.time > key.time + 0.0001);

/**
 * 타임라인 줄의 숫자칸 — 줄에 선 단추들과 **같은 키**여야 합니다.
 *
 * 공용
 * `NumberInput` 은 패널용이라 이 좁은 줄에서는 혼자 커서 눈에 걸립니다.
 */
export const TIMELINE_FIELD =
  "rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums outline-none";
export const timelineFieldStyle = () => ({
  background: "oklch(1 0 0 / 7%)",
  border: "1px solid oklch(1 0 0 / 10%)",
  color: "oklch(0.88 0.01 265)",
});

/**
 * 손떨림의 **기준값**. 「핸드헬드로 찍으려면 몇 프로?」 에 답하는 자리입니다.
 *
 * 숫자만 있으면 0.25 가 센지 약한지 알 수가 없습니다. 찍는 방식의 이름을 붙여 두면
 * 「어깨에 올린 느낌」 을 고르면 되지, 수치를 외울 필요가 없습니다.
 */
export const HANDHELD_PRESETS = [
  { value: 0, label: "0", hint: "삼각대 — 완전히 고정" },
  { value: 0.12, label: "12", hint: "어깨에 올린 느낌 — 아주 옅은 숨결" },
  { value: 0.25, label: "25", hint: "손으로 든 다큐멘터리 — 흔한 핸드헬드" },
  { value: 0.5, label: "50", hint: "뛰면서 따라가는 카메라" },
  { value: 0.8, label: "80", hint: "흔들어 찍는 액션 — 아주 거칠게" },
];

export const channelOf = (id: string) =>
  MOTION_CHANNELS.find((item) => item.id === id) ?? MOTION_CHANNELS[0];

/**
 * 자유 경로 키의 **갈래별 줄**. 인물 트랙과 같은 짜임입니다.
 *
 * 「회전」 을 각도가 아니라 «바라보는 곳» 으로 두는 까닭: 카메라 각도는 같은 그림을
 * 만드는 값이 여럿이라(짐벌) 손으로 맞추기가 아주 어렵습니다. 3D 화면의 그 점을 그대로
 * 적으면 되는 쪽이 훨씬 정확합니다.
 */
export const CAMERA_KEY_ROWS = [
  { id: "position" as const, label: "이동", color: "oklch(0.86 0.16 90)" },
  {
    id: "target" as const,
    label: "바라보는 곳",
    color: "oklch(0.78 0.16 200)",
  },
  { id: "fov" as const, label: "줌", color: "oklch(0.80 0.18 320)" },
];

/**
 * 어두운 화면에 맞춘 **고르기 단추**.
 *
 * 브라우저 기본 `<select>` 의 펼친
 * 목록은 **운영체제가 그립니다** — 흰 바탕에 우리 글자색(하늘색)이 얹혀 거의 안 보였습니다.
 * `option` 에 색을 줘도 웹뷰마다 먹고 안 먹고가 달라 믿을 수가 없습니다. 그래서 목록까지
 * 직접 그립니다.
 *
 * 바깥을 누르면 닫히고, 화면 아래에 붙은 판이라 목록은 **위로** 폅니다.
 */
export function TimelineSelect({
  value,
  options,
  onChange,
  title,
  width,
  tone,
  placeholder,
  onBlocked,
  tour,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  title?: string;
  width?: number;
  /** 고른 것이 «기본이 아님» 을 알릴 때 켭니다 — 색으로 한눈에 보이게. */
  tone?: boolean;
  placeholder?: string;
  /** 고를 것이 없을 때 눌렀다면. 왜 못 고르는지 알려 주는 자리입니다. */
  onBlocked?: () => void;
  /** 튜토리얼 앵커(`data-tour`). 클립 줄마다 같은 이름이 달려도 띄우는 쪽이 첫 것을 잡습니다. */
  tour?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  /**
   * 펼친 목록의 **화면 좌표**. null 이면 닫혀 있습니다.
   *
   *
   * 클립 줄 목록이 `overflow-y: auto` 라, 그 안에 `absolute` 로 띄운 목록이 **잘려서**
   * 아예 안 보였습니다. 어느 클립이냐가 아니라 줄이 아래쪽일수록 심했어요.
   *
   * 그래서 목록만 `position: fixed` 로 띄우고 자리는 단추의 화면 좌표에서 잽니다 —
   * 잘리는 조상이 없어집니다. 화면 아래에 붙은 판이라 **위로** 폅니다.
   */
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  const picked = options.find((item) => item.id === value);

  const open = () => {
    if (!options.length) {
      onBlocked?.();
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAt({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
  };

  return (
    <div className="relative" data-tour={tour} style={{ width }}>
      <button
        ref={buttonRef}
        type="button"
        title={title}
        onClick={() => (at ? setAt(null) : open())}
        className="flex w-full items-center gap-0.5 truncate rounded px-1 py-0.5 text-left text-[8px] font-semibold"
        style={{
          background: tone ? "oklch(0.55 0.15 200 / 28%)" : "oklch(1 0 0 / 6%)",
          color: tone ? "oklch(0.88 0.13 200)" : "oklch(0.62 0.01 265)",
          border: `1px solid ${tone ? "oklch(0.62 0.15 200 / 55%)" : "oklch(1 0 0 / 10%)"}`,
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          {picked?.label ?? placeholder ?? "고르기"}
        </span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
      </button>
      {at && (
        <>
          {/* 바깥을 눌러 닫기. 목록보다 아래에 깔아 둡니다. */}
          <div
            className="fixed inset-0 z-[130]"
            onPointerDown={() => setAt(null)}
          />
          <div
            className="composition-scroll fixed z-[140] max-h-56 min-w-[7rem] overflow-y-auto rounded-md py-0.5"
            style={{
              left: at.left,
              bottom: at.bottom,
              background: "oklch(0.16 0.01 265)",
              border: "1px solid oklch(1 0 0 / 14%)",
              boxShadow: "0 12px 32px oklch(0 0 0 / 65%)",
            }}
          >
            {options.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setAt(null);
                }}
                className="block w-full truncate px-2 py-1 text-left text-[10px] font-semibold"
                style={{
                  background:
                    item.id === value
                      ? "oklch(0.55 0.15 200 / 26%)"
                      : "transparent",
                  color:
                    item.id === value
                      ? "oklch(0.90 0.13 200)"
                      : "oklch(0.84 0.01 265)",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 이동량의 **단위**. 같은 숫자라도 오빗은 도, 달리는 미터, 줌은 배율입니다.
 *
 * 입력 창에 단위가 없으면 「90」 이 90도인지 90m 인지 알 수가 없습니다 — 달리에 90을
 * 넣으면 카메라가 90m 를 날아갑니다.
 */
export const amountUnitOf = (kind?: string) =>
  kind === "zoom" ? "배" : kind === "orbit" || kind === "pan" ? "°" : "m";

/**
 * 「−2.5」 가 **어느 정도인지** 한 줄로 적습니다.
 *
 * 숫자만 있고 기준이 없으면 몇을 넣어야 할지 알 수가 없습니다 —
 * 지금 씬의 거리로, 그리고 부호의 뜻으로 말해 줍니다.
 */
export function amountHintOf(preset: ShotPreset | undefined, move: CameraMove) {
  const kind = preset?.kind;
  if (kind === "orbit" || kind === "pan")
    return "도(°) — 90이면 4분의 1 바퀴, 180이면 반 바퀴. 음수는 반대 방향입니다.";
  if (kind === "zoom")
    return "배율 — 2면 두 배로 당기고(화각 절반), 0.5면 두 배로 넓힙니다.";
  const a = move.anchor;
  return `미터(m) — 음수면 기준점 쪽으로 다가갑니다. 기준점은 (${a.x.toFixed(1)}, ${a.y.toFixed(1)}, ${a.z.toFixed(1)}) 에 있습니다.`;
}

/**
 * 이름표가 앉는 왼쪽 칸의 너비(px).
 *
 * 예전에는 이름표를 시간 줄 **위에 겹쳐** 놓았습니다. 그래서 0초에 키를 찍으면 마름모가
 * 이름을 덮어 「수화」 가 「화」 로 보였습니다. 애프터이펙트처럼
 * 왼쪽에 칸을 따로 내어 이름과 손잡이를 두고, 오른쪽만 시간 축으로 씁니다.
 *
 * 눈금자도 같은 칸을 비워 둡니다 — 그래야 모든 줄의 «0초» 가 한 세로선에 섭니다.
 */
export const GUTTER = 104;

/**
 * 왼쪽 이름 칸의 공통 스타일.
 *
 *
 * 확대하면 판이 옆으로 길어져 가로로 굴러가는데, 이름 칸까지 함께 굴러가면
 * «지금 보는 줄이 누구 것인지» 를 알 수 없습니다. 그래서 **왼쪽에 붙여 둡니다**.
 *
 * 배경색이 꼭 필요합니다 — 투명하면 굴러 들어온 키프레임이 이름 뒤로 비칩니다.
 */
export const gutterStyle = {
  width: GUTTER,
  position: "sticky" as const,
  left: 0,
  zIndex: 6,
  background: "oklch(0.13 0.008 265)",
};

export const ANCHOR_SPOTS = [
  // 사람 키를 1 로 본 실제 비율. 처음 값(0.62 / 0.45)이 한 칸씩 아래였습니다.
  { id: "head", label: "머리", ratio: 0.9 },
  { id: "chest", label: "가슴", ratio: 0.73 },
  { id: "waist", label: "허리", ratio: 0.62 },
  { id: "feet", label: "발", ratio: 0.04 },
] as const;
