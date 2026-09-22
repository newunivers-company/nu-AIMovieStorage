/**
 * 구도잡기에서 정한 **실측 방 치수**로 «6면 전개도» 를 뽑기 위한 틀과 프롬프트.
 *
 *
 *
 * # 치수는 «글» 이 아니라 «틀» 로 줍니다 — 2026-09-12 실험
 *
 * 마그니픽으로 여섯 장을 뽑아 재 본 결과입니다.
 *
 * 1. **미터를 적으면 안 지킵니다.** 6×5 m 를 시켜 3.3×2.6 m 가 나왔습니다.
 * 2. **칸의 가로세로비를 숫자로 적어도 안 지킵니다.** 2.50 / 2.08 을 시켜 1.38 / 1.07 /
 * 0.46 / 0.85 가 나왔습니다. 「세로의 2.5배 너비」 같은 말은 거의 안 먹힙니다.
 * 3. **칸이 그려진 그림을 레퍼런스로 넣으면 배치가 크게 안정됩니다.** 십자 자리·회색
 * 빈칸·정사영이 한 번에 잡혔습니다. 다만 칸 크기는 여전히 조금씩 재해석합니다.
 * 4. 칸마다 **다른 색**으로 칠한 틀이 가장 좋았습니다. 대신 「사실적 사진」 을 세게 못
 * 박아야 합니다 — 틀이 평평해서 그냥 두면 일러스트로 끌려갑니다.
 *
 * 그래서 예전에는 **방의 절대 치수를 그림에서 읽었습니다**(`roomRatioFromFaces`) — 층고 하나만 사람이 정하고
 * 가로·깊이는 뽑힌 그림이 정했습니다.
 *
 * 2026-09-15 부터는 카드에 적은 치수로 뽑은 세트면 **그 치수가 정답**입니다(`CompositionRoom.faceRatio`). MCP 실측에서
 * 나노 바나나 프로는 칸 너비를 벽마다 조금씩 달리 그렸고(8 m 벽이 6.9 m 너비로 그려지는 식), 그림 비율로 방을 세우면
 * 방이 줄었습니다. 그림은 그 벽에 맞춰 조금 늘여 붙입니다. 크기 표시가 없는 옛 세트만 그림 비율을 씁니다.
 *
 * # 십자 전개도의 판 크기
 *
 * ```
 * ┌───────┐
 * │ 천장 │ W × D
 * ┌───────┼───────┼───────┬───────┐
 * │ 왼쪽 │ 정면 │ 오른쪽│ 후면 │ D×H · W×H · D×H · W×H
 * └───────┼───────┼───────┴───────┘
 * │ 바닥 │ W × D
 * └───────┘
 * ```
 *
 * 그래서 캔버스는 (2D + 2W) × (2D + H) 입니다.
 */

/** 방 한 채의 치수(m). */
export interface UnfoldRoom {
  width: number;
  depth: number;
  height: number;
}

export type UnfoldFace = "top" | "left" | "front" | "right" | "back" | "bottom";


/**
 * 칸마다의 색. 프롬프트가 이 이름으로 칸을 가리킵니다 — 「BLUE 칸은 앞 벽」.
 *
 * 채도를 낮춘 것은 생성기가 그 색을 **결과에 남기지 않게** 하기 위해서입니다. 쨍한 원색을
 * 쓰면 «파란 벽» 을 그려 놓습니다.
 */
export const UNFOLD_CELL_COLORS: Record<
  UnfoldFace,
  { rgb: string; en: string; ko: string }
> = {
  top: { rgb: "#fad778", en: "YELLOW", ko: "노랑" },
  left: { rgb: "#eb7878", en: "RED", ko: "빨강" },
  front: { rgb: "#78c8eb", en: "BLUE", ko: "파랑" },
  right: { rgb: "#96dc96", en: "GREEN", ko: "초록" },
  back: { rgb: "#d2a0e6", en: "PURPLE", ko: "보라" },
  bottom: { rgb: "#c8aa82", en: "BROWN", ko: "갈색" },
};

