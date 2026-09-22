/**
 * 계보 패널을 늘어놓는 자리.
 *
 * # 왜 격자가 아니라 흐름인가
 *
 * 처음에는 «한 칸 최소 420px» 격자였습니다. 열 수를 못 박는 것보다는 나았지만
 * 여전히 **칸 폭이 내용과 상관없이 정해졌습니다.** 변형을 하나 만들면 안쪽
 * 계보가 두 열이 되어 420px 을 넘고, 그 순간 패널 안에 가로 스크롤바가
 * 생겼습니다. 계보를 한눈에 보라고 만든 패널인데 스크롤을 밀어야 자녀가
 * 보였습니다.
 *
 * 그래서 격자를 걷어내고 **패널이 자기 내용만큼 자리를 차지하게** 했습니다.
 * 변형이 늘면 패널이 옆으로 늘어나고, 한 줄에 안 들어가면 다음 줄로 넘어갑니다.
 *
 * 캐릭터·배경·에셋이 이 하나를 같이 씁니다. 여기만 고치면 셋이 같이 바뀝니다.
 */
export const LINEAGE_GRID = "flex flex-wrap items-start gap-3";

/** 계보 카드 한 장 폭. `LineageTree` 의 `w-[210px]` 과 같아야 합니다 */
const CARD = 210;
/** 카드 사이 간격. `LineageTree` 의 `gap-6` */
const CARD_GAP = 24;
/** 작은 카드(보유 애셋 미니 계보) 폭. `LineageTree compact` 의 `w-[132px]` */
const COMPACT_CARD = 132;
/** 작은 카드 사이 간격. `LineageTree compact` 의 `gap-4` */
const COMPACT_GAP = 16;
/** 패널 좌우 안쪽 여백. `EntityLineagePanel` 의 `p-4` 양쪽 */
const PADDING = 32;
/** 「보유 애셋」 상자의 좌우 안쪽 여백. `OwnedAssetLineage` 의 `p-3` 양쪽 */
const BOX_PADDING = 24;
/**
 * 세로 스크롤바 자리.
 *
 * 계보 자리에 `overflow-x` 를 주면 세로도 `auto` 로 계산됩니다. 폭이 한 뼘
 * 모자라 가로 스크롤바가 생기면 그 두께 때문에 세로까지 넘쳐 **세로
 * 스크롤바가 따라 생기고, 그게 다시 폭을 깎아** 가로 스크롤바가 굳어집니다.
 * 처음부터 그 자리를 비워 두면 둘 다 안 생깁니다.
 */
const SCROLLBAR = 12;
/**
 * 계보가 한 열뿐이어도 이만큼은 잡습니다.
 *
 * 카드는 210px 이면 되지만 밑에 「보유 애셋」 상자와 「시트 제작」 단추가 붙습니다.
 * 그것들이 눌리지 않는 폭입니다.
 */
const CHROME = 420;

/** 갈래별 강조색. 계보 선·«변형» 글자·배지가 이 색을 씁니다 */
export function lineageAccent(kind: "character" | "background" | "asset"): string {
  return kind === "background"
    ? "oklch(0.72 0.14 200)"
    : kind === "asset"
      ? "oklch(0.78 0.16 160)"
      : "oklch(0.78 0.18 290)";
}

/**
 * 계보가 몇 열인가 — 원본만 있으면 1, 변형 하나면 2, 변형의 변형까지면 3.
 *
 * 이 값이 패널 폭을 정합니다. 변형이 늘어도 패널 폭이 그대로면 안쪽에 가로 스크롤바가
 * 생겨서 부모와 자녀를 같이 볼 수 없습니다. 인물 계보와 보유 애셋의 미니 계보가
 * 같은 셈을 씁니다.
 */
export function lineageColumns(variations: { id: string; parentVariationId?: string }[]): number {
  const depthOf = (variation: { id: string; parentVariationId?: string }): number => {
    let depth = 1;
    let parentId = variation.parentVariationId;
    while (parentId) {
      const parent = variations.find((item) => item.id === parentId);
      if (!parent) break;
      parentId = parent.parentVariationId;
      depth += 1;
      if (depth > 12) break; // 고리가 생겨도 멈춥니다
    }
    return depth;
  };
  return variations.reduce((deepest, item) => Math.max(deepest, depthOf(item) + 1), 1);
}

/**
 * 계보 깊이에 맞는 패널 최소 폭.
 *
 * `columns` 는 인물 계보가 몇 열인지, `compactColumns` 는 패널 안 「보유 애셋」 상자의
 * 미니 계보 중 가장 깊은 것이 몇 열인지(없으면 0). 둘 중 넓은 쪽이 폭을 정합니다.
 *
 * 미니 계보 폭을 **미리** 셈하는 이유: `LineageTree` 는 스크롤 상자가 아닙니다(그 파일의
 * 주석 참조 — 스크롤바가 폭을 깎아 스스로를 유지하는 고리). 상자 안에 `overflow-x` 를 두면
 * 같은 고리가 되살아납니다. 변형이 깊은 보유 애셋이 있으면 패널이 옆으로 넓어지는 것이
 * 의도된 동작입니다.
 */
export function lineagePanelStyle(columns: number, compactColumns = 0) {
  const needed = CARD * columns + CARD_GAP * Math.max(columns - 1, 0) + PADDING + SCROLLBAR;
  const neededCompact = compactColumns
    ? COMPACT_CARD * compactColumns +
      COMPACT_GAP * Math.max(compactColumns - 1, 0) +
      PADDING +
      SCROLLBAR +
      BOX_PADDING
    : 0;
  const min = Math.max(CHROME, needed, neededCompact);
  // 자라지는 않습니다(0). 하나뿐일 때 화면을 통째로 먹으면 카드 오른쪽이
  // 텅 비고 밑의 단추만 우스꽝스럽게 길어집니다. 필요한 만큼만 차지하고
  // 남는 자리는 다음 패널이 씁니다.
  //
  // 창이 좁으면 100% 로 묶습니다 — 아니면 패널이 화면 밖으로 밀려납니다.
  return { flex: `0 1 ${min}px`, minWidth: `min(100%, ${min}px)` } as const;
}
