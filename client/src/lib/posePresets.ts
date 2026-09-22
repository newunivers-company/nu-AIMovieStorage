import { invoke } from "@tauri-apps/api/core";
import type { Vector3Value } from "@/lib/composition";
import { PRESET_FOLDER, resolveUnderBase } from "@/lib/storagePaths";

/**
 * 사용자가 직접 맞춰 저장하는 포즈 프리셋.
 *
 * 리그마다 관절 로컬축이 달라서 각도를 코드로 하드코딩하면 계속 어긋납니다.
 * 화면에서 눈으로 맞춘 값을 파일로 저장해 재사용하는 편이 정확하고, 프로젝트 간에도 공유됩니다.
 *
 * 데스크톱(Tauri)에서는 사용자가 지정한 폴더에 프리셋 하나당 JSON 파일 하나로 저장하고,
 * 브라우저 미리보기에서는 localStorage 로 대체합니다.
 */

const SETTINGS_KEY = "frameforge.preset.folder.v1";
const FALLBACK_KEY = "frameforge.pose.presets.v1";

export type PosePresetKind = "full" | "body" | "hand";
export type HandSide = "Left" | "Right";

export interface PosePreset {
  id: string;
  name: string;
  /** 사용자가 직접 만드는 분류. 비어 있으면 "기본"으로 묶입니다. */
  group: string;
  kind: PosePresetKind;
  /** kind 가 "hand" 일 때 어느 손으로 만들었는지. 반대 손에는 좌우 반전해서 적용합니다. */
  hand?: HandSide;
  /** 관절별 각도(라디안). */
  bonePose: Record<string, Vector3Value>;
  /**
   * 그룹 안에서의 자리(작을수록 앞). 끌어 옮기면 여기가 바뀝니다.
   *
   * 옛 프리셋에는 없어서 없으면 만든 순서(createdAt)로 물러섭니다 — 이름순으로 물러서면
   * 옛 프리셋과 새 프리셋이 뒤섞여 «내가 놓은 자리» 가 무너집니다.
   */
  order?: number;
  createdAt: string;
}


function isDesktopApp() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getPresetFolder(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SETTINGS_KEY) || "";
  } catch {
    return "";
  }
}

export function setPresetFolder(path: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, path.trim());
}

/**
 * 프리셋이 실제로 놓이는 자리.
 *
 * 기본은 «기본 저장 폴더 / PosePreset» 입니다. 예전에는 이 칸에 저장 폴더를
 * 그대로 넣을 수 있었고, 그러면 프리셋 json 이 프로젝트 폴더들과 나란히
 * 최상단에 쌓였습니다.
 */
export function presetDirectory(): string {
  return resolveUnderBase(getPresetFolder(), PRESET_FOLDER);
}

/** 폴더를 미리 만들어 둡니다. 저장 폴더를 고른 직후에 눈에 보여야 합니다. */
export async function ensurePresetFolder(): Promise<void> {
  if (!isDesktopApp()) return;
  const folder = presetDirectory().trim();
  if (!folder) return;
  await invoke("ensure_directory", { path: folder }).catch(() => null);
}

/** 파일 이름 충돌을 피하면서 사람이 알아볼 수 있게 만듭니다. */
function toFileName(preset: PosePreset) {
  const safe = `${preset.group}_${preset.name}`.replace(/[<>:"/\\|?*]/g, "_").trim();
  return `${safe || "preset"}__${preset.id}`;
}

function readFallback(): PosePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallback(presets: PosePreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(presets));
  } catch {
    /* 저장 실패가 작업을 막으면 안 되므로 조용히 넘어갑니다. */
  }
}

const sortPresets = (presets: PosePreset[]) =>
  presets.sort(
    (a, b) =>
      a.group.localeCompare(b.group) ||
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.name.localeCompare(b.name),
  );

export async function listPosePresets(): Promise<PosePreset[]> {
  const folder = presetDirectory();
  if (!isDesktopApp() || !folder) return sortPresets(readFallback());

  try {
    const files = await invoke<{ fileName: string; contents: string }[]>("list_preset_files", { directory: folder });
    const presets: PosePreset[] = [];
    for (const file of files) {
      try {
        const parsed = JSON.parse(file.contents) as PosePreset;
        if (parsed?.id && parsed?.bonePose) presets.push(parsed);
      } catch {
        /* 깨진 파일은 건너뜁니다. */
      }
    }
    return sortPresets(presets);
  } catch {
    return sortPresets(readFallback());
  }
}