/** 틀 안에서 칸 하나가 차지하는 자리(픽셀). */
export interface UnfoldTemplateCell {
  face: UnfoldFace;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 전개도 틀의 칸 색 — 바탕 #808080 보다 아주 조금 밝게. 까닭은 `buildUnfoldTemplate` 의 칠하는 자리. */
export const UNFOLD_TEMPLATE_CELL = "#929292";

/**
 * 십자 전개도 **틀** 을 그립니다 — 방 치수 그대로의 칸 여섯 개 + 회색 빈칸.
 *
 * 이 그림을 생성기에 레퍼런스로 넣고 「각 칸을 그 자리 그대로 사진으로 바꿔라」 라고
 * 시킵니다. 글로 「2.50배」 라고 적는 것보다 훨씬 잘 지킵니다(머리말 실험 3·4).
 */
export function buildUnfoldTemplate(
  room: UnfoldRoom,
  heightPx = 2160,
  /**
   * 칸을 색 대신 **회색 하나**로(기본). 실외·방 전개도 모두 씁니다.
   *
   * 2026-09-15 나노 바나나 결과: 칸마다 다른 색(빨강·노랑·초록·보라)이 그림 둘레에 **색 테두리**로 남고, 방 벽마다 틀 색이
   * 물들었습니다 — «색은 사라진다» 를 적어도 그대로였습니다(머리말 실험 4 의 «색 틀이 가장 좋다» 는 배치만 본 결과였습니다).
   * 문장은 이제 칸을 색 이름이 아니라 «가운데 줄 1번(너비 4 m)» 처럼 자리로 부릅니다. false 는 옛 색 틀 — 남겨만 둡니다.
   */
  neutral = true,
  /**
   * 옆 네 칸의 **아래 절반만 조금 어둡게**(#8c8c8c, 위 #949494) — 실외 전개도의 지평선 자리를 그림으로 알려 줍니다.
   *
   * 2026-09-16 MCP 실측: 같은 문장에 이 틀과 «밝은 위 절반과 조금 어두운 아래 절반이 만나는 줄이 지평선» 한 줄을 더하자,
   * 정체성 그림 없이 네 장 모두 지평선이 칸 가운데인 눈높이 사진이었습니다. 두 회색 모두 바탕 ±30 의 무채색이라 남아도 자르기가
   * 벗기고, 칸 안 색이 둘뿐이라 «틀은 전개도가 아니다» 판정(`looksLikeCrossUnfold`, 칸마다 색 셋 이상)도 그대로입니다.
   */
  horizon = false,
): { canvas: HTMLCanvasElement; cells: UnfoldTemplateCell[] } {
  const { width, depth, height } = room;
  const unit = heightPx / (2 * depth + height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((2 * depth + 2 * width) * unit);
  canvas.height = Math.round((2 * depth + height) * unit);
  const context = canvas.getContext("2d");
  const xs = [
    0,
    depth,
    depth + width,
    2 * depth + width,
    2 * depth + 2 * width,
  ];
  const ys = [0, depth, depth + height, 2 * depth + height];
  const boxes: [UnfoldFace, number, number, number, number][] = [
    ["top", xs[1], ys[0], xs[2], ys[1]],
    ["left", xs[0], ys[1], xs[1], ys[2]],
    ["front", xs[1], ys[1], xs[2], ys[2]],
    ["right", xs[2], ys[1], xs[3], ys[2]],
    ["back", xs[3], ys[1], xs[4], ys[2]],
    ["bottom", xs[1], ys[2], xs[2], ys[3]],
  ];
  if (context) {
    context.fillStyle = "#808080";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const cells: UnfoldTemplateCell[] = [];
  for (const [face, a, b, c, d] of boxes) {
    const cell = {
      face,
      left: Math.round(a * unit),
      top: Math.round(b * unit),
      width: Math.round((c - a) * unit),
      height: Math.round((d - b) * unit),
    };
    cells.push(cell);
    if (!context) continue;
    /*
      칸은 바탕(#808080)보다 **아주 조금만** 밝게(#929292, 차이 18). 2026-09-15 MCP 실측: 밝은 회색(#c2c2c2) 칸이면 생성기가 그림을
      칸보다 좁게 그리고 남은 자리에 **밝은 회색 띠**를 남겼습니다. 거의 같은 회색이면 남아도 바탕으로 읽혀 자르기
      (`trimBackgroundEdges` 의 허용 20)가 벗깁니다. 칸 자리는 이 차이만으로도 잘 지켰습니다.
    */
    context.fillStyle = neutral ? UNFOLD_TEMPLATE_CELL : UNFOLD_CELL_COLORS[face].rgb;
    context.fillRect(cell.left, cell.top, cell.width, cell.height);
    if (neutral && horizon && face !== "top" && face !== "bottom") {
      const half = Math.round(cell.height / 2);
      context.fillStyle = "#949494";
      context.fillRect(cell.left, cell.top, cell.width, half);
      context.fillStyle = "#8c8c8c";
      context.fillRect(cell.left, cell.top + half, cell.width, cell.height - half);
    }
  }
  return { canvas, cells };
}


const round2 = (value: number) => Math.round(value * 100) / 100;

/** 실외 전개도 옆면 사진의 눈높이(m). 프롬프트와 구도잡기 방 기하(`blueprint.outdoorFaceSetSize`)가 같은 값을 써야 지평선이 맞습니다. */
export const OUTDOOR_EYE_HEIGHT = 1.6;

/**
 * 방 전개도의 **영문 본문** — 배경 카드의 «등장방형 · 실내 안쪽면 / 바깥쪽면» 칩이 씁니다. 본문은 `buildRoomUnfoldEnglish`
 * (칸을 자리로 부르는 2026-09-15 문장). 옛 `buildUnfoldPrompt`(색 칸 문장)는 부르는 곳이 없어 남겨만 둡니다.
 *
 * 방 크기를 모르면 치수 구절을 뺍니다(«1 m wide» 가 그대로 나가면 생성기가 납작한 상자를 그립니다).
 * `look` 을 비우면 한국어 자리표시자가 들어가므로 칩에서는 «아래에 적힌 방·건물» 로 넘깁니다.
 */
export function buildUnfoldEnglish(
  room: UnfoldRoom | null,
  look: string,
  shell: "inner" | "outer",
): string {
  return buildRoomUnfoldEnglish(room, look, shell);
}


/**
 * **실외 · 실제 크기 공간** 전개도 — 한 변 S m 공간 한가운데 눈높이에서 본 네 방향 + 하늘 + 그 공간 땅 전체의 실측 지도.
 *
 *
 *
 * 옆면을 «상자 벽의 실제 크기 그림 — 지평선은 벽 맨 아래 3 %» 로 세 번 고쳐 적었지만 나노 바나나는 늘 지평선이 가운데인 보통
 * 사진을 그렸습니다. 그래서 생성기가 잘하는 수평 90° 사진을 받고 **구도잡기 방이 기하를 맞춥니다**(`outdoorFaceSetSize`,
 * `CompositionRoom.sideCropBottom`). 여기서 미터가 실제로 쓰이는 곳은 바닥 지도(S×S m)와 경계에 선 것의 크기 단서입니다.
 *
 * ## 문장은 마그니픽 MCP 로 나노 바나나 프로를 직접 돌려 고른 것입니다(2026-09-15, 판마다 2~4 장)
 * - «정체성 그림은 드론 사진 — 내용·색·빛만, 카메라 높이·각도는 절대 아님» 을 따로 적기 전에는 옆면 네 장이 전부 **항공 시점**
 * 이었습니다(정체성 그림이 항공 마스터라서). 적은 뒤로는 대부분 땅에서 본 시점.
 * - «땅에서는 나무 너머가 안 보인다 — 경계의 나무는 지평선 **위로** 솟는다» 가 항공 시점을 막는 핵심이었습니다.
 * - «사람이 눈높이에서 찍는다» 를 빼고 «풀밭에서 찍은 사진» 으로만 적자 다시 항공 시점이 늘었고, «삼각대» 라고 적자 삼각대가
 * 그려졌습니다. 그래서 «사람이 찍되 찍는 사람은 안 보인다».
 * - 달이 빈 회색 칸(윗줄 3열)에 한 번 더 그려지는 일이 넷 중 하나꼴로 남았습니다. 자르기는 그 달에 흔들리지 않음을 확인했습니다
 * (`looksLikeCrossUnfold` 가 선을 제자리에서 찾음). «낮게, 나무 선 바로 위» 로 적으면 줄어듭니다.
 * - 칸 틀은 **바탕과 거의 같은 회색**(`buildUnfoldTemplate`)이라야 칸 사이 밝은 띠가 안 남습니다.
 */
export function buildOutdoorAreaEnglish(side: number, place: string): string {
  const s = round2(side);
  const half = round2(side / 2);
  const eye = OUTDOOR_EYE_HEIGHT;
  /*
    카메라 문단을 장소보다 **앞**에 둡니다(앞쪽 글을 더 무겁게 따릅니다 — 2026-09-15 확인판).

    2026-09-16 «아래 절반은 땅만, 경계는 지평선 위로»: 이 두 줄이 없을 때는 생성기가 보통 풍경 사진처럼 숲을 화면 가운데에
    크게 채워 **숲 밑동이 지평선보다 칸 높이의 20~30 % 아래**(= 3~5 m 앞)였고, 25 m 벽에 붙이자 나무가 몇 배로 커 보였습니다
    . 틀의 어두운 아래 절반·밝은 위 절반을 말로 짚자 네 장 모두 밑동이 지평선 근처
    (25~50 m)로 올라왔습니다. 숫자(«지평선 아래 3 %» 같은)로 적으면 오히려 항공 시점이 늘어 말로만 둡니다.
  */
  return [
    `A single photorealistic image: six views of one real outdoor place, laid out as a cross of six equal squares on flat mid-grey (four columns by three rows of equal square cells). No words anywhere in the image - no captions, no labels, no letters, no numbers, no watermark.`,
    "",
    `THE FOUR MIDDLE-ROW VIEWS: a person standing on the ground in the middle of a ${s} m by ${s} m clearing takes four photographs at eye level, the lens ${eye} m above the ground, perfectly level, turning on the spot by exactly 90 degrees between shots. The photographer is never visible. Each view covers exactly 90 degrees, so the four join into one seamless 360-degree ring.`,
    "- The whole darker lower half of every middle-row square is open ground only - grass, earth, paths, water and low stones - stretching from the bottom edge all the way up to the horizon line. No tree trunk, bush, wall or building stands in the lower half.",
    `- What surrounds the clearing - trees, buildings or rocks - is far away at its edge, ${half} m from the camera: it stands ON the horizon line (its base touches the horizon line) and rises only into the lighter upper half. Seen from the ground you cannot see over it; the sky is above it.`,
    "- The horizon line is exactly across the middle of every middle-row square, at the same height in all four. None of the four is an aerial view: no tree tops or roofs seen from above, nothing spread out below the camera.",
    "- Middle row, column 1: looking left. Column 2: looking straight ahead. Column 3: looking right. Column 4: looking straight behind.",
    "- A moon or the sun hangs low, just above the tree line or roofline, inside the one middle-row picture that faces it, at the size the real moon has in an ordinary wide photograph - a small disc, never a giant moon filling the sky. Each exists only once in the whole image.",
    "",
    `PLACE: ${place}`,
    "",
    "- Top row, column 2: looking straight up from the same spot - pure sky only, no moon, no sun, no trees, no horizon.",
    `- Bottom row, column 2: the ground of the ${s} m by ${s} m clearing seen straight down like a true-scale map: ground cover, paths, water and stones exactly where they lie, with only a thin fringe of whatever stands at the edge touching the outer edges of the square. No horizon, no sky.`,
    "- Top row columns 1, 3, 4 and bottom row columns 1, 3, 4 are empty flat grey.",
    "",
    "Where two squares touch, the horizon, ground and sky continue across at the same height. Same light and time in every square. No people, no animals, no camera equipment, no text, no frames, no fisheye, no tilted horizon. Photorealistic, cinematic. Aspect ratio 4:3.",
  ].join("\n");
}

/** `buildOutdoorAreaEnglish` 의 한국어 완결본 — 한글 프롬프트를 그대로 «구성» 으로 보내도 되게. */
export function buildOutdoorAreaKorean(side: number, place: string): string {
  const s = round2(side);
  const half = round2(side / 2);
  const eye = OUTDOOR_EYE_HEIGHT;
  return [
    "한 장의 사실적인 이미지: 실제 야외 장소 한 곳을 본 여섯 그림을 평평한 중간 회색 바탕 위에 같은 크기 정사각형 여섯 개의 십자로 놓습니다(같은 크기 정사각 칸 가로 4 × 세로 3). 그림 어디에도 글자 없음 — 캡션·라벨·문자·숫자·워터마크 없음.",
    "",
    `가운데 줄 네 그림: ${s} m × ${s} m 공터 한가운데 땅에 선 사람이 눈높이(렌즈가 땅에서 ${eye} m)에서 완전히 수평으로, 제자리에서 정확히 90° 씩 돌며 찍은 사진 네 장. 찍는 사람은 보이지 않습니다. 저마다 90° 를 담아 넷이 이음매 없는 360° 한 바퀴로 이어집니다.`,
    "- 가운데 줄 칸의 어두운 아래 절반 전체는 트인 땅뿐입니다 — 풀·흙·길·물·낮은 돌이 칸 아래 끝부터 지평선까지 이어집니다. 아래 절반에는 나무줄기·덤불·담·건물이 없습니다.",
    `- 공터를 둘러싼 나무·건물·바위는 멀리 경계에, 카메라에서 ${half} m 떨어져 있습니다: 지평선 위에 서서(밑동이 지평선에 닿고) 밝은 위 절반으로만 솟습니다. 땅에서는 그 너머가 보이지 않고, 그 위는 하늘입니다.`,
    "- 지평선은 가운데 줄 모든 칸의 세로 한가운데를 가로지르고 네 장 모두 같은 높이입니다. 어느 것도 항공 시점이 아닙니다 — 위에서 내려다본 나무 꼭대기·지붕, 카메라 아래로 펼쳐진 풍경 없음.",
    "- 가운데 줄 1열: 왼쪽. 2열: 정면. 3열: 오른쪽. 4열: 바로 뒤.",
    "- 달이나 해는 그쪽을 향한 가운데 줄 그림 하나 안에, 나무 선이나 지붕선 바로 위에 낮게 걸립니다. 크기는 보통의 넓은 사진 속 실제 달 그대로 — 작은 원판, 하늘을 채우는 거대한 달 아님. 그림 전체에 각각 한 번만.",
    "",
    `장소: ${place}`,
    "",
    "- 윗줄 2열: 같은 자리에서 똑바로 올려다본 하늘뿐 — 달·해·나무·지평선 없음.",
    `- 아랫줄 2열: ${s} m × ${s} m 공터의 땅을 똑바로 내려다본 실제 축척 지도 — 풀·길·물·돌이 놓인 자리 그대로, 경계에 선 것은 정사각형 바깥 끝에 얇게 닿는 정도만. 지평선·하늘 없음.`,
    "- 윗줄과 아랫줄의 1·3·4열은 빈 회색.",
    "",
    "두 정사각형이 맞닿는 곳에서 지평선·땅·하늘이 같은 높이로 이어집니다. 모든 칸의 빛·시간이 같습니다. 사람·동물·촬영 장비·글자·액자·어안 렌즈·기울어진 지평선 없음. 사실적, 영화 같은 사진. 비율 4:3.",
  ].join("\n");
}

/**
 * **파노라마 · 실외 돔** — 등장방형 한 장. 구도잡기가 지면 투영 돔에 감습니다(`buildPanoramaDome`).
 *
 * , 「돔은 카메라 무빙 없는 씬 위주로」.
 * MCP 실측(나노 바나나 프로 16:9·21:9 각 3 장, 정체성 그림 없이): 여섯 장 모두 지평선이 세로 가운데, 숲이 지평선 위 멀리,
 * 달 작게 한 번. 한 장이라 칸 배치 실패가 없습니다. 좌우 끝 이음은 옆 줄 차의 2~3 배라 한 바퀴 돌면 경계가 약하게 보입니다.
 * 돔은 한가운데(눈높이)에서 가장 자연스럽고, 카메라가 가운데서 멀어지면 바닥이 방사형으로 번집니다 — 그래서 제자리 컷용입니다.
 * 나노 바나나 프로에 2:1 비율이 없어 16:9 로 받습니다(세로가 조금 늘어나 보이는 정도).
 */
export function buildOutdoorPanoramaEnglish(side: number, place: string): string {
  const s = round2(side);
  const half = round2(side / 2);
  const eye = OUTDOOR_EYE_HEIGHT;
  return [
    `A single seamless 360-degree equirectangular panorama photograph - the full sphere, 360 degrees around and 180 degrees from straight up to straight down - taken by a person standing on the ground in the middle of a ${s} m by ${s} m clearing, the lens ${eye} m above the ground, perfectly level. The photographer is never visible.`,
    "",
    "PROJECTION: true equirectangular, like the output of a real 360 camera. The horizon is a perfectly straight horizontal line exactly across the vertical middle of the image. The top edge of the image is the sky straight overhead, the bottom edge is the ground straight below the camera. The left and right edges are the same direction (straight behind) and join seamlessly. The image centre is straight ahead; one quarter from the left edge is to the left, three quarters is to the right.",
    "",
    `THE SPACE: the whole lower half of the image is open ground only - grass, earth, paths, water and low stones - stretching all the way to the horizon; no tree trunk, bush, wall or building stands in the lower half. What surrounds the clearing - trees, buildings or rocks - is far away at its edge, ${half} m from the camera, all the way around: it stands on the horizon line and rises only above it. A moon or the sun hangs low just above the tree line or roofline in the one direction it faces, each exists only once, each a small disc like the real moon in a wide photograph.`,
    "",
    `PLACE: ${place}`,
    "",
    "One single continuous photograph - not a collage, not split into panels, no borders, no frames, no text, no letters, no watermark, no people, no animals, no camera equipment. Photorealistic, cinematic. Aspect ratio 16:9.",
  ].join("\n");
}

/** `buildOutdoorPanoramaEnglish` 의 한국어 완결본. */
export function buildOutdoorPanoramaKorean(side: number, place: string): string {
  const s = round2(side);
  const half = round2(side / 2);
  const eye = OUTDOOR_EYE_HEIGHT;
  return [
    `이음매 없는 360° 등장방형 파노라마 사진 한 장 — 가로 360°, 세로는 똑바로 위부터 똑바로 아래까지 180° 전체. ${s} m × ${s} m 공터 한가운데 땅에 선 사람이 눈높이(렌즈가 땅에서 ${eye} m)에서 완전히 수평으로 찍었습니다. 찍는 사람은 보이지 않습니다.`,
    "",
    "투영: 실제 360° 카메라가 내놓는 진짜 등장방형. 지평선은 그림 세로 한가운데를 가로지르는 곧은 수평선. 그림 위 끝은 머리 바로 위 하늘, 아래 끝은 카메라 바로 아래 땅. 왼쪽·오른쪽 끝은 같은 방향(바로 뒤)이라 이음매 없이 이어집니다. 그림 가운데가 정면, 왼쪽 끝에서 4분의 1 이 왼쪽, 4분의 3 이 오른쪽.",
    "",
    `공간: 그림 아래 절반 전체는 트인 땅뿐 — 풀·흙·길·물·낮은 돌이 지평선까지 이어지고, 아래 절반에 나무줄기·덤불·담·건물은 없습니다. 공터를 둘러싼 나무·건물·바위는 사방 모두 멀리 경계에(카메라에서 ${half} m) 지평선 위에 서서 그 위로만 솟습니다. 달이나 해는 그쪽 방향 한 곳, 나무 선이나 지붕선 바로 위에 낮게, 각각 한 번만, 넓은 사진 속 실제 달처럼 작은 원판으로.`,
    "",
    `장소: ${place}`,
    "",
    "이어진 사진 한 장 — 콜라주·칸 나눔·테두리·액자·글자·워터마크·사람·동물·촬영 장비 없음. 사실적, 영화 같은 사진. 비율 16:9.",
  ].join("\n");
}

/**
 * **방 전개도**(안쪽판·바깥판)의 영문 — 칸을 색이 아니라 **자리**로 부릅니다.
 *
 * 2026-09-15 마그니픽 MCP · 나노 바나나 프로 실측(6×4×3 m, 판마다 2~3 장):
 * - 예전 색 칸 틀(«BLUE 칸은 앞 벽»)은 칸 비율은 잘 지켰지만 **벽마다 틀 색이 물들었고**(왼쪽 벽 붉게, 오른쪽 초록, 뒤 보라),
 * 바깥판은 칸 둘레에 **색 띠**가 그대로 남았습니다.
 * - 바탕과 거의 같은 회색 칸 틀 + «가운데 줄 1번(좁은 4 m) = 왼쪽 벽» 처럼 자리·너비로 부르자 색 물듦·색 띠가 사라지고 배치도
 * 그대로였습니다(셋 중 둘이 칸 비율까지 맞음).
 * - 바깥판 벽 칸에 **박공 삼각형·처마**가 그려져 벽 위로 지붕이 삐져나왔습니다 → «벽 칸에는 평평한 벽면만 — 지붕·박공·처마 없음».
 * 바닥 칸은 «아래에서 올려다본 기단» 이라 적었더니 돌담을 원근으로 그려서 «건물 밑의 맨땅을 똑바로 내려다본 것» 으로 바꿨습니다.
 * - «문은 약 2 m, 벽 높이의 몇 %» 를 적으면 벽 속 물건의 크기가 층고에 맞게 잡힙니다.
 */
export function buildRoomUnfoldEnglish(room: UnfoldRoom | null, place: string, shell: "inner" | "outer"): string {
  const m = (value: number) => `${round2(value)} m`;
  const wide = (value: number) => (room ? ` (${m(value)} wide)` : "");
  const doorPct = room ? Math.min(95, Math.round((2 / room.height) * 100)) : 0;
  const door = room ? ` A wall ${m(room.height)} tall: a door there is about 2 m tall, ${doorPct} % of the wall height.` : "";
  if (shell === "outer") {
    const size = room ? `, ${m(room.width)} wide, ${m(room.depth)} deep, walls ${m(room.height)} tall` : "";
    return [
      `A single photorealistic image: the unfolded box of the OUTSIDE of one building${size}, like an architect's development drawing of its outer skin. No words anywhere in the image.`,
      "",
      `PLACE: ${place}`,
      "",
      `- Middle row, rectangle 1${wide(room?.depth ?? 0)}: the outside of the left wall, seen from outside standing in front of it.`,
      `- Middle row, rectangle 2${wide(room?.width ?? 0)}: the outside of the front wall.`,
      `- Middle row, rectangle 3${wide(room?.depth ?? 0)}: the outside of the right wall.`,
      `- Middle row, rectangle 4${wide(room?.width ?? 0)}: the outside of the back wall.`,
      "- The rectangle above the front wall: the roof surface seen straight down from above, filling the rectangle.",
      "- The rectangle below the front wall: the plain ground under the building seen straight down, filling the rectangle.",
      "",
      `HOW EACH RECTANGLE IS PAINTED: a flat straight-on orthographic elevation of that one outside face, filling its rectangle edge to edge, corner to corner. The camera is perpendicular to the surface. Zero perspective, every vertical line exactly vertical, every horizontal line exactly horizontal. Inside a wall rectangle the bottom edge is exactly where the wall meets the ground and the top edge exactly the eaves line: ONLY the flat wall surface is visible - no roof, no gable triangle, no roof edge or overhang, no sky, no ground, no neighbouring wall, no corner of the building.${door}`,
      "",
      "ONLY THINGS FIXED TO THE WALL APPEAR: the cladding itself, the base along the very bottom edge, windows with frames and shutters, doors, drainpipes, lamps, signs, things pressed flat against the wall. No people, no animals, no plants in front, no parked cars.",
      "",
      "CONTINUITY: one building - the same cladding, the same weathering, the same colour, the same light and time in every rectangle; no rectangle is tinted differently. Where two rectangles touch, that edge is the corner of the building and the base line continues across it at the same height.",
      "",
      "Photorealistic architectural photography, real materials, true photographic detail. Not an illustration, no outlines, no line art. No text, no letters, no numbers, no labels, no coloured strips, no border anywhere.",
    ].join("\n");
  }
  const size = room ? `, ${m(room.width)} wide, ${m(room.depth)} deep, ${m(room.height)} from floor to ceiling` : "";
  return [
    `A single photorealistic image: the unfolded box of one room${size}, like an architect's development drawing. No words anywhere in the image.`,
    "",
    `PLACE: ${place}`,
    "",
    `- Middle row, rectangle 1${wide(room?.depth ?? 0)}: the wall on your left.`,
    `- Middle row, rectangle 2${wide(room?.width ?? 0)}: the wall in front of you.`,
    `- Middle row, rectangle 3${wide(room?.depth ?? 0)}: the wall on your right.`,
    `- Middle row, rectangle 4${wide(room?.width ?? 0)}: the wall behind you.`,
    "- The rectangle above the front wall: the ceiling, seen looking straight up; its lower edge is the top of the front wall.",
    "- The rectangle below the front wall: the floor, seen looking straight down; its upper edge is the bottom of the front wall.",
    "",
    `HOW EACH RECTANGLE IS PAINTED: a flat straight-on orthographic elevation of that one surface, filling its rectangle edge to edge, corner to corner. The camera is perpendicular to the surface. Zero perspective convergence, no vanishing point; every vertical line exactly vertical, every horizontal line exactly horizontal. Inside a wall rectangle the bottom edge is exactly the line where it meets the floor and the top edge exactly where it meets the ceiling - no floor, no ceiling and no neighbouring wall is visible inside it, no corner returns, no depth into the space.${door}`,
    "",
    "ONLY THINGS FIXED TO THE SURFACE APPEAR: the finish itself, doors and frames, windows with frames, built-in shelves and cupboards, radiators, switches, pipes, wall lamps, pictures or maps on the wall, the skirting along the very bottom edge. Nothing free-standing and nothing resting on the floor. No people, no animals. The floor rectangle is the bare finish with nothing standing on it.",
    "",
    "CONTINUITY: one space - the same materials, the same colours, the same light and time in every rectangle; no rectangle is tinted differently from the others. Where two rectangles touch, that edge is the corner between those two surfaces and the skirting line continues across it at the same height.",
    "",
    "Photorealistic architectural photography, real materials, real wood grain, true photographic detail. Not an illustration, no outlines, no line art. No text, no letters, no numbers, no labels, no border anywhere.",
  ].join("\n");
}

/** 방 전개도(안쪽·바깥쪽)의 **한국어 본문** — `buildRoomUnfoldEnglish` 와 같은 뜻. 한글 프롬프트를 그대로 «구성» 으로 보내도 되게. */
export function buildUnfoldKorean(room: UnfoldRoom | null, place: string, shell: "inner" | "outer"): string {
  const m = (value: number) => `${round2(value)} m`;
  const wide = (value: number) => (room ? `(너비 ${m(value)})` : "");
  const doorPct = room ? Math.min(95, Math.round((2 / room.height) * 100)) : 0;
  const door = room ? ` 벽 높이 ${m(room.height)}: 거기 달린 문은 약 2 m, 벽 높이의 ${doorPct}% 입니다.` : "";
  if (shell === "outer") {
    const size = room ? ` — 가로 ${m(room.width)} · 깊이 ${m(room.depth)} · 벽 높이 ${m(room.height)}` : "";
    return [
      `한 장의 사실적인 이미지: 건물 한 채의 **바깥**을 펼친 상자${size}, 외벽 건축 전개도처럼. 그림 어디에도 글자 없음.`,
      "",
      `장소: ${place}`,
      "",
      `- 가운데 줄 1번 사각형${wide(room?.depth ?? 0)}: 왼쪽 벽의 바깥면, 밖에서 그 앞에 서서 본 모습.`,
      `- 가운데 줄 2번 사각형${wide(room?.width ?? 0)}: 앞 벽의 바깥면.`,
      `- 가운데 줄 3번 사각형${wide(room?.depth ?? 0)}: 오른쪽 벽의 바깥면.`,
      `- 가운데 줄 4번 사각형${wide(room?.width ?? 0)}: 뒤 벽의 바깥면.`,
      "- 앞 벽 위 사각형: 위에서 똑바로 내려다본 지붕면, 칸을 가득.",
      "- 앞 벽 아래 사각형: 건물 밑의 맨땅을 똑바로 내려다본 모습, 칸을 가득.",
      "",
      `칠하는 법: 각 사각형은 그 바깥면 하나를 정면에서 본 평면 입면도로 칸을 모서리까지 가득 채웁니다. 카메라는 면에 수직, 원근 없음, 세로선은 수직, 가로선은 수평. 벽 칸의 아래 끝은 벽이 땅과 만나는 선, 위 끝은 처마선 — 평평한 벽면만 보이고 지붕·박공 삼각형·지붕 끝이나 처마 돌출·하늘·땅·옆 벽·건물 모서리는 없습니다.${door}`,
      "",
      "벽에 붙은 것만: 외장재, 맨 아래 끝의 기단, 창틀과 덧문, 문, 빗물받이, 등, 간판, 벽에 딱 붙여 둔 것. 사람·동물·앞에 자란 식물·주차된 차 없음.",
      "",
      "연속성: 건물 한 채 — 모든 칸의 외장재·낡은 정도·색·빛·시간이 같고, 어느 칸도 다른 색으로 물들지 않습니다. 두 칸이 맞닿는 곳은 건물 모서리이고 기단 선이 같은 높이로 이어집니다.",
      "",
      "사실적인 건축 사진, 실제 재질, 사진다운 디테일. 일러스트 아님, 외곽선·선화 없음. 글자·숫자·라벨·색 띠·테두리 없음.",
    ].join("\n");
  }
  const size = room ? ` — 가로 ${m(room.width)} · 깊이 ${m(room.depth)} · 층고 ${m(room.height)}` : "";
  return [
    `한 장의 사실적인 이미지: 방 하나를 펼친 상자${size}, 건축 전개도처럼. 그림 어디에도 글자 없음.`,
    "",
    `장소: ${place}`,
    "",
    `- 가운데 줄 1번 사각형${wide(room?.depth ?? 0)}: 왼쪽 벽.`,
    `- 가운데 줄 2번 사각형${wide(room?.width ?? 0)}: 앞 벽.`,
    `- 가운데 줄 3번 사각형${wide(room?.depth ?? 0)}: 오른쪽 벽.`,
    `- 가운데 줄 4번 사각형${wide(room?.width ?? 0)}: 뒤 벽.`,
    "- 앞 벽 위 사각형: 똑바로 올려다본 천장, 아래 끝이 앞 벽의 위 끝.",
    "- 앞 벽 아래 사각형: 똑바로 내려다본 바닥, 위 끝이 앞 벽의 아래 끝.",
    "",
    `칠하는 법: 각 사각형은 그 면 하나를 정면에서 본 평면 입면도로 칸을 모서리까지 가득 채웁니다. 카메라는 면에 수직, 원근 수렴·소실점 없음, 세로선은 수직, 가로선은 수평. 벽 칸의 아래 끝은 바닥과 만나는 선, 위 끝은 천장과 만나는 선 — 바닥·천장·옆 벽이 칸 안에 보이지 않습니다.${door}`,
    "",
    "면에 붙은 것만: 마감재, 문과 문틀, 창틀, 붙박이 선반과 장, 라디에이터, 스위치, 배관, 벽등, 벽에 건 그림이나 지도, 맨 아래 끝의 걸레받이. 세워 둔 가구·바닥에 놓인 것 없음. 사람·동물 없음. 바닥 칸은 아무것도 놓이지 않은 맨바닥.",
    "",
    "연속성: 한 공간 — 모든 칸의 재질·색·빛·시간이 같고, 어느 칸도 다른 색으로 물들지 않습니다. 두 칸이 맞닿는 곳은 두 면의 모서리이고 걸레받이 선이 같은 높이로 이어집니다.",
    "",
    "사실적인 건축 사진, 실제 재질, 실제 나뭇결, 사진다운 디테일. 일러스트 아님, 외곽선·선화 없음. 글자·숫자·라벨·테두리 없음.",
  ].join("\n");
}


