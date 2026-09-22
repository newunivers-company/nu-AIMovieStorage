import { COMPOSITION_CUBE_FACES, type CompositionCubeFace } from "@/lib/composition";

/**
 * 넓은 그림을 진짜 360×180 파노라마로 펴고, 거기서 여섯 면을 잘라내는 계산.
 *
 * ## 왜 필요한가
 *
 * 생성기에 «360도 등장방형 파노라마» 를 시켜도 대개는 그냥 **가로로 넓은 풍경**이
 * 나옵니다. 2:1 비율은 맞지만 담고 있는 세로 화각이 60도쯤이고, 등장방형이라면
 * 있어야 할 위아래 왜곡이 없습니다.
 *
 * 그걸 그대로 구에 감으면 맨 윗줄이 «머리 바로 위 한 점» 으로 모입니다. 하늘에
 * 달이 떠 있었다면 그 달이 극점을 향해 방사형으로 뭉개집니다. 구도잡기에서
 * 노란 덩어리와 보라 덩어리가 가운데 한 점으로 빨려 들어가 보이던 것이 이겁니다.
 *
 * ## 무엇을 하는가
 *
 * 원본이 담고 있는 세로 화각을 사람이 알려 주면, 그 띠를 파노라마의 **가운데
 * 띠**에 제자리로 놓고 위아래 빈 곳을 채웁니다. 그러면 지평선이 정확히 한가운데
 * 오고, 하늘은 위로 땅은 아래로 갑니다.
 *
 * ## 못 하는 것
 *
 * 원본에 없는 것을 만들어 내지는 못합니다. 세로 60도짜리 그림에서 나머지 120도는
 * **데이터가 아예 없어서**, 가장자리 색을 늘여 덮는 것 말고 방법이 없습니다.
 * 천장과 바닥이 밋밋한 색 뚜껑이 되는 건 그래서입니다. 구도를 잡을 때 똑바로
 * 올려다보거나 내려다볼 일은 드물어서 대개는 문제가 안 되지만, 그런 컷이 필요하면
 * 처음부터 제대로 된 파노라마를 뽑아야 합니다.
 */

export interface PanoramaFix {
  /**
   * 원본이 담고 있는 **세로 화각**(도).
   *
   * 180이면 이미 온전한 파노라마라 손대지 않습니다. 생성기가 뽑은 풍경은
   * 대개 50~80도입니다. 눈으로 맞추는 수밖에 없는데, 지평선을 한가운데 두고
   * 미리보기에서 하늘이 너무 빨리 뭉개지면 값을 키우세요.
   */
  verticalFov: number;
  /**
   * 세로로 어떻게 늘어나 있는지.
   *
   * - equirect — 높이가 **각도**에 비례합니다. 진짜 파노라마입니다.
   * - cylindrical — 높이가 **각도의 탄젠트**에 비례합니다. 보통 렌더나 사진이
   * 이쪽에 가깝습니다. 위로 갈수록 실제보다 빨리 벌어져 있어서, 그대로
   * 각도로 읽으면 하늘이 아래로 처집니다.
   */
  vertical: "cylindrical" | "equirect";
  /** 원본에서 지평선이 있는 높이(0~1). 0.5 면 한가운데입니다. */
  horizon: number;
  /**
   * 좌우 끝을 잇는 띠의 폭(0~0.3, 가로 대비 비율).
   *
   * 파노라마는 왼쪽 끝과 오른쪽 끝이 맞닿습니다. 생성기는 그걸 모르고 그려서
   * 대개 이음매에 세로줄이 생깁니다. 양쪽 끝을 서로 섞어 그 줄을 없앱니다.
   */
  seam: number;
  /** 데이터가 없는 위아래를 가장자리 색으로 채울지. */
  fillPoles: boolean;
}

export const DEFAULT_PANORAMA_FIX: PanoramaFix = {
  verticalFov: 70,
  vertical: "cylindrical",
  horizon: 0.5,
  seam: 0.06,
  fillPoles: true,
};

const DEG = Math.PI / 180;

/**
 * 위도(라디안)를 원본의 세로 위치(0~1)로 옮깁니다.
 *
 * 지평선을 기준으로 위아래를 따로 계산합니다. 지평선이 한가운데가 아니면
 * 위쪽과 아래쪽의 배율이 달라지는데, 그래도 **지평선이 정확히 적도에 오는 것**이
 * 훨씬 중요합니다. 그게 어긋나면 여섯 면이 전부 기울어집니다.
 *
 * 범위를 벗어나면 null 입니다. 원본에 그 각도의 그림이 없다는 뜻입니다.
 */
