import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SURFACE_BOX, SURFACE_MEDIA } from "./imageSurface";

/*
  **편집 화면의 크기 규칙이 흩어지지 않게 셉니다.**

  탭을 옮기면 같은 그림이 커졌습니다. 자르기 탭만 고쳤더니 표시하기·동선·파노라마는 그대로
  부풀었습니다 — 같은 규칙이 다섯 벌 적혀 있었기 때문입니다(여덟 곳은 맞고 한 곳만 틀린 모양).

  읽어서는 못 찾습니다. 그래서 **자료로** 셉니다.
*/

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(HERE, "../components");

/** 그림 위에 무언가를 얹는 화면들. 새 편집 탭을 만들면 여기 더하세요. */
const SURFACES = [
  "sheet/CropperSurface.tsx",
  "ImageMarkupEditor.tsx",
  "MotionLines.tsx",
  "PanoramaWorkbench.tsx",
];

describe("편집 화면 크기 규칙", () => {
  it("규칙은 한 벌뿐입니다 — 화면마다 따로 적지 않습니다", () => {
    const strays: string[] = [];
    for (const name of SURFACES) {
      const text = readFileSync(join(COMPONENTS, name), "utf8");
      if (!text.includes("SURFACE_MEDIA")) strays.push(`${name}: 공용 규칙을 안 씁니다`);
      /*
        `w-full` 을 그림·캔버스에 직접 붙이면 **칸 너비에 맞춰 늘어납니다.** 창이 넓을수록
        그림이 부풀어 세로가 창을 넘고, 아래 띠(저장·닫기)가 화면 밖으로 밀립니다.
      */
      for (const hit of text.matchAll(/<(?:img|canvas)[^>]*className="([^"]*)"/g)) {
        /*
          **겹쳐 깔리는 덧그림 판은 뺍니다.** `absolute inset-0` 인 것은 감싸개를 그대로 채우는
          것이 제 일이라 `w-full` 이 맞습니다 — 크기를 정하는 것은 그 아래 그림이고, 이 판은
          그림이 정한 크기를 따라갈 뿐입니다. 거르지 않으면 맞는 코드가 시험에 걸립니다.
        */
        if (/\babsolute\b/.test(hit[1]) && /\binset-0\b/.test(hit[1])) continue;
        if (/\bw-full\b/.test(hit[1])) strays.push(`${name}: <img|canvas> 에 w-full — ${hit[1]}`);
      }
    }
    expect(strays, "편집 화면이 제 나름의 크기 규칙을 갖고 있습니다").toEqual([]);
  });

  it("감싸개는 그림과 같은 크기입니다 — 얹는 것이 백분율이라서", () => {
    // `w-fit` 이 빠지면 상자가 칸 전체를 차지해, 위에 얹은 상자·번호·선이 전부 왼쪽으로 쏠립니다.
    expect(SURFACE_BOX).toContain("w-fit");
    expect(SURFACE_MEDIA).toContain("max-w-full");
    expect(SURFACE_MEDIA).toMatch(/max-h-\[\d+vh\]/);
  });
});
