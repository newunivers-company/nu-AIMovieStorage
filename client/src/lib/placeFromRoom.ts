import {
  CUBEMAP_CHIP_ID,
  DOME_CHIP_ID,
  ROOM_INNER_CHIP_ID,
  ROOM_OUTER_CHIP_ID,
} from "@/lib/blueprint";
import { newBackground, type Background } from "@/lib/projectTypes";

/**
 * 구도잡기의 **방 하나**를 그대로 담은 장소 카드.
 *
 * 배경 만들기가 따로 떨어진 탭일 이유가 없습니다 — 배경과 배경 에셋을 만들어 짝짓는 일이
 * 구도잡기 안에서 한 번에 돕니다.
 *
 * # 크기를 두 번 적지 않게
 *
 * 전개도·돔 프롬프트는 «몇 미터짜리 공간인가» 를 문장에 박아 넣습니다(`unfoldPrompt.ts`). 그 숫자를 장소 카드에서 손으로 다시
 * 적으면 구도잡기의 방과 어긋나고, 어긋나면 6면을 걸었을 때 사람 대비 나무·벽 크기가 틀어집니다. 그래서 방에서 바로 만듭니다 —
 * 카드에는 그 방의 가로·깊이·층고가 이미 적혀 있고, 뽑아 온 그림은 자동 커팅이 같은 크기로 잘라 그 방에 겁니다.
 *
 * 실외(전개도·돔)는 **한 변**만 씁니다(`spaceForChips` 의 규칙 — 실외 크기는 방 크기와 따로 관리). 방이 정사각이 아니면 긴 변을
 * 씁니다: 공터는 둘레까지의 거리가 반지름이라, 짧은 변을 쓰면 실제보다 좁은 공터가 됩니다.
 */
export function placeFromRoom(spec: {
  kind: "outdoor" | "dome" | "roomInner" | "roomOuter";
  /** 방 이름(«방 1»). 장면 이름과 합쳐 카드 이름이 됩니다. */
  name: string;
  width: number;
  depth: number;
  height: number;
  /** 장면 제목 — 있으면 «장면 · 방» 으로 이름을 짓습니다. */
  sceneTitle?: string;
}): Background {
  const outdoor = spec.kind === "outdoor" || spec.kind === "dome";
  const background = newBackground(outdoor ? "exterior" : "interior");
  const round = (value: number) => Math.round(value * 10) / 10;
  const side = round(Math.max(spec.width, spec.depth));
  const chip =
    spec.kind === "outdoor"
      ? CUBEMAP_CHIP_ID
      : spec.kind === "dome"
        ? DOME_CHIP_ID
        : spec.kind === "roomOuter"
          ? ROOM_OUTER_CHIP_ID
          : ROOM_INNER_CHIP_ID;
  const suffix =
    spec.kind === "outdoor" ? "실외" : spec.kind === "dome" ? "돔" : spec.kind === "roomOuter" ? "바깥면" : "";
  const name = [spec.sceneTitle?.trim(), spec.name.trim(), suffix].filter(Boolean).join(" · ") || "새 장소";
  return {
    ...background,
    name,
    // 실외 돔용 카드는 «파노라마» 로 표시해 둡니다 — 방의 장소 목록을 이 표시로 가릅니다.
    usage: spec.kind === "dome" ? ("dome" as const) : undefined,
    // 크기는 칩 갈래에 맞는 자리에 적습니다 — 실외는 한 변, 실내는 가로·깊이·층고.
    panoramaSpace: outdoor ? undefined : { width: round(spec.width), depth: round(spec.depth), height: round(spec.height) },
    exteriorSpace: outdoor ? { width: side, depth: side, height: side } : undefined,
    // 기본 마스터 칩은 그대로 두고 전개도·돔 칩을 더합니다 — 마스터 한 장이 있어야 색과 빛을 정합니다.
    blueprint: [...background.blueprint, chip],
  };
}