function latitudeToSourceY(latitude: number, fix: PanoramaFix): number | null {
  const half = (fix.verticalFov / 2) * DEG;
  if (half <= 0) return null;

  const ratio =
    fix.vertical === "equirect"
      ? latitude / half
      : Math.tan(Math.max(-1.5533, Math.min(1.5533, latitude))) / Math.tan(half);

  if (ratio > 1 || ratio < -1) return null;

  return ratio >= 0
    ? fix.horizon - ratio * fix.horizon
    : fix.horizon - ratio * (1 - fix.horizon);
}

/** 한 줄의 평균 색. 극점을 덮을 때 씁니다. */
function rowAverage(pixels: Uint8ClampedArray, width: number, row: number) {
  let r = 0;
  let g = 0;
  let b = 0;
  const base = row * width * 4;
  for (let x = 0; x < width; x += 1) {
    r += pixels[base + x * 4];
    g += pixels[base + x * 4 + 1];
    b += pixels[base + x * 4 + 2];
  }
  return { r: r / width, g: g / width, b: b / width };
}

/**
 * 좌우 끝을 이어 붙입니다.
 *
 * 폭 s 의 띠 안에서 양쪽 끝을 서로 섞되, 바깥으로 갈수록 상대편 비중을 키워
 * **맨 끝 두 열이 똑같은 값**이 되게 합니다. 그러면 감았을 때 이음매가 없습니다.
 * 띠 안쪽 끝에서는 섞는 비율이 0이라 원본이 그대로 남습니다.
 */
function blendSeam(image: ImageData, band: number) {
  if (band < 1) return;
  const { width, height, data } = image;
  const strip = Math.min(band, Math.floor(width / 2) - 1);
  if (strip < 1) return;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let k = 0; k < strip; k += 1) {
      const weight = 0.5 * (1 - k / strip);
      const left = row + k * 4;
      const right = row + (width - 1 - k) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const a = data[left + channel];
        const b = data[right + channel];
        data[left + channel] = a * (1 - weight) + b * weight;
        data[right + channel] = b * (1 - weight) + a * weight;
      }
    }
  }
}

/**
 * 넓은 그림 한 장을 2:1 등장방형 파노라마로 폅니다.
 *
 * 가로는 손대지 않습니다 — 경도는 원본에서도 결과에서도 가로 위치에 그대로
 * 비례하니까요. 바뀌는 것은 세로뿐이라 **한 줄씩 옮겨 그리면** 됩니다.
 * 픽셀마다 계산하는 것보다 훨씬 빠르고, 가로 해상도가 그대로 남습니다.
 */
