// 위저드 진행 중인 초안을 브라우저에 자동 저장합니다.
//
// 배경: NewProjectPage 의 draft 는 React state 에만 존재하고, STEP 5 의
// "프로젝트 생성"을 눌러야만 localProjectStore 로 넘어갑니다. 그래서 새로고침,
// dev 서버 재시작, HMR 한 번에 작업이 전부 사라집니다. 이 모듈은 그 사이를 메웁니다.
//
// 한계: File 객체와 blob: URL 은 직렬화·복원이 불가능합니다. 따라서 이미지가 아닌
// 텍스트 데이터(캐릭터 설정, 프롬프트, 씬/컷, 구도 좌표)를 우선 보존하고,
// 이미지 자리는 비워둔 뒤 복원 시 사용자에게 알립니다.

const DRAFT_KEY = "frameforge.wizard.draft.v1";

export interface DraftSnapshot<T> {
  savedAt: string;
  step: number;
  droppedImages: number;
  draft: T;
}

/** blob: URL 은 세션이 끝나면 죽으므로 저장하지 않습니다. */
function isDeadOnReload(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}

/**
 * File 과 blob: URL 을 제거한 복사본을 만듭니다.
 * 제거된 이미지 개수를 함께 돌려주어 복원 시 안내에 씁니다.
 */
function stripVolatile<T>(draft: T): { clean: unknown; dropped: number } {
  let dropped = 0;

  const walk = (value: unknown): unknown => {
    if (typeof File !== "undefined" && value instanceof File) {
      dropped += 1;
      return null;
    }
    if (isDeadOnReload(value)) {
      dropped += 1;
      return null;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        out[key] = walk(item);
      }
      return out;
    }
    return value;
  };

  return { clean: walk(draft), dropped };
}

/** 비어 있는 초안인지 판단합니다. 빈 초안은 저장하지 않습니다. */
function isEmptyDraft(draft: unknown): boolean {
  if (!draft || typeof draft !== "object") return true;
  const d = draft as {
    title?: string;
    characters?: unknown[];
    backgrounds?: unknown[];
    scenes?: unknown[];
  };
  return (
    !d.title?.trim() &&
    !(d.characters?.length ?? 0) &&
    !(d.backgrounds?.length ?? 0) &&
    !(d.scenes?.length ?? 0)
  );
}

export function saveDraftSnapshot<T>(draft: T, step: number): void {
  if (typeof window === "undefined") return;
  if (isEmptyDraft(draft)) return;

  try {
    const { clean, dropped } = stripVolatile(draft);
    const snapshot: DraftSnapshot<unknown> = {
      savedAt: new Date().toISOString(),
      step,
      droppedImages: dropped,
      draft: clean,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
  } catch {
    // 용량 초과나 스토리지 차단 시 조용히 포기합니다. 저장 실패가 작업을 막으면 안 됩니다.
  }
}

export function readDraftSnapshot<T>(): DraftSnapshot<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSnapshot<T>;
    return parsed?.draft ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraftSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 무시 */
  }
}

/** "3분 전" 같은 상대 시각 문구를 만듭니다. */
export function describeSavedAt(savedAt: string): string {
  const saved = new Date(savedAt).getTime();
  if (Number.isNaN(saved)) return "";
  const diffMin = Math.floor((Date.now() - saved) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return new Date(savedAt).toLocaleString("ko-KR");
}