export async function savePosePreset(preset: Omit<PosePreset, "id" | "createdAt">): Promise<PosePreset> {
  const created: PosePreset = {
    ...preset,
    group: preset.group.trim() || "기본",
    id: globalThis.crypto?.randomUUID?.() || `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };

  const folder = presetDirectory();
  if (isDesktopApp() && folder) {
    await invoke("save_preset_file", {
      request: { directory: folder, fileName: toFileName(created), contents: JSON.stringify(created, null, 2) },
    });
    return created;
  }

  writeFallback([...readFallback(), created]);
  return created;
}

/**
 * 이미 있는 프리셋을 **같은 id 로** 고쳐 씁니다(그룹·자리 옮기기).
 *
 * `savePosePreset` 은 새 id 를 만드는 «저장» 이라 여기 쓸 수 없습니다. 그룹이나 이름이 바뀌면
 * 파일 이름도 바뀌므로(`toFileName`) 옛 파일을 먼저 지우고 새로 씁니다 — 안 지우면 같은
 * 프리셋이 둘로 보입니다.
 */
export async function writePosePreset(next: PosePreset, previous?: PosePreset): Promise<void> {
  const folder = presetDirectory();
  if (isDesktopApp() && folder) {
    if (previous && toFileName(previous) !== toFileName(next)) {
      await invoke("delete_preset_file", { directory: folder, fileName: toFileName(previous) }).catch(
        () => undefined,
      );
    }
    await invoke("save_preset_file", {
      request: { directory: folder, fileName: toFileName(next), contents: JSON.stringify(next, null, 2) },
    });
    return;
  }
  writeFallback(readFallback().map((item) => (item.id === next.id ? next : item)));
}

export async function deletePosePreset(preset: PosePreset) {
  const folder = presetDirectory();
  if (isDesktopApp() && folder) {
    await invoke("delete_preset_file", { directory: folder, fileName: toFileName(preset) });
    return;
  }
  writeFallback(readFallback().filter(item => item.id !== preset.id));
}

const HAND_BONE_RE = /^(Left|Right)Hand/;

/**
 * 손 프리셋을 반대 손에 적용할 수 있게 좌우를 뒤집습니다.
 * 좌우 손은 거울 대칭이라 본 이름의 Left/Right 를 바꾸고 회전 부호를 반전하면 됩니다.
 * 덕분에 한쪽 손만 맞춰 저장해도 양손에 쓸 수 있습니다.
 */
export function mirrorHandBonePose(bonePose: Record<string, Vector3Value>, target: HandSide) {
  const mirrored: Record<string, Vector3Value> = {};
  for (const [bone, rotation] of Object.entries(bonePose)) {
    const match = HAND_BONE_RE.exec(bone);
    if (!match) continue;
    const source = match[1] as HandSide;
    const name = source === target ? bone : bone.replace(/^(Left|Right)/, target);
    const flip = source === target ? 1 : -1;
    mirrored[name] = { x: rotation.x * flip, y: rotation.y * flip, z: rotation.z * flip };
  }
  return mirrored;
}

/** 전체 bonePose 에서 한쪽 손 관절만 추립니다. */
export function extractHandBonePose(bonePose: Record<string, Vector3Value>, hand: HandSide) {
  const entries: Record<string, Vector3Value> = {};
  for (const [bone, rotation] of Object.entries(bonePose)) {
    if (bone.startsWith(`${hand}Hand`)) entries[bone] = { ...rotation };
  }
  return entries;
}

/** 전체 bonePose 에서 손 관절을 제외한 몸통·팔다리만 추립니다. */
export function extractBodyBonePose(bonePose: Record<string, Vector3Value>) {
  const entries: Record<string, Vector3Value> = {};
  for (const [bone, rotation] of Object.entries(bonePose)) {
    if (!HAND_BONE_RE.test(bone)) entries[bone] = { ...rotation };
  }
  return entries;
}

/** 종류별로 저장할 각도를 추립니다. */
export function bonePoseForKind(bonePose: Record<string, Vector3Value>, kind: PosePresetKind, hand: HandSide) {
  if (kind === "hand") return extractHandBonePose(bonePose, hand);
  if (kind === "body") return extractBodyBonePose(bonePose);
  return { ...bonePose };
}
