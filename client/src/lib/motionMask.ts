import type { DrawableMark } from "@/lib/imageMarkDraw";

/**
 * **«여기는 움직인다» 마스크** — 그림 위에 그린 표시를 흑백 PNG 한 장으로 굽는 셈.
 *
 * # 왜 필요한가
 *
 * 구도잡기가 뽑는 레퍼런스 영상은 배경이 **정지 이미지**입니다. 영상 모델은 그 정지 화면을
 * 「이 구역은 안 움직인다」 로 읽어 배경을 얼려 버립니다 — 달리는 차 안 컷인데 창밖 풍경이
 * 한 픽셀도 안 바뀝니다. 반대로 캐릭터 스왑에서는 **인물은 단단히 붙들고 배경은 자유롭게**
 * 두어야 하는데, 조건 세기는 화면 전체에 한 덩이로 걸립니다.
 *
 * 둘 다 「어느 구역이냐」 를 말할 수단이 없어서 생기는 일입니다. 흰 구역은 움직이고 검은
 * 구역은 고정 — 그 한 장이면 갈라집니다.
 *
 * # 흰색이 «움직임» 인 까닭
 *
 * 인페인팅·비디오 인페인팅 계열이 모두 **흰색을 «여기를 새로 그려라»** 로 씁니다. 반대로
 * 두면 받는 쪽마다 뒤집는 코드가 생기고, 그중 한 곳이 뒤집기를 빠뜨리면 정확히 반대인
 * 영상이 나옵니다 — 읽어서는 못 찾습니다. 여기서 한 번 정하고 그대로 씁니다.
 *
 * # 순수한 셈과 붓질을 갈라 둡니다
 *
 * `motionMaskShapes` 는 «0~1 비율 표시 → 원본 픽셀 도형» 까지만 합니다(캔버스가 없어도
 * 돕니다 — 시험이 이것을 셉니다). 캔버스를 만지는 것은 `paintMotionMask` 하나뿐입니다.
 */

/**
 * 마스크 파일 이름에 붙는 말 — `냥이_클로즈업_움직임_001`.
 *
 * 짓는 쪽(`mediaLibrary.editedStem` 의 `EditAction`)과 찾는 쪽(`isMotionMaskName`)이
 * **같은 글자**를 봐야 합니다. 두 벌로 적으면 한쪽만 고치는 날이 오고, 그날 마스크는
 * 폴더에 멀쩡히 있는데 아무도 못 찾습니다.
 */
export const MOTION_MASK_ACTION = "움직임";

/**
 * 화면에서 «움직임 구역» 표시를 칠하는 색.
 *
 * 번호 색(`markColor`)과 **겹치지 않는 값**이어야 합니다 — 겹치면 ①번 구역과 움직임 구역이
 * 같은 색으로 보여 한눈에 안 갈립니다. 색만으로는 색각 차이에서 약하므로 그리는 쪽이
 * 점선 + 반투명 채우기를 같이 씁니다(`drawImageMarks`).
 */
export const MOTION_MARK_COLOR = "#00e0c6";

/** 자유선은 선이라 넓이가 없습니다. 긴 변의 이 비율만큼 굵은 띠로 칠해 구역이 되게 합니다. */
export const MOTION_FREE_BAND = 0.035;

/** 이 표시가 «움직이는 구역» 인가. 앵커는 점이라 구역이 될 수 없습니다. */
export function isMotionMark(mark: DrawableMark): boolean {
  return mark.motion === true && mark.shape !== "anchor";
}

/** 하나라도 «움직임 구역» 이 있는가 — 단추를 띄울지, 구울 것이 있는지 가릅니다. */
export function hasMotionMarks(marks: DrawableMark[]): boolean {
  return marks.some(isMotionMark);
}

/** 마스크에 흰색으로 칠할 도형 하나. 좌표는 **원본 픽셀**입니다. */
export type MaskShape =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  /** 자유선 — 지나간 자리를 이은 길. `band` 만큼 굵게 칠하고 안쪽도 채웁니다. */
  | { kind: "path"; points: { x: number; y: number }[]; band: number };

/**
 * «움직임 구역» 표시를 원본 픽셀 도형으로 옮깁니다. **캔버스를 만지지 않습니다.**
 *
 * 크기는 최소 1픽셀로 눌러 둡니다 — 0 이면 칠할 것이 없어 조용히 빠지는데, 사람은
 * 「그렸는데 왜 마스크에 없지」 만 보게 됩니다.
 */
export function motionMaskShapes(
  marks: DrawableMark[],
  width: number,
  height: number,
): MaskShape[] {
  const band = Math.max(1, Math.max(width, height) * MOTION_FREE_BAND);
  const shapes: MaskShape[] = [];

  for (const mark of marks) {
    if (!isMotionMark(mark)) continue;
    const first = mark.points[0];
    const last = mark.points[mark.points.length - 1];
    if (!first || !last) continue;

    if (mark.shape === "free") {
      const points = mark.points.map((point) => ({
        x: point.x * width,
        y: point.y * height,
      }));
      if (points.length < 2) continue;
      shapes.push({ kind: "path", points, band });
      continue;
    }

    const x1 = first.x * width;
    const y1 = first.y * height;
    const x2 = last.x * width;
    const y2 = last.y * height;
    const w = Math.max(1, Math.abs(x2 - x1));
    const h = Math.max(1, Math.abs(y2 - y1));

    if (mark.shape === "ellipse") {
      shapes.push({
        kind: "ellipse",
        cx: (x1 + x2) / 2,
        cy: (y1 + y2) / 2,
        rx: w / 2,
        ry: h / 2,
      });
    } else {
      shapes.push({ kind: "rect", x: Math.min(x1, x2), y: Math.min(y1, y2), w, h });
    }
  }

  return shapes;
}