export function buildEquirect(
  source: HTMLImageElement | HTMLCanvasElement,
  fix: PanoramaFix,
  width = 4096,
): HTMLCanvasElement {
  const sourceWidth = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const sourceHeight = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;

  const height = Math.round(width / 2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  // 원본에서 한 줄씩 읽으려면 같은 크기의 캔버스에 한 번 올려 둬야 합니다.
  const readable = document.createElement("canvas");
  readable.width = sourceWidth;
  readable.height = sourceHeight;
  const readContext = readable.getContext("2d", { willReadFrequently: true });
  if (!readContext) return canvas;
  readContext.drawImage(source, 0, 0);

  let firstValid = -1;
  let lastValid = -1;

  for (let y = 0; y < height; y += 1) {
    const latitude = (0.5 - (y + 0.5) / height) * Math.PI;
    const ratio = latitudeToSourceY(latitude, fix);
    if (ratio === null) continue;

    const sourceY = Math.max(0, Math.min(sourceHeight - 1, ratio * sourceHeight));
    context.drawImage(readable, 0, sourceY, sourceWidth, 1, 0, y, width, 1);

    if (firstValid < 0) firstValid = y;
    lastValid = y;
  }

  // 위아래로 남은 빈 곳. 원본에 없는 각도라 만들어 낼 수 없고, 가장자리 색을
  // 늘여 덮습니다. 극점에 가까울수록 그 줄의 평균색으로 수렴시켜, 한 점으로
  // 모이는 자리에 서로 다른 색이 부딪히지 않게 합니다.
  if (fix.fillPoles && firstValid > 0) {
    fillPole(context, canvas, width, firstValid, "top");
  }
  if (fix.fillPoles && lastValid >= 0 && lastValid < height - 1) {
    fillPole(context, canvas, width, lastValid, "bottom");
  }

  if (fix.seam > 0) {
    const image = context.getImageData(0, 0, width, height);
    blendSeam(image, Math.round(width * fix.seam));
    context.putImageData(image, 0, 0);
  }

  return canvas;
}

function fillPole(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  width: number,
  edgeRow: number,
  side: "top" | "bottom",
) {
  const edge = context.getImageData(0, edgeRow, width, 1);
  const average = rowAverage(edge.data, width, 0);
  const count = side === "top" ? edgeRow : canvas.height - 1 - edgeRow;
  if (count <= 0) return;

  // 먼저 평균색으로 통째로 덮고, 그 위에 가장자리 줄을 점점 옅게 얹습니다.
  context.fillStyle = `rgb(${Math.round(average.r)}, ${Math.round(average.g)}, ${Math.round(average.b)})`;
  context.fillRect(0, side === "top" ? 0 : edgeRow + 1, width, count);

  for (let step = 1; step <= count; step += 1) {
    const y = side === "top" ? edgeRow - step : edgeRow + step;
    // 극점에 닿을 때 0 이 되도록 부드럽게 떨어뜨립니다.
    context.globalAlpha = Math.pow(1 - step / count, 1.6);
    context.drawImage(canvas, 0, edgeRow, width, 1, 0, y, width, 1);
  }
  context.globalAlpha = 1;
}

/**
 * 면마다 «화면 가로 a, 세로 b» 를 3차원 방향으로 바꾸는 식.
 *
 * 정면이 −Z 입니다. 구도잡기의 상자(BoxGeometry) 도 −Z 를 정면으로 쓰고 있어서
 * 여기서 뽑은 여섯 장이 그대로 들어맞습니다.
 *
 * 위·아래 면의 위아래 방향은 옆면과 이어지도록 맞췄습니다. 이걸 틀리면 여섯 장이
 * 각각은 멀쩡한데 상자로 세우면 천장만 뒤집혀 보입니다.
 */
const FACE_VECTORS: Record<CompositionCubeFace, (a: number, b: number) => [number, number, number]> = {
  front: (a, b) => [a, -b, -1],
  back: (a, b) => [-a, -b, 1],
  right: (a, b) => [1, -b, a],
  left: (a, b) => [-1, -b, -a],
  top: (a, b) => [a, 1, b],
  bottom: (a, b) => [a, -1, -b],
};

/**
 * 파노라마 한 장에서 여섯 면을 **계산으로** 잘라냅니다.
 *
 * 여섯 면을 생성기로 따로 뽑으면 아무리 프롬프트를 잘 써도 이음매가 안 맞습니다.
 * 확산 모델에는 3차원이라는 것이 없어서, 여섯 번의 생성이 같은 공간의 여섯 방향이
 * 되리라는 보장이 어디에도 없기 때문입니다.
 *
 * 반면 이건 한 장을 여섯 방향으로 **다시 투영**하는 것뿐입니다. 원래 하나였으니
 * 경계가 어긋날 여지가 없습니다. 요금도 한 번만 냅니다.
 */
export function cubeFacesFromEquirect(
  equirect: HTMLCanvasElement,
  size = 1024,
): Record<CompositionCubeFace, HTMLCanvasElement> {
  const width = equirect.width;
  const height = equirect.height;
  const readContext = equirect.getContext("2d", { willReadFrequently: true });
  const source = readContext?.getImageData(0, 0, width, height);

  const faces = {} as Record<CompositionCubeFace, HTMLCanvasElement>;

  for (const face of COMPOSITION_CUBE_FACES) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    faces[face] = canvas;

    const context = canvas.getContext("2d");
    if (!context || !source) continue;

    const target = context.createImageData(size, size);
    const toVector = FACE_VECTORS[face];

    for (let j = 0; j < size; j += 1) {
      const b = (2 * (j + 0.5)) / size - 1;
      for (let i = 0; i < size; i += 1) {
        const a = (2 * (i + 0.5)) / size - 1;
        const [x, y, z] = toVector(a, b);
        const length = Math.sqrt(x * x + y * y + z * z);

        // 경도 0 이 −Z(정면) 입니다. 파노라마 한가운데가 정면이라는 약속과 같습니다.
        const longitude = Math.atan2(x, -z);
        const latitude = Math.asin(y / length);

        const u = (0.5 + longitude / (2 * Math.PI)) * width;
        const v = (0.5 - latitude / Math.PI) * height;

        sampleBilinear(source, width, height, u, v, target.data, (j * size + i) * 4);
      }
    }

    context.putImageData(target, 0, 0);
  }

  return faces;
}

