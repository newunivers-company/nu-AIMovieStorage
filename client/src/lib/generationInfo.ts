import { COMFY_MODEL_LABEL } from "@/lib/comfyFleet";
import {
  LOCAL_ENGINE_CATALOG,
  type LocalEngineId,
  type LocalRunOptions,
  type LocalRunResult,
} from "@/lib/localEngines";
import type { GenerationInfo } from "@/lib/projectTypes";

/**
 * 뽑은 결과에서 **그림 곁에 적어 둘 값**을 만듭니다(`GenerationInfo`).
 *
 * 보낸 값(`opts`)과 실제로 쓴 값(`meta`)이 다를 수 있습니다 — 서버는 크기를 16의 배수로 맞추고,
 * 시드를 안 주면 새로 뽑고, 로라는 서버에 있는 것만 겁니다. 그래서 **meta 를 먼저** 믿고, 없으면
 * opts 를 씁니다. 로컬 워커와 사내 ComfyUI 의 meta 는 칸 이름이 조금 달라 여기서 한 꼴로 맞춥니다.
 */
export function buildGenerationInfo(
  engine: LocalEngineId,
  opts: LocalRunOptions,
  result: Pick<LocalRunResult, "seconds" | "meta">,
  at: Date = new Date(),
): GenerationInfo {
  const meta = result.meta ?? {};
  const comfy = meta.backend === "comfy";
  const num = (value: unknown): number | undefined => {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  };
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value : undefined;

  const loras = comfy
    ? (Array.isArray(meta.loras_used) ? meta.loras_used : []).filter((item): item is string => typeof item === "string")
    : (opts.loras ?? []).filter((lora) => !lora.server).map((lora) => lora.path.split(/[\\/]/).pop() || lora.path);

  const info: GenerationInfo = {
    engine,
    model: comfy ? (COMFY_MODEL_LABEL[engine] ?? LOCAL_ENGINE_CATALOG[engine]?.name) : LOCAL_ENGINE_CATALOG[engine]?.name,
    backend: comfy ? "comfy" : "local",
    host: comfy ? text(meta.endpoint)?.replace(/^https?:\/\//, "") : undefined,
    promptId: comfy ? text(meta.prompt_id) : undefined,
    workflow: text(meta.workflow),
    prompt: text(meta.prompt) ?? opts.prompt,
    negative: text(meta.negative) ?? text(opts.negative),
    seed: num(meta.seed) ?? num(opts.seed),
    width: num(meta.width) ?? num(opts.width),
    height: num(meta.height) ?? num(opts.height),
    seconds: num(meta.seconds_video) ?? num(meta.seconds) ?? num(opts.seconds),
    frames: num(meta.frames),
    fps: num(meta.fps),
    speed: text(meta.speed),
    loras: loras.length ? loras : undefined,
    lorasFailed: meta.loras_failed === true ? true : undefined,
    references: num(meta.references),
    motionMask: meta.motion_mask === true ? true : undefined,
    took: Math.round((Number(result.seconds) || 0) * 10) / 10,
    at: at.toISOString(),
  };
  // 빈 칸은 저장하지 않습니다 — 작품 파일이 `"seed": undefined` 같은 줄로 불지 않게.
  return Object.fromEntries(Object.entries(info).filter(([, value]) => value !== undefined)) as unknown as GenerationInfo;
}

/** 사람이 읽는 몇 줄 — 그림 위에 마우스를 올리면 보이는 안내와 «생성 정보 복사» 에 씁니다. */
export function describeGeneration(info: GenerationInfo): string {
  const where = info.backend === "comfy" ? `사내 ComfyUI${info.host ? ` ${info.host}` : ""}` : "이 컴퓨터";
  const lines = [
    `${info.model || info.engine} · ${where}${info.speed === "fast" ? " · 빠르게" : ""}`,
    [
      info.width && info.height ? `${info.width}×${info.height}` : "",
      info.seconds ? `${info.seconds}초` : "",
      info.frames ? `${info.frames}프레임` : "",
      info.seed !== undefined ? `시드 ${info.seed}` : "",
      `${info.took}초 걸림`,
    ]
      .filter(Boolean)
      .join(" · "),
  ];
  if (info.loras?.length) lines.push(`로라: ${info.loras.join(", ")}${info.lorasFailed ? " (서버 로그에 못 붙임 기록)" : ""}`);
  if (info.references) lines.push(`레퍼런스 ${info.references}장`);
  if (info.motionMask) lines.push("움직임 마스크 적용");
  lines.push(`프롬프트: ${info.prompt}`);
  if (info.negative) lines.push(`제외: ${info.negative}`);
  lines.push([localTime(info.at), info.workflow, info.promptId].filter(Boolean).join(" · "));
  return lines.join("\n");
}

/** 저장은 ISO(UTC)로, 보여 줄 때는 이 컴퓨터 시각으로 — `2026-09-27 23:12`. */
function localTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