/**
 * 캔버스에 마스크를 칠합니다 — **바탕은 검정, 움직임 구역만 흰색**.
 *
 * 그림은 그리지 않습니다. 부르는 쪽이 원본과 **같은 크기**의 캔버스를 주어야 합니다 —
 * 화면 크기로 구우면 생성기에서 구역이 어긋납니다(표시 좌표가 0~1 비율인 까닭도 이것입니다).
 *
 * 자유선은 «길» 을 굵은 띠로 칠하고 **안쪽도 채웁니다.** 사람이 구역을 그릴 때 동그라미를
 * 그리듯 한 바퀴 돌리는 일이 흔한데, 띠만 칠하면 가운데가 검게 남아 「테두리만 움직이는」
 * 이상한 마스크가 됩니다.
 */
export function paintMotionMask(
  context: CanvasRenderingContext2D,
  marks: DrawableMark[],
  width: number,
  height: number,
): void {
  context.save();
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#ffffff";
  context.lineJoin = "round";
  context.lineCap = "round";

  for (const shape of motionMaskShapes(marks, width, height)) {
    if (shape.kind === "rect") {
      context.fillRect(shape.x, shape.y, shape.w, shape.h);
      continue;
    }
    if (shape.kind === "ellipse") {
      context.beginPath();
      context.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      context.fill();
      continue;
    }
    context.beginPath();
    shape.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.fill();
    context.lineWidth = shape.band;
    context.stroke();
  }

  context.restore();
}

/**
 * 이 파일 이름이 움직임 마스크인가 — `냥이_클로즈업_움직임_001` · `냥이_움직임`.
 *
 * 번호 꼬리(`_001`)는 저장할 때 Rust 가 붙이므로 있을 수도 없을 수도 있습니다.
 * 확장자는 있어도 되고 없어도 됩니다(화면 이름은 몸통만 들고 있습니다).
 */
export function isMotionMaskName(name: string): boolean {
  const stem = name.replace(/\.[a-z0-9]+$/i, "").trim();
  return new RegExp(`(^|_)${MOTION_MASK_ACTION}(_\\d+)?$`).test(stem);
}

/**
 * 그림 목록에서 이 그림의 움직임 마스크를 찾습니다.
 *
 * **이름으로** 찾는 까닭: 마스크는 저장된 순간부터 그냥 생성 이미지 한 장입니다(`GeneratedImageAsset`
 * 에는 «무엇으로 만든 파일인가» 칸이 없습니다). 파일 이름이 곧 그 표라, 규칙을 여기 한 벌만 둡니다.
 *
 * 여럿이면 **가장 마지막 것** — 다시 구운 판이 뒤에 쌓이고, 새로 그린 것이 쓰려던 것입니다.
 */
export function findMotionMask<T extends { name?: string; filePath?: string | null }>(
  images: readonly T[],
): T | null {
  for (let index = images.length - 1; index >= 0; index -= 1) {
    const image = images[index];
    if (!image?.filePath) continue;
    if (isMotionMaskName(image.name || image.filePath)) return image;
  }
  return null;
}

/**
 * 마스크를 함께 올릴 때 **프롬프트에 싣는 한 줄**.
 *
 * `cutVideoPrompt.ts` 의 `vfx` 자리를 본떴습니다 — 한국어와 영어를 따로 돌려주고, 부르는 쪽이
 * 제 `ko`·`en` 목록에 밀어 넣습니다. «고정» 쪽을 반드시 함께 적습니다: 흰 구역만 말하면 모델이
 * 나머지도 덩달아 흔듭니다.
 *
 * 이름을 주면 문장이 그 파일을 짚습니다 — 레퍼런스를 여러 장 올릴 때 어느 것이 마스크인지
 * 모델이 알아야 합니다.
 */
export function describeMotionMask(input?: { name?: string }): {
  ko: string;
  en: string;
} {
  const name = input?.name?.trim();
  const which = name ? `«${name}»` : "흑백 마스크";
  const whichEn = name ? `"${name}"` : "the black-and-white mask";
  return {
    ko:
      `첨부한 ${which} 는 움직임 마스크입니다. **흰 구역만 움직이고**, 검은 구역은 첫 프레임 그대로 ` +
      "붙박이입니다 — 검은 쪽의 물건·무늬·빛은 한 픽셀도 바뀌지 않습니다.",
    en:
      `${whichEn} is a motion mask: only the white areas move. The black areas stay locked to the first ` +
      "frame - objects, textures and lighting there do not change by a single pixel.",
  };
}