/**
 * 방 상자의 치수와 카메라(앵커) 자리 — 눈에서 각 벽까지 거리(m).
 * 앞 = 파노라마 한가운데(−Z), 오른쪽 = +X. 눈은 바닥에서 `eye` m.
 */
export interface EquirectBox {
  ahead: number;
  right: number;
  behind: number;
  left: number;
  /** 층고(m). */
  height: number;
  /** 눈높이(m). 프롬프트의 360 카메라 1.6 m 와 같아야 벽선이 맞습니다. */
  eye: number;
}

/** 한 면의 가로·세로(m) — 앞뒤 벽 W×H, 옆벽 D×H, 천장·바닥 W×D. */
export function boxFaceMeters(box: EquirectBox, face: CompositionCubeFace): { width: number; height: number } {
  const across = box.left + box.right;
  const deep = box.ahead + box.behind;
  if (face === "front" || face === "back") return { width: across, height: box.height };
  if (face === "left" || face === "right") return { width: deep, height: box.height };
  return { width: across, height: deep };
}

/**
 * 면의 한 픽셀(0~1) → 눈에서 본 3차원 방향. `FACE_VECTORS` 와 **같은 방향 규약**입니다 — 정육면체 한가운데면
 * 두 식이 똑같아져 `cubeFacesFromEquirect` 결과와 픽셀 단위로 같습니다(검증 스크립트로 확인).
 */
function boxPoint(box: EquirectBox, face: CompositionCubeFace, u: number, v: number): [number, number, number] {
  const top = box.height - box.eye;
  const y = top - v * box.height;
  const across = box.left + box.right;
  const deep = box.ahead + box.behind;
  switch (face) {
    case "front":
      return [-box.left + u * across, y, -box.ahead];
    case "back":
      return [box.right - u * across, y, box.behind];
    case "right":
      return [box.right, y, -box.ahead + u * deep];
    case "left":
      return [-box.left, y, box.behind - u * deep];
    case "top":
      return [-box.left + u * across, top, -box.ahead + v * deep];
    default:
      return [-box.left + u * across, -box.eye, box.behind - v * deep];
  }
}

/**
 * 등장방형 한 장을 **방 상자의 여섯 면**으로 다시 투영합니다 — 픽셀만 다루는 순수 계산.
 *
 * , 「층고는 없네?」.
 * 정육면체 여섯 면(`cubeFacesFromEquirect`)은 **카메라가 정육면체 한가운데**일 때만 벽 그림이 됩니다. 가로 12 ×
 * 깊이 10 × 층고 2.4 m 방에 앵커가 한쪽에 치우쳐 있으면, 90° 면을 그 방의 벽에 붙였을 때 문·창이 엉뚱한 자리에
 * 늘어납니다. 방 크기와 앵커 자리를 알면 벽의 한 점 한 점을 눈에서 본 방향으로 바꿔 파노라마에서 읽으면 되고,
 * 그러면 면 그림이 곧 **그 방의 벽**이라 구도잡기가 면 비율로 방을 세울 때 치수도 그대로 맞습니다.
 *
 * `pixelsPerMeter` 로 면 크기를 정합니다(면마다 가로세로가 달라 한 숫자 크기로는 못 정합니다).
 */
