import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMFY_MODEL_LABEL,
  COMFY_PREFERRED,
  COMFY_REMOTE_ENGINES,
  comfyDroppedNote,
  comfyHostOf,
  isComfyCancelled,
  isComfyRemote,
  loadComfyFleet,
  remoteOrder,
} from "@/lib/comfyFleet";
import { LOCAL_ENGINE_CATALOG, type LocalEngineId } from "@/lib/localEngines";

/*
  사내 ComfyUI 로 뽑을 수 있는 엔진이 **두 벌**(Rust `comfy_gen.rs` 의 `REMOTE_ENGINES`,
  프런트 `COMFY_REMOTE_ENGINES`)입니다. 한쪽만 고치면 화면은 «원격으로 됩니다» 하고 Rust 는
  「뽑을 수 없는 엔진」 이라 거절합니다. 그래서 Rust 파일을 직접 읽어 견줍니다.
*/
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../../../src-tauri/src");
const RUST = readFileSync(join(SRC, "comfy_gen.rs"), "utf8");
const WORKFLOW_DIR = join(SRC, "comfy_workflows");

function rustRemoteEngines(): string[] {
  const matched = RUST.match(/pub const REMOTE_ENGINES: &\[&str\] = &\[([^\]]*)\]/);
  if (!matched) throw new Error("REMOTE_ENGINES 를 찾지 못했습니다");
  return [...matched[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("사내 ComfyUI 엔진 목록", () => {
  it("프런트와 Rust 의 목록이 같다", () => {
    expect([...COMFY_REMOTE_ENGINES].sort()).toEqual(rustRemoteEngines().sort());
  });

  it("모두 카탈로그에 있는 엔진이고, 모션 캡처는 없다", () => {
    for (const id of COMFY_REMOTE_ENGINES) {
      expect(LOCAL_ENGINE_CATALOG[id], id).toBeTruthy();
      expect(LOCAL_ENGINE_CATALOG[id].kind).not.toBe("mocap");
    }
  });

  it("워크플로 파일마다 엔진과 확장자가 카탈로그와 맞고, Rust 가 그 파일을 품는다", () => {
    const files = readdirSync(WORKFLOW_DIR).filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(COMFY_REMOTE_ENGINES.length);
    for (const file of files) {
      const doc = JSON.parse(readFileSync(join(WORKFLOW_DIR, file), "utf8"));
      const engine = doc.engine as LocalEngineId;
      expect(COMFY_REMOTE_ENGINES, file).toContain(engine);
      expect(doc.extension, file).toBe(LOCAL_ENGINE_CATALOG[engine].extension);
      expect(RUST, file).toContain(`include_str!("comfy_workflows/${file}")`);
    }
  });

  it("원격 엔진마다 서버에서 도는 모델 이름이 있다", () => {
    for (const id of COMFY_REMOTE_ENGINES) expect(COMFY_MODEL_LABEL[id], id).toBeTruthy();
    expect(COMFY_MODEL_LABEL.qwenimage).toBe("Qwen-Image 2.1");
  });

  it("H3 «빠르게» 는 첫 프레임·텍스트 영상에만 있고 레퍼런스 영상에는 없다", () => {
    const has = (file: string) => JSON.parse(readFileSync(join(WORKFLOW_DIR, file), "utf8")).fast !== undefined;
    expect(has("minimaxh3_t2v.json")).toBe(true);
    expect(has("minimaxh3_i2v.json")).toBe(true);
    expect(has("minimaxh3_r2v.json")).toBe(false);
    expect(loadComfyFleet().speed).toBe("fast");
  });

  it("사용자가 정한 기본: 그림은 Qwen-Image 2.1, 영상은 MiniMax H3", () => {
    expect(COMFY_PREFERRED.image).toBe("qwenimage");
    expect(COMFY_PREFERRED.video).toBe("minimaxh3");
    const qwen = JSON.parse(readFileSync(join(WORKFLOW_DIR, "qwenimage.json"), "utf8"));
    expect(JSON.stringify(qwen.graph)).toContain("qwen_image_2.1");
  });
});

describe("엔진 차례", () => {
  const info = (id: LocalEngineId) => LOCAL_ENGINE_CATALOG[id];

  it("원격이 켜져 있으면(기본값) 사용자가 정한 엔진이 맨 앞이다", () => {
    const images = (["zimage", "krea2", "qwenimage"] as LocalEngineId[]).map(info);
    images.sort((a, b) => remoteOrder(a) - remoteOrder(b));
    expect(images[0].id).toBe("qwenimage");
    const videos = (["wanvideo", "ltx25", "minimaxh3"] as LocalEngineId[]).map(info);
    videos.sort((a, b) => remoteOrder(a) - remoteOrder(b));
    expect(videos[0].id).toBe("minimaxh3");
  });

  it("꺼져 있거나 주소가 없으면 원격으로 보내지 않는다", () => {
    expect(isComfyRemote("qwenimage")).toBe(true);
    expect(isComfyRemote("qwenimage", { enabled: false, endpoints: ["http://a"], speed: "fast" })).toBe(false);
    expect(isComfyRemote("qwenimage", { enabled: true, endpoints: [], speed: "fast" })).toBe(false);
    expect(isComfyRemote("sam3dbody", { enabled: true, endpoints: ["http://a"], speed: "fast" })).toBe(false);
  });
});

describe("원격 결과 알림", () => {
  it("못 실은 것을 모아 한 줄로 말한다", () => {
    expect(comfyDroppedNote({ backend: "local" })).toBe("");
    expect(comfyDroppedNote({ backend: "comfy", references_dropped: 0, loras_dropped: [], ignored: [] })).toBe("");
    const note = comfyDroppedNote({
      backend: "comfy",
      references_dropped: 2,
      loras_dropped: ["a.safetensors"],
      ignored: ["움직임 마스크"],
    });
    expect(note).toContain("레퍼런스 2개");
    expect(note).toContain("로라 1개");
    expect(note).toContain("움직임 마스크");
  });

  it("멈춘 것과 실패한 것을 가른다 — Rust 의 CANCELLED 문구와 같아야 한다", () => {
    const rust = RUST.match(/const CANCELLED: &str = "([^"]+)"/)?.[1];
    expect(rust).toBeTruthy();
    expect(isComfyCancelled(rust)).toBe(true);
    expect(isComfyCancelled(new Error("사내 ComfyUI 가 실행 중 실패했습니다"))).toBe(false);
  });

  it("서버 주소에서 http 를 뗀다", () => {
    expect(comfyHostOf({ endpoint: "http://192.168.0.136:8191" })).toBe("192.168.0.136:8191");
    expect(comfyHostOf({})).toBe("");
  });
});
