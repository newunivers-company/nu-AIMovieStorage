import { invoke } from "@tauri-apps/api/core";
import { getMediaLibrarySettings, safeFileName } from "@/lib/mediaLibrary";
import { isDesktopApp } from "@/lib/llm";

/**
 * 프로젝트 데이터를 저장 폴더에 파일로 씁니다.
 *
 * localStorage 는 origin 단위로 격리되기 때문에 개발 서버와 설치본이 서로 다른
 * 저장소를 봅니다. 개발하며 만든 프로젝트가 빌드 후 사라지고, 백업할 방법도 없습니다.
 *
 * 파일로 두면
 * - 개발 → 설치 전환에도 그대로 남고
 * - 폴더째 복사해 옮기거나 백업할 수 있고
 * - 이미지 옆에 "그 이미지를 어떤 프롬프트로 만들었는지"가 함께 남습니다
 *
 * localStorage 는 폴더를 아직 안 정한 상태를 위한 임시 자리로만 씁니다.
 */

/** 프로젝트 폴더 안에 놓이는 파일 이름 */
export const PROJECT_FILE_NAME = "project.json";

export function getBaseDirectory() {
  return getMediaLibrarySettings().baseDirectory.trim();
}

/** 파일 저장을 쓸 수 있는 상태인지. 폴더를 안 정했으면 localStorage 로 돌아갑니다. */
export function canUseProjectFiles() {
  return isDesktopApp() && Boolean(getBaseDirectory());
}

/**
 * 폴더에서 읽어 온 파일 하나.
 *
 * `relativePath` 는 저장 폴더 기준 상대 경로입니다 — 예: `수화의 숲/project.json`.
 * 예전에는 이 필드를 `name` 이라고 적어 뒀는데 Rust 는 `relativePath` 를
 * 보냅니다. 그래서 값이 늘 undefined 였고, 그걸 폴더 이름으로 쓰던 곳에서
 * **프로젝트의 folder 가 통째로 비었습니다.** 그러면 그림 경로가 다시
 * 제목 기준으로 떨어져서 「프로젝트 하나 = 폴더 하나」가 깨집니다.
 */
export interface DataFile {
  relativePath: string;
  contents: string;
}

/** `수화의 숲/project.json` → `수화의 숲` */
export function folderOf(file: DataFile): string {
  return (file.relativePath || "").split("/")[0] || "";
}

/** Rust `save_data_file` 의 답. `written` 이 거짓이면 디스크가 달라서 쓰지 않은 것이고 `current` 가 그 내용입니다. */
export interface SaveDataResult {
  path: string;
  written: boolean;
  current?: string | null;
}

/**
 * @param ifUnmodifiedSince 이 창이 마지막으로 읽거나 쓴 판의 `updatedAt`. 넘기면 디스크의 값과
 * 다를 때 쓰지 않습니다(2026-09-21 두 창 사고 — 비교는 Rust 한 명령 안에서, 한 벌로).
 * 없으면 검사 없이 씁니다.
 */
export async function writeDataFile(relativePath: string, contents: string, ifUnmodifiedSince?: string) {
  const baseDirectory = getBaseDirectory();
  if (!baseDirectory) throw new Error("저장 폴더를 먼저 설정해 주세요.");
  return invoke<SaveDataResult>("save_data_file", {
    request: { baseDirectory, relativePath, contents, ifUnmodifiedSince: ifUnmodifiedSince ?? null },
  });
}


/** 저장 폴더의 하위 폴더마다 project.json 을 찾아 읽습니다. */
export async function readAllProjectFiles(): Promise<DataFile[]> {
  const baseDirectory = getBaseDirectory();
  if (!isDesktopApp() || !baseDirectory) return [];
  return invoke<DataFile[]>("list_project_data", { baseDirectory, fileName: PROJECT_FILE_NAME });
}


/**
 * 프로젝트 폴더 이름.
 *
 * Rust 쪽에서도 한 번 더 거르므로(`safe_name`), **두 벌이 같은 규칙이라야**
 * 화면이 예측한 저장 경로와 실제로 만들어지는 폴더가 맞습니다.
 *
 * 2026-09-18 점검: 여기만 **제어 문자를 안 걸렀습니다.** 이름에 보이지 않는 글자가
 * 하나 섞이면 화면은 «냥이», Rust 는 «_냥이» 로 폴더를 만들어, 화면이 가리키는 자리에
 * 파일이 없는 상태가 됩니다. `safeFileName` 이 Rust 와 같은 규칙이라 그것에 맡깁니다(규칙 1).
 * 비었을 때의 대체 이름만 여기 것이 다릅니다 — 프로젝트는 «이름없음» 보다 id 가 낫습니다.
 */
export function toFolderName(value: string, fallback: string) {
  if (!value.trim()) return fallback;
  const cleaned = safeFileName(value);
  return cleaned === "이름없음" ? fallback : cleaned;
}