export function boxFacesFromEquirectPixels(
  source: { data: Uint8ClampedArray; width: number; height: number },
  box: EquirectBox,
  pixelsPerMeter: number,
): Record<CompositionCubeFace, { width: number; height: number; data: Uint8ClampedArray }> {
  const image = source as unknown as ImageData;
  const faces = {} as Record<CompositionCubeFace, { width: number; height: number; data: Uint8ClampedArray }>;
  for (const face of COMPOSITION_CUBE_FACES) {
    const meters = boxFaceMeters(box, face);
    const width = Math.max(8, Math.round(meters.width * pixelsPerMeter));
    const height = Math.max(8, Math.round(meters.height * pixelsPerMeter));
    const data = new Uint8ClampedArray(width * height * 4);
    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const [x, y, z] = boxPoint(box, face, (i + 0.5) / width, (j + 0.5) / height);
        const length = Math.sqrt(x * x + y * y + z * z) || 1;
        const longitude = Math.atan2(x, -z);
        const latitude = Math.asin(y / length);
        const u = (0.5 + longitude / (2 * Math.PI)) * source.width;
        const v = (0.5 - latitude / Math.PI) * source.height;
        sampleBilinear(image, source.width, source.height, u, v, data, (j * width + i) * 4);
      }
    }
    faces[face] = { width, height, data };
  }
  return faces;
}

/** 캔버스 껍데기 — 그림을 원본 크기 그대로 읽어 방 상자 여섯 면 캔버스를 돌려줍니다. */
export function boxFacesFromEquirect(
  source: HTMLImageElement | HTMLCanvasElement,
  box: EquirectBox,
  longestFacePixels: number,
): Record<CompositionCubeFace, HTMLCanvasElement> | null {
  const width = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;
  if (!width || !height) return null;
  const read = document.createElement("canvas");
  read.width = width;
  read.height = height;
  const readContext = read.getContext("2d", { willReadFrequently: true });
  if (!readContext) return null;
  readContext.drawImage(source, 0, 0);
  const pixels = readContext.getImageData(0, 0, width, height);
  const longest = Math.max(
    ...COMPOSITION_CUBE_FACES.map((face) => {
      const meters = boxFaceMeters(box, face);
      return Math.max(meters.width, meters.height);
    }),
  );
  const faces = boxFacesFromEquirectPixels(pixels, box, longestFacePixels / Math.max(0.01, longest));
  const out = {} as Record<CompositionCubeFace, HTMLCanvasElement>;
  for (const face of COMPOSITION_CUBE_FACES) {
    const face_ = faces[face];
    const canvas = document.createElement("canvas");
    canvas.width = face_.width;
    canvas.height = face_.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const imageData = context.createImageData(face_.width, face_.height);
    imageData.data.set(face_.data);
    context.putImageData(imageData, 0, 0);
    out[face] = canvas;
  }
  return out;
}

/**
 * 네 이웃을 섞어 읽습니다./**
 * 네 이웃을 섞어 읽습니다.
 *
 * 가장 가까운 픽셀만 집으면 큐브 면의 가장자리, 특히 위아래 면에서 계단이
 * 그대로 보입니다. 파노라마 한 픽셀이 큐브에서는 여러 픽셀로 늘어나는 자리가
 * 있어서 그렇습니다.
 *
 * 가로는 **감아서** 읽습니다. 파노라마의 오른쪽 끝 다음은 왼쪽 끝입니다.
 */
function sampleBilinear(
  source: ImageData,
  width: number,
  height: number,
  u: number,
  v: number,
  out: Uint8ClampedArray,
  outIndex: number,
) {
  const x0 = Math.floor(u - 0.5);
  const y0 = Math.floor(v - 0.5);
  const fx = u - 0.5 - x0;
  const fy = v - 0.5 - y0;

  const wrap = (x: number) => ((x % width) + width) % width;
  const clamp = (y: number) => Math.max(0, Math.min(height - 1, y));

  const x1 = wrap(x0 + 1);
  const y1 = clamp(y0 + 1);
  const xa = wrap(x0);
  const ya = clamp(y0);

  for (let channel = 0; channel < 3; channel += 1) {
    const topLeft = source.data[(ya * width + xa) * 4 + channel];
    const topRight = source.data[(ya * width + x1) * 4 + channel];
    const bottomLeft = source.data[(y1 * width + xa) * 4 + channel];
    const bottomRight = source.data[(y1 * width + x1) * 4 + channel];

    const top = topLeft + (topRight - topLeft) * fx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * fx;
    out[outIndex + channel] = top + (bottom - top) * fy;
  }
  out[outIndex + 3] = 255;
}

