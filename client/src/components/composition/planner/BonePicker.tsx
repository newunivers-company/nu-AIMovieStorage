import { useEffect, useState } from "react";
import {
  BONE_PIE_ROOT,
  bonePiePath,
  type BonePieNode,
} from "@/lib/bonePieMenu";

/**
 * Tab 으로 여는 **관절 고르기** — 블렌더의 파이 메뉴처럼 마우스를 중심으로 둥글게.
 *
 * , 「처음엔 상체·왼쪽·오른쪽 3개만… 팔 누르면 팔·팔꿈치·손·손가락…
 * 그래야 순차적으로 자세를 맞추지(위치도 직관적으로 배치해 주고)」.
 *
 * # 왜 네모 목록이 아니라 원인가
 *
 * 네모 목록은 **화면 한 자리를 차지합니다.** 그 자리에 이름표나 알림이 있으면 겹치고,
 * 겹치지 않게 옮기면 이번엔 마우스에서 멉니다. 원형은 «지금 커서가 있는 곳» 이 곧 메뉴의
 * 한가운데라, 어디서 눌러도 손이 움직이는 거리가 같고 가리는 넓이도 작습니다.
 *
 * 방향으로 기억된다는 점이 더 큽니다 — 「왼쪽은 왼쪽, 다리는 아래」 가 몇 번 하면 손에
 * 붙어서 나중에는 읽지 않고 그쪽으로 밀게 됩니다. 그래서 자리는 항목 수로 균등 분할하지
 * 않고 `bonePieMenu.ts` 에 **사람이 적어 둔 각도**를 그대로 씁니다.
 *
 * # 한 걸음씩 내려갑니다
 *
 * 상체·왼쪽·오른쪽 → 팔·손·다리 → 팔·팔꿈치·손목·손가락 → 다섯 손가락 → 세 마디.
 * 한 고리에 서너 개만 두는 것이 핵심입니다 — 열다섯 개를 한 원에 늘어놓으면 라벨이
 * 겹치고, 무엇보다 «방향으로 외우기» 가 안 됩니다.
 */
export function BonePicker({
  activeBone,
  origin,
  onSelect,
  onClose,
}: {
  activeBone: string | null;
  /** Tab 을 누른 순간의 마우스 자리(화면 좌표). 여기가 원의 한가운데가 됩니다. */
  origin: { x: number; y: number };
  onSelect: (boneId: string) => void;
  onClose: () => void;
}) {
  /**
   * 지금까지 내려온 길. 마지막 칸이 화면에 보이는 고리입니다.
   *
   * 열 때 이미 관절을 잡고 있었다면 **그 관절이 있는 고리부터** 엽니다 — 팔꿈치를 만지다
   * Tab 을 누르는 이유는 대개 같은 팔의 다른 마디라서, 처음부터 내려오게 하면 손이 세 번
   * 더 갑니다.
   */
  const [trail, setTrail] = useState<BonePieNode[][]>(() => {
    const found = bonePiePath(activeBone);
    return found.length ? found : [BONE_PIE_ROOT];
  });
  const ring = trail[trail.length - 1];

  /*
    한 걸음 뒤로는 **Ctrl+Tab** 입니다.

     Esc 는 편집 창(Radix Dialog)을 닫는 키라, 첫 고리에서 한 번
    더 누르면 구도잡기가 통째로 닫혔습니다. Tab 이 여는 키니 그 짝으로 Ctrl+Tab 이 자연스럽습니다.
  */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (trail.length > 1) setTrail((path) => path.slice(0, -1));
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [trail.length, onClose]);

  /*
    고리 반지름. 한 고리에 서넛뿐이라 크게 잡을 이유가 없지만, 다섯이면 라벨이 닿아서
    조금 넓힙니다. 중심이 화면 밖으로 밀리지 않게 가장자리에서는 안쪽으로 당깁니다.
  */
  const radius = ring.length <= 3 ? 122 : 148;
  const margin = radius + 76;
  const center = {
    x: Math.min(Math.max(origin.x, margin), window.innerWidth - margin),
    y: Math.min(Math.max(origin.y, margin), window.innerHeight - margin),
  };

  /** 지금 어느 가지에 있는지 — 「왼쪽 · 팔」. 첫 고리에서는 안내 문구. */
  const where = trail
    .slice(1)
    .map((_, index) => {
      const parent = trail[index];
      const chosen = parent.find((node) => node.children === trail[index + 1]);
      return chosen?.label;
    })
    .filter(Boolean)
    .join(" · ");

  const pick = (node: BonePieNode) => {
    if (node.bone) {
      onSelect(node.bone);
      onClose();
      return;
    }
    if (node.children) setTrail((path) => [...path, node.children!]);
  };

  return (
    <div
      data-tour="bone-picker"
      className="fixed inset-0 z-[60]"
      // 바깥을 누르면 닫습니다 — 잘못 열었을 때 빠져나갈 자리가 있어야 합니다.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* 한가운데 점 — 원의 중심이 어디인지. 누르면 한 걸음 뒤로. */}
      <button
        type="button"
        onClick={() =>
          trail.length > 1 ? setTrail((path) => path.slice(0, -1)) : onClose()
        }
        title={trail.length > 1 ? "한 걸음 뒤로" : "닫기"}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: center.x,
          top: center.y,
          width: 30,
          height: 30,
          border: "2px solid oklch(0.72 0.01 265 / 70%)",
          background: "oklch(0 0 0 / 50%)",
        }}
      />
      <span
        className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold"
        style={{
          left: center.x,
          top: center.y - 36,
          color: "oklch(0.66 0.01 265)",
          textShadow: "0 0 6px oklch(0 0 0 / 95%)",
        }}
      >
        {where || "관절 고르기"}
      </span>
      <span
        className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[9px]"
        style={{
          left: center.x,
          top: center.y + 26,
          color: "oklch(0.46 0.01 265)",
          textShadow: "0 0 6px oklch(0 0 0 / 95%)",
        }}
      >
        {trail.length > 1 ? "Ctrl+Tab 뒤로" : "Tab 닫기"}
      </span>

      {ring.map((node) => {
        // 적어 둔 시계 각도를 화면 좌표로. 0이 12시라 −90° 만큼 돌립니다.
        const angle = ((node.at - 90) * Math.PI) / 180;
        const on = Boolean(node.bone) && node.bone === activeBone;
        return (
          <button
            key={node.key}
            type="button"
            onClick={() => pick(node)}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
            style={{
              left: center.x + Math.cos(angle) * radius,
              top: center.y + Math.sin(angle) * radius,
              background: on
                ? "oklch(0.62 0.22 290 / 46%)"
                : "oklch(0.16 0.01 265 / 96%)",
              border: `1px solid ${on ? "oklch(0.74 0.18 290)" : "oklch(1 0 0 / 14%)"}`,
              color: on ? "oklch(0.94 0.08 290)" : "oklch(0.86 0.01 265)",
              boxShadow: "0 6px 18px oklch(0 0 0 / 55%)",
            }}
          >
            {node.label}
            {/* 더 내려가는 가지는 점으로 알려 줍니다 — 누르면 끝인지 아닌지 미리 보이게. */}
            {!node.bone && (
              <span
                className="ml-1 text-[9px] font-normal"
                style={{ color: "oklch(0.52 0.01 265)" }}
              >
                ›
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default BonePicker;
