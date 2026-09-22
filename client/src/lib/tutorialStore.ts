import { useSyncExternalStore } from "react";
import { FULL_TUTORIAL, tutorialById, type TutorialPage, type TutorialRoute } from "@/tutorials";

/**
 * **튜토리얼 살림** — 켜짐 · 본 것 · 지금 따라가는 걸음.
 *
 * # 왜 React 상태가 아니라 모듈인가
 *
 * 안내 창(`TutorialOverlay`)은 앱 뿌리에 하나, 여는 단추는 위 띠(`TutorialMenu`)와 설정 화면 두 곳,
 * 단계를 옮겨 달라는 부탁은 프로젝트 껍데기(`NewProjectPage`)가 받습니다. 넷이 같은 것을 봐야 하므로
 * 상태는 화면 밖 한 곳에 두고 `useSyncExternalStore` 로 구독합니다 — 언어(`i18n.ts`)와 같은 꼴입니다.
 *
 * # 무엇을 저장하나
 *
 * `enabled` · `seen` · `active` 전부 localStorage 에 씁니다. 따라가던 걸음을 앱을 껐다 켜도 이어 가게 —
 * 한 바퀴는 서른 몇 걸음이라 도중에 창을 닫는 일이 흔합니다.
 *
 * 처음 켤 때 한 바퀴가 저절로 뜨는 것은 «본 적 없음» 을 보고 정합니다. 닫거나 끝내면 «봤음» 이 되어
 * 다시는 저절로 뜨지 않습니다 — 매번 뜨면 끄게 되고, 끄면 막혔을 때도 못 씁니다.
 */

export interface TutorialRun {
  tutorialId: string;
  stepIndex: number;
}

export interface TutorialState {
  /** 설정의 스위치. 꺼져 있으면 위 띠의 단추도, 안내 창도 안 뜹니다. */
  enabled: boolean;
  /** 끝까지 봤거나 닫은 튜토리얼의 id. */
  seen: Record<string, true>;
  /** 지금 따라가는 걸음. 없으면 안내 창이 안 뜹니다. */
  active: TutorialRun | null;
}

/** 다른 옵션과 같은 관례(`ai-video-storage.<이름>.v1`). */
export const TUTORIAL_STORAGE_KEY = "ai-video-storage.tutorials.v1";

interface Saved {
  enabled?: boolean;
  seen?: string[];
  active?: TutorialRun | null;
}

const FRESH: TutorialState = { enabled: true, seen: {}, active: null };

/** 저장소는 없을 수 있습니다(단위 시험·막힌 웹뷰). 예외를 내면 앱이 첫 화면에서 죽으므로 조용히 `null`. */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * 저장된 걸음이 지금 자료에 있는지 확인해서 받습니다. 튜토리얼을 고쳐 걸음이 줄었거나 id 가 바뀐 채
 * 옛 저장본을 읽으면, 없는 걸음을 가리켜 빈 카드가 뜨거나 아예 안 뜹니다.
 */
function settleRun(run: unknown): TutorialRun | null {
  if (!run || typeof run !== "object") return null;
  const { tutorialId, stepIndex } = run as Partial<TutorialRun>;
  if (typeof tutorialId !== "string") return null;
  const tutorial = tutorialById(tutorialId);
  if (!tutorial || !tutorial.steps.length) return null;
  const index = typeof stepIndex === "number" && Number.isFinite(stepIndex) ? Math.floor(stepIndex) : 0;
  return { tutorialId, stepIndex: Math.max(0, Math.min(tutorial.steps.length - 1, index)) };
}

function read(): TutorialState {
  try {
    const raw = storage()?.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) return FRESH;
    const parsed = JSON.parse(raw) as Saved;
    const seen: Record<string, true> = {};
    for (const id of Array.isArray(parsed.seen) ? parsed.seen : []) {
      if (typeof id === "string") seen[id] = true;
    }
    return { enabled: parsed.enabled !== false, seen, active: settleRun(parsed.active) };
  } catch {
    return FRESH;
  }
}

let state: TutorialState = read();
const listeners = new Set<() => void>();

function persist() {
  try {
    const plain: Saved = { enabled: state.enabled, seen: Object.keys(state.seen), active: state.active };
    storage()?.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(plain));
  } catch {
    // 저장이 막혀도 이번 실행 동안은 바뀐 대로 씁니다.
  }
}

/** 상태는 통째로 갈아 끼웁니다 — `useSyncExternalStore` 가 «같은 객체» 로 바뀜을 판단하기 때문입니다. */
function commit(next: TutorialState) {
  state = next;
  persist();
  for (const listener of listeners) listener();
}

export function getTutorialState(): TutorialState {
  return state;
}

