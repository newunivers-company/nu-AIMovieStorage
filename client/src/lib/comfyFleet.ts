import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { LocalEngineId, LocalEngineKind } from "@/lib/localEngines";

/**
 * **사내 ComfyUI 로 생성** — 프런트 쪽 설정과 호출.
 *
 * 로컬 엔진(`localEngines.ts`)과 같은 요청을 회사의 ComfyUI 서버들에 보냅니다. 이 컴퓨터에
 * 엔진을 설치하지 않아도 되고, 노트북 GPU 로는 못 올리는 Qwen-Image·MiniMax H3 도 돕니다.
 * 워크플로·서버 고르기·결과 받기는 Rust(`src-tauri/src/comfy_gen.rs`)가 합니다. 여기는
 * «켜져 있는가, 어느 서버들인가» 만 기억합니다.
 *
 * # 켜져 있으면 이쪽이 먼저입니다
 *
 * 원격으로 뽑을 수 있는 엔진은 로컬에 설치돼 있어도 사내 서버로 보냅니다. 회사 서버는
 * 24 GB GPU 에 모델이 이미 올라가 있어, 같은 엔진을 이 컴퓨터에서 돌리는 것보다 빠릅니다.
 * 이 컴퓨터로 돌리고 싶으면 설정에서 끄면 됩니다.
 */

/**
 * 사내 ComfyUI 로 뽑을 수 있는 엔진 — Rust 의 `REMOTE_ENGINES` 와 같은 목록입니다.
 * 두 곳이 어긋나지 않게 `comfyFleet.test.ts` 가 Rust 파일을 직접 읽어 견줍니다.
 */
export const COMFY_REMOTE_ENGINES: LocalEngineId[] = [
  "qwenimage",
  "zimage",
  "krea2",
  "minimaxh3",
  "wanvideo",
  "ltx25",
  "acestep",
];

/**
 * 원격일 때 갈래마다 **먼저 고를** 엔진. 사용자 지정(2026-09-23):
 * 그림은 Qwen-Image 2.1, 영상은 MiniMax H3.
 */
export const COMFY_PREFERRED: Partial<Record<LocalEngineKind, LocalEngineId>> = {
  image: "qwenimage",
  video: "minimaxh3",
  music: "acestep",
};

/**
 * 사내 서버에서 **실제로 도는 모델** 이름. 카탈로그 이름(«그림 — Qwen-Image (20B)») 은 로컬 워커 기준이라
 * 원격에서는 판이 다릅니다 — 사내 Qwen-Image 는 2.1 입니다(`comfy_workflows/*.json`).
 */
export const COMFY_MODEL_LABEL: Partial<Record<LocalEngineId, string>> = {
  qwenimage: "Qwen-Image 2.1",
  zimage: "Z-Image Turbo",
  krea2: "Krea 2 Turbo",
  minimaxh3: "MiniMax H3",
  wanvideo: "Wan 2.2 A14B",
  ltx25: "LTX 2.5",
  acestep: "ACE-Step 1.5",
};

/** 사내 ComfyUI 서버(192.168.0.136, RTX 3090 × 4). */
export const DEFAULT_COMFY_ENDPOINTS = [
  "http://192.168.0.136:8190",
  "http://192.168.0.136:8191",
  "http://192.168.0.136:8192",
  "http://192.168.0.136:8193",
];

export interface ComfyFleetSettings {
  enabled: boolean;
  endpoints: string[];
}

const KEY = "frameforge.comfyFleet.v1";

function read(): ComfyFleetSettings {
  const fallback = { enabled: true, endpoints: [...DEFAULT_COMFY_ENDPOINTS] };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<ComfyFleetSettings>;
    const endpoints = Array.isArray(parsed.endpoints)
      ? parsed.endpoints.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : fallback.endpoints;
    return { enabled: parsed.enabled !== false, endpoints };
  } catch {
    return fallback;
  }
}

let settings: ComfyFleetSettings = read();
const listeners = new Set<() => void>();

