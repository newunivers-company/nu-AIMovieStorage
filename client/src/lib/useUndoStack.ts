import { useCallback, useReducer, useRef, useState } from "react";

/**
 * 편집 창의 되돌리기 한 벌.
 *
 * 시트 배치·칸 자르기·구도잡기가 저마다 undo/redo 스택을 따로 들고 있었습니다.
 * 「손잡이를 눌렀다 그냥 떼도 스택에 쌓여 Ctrl+Z 한 번이 헛돈다」(지시 263) 를
 * 시트 배치에서 고쳤는데 나머지 두 곳에는 그대로 남아 있었습니다. 한 벌로 모아
 * 한 번 고치면 전부에 먹게 합니다.
 *
 * 두 가지 꼴로 씁니다.
 * - `useUndoStack(initial)` — 값을 이 훅이 들고 있습니다(칸 자르기).
 * - `useUndoHistory(value, onChange)` — 값은 부모가 들고 있고 기록만 여기서 맡습니다
 * (시트 배치). 배치도는 카드가 저장하는 것이라 값을 훅 안으로 옮길 수 없습니다.
 *
 * 기록은 ref 에 둡니다. 판을 쌓을 때마다 setState 를 두 번 부르면 그림이 한 번
 * 더 그려지고, 되돌리기 안에서 다른 setState 를 부르는 꼴이 되어 StrictMode 의
 * 두 번 호출에 두 번 쌓입니다. canUndo·canRedo 만 따로 깨워 새로 그립니다.
 */

export interface UndoStackOptions<T> {
  /** 쌓아 둘 최대 판 수. 안 주면 제한이 없습니다 */
  limit?: number;
  /** 두 판이 «같은 판» 인지. 기본은 JSON 으로 비교합니다 */
  isSame?: (a: T, b: T) => boolean;
}

export interface UndoHistory<T> {
  value: T;
  /** 기록을 남기고 바꿉니다. Ctrl+Z 한 번에 이 변경 하나가 풀립니다 */
  set: (next: T | ((current: T) => T)) => void;
  /** 기록 없이 바꿉니다. 끌기 도중·이름 한 글자처럼 되돌리기 단위가 아닌 변경 */
  replace: (next: T | ((current: T) => T)) => void;
  /** 지금 판을 기록만 합니다. 끌기 시작처럼 «여기부터 한 동작» 을 표시할 때 */
  mark: () => void;
  undo: () => void;
  redo: () => void;
  /** 기록을 비우고 값을 갈아 끼웁니다. 창을 닫거나 다른 대상을 열 때 */
  reset: (next: T) => void;
  /** 기록만 비움(값은 그대로) — 배치도 바꿀 때 */
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function defaultIsSame<T>(a: T, b: T): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function resolveNext<T>(next: T | ((current: T) => T), current: T): T {
  return typeof next === "function" ? (next as (current: T) => T)(current) : next;
}

function pushCapped<T>(stack: T[], item: T, limit: number | undefined) {
  stack.push(item);
  if (limit && stack.length > limit) stack.shift();
}

/**
 * 값은 부모가 들고 있고 기록만 맡는 꼴.
 *
 * 되돌리기 함수들은 값에 묶이지 않고 ref 를 읽습니다. 값에 묶어 만들면 판이
 * 바뀔 때마다 새 함수가 되어 키보드 리스너를 뗐다 붙여야 하고, 한 핸들러 안에서
 * `set` 을 두 번 부르면 두 번째가 첫 번째 결과를 못 봅니다. ref 로 두면 함수는
 * 한 번만 만들고, 갱신 함수는 늘 «지금 값» 을 받습니다.
 */
export function useUndoHistory<T>(
  value: T,
  onChange: (next: T) => void,
  options: UndoStackOptions<T> = {},
): UndoHistory<T> {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // 기록이 ref 라 canUndo·canRedo 는 저절로 새로 그려지지 않습니다. 쌓거나 뺄 때마다 깨웁니다.
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  const apply = useCallback((next: T) => {
    // 부모가 다시 그리기 전에도 다음 갱신 함수가 이 값을 받아야 합니다.
    valueRef.current = next;
    onChangeRef.current(next);
  }, []);

  const mark = useCallback(() => {
    pushCapped(past.current, valueRef.current, optionsRef.current.limit);
    future.current = [];
    rerender();
  }, []);

  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = valueRef.current;
      pushCapped(past.current, current, optionsRef.current.limit);
      future.current = [];
      apply(resolveNext(next, current));
      rerender();
    },
    [apply],
  );

  const replace = useCallback(
    (next: T | ((current: T) => T)) => {
      apply(resolveNext(next, valueRef.current));
    },
    [apply],
  );

  const undo = useCallback(() => {
    if (!past.current.length) return;
    const current = valueRef.current;
    const same = (a: T, b: T) => (optionsRef.current.isSame ?? defaultIsSame)(a, b);
    /*
      손잡이를 눌렀다 그냥 떼도 스택에 쌓입니다. 그러면 Ctrl+Z 한 번이 아무
      변화 없이 소모됩니다. 지금과 같은 판은 건너뛰고 진짜 다른 판까지 갑니다.
      (지시 263)
    */
    let previous = past.current.pop() as T;
    while (same(previous, current) && past.current.length) previous = past.current.pop() as T;
    if (same(previous, current)) {
      rerender();
      return;
    }
    pushCapped(future.current, current, optionsRef.current.limit);
    apply(previous);
    rerender();
  }, [apply]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop() as T;
    pushCapped(past.current, valueRef.current, optionsRef.current.limit);
    apply(next);
    rerender();
  }, [apply]);

  const reset = useCallback(
    (next: T) => {
      past.current = [];
      future.current = [];
      apply(next);
      rerender();
    },
    [apply],
  );

  /**
   * 기록만 비웁니다(값은 그대로). 시트 창에서 배치도를 바꿀 때 씁니다 — 안 비우면 Ctrl+Z 가
   * 앞 배치도의 판을 지금 배치도에 덮어써 프로젝트 공용 배치도가 망가집니다(검토 2026-09-08).
   * reset 은 apply 를 불러 아직 없는 배치도까지 만들어 버리므로 못 씁니다.
   */
  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    rerender();
  }, []);

  return {
    value,
    set,
    clear,
    replace,
    mark,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

/** 값까지 이 훅이 들고 있는 꼴. */
export function useUndoStack<T>(
  initial: T | (() => T),
  options: UndoStackOptions<T> = {},
): UndoHistory<T> {
  const [value, setValue] = useState<T>(initial);
  return useUndoHistory(value, setValue, options);
}
