/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { BackgroundKind, CompositionCustomBackground, CompositionState } from "@/lib/composition";


// ── 배경 ──────────────────────────────────────────────────────────────

/**
 * 갈래에 맞춰 그 배경을 «지금 쓰는 것» 으로 고릅니다.
 * HDRI·파노라마는 고르는 순간 환경 방식도 그쪽으로 바꿉니다. 일반 배경은
 * 면에 붙이는 것이라 여기서 고를 게 없습니다.
 */
export function selectCustomBackgroundIn(
  current: CompositionState,
  kind: BackgroundKind,
  id: string,
): CompositionState {
  return {
    ...current,
    ...(kind === "hdri"
      ? { environmentMode: "hdri" as const, hdriId: id }
      : kind === "panorama"
        ? { environmentMode: "panorama" as const, panoramaId: id }
        : {}),
  };
}

export function addCustomBackgroundIn(
  current: CompositionState,
  entry: CompositionCustomBackground,
): CompositionState {
  return selectCustomBackgroundIn(
    { ...current, customBackgrounds: [...current.customBackgrounds, entry] },
    entry.kind || "background",
    entry.id,
  );
}

/** 비율·저장 경로처럼 나중에 알게 되는 값을 적습니다. */
export function patchCustomBackgroundIn(
  current: CompositionState,
  id: string,
  patch: Partial<CompositionCustomBackground>,
): CompositionState {
  return {
    ...current,
    customBackgrounds: current.customBackgrounds.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

/**
 * 들여온 배경 그림 하나를 목록에서 **뺍니다**.
 *
 * 잘못 들여온 파노라마가 목록에 그대로
 * 남아 있으면 실외 방을 고를 때마다 걸리적거립니다.
 *
 * 걸려 있던 방의 돔·고른 표시도 함께 풉니다 — 안 풀면 «없는 그림» 을 가리킨 채로 남아
 * 다시 열었을 때 돔이 빈 구로 섭니다. 폴더의 원본 파일을 지우는 일은 부르는 쪽 몫입니다
 * (`deleteProjectMediaFile` — 공통 규칙 3).
 */
export function removeCustomBackgroundIn(
  current: CompositionState,
  id: string,
): CompositionState {
  return {
    ...current,
    customBackgrounds: current.customBackgrounds.filter((item) => item.id !== id),
    rooms: (current.rooms ?? []).map((room) =>
      room.panorama === id ? { ...room, panorama: undefined } : room,
    ),
  };
}

// ── 배경 눈높이(축척) ─────────────────────────────────────────────────
/*
  «이 배경을 몇 미터 눈높이에서 본 것으로 볼 것인가»(h).

  배경 이미지는 각도만 정하고 거리는 정하지 않습니다. 둘을 잇는 값이 h 하나뿐이라
  여기가 **유일한 축척 손잡이**입니다.
    · 지평선은 언제나 눈높이에 온다
    · 바닥의 한 점이 지평선 아래 θ 로 보이면 그 점까지 거리 d = h / tan θ
    · 그 자리에 선 키 1.7m 사람의 화면상 크기 ∝ 1.7 / d = 1.7·tan θ / h
  → h 를 절반으로 낮추면 같은 자리의 인물이 두 배로 커 보입니다.

  맞습니다. foregroundZoom 은 인물까지의 거리도 같이 늘려 각도 크기가
  그대로입니다.
*/

// ── 원거리·근거리 샷 ─────────────────────────────────────────────────────
