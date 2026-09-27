import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SERVER_LORA_RULES,
  isServerLora,
  searchServerLoras,
  serverLoraKey,
  serverLoraLabel,
  serverLoraName,
  serverLorasFor,
  serverLorasToRun,
} from "@/lib/comfyLoras";
import { lorasToRun } from "@/lib/localLoras";
import { COMFY_REMOTE_ENGINES } from "@/lib/comfyFleet";

// 2026-09-27 사내 서버 `/models/loras` 에서 뽑은 일부(폴더 구조가 그대로인 것).
const SERVER = [
  "2.5D Fantasy Style.safetensors",
  "qwen/cinematic_redmond_qwen.safetensors",
  "qwen/qwen-image-edit-2511-multiple-angles-lora.safetensors",
  "qwen/Qwen-Image-Edit-Unblur-Upscale_20.safetensors",
  "qwen_edit/something.safetensors",
  "zimage/Cinematic Film Color style zib v2.safetensors",
  "zimage/Z-Image-Fun-Lora-Distill-2603_UDCAI_ComfyUI.safetensors",
  "krea2/ultra_real_krea2_v2.safetensors",
  "krea2/krea2_raw_to_turbo_r256_comfy.safetensors",
  "krea2_style/amber-noir-chiaroscuro.safetensors",
  "minimax_h3/Minimax_H3_Cinematic_Look_v01.safetensors",
  "minimax_h3/minimax_h3_fl2v_lightx2v_turbo_8step_v1.0_rank24_bf16.safetensors",
  "minimax_h3/camera_motion_h3_lora_v1_1000_pruned.safetensors",
  "wan22_360/[WAN2.2]360Rotation_Redmond_high_noise.safetensors",
  "lightx2v/wan22_i2v_seko_v1_high_noise_model.safetensors",
  "ltx2.5/LTX-2.5-Licon-MSR-V1.safetensors",
  "ltx-2.5-22b-ic-lora-pixel-spatial-upscaler-x2-1.0.safetensors",
  "ltxv/ltx2/ltx-2.3-22b-lora-cinemagraph-0.9.safetensors",
];

describe("서버 로라 — 엔진에 맞는 것 고르기", () => {
  it("폴더로 엔진을 가리고, 속도용·편집용·IC·업스케일은 뺍니다", () => {
    // v1·2512 용은 2.1 에 안 붙습니다(실측) — 2.1 이라고 적힌 것만.
    expect(serverLorasFor("qwenimage", SERVER)).toEqual([]);
    expect(serverLorasFor("qwenimage", ["qwen/some_style_qwen_image_2.1.safetensors"])).toEqual([
      "qwen/some_style_qwen_image_2.1.safetensors",
    ]);
    expect(serverLorasFor("zimage", SERVER)).toEqual(["zimage/Cinematic Film Color style zib v2.safetensors"]);
    expect(serverLorasFor("krea2", SERVER)).toEqual([
      "krea2/ultra_real_krea2_v2.safetensors",
      "krea2_style/amber-noir-chiaroscuro.safetensors",
    ]);
    expect(serverLorasFor("minimaxh3", SERVER)).toEqual([
      "minimax_h3/Minimax_H3_Cinematic_Look_v01.safetensors",
      "minimax_h3/camera_motion_h3_lora_v1_1000_pruned.safetensors",
    ]);
    expect(serverLorasFor("wanvideo", SERVER)).toEqual(["wan22_360/[WAN2.2]360Rotation_Redmond_high_noise.safetensors"]);
    // LTX 2.3 의 로라는 2.5 에 권하지 않습니다.
    expect(serverLorasFor("ltx25", SERVER)).toEqual(["ltx2.5/LTX-2.5-Licon-MSR-V1.safetensors"]);
    expect(serverLorasFor("acestep", SERVER)).toEqual([]);
  });

  it("원격으로 도는 그림·영상 엔진은 모두 규칙이 있습니다", () => {
    for (const engine of COMFY_REMOTE_ENGINES.filter((id) => id !== "acestep")) {
      expect(SERVER_LORA_RULES[engine], engine).toBeInstanceOf(RegExp);
    }
  });

  it("검색은 띄어 쓴 말이 모두 들어 있는 것을 대소문자 없이 찾습니다", () => {
    expect(searchServerLoras(SERVER, "CINEMATIC h3")).toEqual(["minimax_h3/Minimax_H3_Cinematic_Look_v01.safetensors"]);
    expect(searchServerLoras(SERVER, "  ")).toBe(SERVER);
  });

  it("이름표는 폴더와 확장자를 뗍니다", () => {
    expect(serverLoraLabel("krea2_style/amber-noir-chiaroscuro.safetensors")).toBe("amber-noir-chiaroscuro");
    expect(serverLoraLabel("memu.safetensors")).toBe("memu");
  });
});

describe("서버 로라 — 고른 값에서 생성 인자로", () => {
  it("comfy: 머리를 떼고 서버 경로 그대로, 세기 1, 서버 표시를 붙여 보냅니다", () => {
    const key = serverLoraKey("qwen/cinematic_redmond_qwen.safetensors");
    expect(isServerLora(key)).toBe(true);
    expect(isServerLora("C:\\loras\\mine.safetensors")).toBe(false);
    expect(serverLoraName(key)).toBe("qwen/cinematic_redmond_qwen.safetensors");
    expect(serverLorasToRun([key, "C:\\loras\\mine.safetensors"])).toEqual([
      { path: "qwen/cinematic_redmond_qwen.safetensors", weight: 1, server: true },
    ]);
  });

  it("lorasToRun 은 이 컴퓨터에 없는 서버 로라도 함께 돌려줍니다", () => {
    const key = serverLoraKey("minimax_h3/Minimax_H3_Cinematic_Look_v01.safetensors");
    expect(lorasToRun("minimaxh3", [key], [])).toEqual([
      { path: "minimax_h3/Minimax_H3_Cinematic_Look_v01.safetensors", weight: 1, server: true },
    ]);
  });
});

describe("서버 로라 — 로컬로 돌 때", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "localEngines.ts"), "utf8");
  it("로컬 워커에는 서버 로라를 빼고 보내고, 뺀 것을 결과에 적습니다", () => {
    expect(source).toContain("filter((lora) => !lora.server)");
    expect(source).toContain("opts: localOptions");
    expect(source).toContain("server_loras_skipped");
  });
});