export function subscribeTutorials(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 켜짐 · 본 것 · 지금 걸음. 바뀌면 다시 그립니다. */
export function useTutorial(): TutorialState {
  return useSyncExternalStore(subscribeTutorials, getTutorialState, getTutorialState);
}

export function setTutorialsEnabled(enabled: boolean) {
  if (enabled === state.enabled) return;
  // 끄면 따라가던 걸음도 접습니다 — 꺼 놓았는데 안내 창만 남아 있으면 «껐는데 왜 뜨나» 가 됩니다.
  commit({ ...state, enabled, active: enabled ? state.active : null });
}

export function startTutorial(id: string) {
  const tutorial = tutorialById(id);
  if (!tutorial || !tutorial.steps.length) return;
  commit({ ...state, active: { tutorialId: id, stepIndex: 0 } });
}

function withSeen(id: string): Record<string, true> {
  return state.seen[id] ? state.seen : { ...state.seen, [id]: true };
}

/**
 * 닫기 = 건너뛰기 = 끝. 셋 다 «봤음» 으로 적습니다.
 *
 * 도중에 닫은 것도 «봤음» 인 까닭 — 처음 켤 때 저절로 뜨는 한 바퀴를 닫았는데 다음에 또 뜨면
 * 사람은 스위치를 끄고, 그러면 막혔을 때 볼 페이지 튜토리얼까지 함께 사라집니다.
 */
export function closeTutorial() {
  if (!state.active) return;
  commit({ ...state, seen: withSeen(state.active.tutorialId), active: null });
}

export function nextStep() {
  const run = state.active;
  if (!run) return;
  const tutorial = tutorialById(run.tutorialId);
  if (!tutorial) {
    commit({ ...state, active: null });
    return;
  }
  if (run.stepIndex >= tutorial.steps.length - 1) {
    closeTutorial();
    return;
  }
  commit({ ...state, active: { ...run, stepIndex: run.stepIndex + 1 } });
}

export function prevStep() {
  const run = state.active;
  if (!run || run.stepIndex === 0) return;
  commit({ ...state, active: { ...run, stepIndex: run.stepIndex - 1 } });
}

/**
 * 설정의 «처음부터 다시 보기». 본 기록을 비우고 한 바퀴를 바로 시작합니다.
 * 스위치가 꺼져 있었으면 켭니다 — 다시 보겠다는 뜻이니까요.
 */
export function resetTutorials() {
  commit({ enabled: true, seen: {}, active: { tutorialId: FULL_TUTORIAL.id, stepIndex: 0 } });
}

/** 앱을 켤 때 한 번 — 켜져 있고, 한 바퀴를 본 적이 없고, 따라가던 것이 없을 때만 한 바퀴를 띄웁니다. */
export function autoStartTutorial() {
  if (!state.enabled || state.active || state.seen[FULL_TUTORIAL.id]) return;
  startTutorial(FULL_TUTORIAL.id);
}

/* ── 어느 화면에 있는가 ──────────────────────────────────────────────────────── */

/**
 * 프로젝트 껍데기의 네 단계(1~4) ↔ 튜토리얼 화면 이름. **한 벌** — `NewProjectPage` 가 «지금 단계» 를
 * 알릴 때와 안내 창이 «그 단계로 가 달라» 고 할 때 같은 표를 씁니다. 두 벌이면 한쪽만 고쳐져
 * 안내가 엉뚱한 단계를 엽니다.
 */
export const PROJECT_STEP_PAGES: readonly TutorialPage[] = ["basics", "characters", "scenes", "finish"];

export function projectStepToPage(step: number): TutorialPage | null {
  return PROJECT_STEP_PAGES[step - 1] ?? null;
}

export function projectPageToStep(page: TutorialPage): number | null {
  const index = PROJECT_STEP_PAGES.indexOf(page);
  return index < 0 ? null : index + 1;
}

/** `/new-project` 도 `/project/:id` 도 같은 껍데기입니다 — 제목을 적어 저장되기 전에는 앞 주소에 있습니다. */
export function isProjectLocation(location: string): boolean {
  return location === "/new-project" || location.startsWith("/project/");
}

export function routeMatches(route: TutorialRoute, location: string): boolean {
  return route === "/project/:id" ? isProjectLocation(location) : location === route;
}

/**
 * 주소와 (껍데기가 알려 준) 단계로 «지금 화면» 을 정합니다. 위 띠의 «이 페이지 기능» 이 이걸로
 * 목록을 고릅니다. 구도잡기 창은 주소가 없어서 여기서는 안 나옵니다 — 그 갈래는 메뉴에 늘 있습니다.
 */
export function pageForLocation(location: string, reported: TutorialPage | null): TutorialPage | null {
  if (location === "/") return "projects";
  if (location === "/settings") return "settings";
  if (location === "/bgm") return "bgm";
  if (isProjectLocation(location)) return reported ?? "basics";
  return null;
}

let reportedPage: TutorialPage | null = null;
const pageListeners = new Set<() => void>();

function subscribePage(listener: () => void): () => void {
  pageListeners.add(listener);
  return () => {
    pageListeners.delete(listener);
  };
}

function getReportedPage(): TutorialPage | null {
  return reportedPage;
}

/** 프로젝트 껍데기가 «지금 이 단계» 를 알립니다. 화면을 떠나면 `null`. */
export function reportTutorialPage(page: TutorialPage | null) {
  if (page === reportedPage) return;
  reportedPage = page;
  for (const listener of pageListeners) listener();
}

export function useReportedTutorialPage(): TutorialPage | null {
  return useSyncExternalStore(subscribePage, getReportedPage, getReportedPage);
}

/* ── 「그 단계를 열어 줘」 ────────────────────────────────────────────────────── */

/**
 * 안내 창은 앱 뿌리에 살아서 프로젝트 껍데기의 단계 상태를 직접 못 만집니다. 창 이벤트로 부탁하고
 * 껍데기가 듣습니다. 이름을 여기 한 곳에 두어 보내는 쪽과 듣는 쪽이 어긋나지 않게 합니다.
 */
export const TUTORIAL_PAGE_EVENT = "tutorial:page";

export function requestTutorialPage(page: TutorialPage) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialPage>(TUTORIAL_PAGE_EVENT, { detail: page }));
}

export function onTutorialPageRequest(listener: (page: TutorialPage) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<TutorialPage>).detail;
    if (typeof detail === "string") listener(detail);
  };
  window.addEventListener(TUTORIAL_PAGE_EVENT, handler);
  return () => window.removeEventListener(TUTORIAL_PAGE_EVENT, handler);
}
