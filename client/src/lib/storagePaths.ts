import { getMediaLibrarySettings } from "@/lib/mediaLibrary";

/**
 * 저장 폴더 한 곳에서 갈라지는 자리들.
 *
 * # 왜 따로 고르게 하지 않는가
 *
 * 예전에는 「기본 저장 폴더」·「프롬프트 문구 폴더」·「포즈 프리셋 폴더」를
 * 각각 고르게 했습니다. 그런데 셋 다 같은 곳(`00_AI_Storage`)을 가리키게
 * 두는 일이 실제로 일어났고, 그러면 저장 폴더 바로 아래에
 * `models/ platforms/ requests/ techniques/` 가 프로젝트 폴더들과 나란히
 * 쏟아집니다. 탐색기로 열면 어느 것이 작품이고 어느 것이 설정인지 알 수 없어요.
 *
 * 그래서 **한 곳만 고르면 나머지는 그 아래로 갈라집니다.**
 *
 * ```
 * 00_AI_Storage/
 * 수화의 숲/ ← 프로젝트 하나. 그림·영상·project.json 이 여기 안에
 * Prompt/ ← 요청 문구와 가이드 md
 * requests/ models/ platforms/ techniques/
 * PosePreset/ ← 구도잡기에서 저장한 자세
 * ```
 *
 * 굳이 다른 자리에 두고 싶으면 각 칸에서 직접 지정할 수 있습니다.
 * 그때는 그 값이 이깁니다.
 */

/** 프롬프트 문구가 들어갈 폴더 이름 */
export const PROMPT_FOLDER = "Prompt";
/** 포즈 프리셋이 들어갈 폴더 이름 */
export const PRESET_FOLDER = "PosePreset";

/** 윈도우/유닉스 구분자를 섞지 않도록 원본 구분자를 따라갑니다. */
export function joinPath(base: string, ...parts: string[]) {
  const root = base.trim().replace(/[\/]+$/, "");
  if (!root) return "";
  const separator = root.includes("\\") ? "\\" : "/";
  return [root, ...parts].join(separator);
}

function sameFolder(a: string, b: string) {
  const clean = (value: string) => value.trim().replace(/[\/]+$/, "").toLowerCase();
  return !!a && clean(a) === clean(b);
}

/**
 * 저장 폴더 아래의 자리를 구합니다.
 *
 * `override` 가 저장 폴더와 **같은 곳**이면 무시합니다. 그건 «따로 지정한
 * 것» 이 아니라 예전에 잘못 저장된 값이고, 그대로 두면 다시 최상단에
 * 쏟아집니다.
 */
export function resolveUnderBase(override: string, folder: string): string {
  const base = getMediaLibrarySettings().baseDirectory.trim();
  if (isOverrideActive(override)) return override.trim();
  return joinPath(base, folder);
}

/**
 * 이 값이 «정말 따로 지정한 것» 인지.
 *
 * 저장 폴더와 같은 곳이면 아닙니다. 화면에서 「따로 지정함」 뱃지를 그
 * 경우에도 띄우면, 기본 자리를 쓰고 있는데 아닌 것처럼 읽힙니다.
 */
export function isOverrideActive(override: string): boolean {
  const base = getMediaLibrarySettings().baseDirectory.trim();
  const chosen = override.trim();
  return !!chosen && !sameFolder(chosen, base);
}
