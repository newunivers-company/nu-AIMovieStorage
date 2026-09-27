import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
  재생 중에는 React 상태를 바꾸지 않고 DOM 을 직접 고칩니다(`usePlannerPlayback`). 고칠 대상이 화면에
  없으면 아무 일도 안 일어나 조용히 멈춰 보입니다 — 2026-09-26 회귀 점검에서 타임라인의 시각 글자가
  재생 내내 0.00s 였습니다(ref 를 단 글자가 없었음). 칠하는 쪽과 칠해질 글자가 같은 표지를 쓰는지 봅니다.
*/
const read = (name: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), name), "utf8");

describe("재생 중 시각 글자", () => {
  it("재생 루프가 표지 달린 글자를 모두 고칩니다", () => {
    const hook = read("usePlannerPlayback.ts");
    expect(hook).toContain('querySelectorAll<HTMLElement>("[data-playhead-label]")');
    // 아무 글자에도 안 달린 ref 로 되돌아가지 않게.
    expect(hook).not.toContain("const playheadLabelRef");
  });

  it("타임라인의 접힘·펼침 두 모습 모두 시각 글자에 표지가 있습니다", () => {
    const timeline = read("MoveTimeline.tsx");
    expect(timeline.match(/<span data-playhead-label>\{playhead\.toFixed\(2\)\}s<\/span>/g)?.length).toBe(2);
  });
});
