import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "@/lib/llm";
import { loadComfyFleet, subscribeComfyFleet } from "@/lib/comfyFleet";
import type { LocalEngineId, LocalLora } from "@/lib/localEngines";

/**
 * **사내 ComfyUI 에 있는 로라** — 이 컴퓨터에 받아 두지 않아도 서버에 있으면 걸 수 있습니다.
 *
 *
 *
 * # 왜 따로 두는가
 *
 * 뽑는 자리의 로라 칩(`LoraPicker`)은 이 컴퓨터의 엔진 폴더에 있는 파일만 보여 줍니다. 원격으로
 * 도는 엔진(Qwen-Image 2.1, H3 …)은 이 컴퓨터에 폴더가 없어서 고를 것이 하나도 없었습니다.
 * 서버에는 로라가 405개 있습니다(2026-09-27). 서버 것을 고르면 **서버의 상대 경로**를 그대로
 * 보내고(`comfy:` 를 떼고), Rust 가 받아 준 서버의 목록에서 폴더까지 같은 것을 찾아 겁니다.
 *
 * # 엔진에 맞는 것을 어떻게 가리는가
 *
 * 서버 폴더가 모델별로 나뉘어 있어 **폴더로 추정**합니다(`SERVER_LORA_RULES`). 파일 안을 열어 보지
 * 않으므로 확실하지는 않습니다 — 화면에 «폴더로 고름» 이라 적고, 나머지는 검색해서 고를 수 있게
 * 둡니다. 속도용(터보·lightx2v·distill)과 편집·IC·업스케일 로라는 뺍니다. 워크플로가 이미 속도
 * 로라를 거는 데다(«빠르게»), 나머지는 다른 모델·다른 입력을 요구해 걸면 결과가 망가집니다.
 */

/** 뽑는 자리에서 고른 값 중 서버 로라를 가리키는 머리. 로컬 로라는 파일 경로라 겹치지 않습니다. */
export const SERVER_LORA_PREFIX = "comfy:";

export function isServerLora(picked: string): boolean {
  return picked.startsWith(SERVER_LORA_PREFIX);
}

export function serverLoraName(picked: string): string {
  return picked.slice(SERVER_LORA_PREFIX.length);
}

export function serverLoraKey(name: string): string {
  return `${SERVER_LORA_PREFIX}${name}`;
}

/** 엔진별로 «이 폴더면 맞는다» 는 규칙. 없는 엔진(음악 등)은 서버 로라를 권하지 않습니다. */
export const SERVER_LORA_RULES: Partial<Record<LocalEngineId, RegExp>> = {
  // `qwen/` 폴더의 것은 Qwen-Image v1·2512 용이라 2.1 에 걸면 모양이 안 맞아 **조용히 빠집니다**
  // (2026-09-27 실측: 서버 로그에 오류 243줄, 결과는 로라 없는 것과 같음). 2.1 용이라고 이름에
  // 적힌 것만 권합니다 — 지금 서버에는 없습니다. 검색하면 고를 수는 있고, 안 붙으면 알림이 알려 줍니다.
  qwenimage: /^qwen[^/]*\/.*(2\.1|qwen_?image_?21)/i,
  zimage: /^zimage\//i,
  krea2: /^krea2[^/]*\//i,
  minimaxh3: /^minimax_h3\//i,
  wanvideo: /^(wan|wan22_360)\//i,
  ltx25: /^(ltx2\.5\/|ltx-2\.5)/i,
};

/** 엔진과 상관없이 권하지 않는 것 — 속도용, 편집 모델용, IC(조건 영상을 따로 받는) 로라, 업스케일. */
const NOT_A_STYLE = /turbo|lightx2v|distill|lightning|edit|ic-lora|upscal|projector/i;

/** 파일 이름만 — 폴더와 확장자를 뗍니다. */
export function serverLoraLabel(name: string): string {
  const file = name.split("/").pop() || name;
  return file.replace(/\.safetensors$/i, "");
}

/** 이 엔진에 맞을 것으로 보이는 서버 로라들. */
export function serverLorasFor(engine: LocalEngineId, names: string[]): string[] {
  const rule = SERVER_LORA_RULES[engine];
  if (!rule) return [];
  return names.filter((name) => rule.test(name) && !NOT_A_STYLE.test(name));
}

/** 검색 — 이름 어디든 들어 있으면 맞습니다(대소문자 무시, 띄어 쓴 말은 모두 들어 있어야). */
export function searchServerLoras(names: string[], query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return names;
  return names.filter((name) => {
    const lower = name.toLowerCase();
    return words.every((word) => lower.includes(word));
  });
}

/** 고른 값 중 서버 로라만 생성 인자로. 세기는 1 — 서버 로라는 세기를 적어 둘 자리가 아직 없습니다. */
export function serverLorasToRun(picked: string[] | undefined): LocalLora[] {
  return (picked ?? []).filter(isServerLora).map((key) => ({ path: serverLoraName(key), weight: 1, server: true }));
}

/* ───────────────────────── 서버 목록(한 번 읽고 기억) ───────────────────────── */

type State = { names: string[]; loading: boolean; error: string };

let state: State = { names: [], loading: false, error: "" };
const listeners = new Set<() => void>();
let fetchedFor = "";

function publish(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** 서버에 다시 묻습니다. 주소가 바뀌었거나 «새로 고침» 을 눌렀을 때. */
export async function refreshServerLoras(): Promise<string[]> {
  const fleet = loadComfyFleet();
  if (!isDesktopApp() || !fleet.enabled || !fleet.endpoints.length) {
    publish({ names: [], loading: false, error: "" });
    return [];
  }
  fetchedFor = fleet.endpoints.join("|");
  publish({ ...state, loading: true, error: "" });
  try {
    const names = await invoke<string[]>("comfy_fleet_loras", { endpoints: fleet.endpoints });
    publish({ names, loading: false, error: names.length ? "" : "서버에서 로라 목록을 받지 못했습니다." });
    return names;
  } catch (error) {
    publish({ names: [], loading: false, error: String(error) });
    return [];
  }
}

// 설정에서 주소를 바꾸면 다음에 볼 때 다시 묻습니다.
subscribeComfyFleet(() => {
  fetchedFor = "";
});

const EMPTY: State = { names: [], loading: false, error: "" };

/** 서버 로라 목록. 처음 쓰는 순간(또는 주소가 바뀐 뒤 처음) 한 번 묻습니다. */
export function useServerLoras(active: boolean): State {
  if (active && !state.loading) {
    const fleet = loadComfyFleet();
    if (fleet.endpoints.join("|") !== fetchedFor) {
      fetchedFor = fleet.endpoints.join("|");
      queueMicrotask(() => void refreshServerLoras());
    }
  }
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => EMPTY,
  );
}
