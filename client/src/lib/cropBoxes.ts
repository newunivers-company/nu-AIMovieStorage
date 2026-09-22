import type { FaceKey } from "@/lib/faceSets";
import type { ImageMark } from "@/components/ImageMarkupEditor";

/**
 * **칸 상자** — 시트 위에 끌어 그리는 사각형 하나의 뜻과, 그 자리를 재는 순수 계산.
 *
 * 2026-09-18 에 `SheetPanelCropper.tsx` 에서 떼어 냈습니다. 그리기 면과 목록 판이
 * 저마다 같은 계산을 필요로 하는데, 창 본문 안에 있으면 떼어 낼 수가 없었습니다.
 */

/**
 * 상자가 하는 일.
 *
 * - crop — 그 자리를 잘라 따로 파일로 저장합니다.
 * - erase — 그 자리를 배경색으로 덮어 없앱니다.
 *
 * 지우기가 필요한 이유는 생성기가 시키지 않은 물건을 자꾸 그려 넣기 때문입니다.
 * 손 칸을 뽑으면 손에 기계를 쥐여 주고, 발 칸을 뽑으면 바닥에 그림자 아닌 것이
 * 깔립니다. 손은 «무언가를 잡는 것» 이라고 배운 탓이라 프롬프트로 완전히
 * 막기는 어렵습니다.
 *
 * 그림 한 칸이 통째로 못 쓰게 된 것이 아니라 **한 귀퉁이만 걸리적거리는** 경우가
 * 대부분이라, 다시 뽑는 것보다 그 자리만 덮는 편이 빠릅니다.
 *
 * 지우기는 자르기보다 **먼저** 적용됩니다. 거슬리는 것을 없앤 다음 그 상태에서
 * 칸을 떠내야, 잘라 낸 레퍼런스에도 그 물건이 안 따라 들어갑니다.
 */
export type BoxMode = "crop" | "erase";

export interface CropBox {
  id: string;
  /** 두 점 모두 0~1 비율입니다. */
  points: { x: number; y: number }[];
  /** 파일 이름에 들어갈 말. 자르기 상자는 비어 있으면 저장할 수 없습니다. */
  name: string;
  mode: BoxMode;
  /**
   * 덮을 색. 비어 있으면 **상자 둘레의 색을 평균 내어** 씁니다.
   *
   * 배경 위의 물건이면 둘레가 곧 배경이라 자동이 잘 맞습니다. 다만 상자가 칸
   * 테두리에 걸치면 검은 선까지 섞여 탁해지므로, 그럴 때는 직접 고릅니다.
   */
  fill?: string;
}

/** 이 창이 내놓는 파일 하나. 받는 쪽(생성 이미지 선반·프롬프트 카드)이 kind 로 갈라 넣습니다. */
export interface CropperSavedFile {
  path: string;
  name: string;
  marks?: ImageMark[];
  /**
   * 어느 도구에서 나왔는지.
   *
   * 지운 판은 원래 «표시한 그림» 과 같은 `"mark"` 로 넘겼습니다. 그러자 받는 쪽마다 처리가
   * 갈렸습니다 — 프롬프트 카드는 `"mark"` 를 버려 등록조차 안 됐고, 선반은 경로 하나에만
   * 기대 등록했습니다. 지운 판은 이제 제 이름(`"erase"`)으로 갑니다.
   *
   * `"upscale"` 은 편집하지 않고 원본만 키운 새 파일(`…_업스케일_NNN`)입니다 — 원본 옆에 남습니다.
   *
   * `"motionMask"` 는 «여기는 움직인다» 흑백 마스크(`…_움직임_NNN`)입니다. 표시한 그림과
   * 갈라 두는 까닭은 **쓰임이 다르기 때문**입니다 — 표시한 그림은 사람·LLM 이 읽는 그림이고,
   * 마스크는 영상 생성기에 조건으로 물리는 판입니다. 같은 이름으로 넘기면 알림이 「표시한
   * 그림을 저장했습니다」 라고만 말해, 마스크를 구운 사람이 제대로 됐는지 알 수 없습니다.
   */
  kind: "crop" | "mark" | "panorama" | "erase" | "upscale" | "motionMask";
  /**
   * 방금 만든 그림의 blob 주소. 받는 쪽이 `assetSrc(filePath)` 를 못 읽었을 때 대신 보여 줍니다.
   * 앱을 닫으면 죽는 주소라 폴백으로만 씁니다 — 저장된 파일이 먼저입니다.
   */
  thumb?: string;
  /**
   * 파노라마에서 잘라낸 여섯 면 중 어느 면인지와 세트 id(`<접두>_<NNN>`).
   * 받는 쪽이 `GeneratedImageAsset.face`/`faceSet` 에 그대로 옮겨야 이름을 다시 파싱하지 않고 세트를
   * 알아봅니다 — 예전에는 여기서 면을 받고도 버려서 등록 경로마다 유실됐습니다.
   */
  face?: FaceKey;
  faceSet?: string;
}

/** 저장하기 전에 보여 주는 결과. 지운 판 한 장과 잘라낼 칸들의 작은 그림. */
export interface PreviewResult {
  /** 지우기가 적용된 판 전체(blob 주소). 지우기 상자가 없으면 빈 문자열 — 원본과 같습니다 */
  url: string;
  width: number;
  height: number;
  crops: { boxId: string; url: string; width: number; height: number }[];
}

/** 지우기 상자는 번호 대신 한 가지 색으로 통일합니다. 자르기와 헷갈리면 안 됩니다. */
export const ERASE_COLOR = "#f43f5e";

export const CROP_COLORS = [
  "#ff5b5b",
  "#ffb020",
  "#4ade80",
  "#38bdf8",
  "#c084fc",
  "#f472b6",
];

/** 미리보기 칸 그림의 긴 변. 원본 해상도로 만들면 6000 시트에서 칸마다 수 MB 가 됩니다. */
export const PREVIEW_CROP_SIZE = 320;

/** 상자를 그리고 이만큼 손을 멈추면 미리보기를 다시 만듭니다. 매 픽셀마다 만들면 큰 시트에서 버벅입니다. */
export const PREVIEW_DEBOUNCE_MS = 300;

export function cropColor(index: number) {
  return CROP_COLORS[index % CROP_COLORS.length];
}

export function boxRect(box: CropBox) {
  const [first, last] = [box.points[0], box.points[box.points.length - 1]];
  return {
    left: Math.min(first.x, last.x),
    top: Math.min(first.y, last.y),
    width: Math.abs(last.x - first.x),
    height: Math.abs(last.y - first.y),
  };
}

/** 상자를 원본 픽셀 자리로 환산합니다. 미리보기와 저장이 같은 자리를 떠내야 하니 한 곳에서. */
export function pixelRect(box: CropBox, width: number, height: number) {
  const rect = boxRect(box);
  return {
    x: Math.round(rect.left * width),
    y: Math.round(rect.top * height),
    w: Math.max(1, Math.round(rect.width * width)),
    h: Math.max(1, Math.round(rect.height * height)),
  };
}

/** 지우기 상자들만의 지문. 같으면 지운 판을 다시 굽지 않습니다. */
export function eraseKey(imageSrc: string, list: CropBox[]) {
  return JSON.stringify([
    imageSrc,
    list
      .filter((box) => box.mode === "erase")
      .map((box) => [boxRect(box), box.fill || ""]),
  ]);
}
