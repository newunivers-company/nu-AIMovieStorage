import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGenerationInfo, describeGeneration } from "@/lib/generationInfo";

const at = new Date("2026-09-27T14:12:00Z");

describe("생성 정보 — 결과에서 만들기", () => {
  it("사내 ComfyUI 결과는 서버가 실제로 쓴 값을 먼저 믿습니다", () => {
    // 2026-09-27 H3 i2v 결과의 meta 모양(comfy_gen.rs 의 `filled.values` + 덧붙인 칸).
    const info = buildGenerationInfo(
      "minimaxh3",
      { prompt: "원래 프롬프트", width: 830, seconds: 3, loras: [{ path: "minimax_h3/look.safetensors", weight: 1, server: true }] },
      {
        seconds: 44.37,
        meta: {
          backend: "comfy",
          endpoint: "http://192.168.0.136:8191",
          prompt_id: "abc-123",
          workflow: "minimaxh3_i2v",
          prompt: "look trigger, 원래 프롬프트",
          width: 832,
          height: 480,
          frames: 73,
          fps: 24,
          seconds: 3,
          seed: 7,
          speed: "fast",
          loras_used: ["minimax_h3\\look.safetensors"],
          references: 2,
          motion_mask: true,
          image: "aimoviestorage_x_first.png",
        },
      },
      at,
    );
    expect(info).toEqual({
      engine: "minimaxh3",
      model: "MiniMax H3",
      backend: "comfy",
      host: "192.168.0.136:8191",
      promptId: "abc-123",
      workflow: "minimaxh3_i2v",
      prompt: "look trigger, 원래 프롬프트",
      seed: 7,
      width: 832,
      height: 480,
      seconds: 3,
      frames: 73,
      fps: 24,
      speed: "fast",
      loras: ["minimax_h3\\look.safetensors"],
      references: 2,
      motionMask: true,
      took: 44.4,
      at: "2026-09-27T14:12:00.000Z",
    });
  });

  it("로컬 결과는 보낸 값으로 채우고, 서버 로라는 걸리지 않았으니 적지 않습니다", () => {
    const info = buildGenerationInfo(
      "zimage",
      {
        prompt: "a cat",
        negative: "blurry",
        width: 1024,
        height: 576,
        loras: [
          { path: "C:\\loras\\zimage\\film.safetensors", weight: 0.8 },
          { path: "zimage/server.safetensors", weight: 1, server: true },
        ],
      },
      { seconds: 12, meta: { seed: 99, workflow: "t2i" } },
      at,
    );
    expect(info.backend).toBe("local");
    expect(info.host).toBeUndefined();
    expect(info.seed).toBe(99);
    expect(info.negative).toBe("blurry");
    expect(info.loras).toEqual(["film.safetensors"]);
    // 빈 칸은 키째 없습니다 — 작품 파일에 undefined 줄이 쌓이지 않게.
    expect(Object.values(info).includes(undefined)).toBe(false);
    expect("lorasFailed" in info).toBe(false);
  });

  it("안 붙은 로라는 표시하고 사람이 읽는 글에도 적습니다", () => {
    const info = buildGenerationInfo(
      "qwenimage",
      { prompt: "p" },
      { seconds: 9, meta: { backend: "comfy", loras_used: ["qwen/a.safetensors"], loras_failed: true, seed: 1, width: 1024, height: 576 } },
      at,
    );
    expect(info.lorasFailed).toBe(true);
    const text = describeGeneration(info);
    expect(text).toContain("Qwen-Image 2.1 · 사내 ComfyUI");
    expect(text).toContain("1024×576 · 시드 1 · 9초 걸림");
    expect(text).toContain("로라: qwen/a.safetensors (서버 로그에 못 붙임 기록)");
    expect(text).toContain("프롬프트: p");
  });
});

describe("생성 정보 — 카드까지 이어지는가", () => {
  const read = (path: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), path), "utf8");
  it("단추 → 카드 세 곳, 일괄 작업 세 곳이 모두 기록을 붙입니다", () => {
    expect(read("localOutput.ts")).toContain("generation: buildGenerationInfo(");
    expect(read("../components/LocalGenerateButton.tsx")).toContain("onDone(result.path, result.name, result.generation)");
    for (const card of ["CutPromptSection.tsx", "CutVideoSection.tsx", "PromptCardBody.tsx"]) {
      expect(read(`../components/project/${card}`), card).toMatch(/generation,|generation \}/);
    }
    expect(read("batchRun.ts").match(/generationOf\(made\)/g)?.length).toBe(4);
  });
});
