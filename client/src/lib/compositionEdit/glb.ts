/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { CompositionState, GlbTrack } from "@/lib/composition";
import { ZERO_VECTOR, uid } from "./core";


// ── GLB ───────────────────────────────────────────────────────────────

/** 파일을 넣은 직후의 트랙. blob 주소는 호출한 쪽이 만들어 넘깁니다. */
export function createGlbTrack(
  name: string,
  url: string,
  id = uid("glb"),
): GlbTrack {
  return {
    id,
    name,
    url,
    startTime: 0,
    speed: 1,
    position: { ...ZERO_VECTOR },
    rotation: { ...ZERO_VECTOR },
    scale: 1,
    visible: true,
    /*
      **기본은 한 번만 재생입니다.** (지시 76)

      블렌더에서 뽑아 오는 것은 대개 「이 동작을 한 번 한다」 입니다.
      반복이 기본이면 속도를 2로 올렸을 때 두 번 돌아 버려서, 속도만
      빠르게 하려던 의도와 어긋납니다. 반복이 필요하면 켜면 됩니다.
    */
    loop: false,
  };
}

export function addGlbTrackIn(
  current: CompositionState,
  track: GlbTrack,
): CompositionState {
  return { ...current, glbTracks: [...(current.glbTracks || []), track] };
}

export function updateGlbIn(
  current: CompositionState,
  id: string,
  patch: Partial<GlbTrack>,
): CompositionState {
  return {
    ...current,
    glbTracks: (current.glbTracks || []).map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

export function removeGlbIn(
  current: CompositionState,
  id: string,
): CompositionState {
  return {
    ...current,
    glbTracks: (current.glbTracks || []).filter((item) => item.id !== id),
  };
}

/**
 * 뷰포트가 GLB 를 읽고 알려 준 클립 목록.
 *
 * 바뀐 게 없으면 반드시 current 를 그대로 돌려줘야 합니다.
 *
 * map/스프레드는 내용이 같아도 새 객체를 만들고, React 는 그걸
 * 변경으로 봅니다. 그러면 씬이 재빌드 → GLB 다시 붙음 → 이 콜백
 * 재호출 → 또 갱신… 으로 무한 루프가 돕니다.
 */
export function setGlbClipsIn(
  current: CompositionState,
  id: string,
  clips: string[],
  duration: number,
): CompositionState {
  const track = (current.glbTracks || []).find((item) => item.id === id);
  if (!track) return current;
  if (
    (track.clips || []).join() === clips.join() &&
    track.clipDuration === duration
  )
    return current;
  return {
    ...current,
    glbTracks: (current.glbTracks || []).map((item) =>
      item.id === id ? { ...item, clips, clipDuration: duration } : item,
    ),
  };
}
