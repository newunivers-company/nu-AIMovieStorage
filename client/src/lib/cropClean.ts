import { eraseKey, pixelRect, type CropBox } from "@/lib/cropBoxes";
import { loadImageForCanvas } from "@/lib/mediaLibrary";
import { toBlob } from "@/lib/canvasBlob";

/** 구운 «지운 판» 한 벌. 지우기 지문이 같으면 이것을 그대로 씁니다. */
export interface CleanCanvas {
  key: string;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** 지운 판의 blob 주소. 지우기 상자가 없으면 빈 문자열(원본과 같습니다). */
  url: string;
}

/**
 * **지우기를 먼저 적용한 판** 굽기 — 칸 자르기 창의 캔버스 작업.
 *
 * 2026-09-18 에 `SheetPanelCropper.tsx` 에서 떼어 냈습니다. 화면 요소가 하나도 없는
 * 캔버스 계산인데, 미리보기와 저장이 **같은 판**을 써야 한다는 것이 이 코드의 핵심이라
 * (안 그러면 미리보고 저장한 그림이 달라집니다) 창 본문에 묻혀 있으면 안 됩니다.
 */

/**
 * 상자 둘레의 색을 평균 냅니다.
 *
 * 배경 위에 놓인 물건이면 둘레가 곧 배경이라, 그 색으로 덮으면 자국이
 * 안 보입니다. 시트 배경은 대개 고정 회색이라 특히 잘 맞습니다.
 */
export function borderAverage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.15));
  const sx = Math.max(0, x - pad),
    sy = Math.max(0, y - pad);
  const sw = Math.min(ctx.canvas.width - sx, w + pad * 2);
  const sh = Math.min(ctx.canvas.height - sy, h + pad * 2);
  if (sw <= 0 || sh <= 0) return "#808080";
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let py = 0; py < sh; py += 1) {
    for (let px = 0; px < sw; px += 1) {
      // 안쪽(지울 자리)은 빼고 테두리 띠만 셉니다.
      const inside = px >= pad && px < sw - pad && py >= pad && py < sh - pad;
      if (inside) continue;
      const i = (py * sw + px) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  if (!n) return "#808080";
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

/**
 * 지우기를 먼저 적용한 판을 만듭니다.
 *
 * 거슬리는 것을 없앤 다음 그 상태에서 칸을 떠내야, 잘라 낸 레퍼런스에도
 * 그 물건이 안 따라 들어갑니다. 원본 파일은 건드리지 않습니다.
 *
 * 그림은 `loadImageForCanvas` 로 읽습니다 — 형제 기능(파노라마·표시·시트 합성)과 같은 길입니다.
 * `asset://` 를 `<img>` 에 그대로 물려 캔버스에 그리면 오염되어 내보낼 수 없다는 것이 이 앱의
 * 규칙이고, 여기만 `crossOrigin` 으로 따로 가던 것을 통일했습니다(09 로드맵 §5 의 «일관성 문제»).
 * `blob:` 주소여도 fetch 가 되니 원본이 아직 폴더에 없는 그림도 됩니다.
 *
 * 지우기 지문이 같으면 이미 만든 캔버스를 그대로 돌려줍니다 — 미리보기가 만든 것을 저장이
 * 다시 굽지 않습니다.
 */
export async function buildCleanCanvas(
  imageSrc: string,
  list: CropBox[],
  /** 앞서 구운 판. 지문이 같으면 다시 굽지 않습니다 — 미리보기가 만든 것을 저장이 또 굽지 않게. */
  cache: { current: CleanCanvas | null },
): Promise<CleanCanvas | null> {
  const key = eraseKey(imageSrc, list);
  if (cache.current?.key === key) return cache.current;
  const image = await loadImageForCanvas(imageSrc);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  const erases = list.filter((box) => box.mode === "erase");
  for (const box of erases) {
    const { x, y, w, h } = pixelRect(box, width, height);
    ctx.fillStyle = box.fill || borderAverage(ctx, x, y, w, h);
    ctx.fillRect(x, y, w, h);
  }
  // 지운 판의 blob 주소는 지우기 상자가 있을 때만 만듭니다. 없으면 원본과 같은 그림을
  // 6000×6000 PNG 로 한 번 더 굽는 헛수고입니다.
  let url = "";
  if (erases.length) {
    const blob = await toBlob(canvas);
    if (blob) url = URL.createObjectURL(blob);
  }
  // 옛 지운 판 주소는 잠시 뒤에 놓아 줍니다 — 그리기 면이 아직 그 주소를 보이는 중일 수 있습니다
  // (`loadImageForCanvas` 와 같은 이유). 창을 닫을 때는 `dropClean` 이 바로 놓습니다.
  const stale = cache.current?.url;
  if (stale) window.setTimeout(() => URL.revokeObjectURL(stale), 10_000);
  const built = { key, canvas, width, height, url };
  cache.current = built;
  return built;
}