export function subscribeComfyFleet(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadComfyFleet(): ComfyFleetSettings {
  return settings;
}

export function saveComfyFleet(next: ComfyFleetSettings): void {
  settings = {
    enabled: next.enabled,
    endpoints: next.endpoints.map((item) => item.trim()).filter(Boolean),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 저장 공간이 없으면 이번 실행 동안만 기억합니다. */
  }
  listeners.forEach((listener) => listener());
}

export function useComfyFleet(): ComfyFleetSettings {
  return useSyncExternalStore(subscribeComfyFleet, loadComfyFleet, loadComfyFleet);
}

/** 이 엔진을 지금 사내 ComfyUI 로 보낼 것인가. */
export function isComfyRemote(engine: LocalEngineId, current: ComfyFleetSettings = settings): boolean {
  return current.enabled && current.endpoints.length > 0 && COMFY_REMOTE_ENGINES.includes(engine);
}

/**
 * 엔진 목록을 고르는 차례. 원격이 켜져 있으면 «사용자가 정한 것 → 원격 가능 → 로컬만» 차례이고,
 * 그 안에서는 원래 우선순위를 따릅니다.
 */
export function remoteOrder(engine: { id: LocalEngineId; kind: LocalEngineKind; priority: number }): number {
  const preferred = COMFY_PREFERRED[engine.kind] === engine.id ? 0 : 1;
  const remote = isComfyRemote(engine.id) ? 0 : 1;
  return preferred * 10_000 + remote * 1_000 + engine.priority;
}

export interface ComfyEndpointStatus {
  url: string;
  ok: boolean;
  error: string | null;
  device: string;
  vramTotalGb: number;
  vramFreeGb: number;
  running: number;
  pending: number;
  reserved: number;
  latencyMs: number;
}

/** 등록한 서버들을 한꺼번에 물어봅니다(설정의 «연결 확인»). */
export function checkComfyFleet(endpoints: string[] = settings.endpoints): Promise<ComfyEndpointStatus[]> {
  return invoke<ComfyEndpointStatus[]>("comfy_fleet_status", { endpoints });
}

export interface ComfyRunResult {
  output: string;
  seconds: number;
  meta: Record<string, unknown>;
}

/**
 * 파일 하나를 사내 ComfyUI 로 만듭니다. `runLocal` 이 원격일 때 이리로 옵니다.
 *
 * `shouldStop` 을 주면 1초마다 물어, 참이 되는 순간 **이 작업만** 서버에서 거둡니다
 * (`comfy_cancel` — 대기열에서 빼거나 실행을 멈춤). 일괄 생성의 «멈추기»(`isStopping`)와
 * 카드의 «멈추기» 단추가 같은 모양으로 씁니다.
 */
export async function runComfy(
  engine: LocalEngineId,
  outputPath: string,
  opts: unknown,
  timeoutSecs?: number,
  shouldStop?: () => boolean,
): Promise<ComfyRunResult> {
  const jobId = `aims-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let asked = false;
  const watch = shouldStop
    ? setInterval(() => {
        if (asked || !shouldStop()) return;
        asked = true;
        void invoke<boolean>("comfy_cancel", { jobId }).catch(() => undefined);
      }, 1000)
    : null;
  try {
    const raw = await invoke<ComfyRunResult>("comfy_generate", {
      engine,
      outputPath,
      opts,
      endpoints: settings.endpoints,
      timeoutSecs,
      jobId,
    });
    return { output: raw.output, seconds: Number(raw.seconds) || 0, meta: raw.meta ?? {} };
  } finally {
    if (watch) clearInterval(watch);
  }
}

/** Rust 가 «멈췄습니다» 로 끝낸 것인가 — 실패 알림 대신 조용히 넘기려고. */
export function isComfyCancelled(error: unknown): boolean {
  return String(error).includes("멈췄습니다");
}

/** 원격 결과에서 «못 실은 것» 을 사람 말로. 없으면 빈 문자열. */
export function comfyDroppedNote(meta: Record<string, unknown> | undefined): string {
  if (!meta || meta.backend !== "comfy") return "";
  const parts: string[] = [];
  const refs = Number(meta.references_dropped) || 0;
  if (refs > 0) parts.push(`레퍼런스 ${refs}개`);
  const loras = Array.isArray(meta.loras_dropped) ? meta.loras_dropped.length : 0;
  if (loras > 0) parts.push(`로라 ${loras}개(사내 서버에 같은 파일이 없음)`);
  const ignored = Array.isArray(meta.ignored) ? (meta.ignored as string[]) : [];
  parts.push(...ignored);
  return parts.length ? `사내 ComfyUI 로는 ${parts.join(" · ")}을(를) 싣지 못했습니다` : "";
}

/** 결과가 어느 서버에서 왔는지 — «192.168.0.136:8191». */
export function comfyHostOf(meta: Record<string, unknown> | undefined): string {
  const endpoint = typeof meta?.endpoint === "string" ? meta.endpoint : "";
  return endpoint.replace(/^https?:\/\//, "");
}
