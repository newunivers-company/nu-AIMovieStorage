import type { Vector3Value } from "@/lib/composition";

/**
 * 시간 위에 찍은 점들을 다루는 **공통 셈법** — 카메라 자유 경로와 인물·소품 트랙이 같이 씁니다.
 *
 * 2026-09-12 정리에서 합쳤습니다. 두 곳(`cameraMoves.ts` 의 `evaluateFreeKeys`,
 * `compositionEdit.ts` 의 `evaluateMotionTrack`)에 정렬·보간·구간 찾기가 **글자 단위로 같은
 * 코드**로 따로 있었습니다. 주석까지 같았습니다. 그대로 두면 한쪽 버그를 고쳐도 다른 쪽은
 * 그대로 남습니다.
 *
 * 두 쓰임의 차이는 딱 둘이라, 그 둘만 부르는 쪽이 정합니다.
 *
 * - 구간에 완급을 걸 것인가 (카메라는 걸고, 인물·소품은 등속)
 * - 키가 하나뿐일 때 그 자리로 갈 것인가 (카메라는 가고, 인물·소품은 안 움직임)
 */

/** 시간 위의 한 점이면 무엇이든. `id` 는 같은 시각이 겹칠 때 순서를 고정하는 데 씁니다. */
export interface TimedKey {
  id: string;
  time: number;
}

/** 시간순. 같은 시각이면 넣은 차례(이름표)로 갈라 안정적으로 정렬합니다. */
export function sortByTime<T extends TimedKey>(keys: readonly T[]): T[] {
  return [...keys].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpVector = (
  a: Vector3Value,
  b: Vector3Value,
  t: number,
): Vector3Value => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

/**
 * 시각 t 가 놓인 구간과 그 안의 진행도(0~1).
 *
 * - 키가 없으면 `null`
 * - 첫 키 앞·마지막 키 뒤에서는 그 키에 **머뭅니다**(`from === to`, `t === 0`). 그래서
 * 부르는 쪽이 «범위 밖» 을 따로 다룰 필요가 없습니다.
 */
export function segmentAt<T extends TimedKey>(
  keys: readonly T[],
  time: number,
): { from: T; to: T; t: number } | null {
  const list = sortByTime(keys);
  if (!list.length) return null;
  const first = list[0];
  const last = list[list.length - 1];
  if (list.length === 1 || time <= first.time)
    return { from: first, to: first, t: 0 };
  if (time >= last.time) return { from: last, to: last, t: 0 };
  let index = 0;
  while (index < list.length - 2 && list[index + 1].time <= time) index += 1;
  const from = list[index];
  const to = list[index + 1];
  // 0 으로 나누지 않게. 같은 시각의 키 둘은 정렬이 갈라 주지만 시각 자체는 같을 수 있습니다.
  const span = Math.max(1e-6, to.time - from.time);
  return { from, to, t: Math.min(1, Math.max(0, (time - from.time) / span)) };
}