/**
 * 원본이 담고 있는 세로 화각을 어림잡습니다.
 *
 * 정답은 알 수 없습니다. 같은 2:1 그림이 60도일 수도 100도일 수도 있고, 그건
 * 그림 안에 적혀 있지 않습니다. 다만 **가로세로 비율**이 단서는 됩니다. 생성기가
 * 뽑은 넓은 풍경은 대개 가로 화각이 90~120도쯤이고, 세로는 거기에 비율만큼
 * 줄어든 값에 가깝습니다.
 *
 * 어차피 눈으로 맞춰야 하는 값이라, 여기서는 **처음 잡아 줄 자리**만 정합니다.
 */
export function guessVerticalFov(width: number, height: number) {
  if (!width || !height) return DEFAULT_PANORAMA_FIX.verticalFov;
  const ratio = width / height;
  // 2:1 이면 이미 파노라마를 노린 그림이라 보고 조금 넓게 잡습니다.
  const horizontal = ratio >= 1.9 ? 360 : 100;
  const guess = ratio >= 1.9 ? 75 : horizontal / ratio;
  return Math.max(30, Math.min(180, Math.round(guess)));
}

/**
 * «이미 등장방형» — 세로 180도·등장방형·지평선 한가운데.
 *
 * P1 프롬프트(docs/복원/10 §3)로 뽑은 파노라마는 위아래 왜곡까지 진짜 등장방형이라
 * 손댈 것이 없습니다. 그런데 `guessVerticalFov` 는 2:1 이면 75도로 어림잡아, 그대로 두면
 * 멀쩡한 파노라마를 가운데 띠로 눌러 버립니다. 이 값이면 `buildEquirect` 는 위도를
 * 원본 세로에 그대로 비례시켜(0.5 − ratio·0.5) 한 줄도 옮기지 않습니다.
 */
export function asFullEquirect(fix: PanoramaFix): PanoramaFix {
  return { ...fix, verticalFov: 180, vertical: "equirect", horizon: 0.5 };
}

/** `asFullEquirect` 상태인가 — 세로 화각 180 + 등장방형이면 어림값을 쓰지 않습니다. */
export function isFullEquirect(fix: PanoramaFix): boolean {
  return fix.verticalFov >= 180 && fix.vertical === "equirect";
}

/**
 * 등장방형을 만들 가로 폭. 원본 가로를 그대로 씁니다(1024~8192).
 *
 * 예전에는 4096 고정이라, 8K 파노라마를 넣어도 여섯 면의 실제 해상도는 1024 였습니다
 * (90° 한 면 = 가로의 1/4). 8192 위로는 안 갑니다 — `cubeFacesFromEquirect` 가
 * 판 전체를 `getImageData` 로 읽는데 8192×4096 이 이미 134MB 라 그 위는 웹뷰가 버겁습니다.
 */
export const MAX_EQUIRECT_WIDTH = 8192;
export function equirectWidthFor(sourceWidth: number): number {
  const clamped = Math.max(1024, Math.min(MAX_EQUIRECT_WIDTH, Math.round(sourceWidth || 1024)));
  // 홀수면 높이(width/2)가 반 픽셀이 됩니다.
  return clamped - (clamped % 2);
}

/**
 * 파노라마에서 90° 한 면이 «원래» 가진 해상도 ≈ 가로 / 4.
 * 이보다 큰 면을 요구하면 늘리는 것뿐이라, 업스케일이 필요한지 판단하는 기준이 됩니다.
 */
export function nativeFaceSize(sourceWidth: number): number {
  return Math.max(1, Math.round(equirectWidthFor(sourceWidth) / 4));
}

/**
 * 캔버스를 키웁니다(브라우저의 고품질 리샘플 — 바이큐빅에 준함).
 *
 * `cubeFacesFromEquirect` 를 큰 크기로 돌리면 면마다 size² 번 샘플링해서 8192 면은
 * 6장에 4억 번 — 분 단위로 걸립니다. 원래 해상도로 자른 뒤 이걸로 키우는 편이 결과는
 * 같고(어차피 원본에 없는 픽셀은 만들 수 없습니다) 수십 배 빠릅니다.
 * 진짜로 없는 픽셀을 만드는 것은 업스케일 엔진(설정의 기본 엔진)의 몫입니다.
 */
export function enlargeCanvas(canvas: HTMLCanvasElement, size: number): HTMLCanvasElement {
  if (canvas.width === size && canvas.height === size) return canvas;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const context = out.getContext("2d");
  if (!context) return canvas;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, size, size);
  return out;
}
