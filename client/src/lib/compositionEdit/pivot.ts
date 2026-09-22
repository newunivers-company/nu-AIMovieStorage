/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { CompositionState } from "@/lib/composition";


// ── 전경 확대의 피벗 ──────────────────────────────────────────────────
/*
  전경 확대(foregroundZoom)는 전경 그룹을 통째로 키우되, 가로·세로는 «놓인
  것들의 한가운데» 를 붙들어 제자리에서 커지게 합니다. 원점을 피벗으로 삼으면
  인물까지의 거리도 같이 늘어나 각도 크기가 그대로여서(= 화면이 안 변해서)
  확대가 아무 일도 하지 않습니다.

  ## 왜 씬의 자식이 아니라 «상태» 로 세는가

  예전에는 `foreground.children` 을 전부 평균했습니다. 두 가지가 조용히
  깨졌습니다.

  1. **격자·굵은 선·그림자 면도 자식**이라 평균에 섞였습니다. 늘 원점에 있어
     평균을 원점 쪽으로 끌어당깁니다. 굵은 선(majorGrid)을 하나 더 넣자
     분모가 N+2 → N+3 이 되어, 저장해 둔 컷을 다시 열면 인물이 딴 자리에
     섰습니다(확대 20배에서 5.7 m). 「바닥을 껐다 켜는 것」 만으로도 배치가
     움직였습니다.
  2. 이펙트 실행 순서 탓에 **한 박자 늦은 자식 목록**을 보기도 했습니다
     (확대 이펙트가 인물 이펙트보다 먼저 선언돼 있습니다).

  상태에서 세면 둘 다 없습니다 — 저장된 값만으로 피벗이 정해지므로, 같은 컷은
  언제 열어도 같은 자리입니다.
*/

/** 전경 확대의 피벗에 드는 한 점. 인물은 나중에 빼낼 수 있게 id 를 달아 둡니다. */
export interface ForegroundPivotPoint {
  x: number;
  z: number;
  characterId?: string;
}

/** 전경 확대의 피벗에 드는 것들(보이는 인물·소품·GLB)의 x·z. */
export function foregroundPivotPoints(
  current: CompositionState,
): ForegroundPivotPoint[] {
  const points: ForegroundPivotPoint[] = [];
  current.characters.forEach((item) => {
    if (!item.hidden) {
      points.push({
        x: item.position.x,
        z: item.position.z,
        characterId: item.characterId,
      });
    }
  });
  current.objects.forEach((item) => {
    if (item.visible) points.push({ x: item.position.x, z: item.position.z });
  });
  (current.glbTracks || []).forEach((item) => {
    if (item.visible) points.push({ x: item.position.x, z: item.position.z });
  });
  return points;
}

/** 전경 확대의 피벗(가로·세로 한가운데). 놓인 것이 없으면 원점. */
export function foregroundPivotOf(current: CompositionState): {
  x: number;
  z: number;
} {
  const points = foregroundPivotPoints(current);
  if (!points.length) return { x: 0, z: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length,
  };
}

/**
 * 월드 좌표 `world` 에 인물의 발을 세우려면 **저장해야 할 로컬 좌표**.
 *
 * ## 왜 그냥 `worldToLocal` 이면 안 되는가
 *
 * 피벗이 «놓인 것들의 평균» 이라, 인물을 옮기면 그 인물 자신이 평균을 바꿉니다.
 * 지금 행렬로 되돌린 값을 저장하면 곧바로 확대 이펙트가 다시 돌면서 전경이
 * 통째로 밀려, 인물이 클릭한 자리에서 벗어납니다(확대 20배에서 2.4 m).
 *
 * ## 식
 *
 * 확대 z, 옮길 인물을 뺀 나머지의 좌표 합 S, 옮길 인물까지 넣은 개수 N 일 때
 * 피벗 c = (S + L)/N 이고 월드 = z·(L − c) + c = z·L + (1 − z)·c 이므로
 *
 * L = (world − (1 − z)·S/N) / (z + (1 − z)/N)
 *
 * 분모는 z 와 1 사이라 늘 양수입니다. N = 1 이면 L = world (혼자면 자기 자신이
 * 피벗이라 확대와 무관), N 이 크면 L ≈ world / z 로 예전 계산에 수렴합니다.
 */
export function foregroundLocalForWorld(
  current: CompositionState,
  movingCharacterId: string,
  world: { x: number; z: number },
  zoom: number,
): { x: number; z: number } {
  const z = zoom || 1;
  const points = foregroundPivotPoints(current);
  // 옮길 인물이 아직 목록에 없으면(숨김 등) 옮긴 뒤에는 들어오므로 하나를 더 셉니다.
  const listed = points.some(
    (point) => point.characterId === movingCharacterId,
  );
  const n = Math.max(1, points.length + (listed ? 0 : 1));
  let sumX = 0;
  let sumZ = 0;
  points.forEach((point) => {
    if (point.characterId === movingCharacterId) return;
    sumX += point.x;
    sumZ += point.z;
  });
  const denominator = z + (1 - z) / n;
  return {
    x: (world.x - ((1 - z) * sumX) / n) / denominator,
    z: (world.z - ((1 - z) * sumZ) / n) / denominator,
  };
}
