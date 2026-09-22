import { describe, expect, it } from "vitest";
import type { DrawableMark } from "@/lib/imageMarkDraw";
import {
  MOTION_MASK_ACTION,
  describeMotionMask,
  findMotionMask,
  hasMotionMarks,
  isMotionMark,
  isMotionMaskName,
  motionMaskShapes,
  paintMotionMask,
} from "@/lib/motionMask";

/**
 * 마스크 굽기의 약속을 못 박습니다.
 *
 * 틀려도 **눈으로는 안 보이는** 종류라 시험이 셉니다 — 흑백이 뒤집히면 「움직이라고 한 곳만
 * 얼어붙는」 영상이 나오는데, 사람은 그냥 「모델이 말을 안 듣는다」 로 봅니다. 캔버스는
 * node 에 없으므로 **부른 순서를 받아 적는 가짜 붓**으로 셉니다.
 */

const rect = (x1: number, y1: number, x2: number, y2: number, motion = true): DrawableMark => ({
  shape: "rect",
  points: [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ],
  motion,
});

/** 캔버스 대신 부른 것을 받아 적습니다. 흑백 순서와 칠한 자리를 여기서 읽습니다. */
function fakeContext() {
  const calls: string[] = [];
  const state = { fillStyle: "", strokeStyle: "", lineWidth: 0 };
  const context = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(value: string) {
      state.fillStyle = value;
      calls.push(`fillStyle=${value}`);
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(value: number) {
      state.lineWidth = value;
      calls.push(`lineWidth=${value}`);
    },
    lineJoin: "",
    lineCap: "",
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect(${x},${y},${w},${h})@${state.fillStyle}`),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
    ellipse: (cx: number, cy: number, rx: number, ry: number) =>
      calls.push(`ellipse(${cx},${cy},${rx},${ry})`),
    fill: () => calls.push(`fill@${state.fillStyle}`),
    stroke: () => calls.push(`stroke@${state.strokeStyle}`),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

describe("무엇이 «움직임 구역» 인가", () => {
  it("켜 둔 사각형·원·자유선만이고, 앵커는 켜도 아닙니다", () => {
    expect(isMotionMark(rect(0, 0, 1, 1))).toBe(true);
    expect(isMotionMark(rect(0, 0, 1, 1, false))).toBe(false);
    // 앵커는 «점» 이라 칠할 넓이가 없습니다. 켜져 있어도 구역이 되면 마스크가 비어 보입니다.
    expect(isMotionMark({ shape: "anchor", points: [{ x: 0.5, y: 0.5 }], motion: true })).toBe(false);
  });

  it("옛 자료(칸이 아예 없는 표시)는 «움직임 아님» 입니다", () => {
    expect(isMotionMark({ shape: "rect", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).toBe(false);
    expect(hasMotionMarks([{ shape: "rect", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }])).toBe(false);
  });

  it("하나라도 있으면 구울 것이 있습니다", () => {
    expect(hasMotionMarks([])).toBe(false);
    expect(hasMotionMarks([rect(0, 0, 0.5, 0.5, false), rect(0.6, 0.6, 0.9, 0.9)])).toBe(true);
  });
});

describe("0~1 비율 → 원본 픽셀", () => {
  it("사각형은 어느 쪽에서 끌었든 같은 자리입니다", () => {
    const forward = motionMaskShapes([rect(0.25, 0.5, 0.75, 1)], 1000, 500);
    const backward = motionMaskShapes([rect(0.75, 1, 0.25, 0.5)], 1000, 500);
    expect(forward).toEqual([{ kind: "rect", x: 250, y: 250, w: 500, h: 250 }]);
    expect(backward).toEqual(forward);
  });

  it("원은 가운데와 반지름으로 옮깁니다", () => {
    expect(
      motionMaskShapes(
        [{ shape: "ellipse", points: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }], motion: true }],
        800,
        600,
      ),
    ).toEqual([{ kind: "ellipse", cx: 200, cy: 300, rx: 200, ry: 300 }]);
  });

  it("자유선은 긴 변에 맞춘 띠 굵기를 함께 돌려줍니다", () => {
    const [shape] = motionMaskShapes(
      [
        {
          shape: "free",
          points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.5 },
            { x: 1, y: 0.25 },
          ],
          motion: true,
        },
      ],
      2000,
      1000,
    );
    expect(shape).toMatchObject({ kind: "path" });
    if (shape.kind !== "path") throw new Error("자유선이 길로 안 나왔습니다");
    expect(shape.points).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 500 },
      { x: 2000, y: 250 },
    ]);
    // 긴 변(2000)의 3.5% — 화면 크기가 아니라 원본 크기를 따라야 같은 굵기로 보입니다.
    expect(shape.band).toBeCloseTo(70);
  });

  it("점 하나짜리 자유선과 켜지 않은 표시는 빠집니다", () => {
    expect(
      motionMaskShapes(
        [
          { shape: "free", points: [{ x: 0.5, y: 0.5 }], motion: true },
          rect(0, 0, 1, 1, false),
        ],
        100,
        100,
      ),
    ).toEqual([]);
  });

  it("납작하게 그린 자리도 1픽셀은 남습니다 — 0 이면 그렸는데 사라집니다", () => {
    expect(motionMaskShapes([rect(0.5, 0.5, 0.5, 0.5)], 1000, 1000)).toEqual([
      { kind: "rect", x: 500, y: 500, w: 1, h: 1 },
    ]);
  });
});

describe("마스크 굽기", () => {
  it("검정으로 판을 덮고 그 위에 흰 구역을 칠합니다 — 순서가 뒤집히면 온통 검정입니다", () => {
    const { context, calls } = fakeContext();
    paintMotionMask(context, [rect(0, 0, 0.5, 0.5)], 200, 100);

    const bg = calls.indexOf("fillRect(0,0,200,100)@#000000");
    const white = calls.indexOf("fillRect(0,0,100,50)@#ffffff");
    expect(bg).toBeGreaterThanOrEqual(0);
    expect(white).toBeGreaterThan(bg);
    expect(calls[0]).toBe("save");
    expect(calls[calls.length - 1]).toBe("restore");
  });

  it("움직임 구역이 하나도 없으면 온통 검정입니다 — 흰 칠이 한 번도 없습니다", () => {
    const { context, calls } = fakeContext();
    paintMotionMask(context, [rect(0, 0, 1, 1, false)], 64, 64);
    expect(calls.filter((call) => call.includes("@#ffffff"))).toEqual([]);
  });

  it("자유선은 안쪽을 채우고 띠로도 칠합니다 — 띠만 칠하면 가운데가 검게 남습니다", () => {
    const { context, calls } = fakeContext();
    paintMotionMask(
      context,
      [
        {
          shape: "free",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.9, y: 0.9 },
          ],
          motion: true,
        },
      ],
      100,
      100,
    );
    expect(calls).toContain("closePath");
    expect(calls).toContain("fill@#ffffff");
    expect(calls).toContain("stroke@#ffffff");
  });
});

describe("이름으로 마스크 찾기", () => {
  it("«…_움직임» 과 번호가 붙은 것만 마스크입니다", () => {
    expect(MOTION_MASK_ACTION).toBe("움직임");
    expect(isMotionMaskName("냥이_클로즈업_움직임_001")).toBe(true);
    expect(isMotionMaskName("냥이_움직임")).toBe(true);
    expect(isMotionMaskName("냥이_움직임_003.png")).toBe(true);
    // 표시한 그림·동선 그림이 걸리면 마스크 자리에 그림이 올라갑니다.
    expect(isMotionMaskName("냥이_클로즈업_표시_001")).toBe(false);
    expect(isMotionMaskName("냥이_클로즈업_동선_001")).toBe(false);
    // 꼬리가 아니라 가운데에 든 말은 다른 파일입니다.
    expect(isMotionMaskName("냥이_움직임_구역_001")).toBe(false);
  });

  it("여러 장이면 가장 마지막 것 — 다시 구운 판이 뒤에 쌓입니다", () => {
    const images = [
      { name: "냥이_움직임_001", filePath: "/a/냥이_움직임_001.png" },
      { name: "냥이_클로즈업_001", filePath: "/a/냥이_클로즈업_001.png" },
      { name: "냥이_움직임_002", filePath: "/a/냥이_움직임_002.png" },
    ];
    expect(findMotionMask(images)?.name).toBe("냥이_움직임_002");
  });

  it("폴더에 없는 그림(경로가 없는 것)은 못 보냅니다", () => {
    expect(findMotionMask([{ name: "냥이_움직임_001", filePath: null }])).toBeNull();
    expect(findMotionMask([])).toBeNull();
  });
});

describe("프롬프트 한 줄", () => {
  it("흰 구역과 검은 구역을 **둘 다** 말합니다 — 한쪽만 말하면 나머지도 덩달아 흔들립니다", () => {
    const line = describeMotionMask({ name: "냥이_움직임_001" });
    expect(line.ko).toContain("냥이_움직임_001");
    expect(line.ko).toContain("흰 구역");
    expect(line.ko).toContain("검은 구역");
    expect(line.en).toContain("white areas move");
    expect(line.en).toContain("black areas stay locked");
  });

  it("이름이 없어도 문장이 성립합니다", () => {
    const line = describeMotionMask();
    expect(line.ko).toContain("흑백 마스크");
    expect(line.en).toContain("black-and-white mask");
  });
});
