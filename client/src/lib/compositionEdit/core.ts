/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { CompositionState, CompositionTimeline, Vector3Value } from "@/lib/composition";








/**
 * 구도잡기 상태의 순수 변환.
 *
 * `CompositionPlanner` 의 `setState` 갱신 함수 안에서 «지금 값 → 다음 값» 을
 * 만드는 부분만 여기 모았습니다. React 도, 파일 저장도, toast 도 모릅니다.
 * 되돌리기 스택(undo/redo)과 화면 상태는 `CompositionPlanner.tsx` 가 그대로
 * 들고 있습니다 — 그쪽이 «언제» 를, 여기가 «무엇으로» 를 맡습니다.
 *
 * 전부 `(current, ...) => next` 꼴입니다. 항상 갱신 함수 안에서 불러야 합니다.
 * LLM 요청·파일 저장이 수 초 걸리는 사이 다른 카드를 만지는 것이 정상 사용법이라,
 * 렌더 시점의 값을 스프레드하면 나중에 도착한 답이 먼저 온 답을 지웁니다.
 */

/** 갱신 함수만 받는 setState. 값으로 덮어쓰는 호출을 타입에서 막습니다. */
export type UpdateComposition = (
  update: (current: CompositionState) => CompositionState,
) => void;

/** 구도 안에서 새로 만드는 항목의 id. 시각과 난수를 섞어 같은 세션 안에서 안 겹치게 합니다. */
export const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// fields.tsx 의 ZERO_VECTOR·ONE_VECTOR 와 같은 값입니다. lib 이 컴포넌트를
// 끌어오지 않도록 여기 따로 둡니다. 쓸 때는 늘 스프레드로 복사합니다.
export const ZERO_VECTOR: Vector3Value = { x: 0, y: 0, z: 0 };
export const ONE_VECTOR: Vector3Value = { x: 1, y: 1, z: 1 };

/** 저장된 타임라인이 없을 때의 기본값. */
export const DEFAULT_TIMELINE: CompositionTimeline = { duration: 5, fps: 24 };
export const timelineOf = (current: CompositionState): CompositionTimeline =>
  current.timeline ?? DEFAULT_TIMELINE;
