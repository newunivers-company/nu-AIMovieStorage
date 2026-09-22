/*
  튜토리얼 목록의 입구.

  세 갈래를 한 배열로 모아 두고, 화면 쪽은 «지금 화면의 것» 만 `tutorialsFor` 로 받습니다.
  앵커 목록(`ALL_ANCHORS`)을 여기서 내는 까닭 — 화면에 `data-tour` 를 다는 쪽이 어떤 이름을
  달아야 하는지 코드로 확인할 수 있어야 합니다. 문서(ANCHORS.md)만 있으면 표와 자료가
  조용히 어긋나고, 테스트가 그 둘을 견줍니다.
*/

import { FULL_TUTORIAL } from "./full";
import { PAGE_TUTORIALS } from "./pages";
import { PLANNER_TUTORIALS } from "./planner";
import type { Tutorial, TutorialAdvance, TutorialPage, TutorialStep } from "./types";

export type { Tutorial, TutorialAdvance, TutorialKind, TutorialPage, TutorialRoute, TutorialStep } from "./types";
export { FULL_TUTORIAL } from "./full";
export { PAGE_TUTORIALS } from "./pages";
export { PLANNER_TUTORIALS } from "./planner";

/** 전부 — 한 바퀴 하나, 페이지별, 구도잡기 갈래 순서입니다. */
export const TUTORIALS: Tutorial[] = [FULL_TUTORIAL, ...PAGE_TUTORIALS, ...PLANNER_TUTORIALS];

/**
 * 이 화면에서 «막혔을 때» 보여 줄 것.
 *
 * 한 바퀴는 어느 화면에서도 목록에 넣지 않습니다 — 그것은 처음 한 번 따라가는 것이지
 * 막힌 데를 찾는 자료가 아닙니다. 구도잡기 갈래는 `planner` 에서만 나옵니다.
 */
export function tutorialsFor(page: TutorialPage): Tutorial[] {
  return TUTORIALS.filter((tutorial) => tutorial.kind !== "full" && tutorial.page === page);
}

export function tutorialById(id: string): Tutorial | undefined {
  return TUTORIALS.find((tutorial) => tutorial.id === id);
}

/** 모든 걸음을 한 줄로 — «어디까지 봤나» 를 셀 때 씁니다. */
export function allSteps(): TutorialStep[] {
  return TUTORIALS.flatMap((tutorial) => tutorial.steps);
}

/** 걸음이 가리키는 `data-tour` 이름 전부. 중복 없이, 이름순. */
export const ALL_ANCHORS: string[] = Array.from(
  new Set(allSteps().map((step) => step.anchor).filter((anchor): anchor is string => Boolean(anchor))),
).sort();

/**
 * 이 걸음을 **무엇으로 넘길까** — 적어 둔 것이 먼저, 없으면 「해 볼 것」 문구로 짐작합니다.
 *
 * 걸음이 210개라 하나하나 적는 대신 문구에서 읽습니다. 「…을 누르세요」 는 누르면 넘어가고,
 * 「…을 적으세요」 는 글자가 들어가면 넘어갑니다. 가리킬 자리(앵커)가 없으면 시킬 수도 없으니
 * 설명 걸음으로 봅니다.
 */
export function stepAdvanceMode(step: TutorialStep): TutorialAdvance {
  if (step.advanceOn) return step.advanceOn;
  if (!step.anchor) return "manual";
  const said = step.action || "";
  if (/적으|입력|붙여넣|쓰세요|치세요/.test(said)) return "input";
  if (/누르|눌러|여세요|열어|고르|켜세요|끄세요|선택/.test(said)) return "click";
  return "manual";
}
