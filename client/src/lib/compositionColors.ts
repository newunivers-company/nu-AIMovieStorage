import type { CompositionState } from "@/lib/composition";
import { BODY_COLORS, mannequinBody } from "@/lib/rig";

/**
 * 구도에 선 사람들의 **몸 색을 정하는 한 곳**.
 *
 * # 왜 한 곳이어야 하나
 *
 * 캡처 그림에는 이름표가 안 나갑니다. 그래서 «누가 누구인가» 를 가리는 것은
 * **색뿐**이고, 프롬프트도 「파란 사람은 @냥이_시트_001」 처럼 색 이름으로 짝을 맞춥니다
 * (`compositionLegend`). 색이 틀리면 캐릭터가 통째로 바뀝니다.
 *
 * 그런데 같은 계산이 **세 군데**에 흩어져 있었습니다 — 3D 화면(`CompositionViewport`),
 * 왼쪽 목록의 점(`LayoutPanel`), 프롬프트 대조표(`compositionLegend`). 셋이 세는 순번이
 * 조금씩 달라서, 목록에서는 다른 색인데 화면에서는 같은 색인 일이 생겼습니다.
 * 이제 셋 다 이 표를 봅니다.
 *
 * # 왜 순번을 안 쓰나
 *
 * 예전에는 `palette[index % 4]` 였습니다. 성별 팔레트가 넷뿐이라 **다섯 번째 사람부터 돌아**
 * 앞사람과 같은 색이 됐습니다 — 다섯 명이 선 구도에서 둘이 같은 색으로 그려졌습니다.
 * 여기서는 **이미 쓴 색을 피해** 가며 나눠 줍니다 — 색이 남아 있는 한 겹치지 않습니다.
 */

/**
 * 손으로 못 박을 수 있는 색 한 벌.
 *
 * 자동 색(`BODY_COLORS`)과 **겹치지 않게** 골랐습니다 — 자동으로 받은 사람과 못 박은 사람이
 * 같은 색이면 못 박은 뜻이 없습니다. 회색 계열을 둔 까닭은 엑스트라를 전부 한 색으로 묶을 때입니다 —
 * 이름을 짝지을 일이 없는 사람들은 색을 나눠 봐야 표만 길어집니다.
 */
export const MANNEQUIN_COLORS = [
  "#d94f4f",
  "#e08a2e",
  "#e6c33f",
  "#6fbf59",
  "#3fb6a8",
  "#4a86d6",
  "#8a63d2",
  "#d46fb0",
  "#8a8f99",
  "#f2f2f2",
];

/** 성별 팔레트를 다 쓰면 넘어갈 곳 — 다른 성별 색, 그다음 못 박는 색. */
const FALLBACK_POOL = [
  ...BODY_COLORS.male,
  ...BODY_COLORS.female,
  ...BODY_COLORS.neutral,
  ...MANNEQUIN_COLORS,
];

const key = (hex: string) => hex.trim().toLowerCase();

/**
 * 인물 하나가 못 박아 둔 색. 없으면 `undefined` 입니다.
 *
 * 자리(`characters[].color`)를 먼저 보고, 없으면 마네킹 기록(`mannequins[].color`)을 봅니다.
 * 마네킹 쪽은 옛 저장본이 쓰던 자리라 계속 읽어 줍니다.
 */
export function pinnedColorOf(
  composition: CompositionState,
  characterId: string,
): string | undefined {
  const placed = composition.characters.find((item) => item.characterId === characterId);
  if (placed?.color) return placed.color;
  return composition.mannequins.find((item) => item.id === characterId)?.color;
}

/**
 * 지금 서 있는 사람 전부의 **몸 색 표**.
 *
 * 숨긴 사람도 넣습니다 — 다시 켰을 때 색이 바뀌면 프롬프트에 적어 둔 짝이 어긋납니다.
 * 순서는 `composition.characters` 그대로라, 사람을 더해도 앞사람 색은 그대로입니다.
 */
export function characterColorMap(
  composition: CompositionState,
  genderOf: (characterId: string) => string | undefined,
): Map<string, string> {
  const colors = new Map<string, string>();
  const used = new Set<string>();

  // 1) 못 박은 색이 먼저 자리를 차지합니다. 자동 색은 그 색을 피해 갑니다.
  composition.characters.forEach((placement) => {
    const pinned = pinnedColorOf(composition, placement.characterId);
    if (!pinned) return;
    colors.set(placement.characterId, pinned);
    used.add(key(pinned));
  });

  // 2) 나머지는 성별 팔레트에서 **아직 안 쓴 색**부터.
  composition.characters.forEach((placement, index) => {
    if (colors.has(placement.characterId)) return;
    const gender = genderOf(placement.characterId) ?? placement.gender;
    const palette = BODY_COLORS[mannequinBody(gender)];
    const free =
      palette.find((hex) => !used.has(key(hex))) ??
      FALLBACK_POOL.find((hex) => !used.has(key(hex)));
    // 열두 색 + 못 박는 색까지 다 썼으면 그때는 어쩔 수 없이 돕니다.
    const hex = free ?? palette[index % palette.length];
    colors.set(placement.characterId, hex);
    used.add(key(hex));
  });

  return colors;
}
