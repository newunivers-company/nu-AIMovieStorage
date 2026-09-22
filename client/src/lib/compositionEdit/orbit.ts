/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { cameraMoveId } from "@/lib/cameraMoves";
import { CAMERA_FOV_MAX, CAMERA_FOV_MIN, CAMERA_SPEED_MAX, CAMERA_SPEED_MIN } from "@/lib/composition";
import { CompositionCubeFace, OccludeKey, OccludeTrack, TargetLayer, CompositionState, MotionChannel, MotionKey } from "@/lib/composition";
import { timelineOf, uid } from "./core";
import { roomsOf } from "./rooms";
import { addMotionKeyIn, addPoseKeyIn, evaluateMotionTrack, motionTracksOf } from "./timeline";

// ── 궤도 조작감(orbit…) ───────────────────────────────────────────────
/*
  마우스로 «맞추기» 가 어려웠던 이유를 숫자로 적어 둡니다 — 다시 기본값으로
  되돌리지 않으려고요().

  실측(scratchpad/cube-check/orbit-feel.mjs, 진짜 three 0.185.1 · 캔버스 720px):

  1. `rotateSpeed = 1` 은 «캔버스 세로 한 판 = 360°» 라는 뜻입니다.
     720px 화면에서 0.500°/px. 그런데 화면이 실제로 담고 있는 각은 화각뿐이라
     40° / 720px = 0.0556°/px 입니다. 즉 **손가락보다 9배 빠르게** 돕니다.
     망원(화각 12°)에서는 30배입니다. 「획획」 은 여기서 옵니다.
  2. `dampingFactor = 0.05` 는 «한 프레임에 남은 양의 5% 만 적용» 입니다.
     100px 을 끌면 첫 프레임에는 50° 중 2.5° 만 돌고, 95% 에 닿는 데 58프레임
     ≈ 0.97초가 걸립니다. 손을 뗀 뒤에도 1초를 더 도는 셈이라, 사람은 그걸
     모르고 더 끌었다가 지나치고 다시 되돌리기를 반복하게 됩니다.
  3. 이동(pan)·줌은 three 가 **이미 거리에 비례**합니다 — 이동은
     `2·Δpx·d·tan(화각/2) / 높이`(= 시선점 깊이에서 화면 1px 만큼), 줌은
     `0.95^휠칸`(기하). 실측도 r=1 → 0.00101 m/px, r=100 → 0.10110 m/px 로
     정확히 100배였습니다. **그러니 여기서 손댈 것은 «시선점이 제자리인가»뿐**
     입니다. 시선점이 엉뚱한 데 남아 있으면 그 d 가 거짓말이 되어 이동·줌이
     같이 미쳐 버립니다. 회전축 문제와 속도 문제는 사실 한 뿌리입니다.
*/

/** 화각 40°·거리 4m 에서의 회전 감도. 720px 화면에서 0.175°/px(화면 대비 3.1배). */
export const ORBIT_ROTATE_BASE = 0.35;
/** 위 기준 화각(°). 망원일수록 같은 각이 화면에서 크게 번지므로 비례해 줄입니다. */
export const ORBIT_ROTATE_FOV_REF = 40;
/** 위 기준 거리(m) — 인물 한 명을 담는 흔한 거리. */
export const ORBIT_ROTATE_DIST_REF = 4;
/** 회전 감도를 재는 거리의 최소·최대(m). 시선점이 코앞이거나 지평선일 때를 막습니다. */
export const ORBIT_MIN_RADIUS = 0.25;
export const ORBIT_MAX_RADIUS = 300;

/**
 * 궤도 회전 감도(`OrbitControls.rotateSpeed`).
 *
 * `기준 × (화각/40) × (거리/4)^¼`.
 *
 * - 화각은 **1제곱**입니다. 화면에 담긴 각과 손의 움직임이 같은 비율로 묶여야
 * 망원으로 당겨도 「화면에서 이만큼」 이 안 변합니다.
 * - 거리는 **네제곱근**입니다. 사용자가 원한 「가까이서는 천천히, 멀리서는 빠르게」
 * 는 맞지만 1제곱으로 하면 100m 에서 25배가 되어 못 씁니다 — 회전은 결국 각도라
 * 거리가 커도 화면 변화량은 같습니다. 손맛만 살짝 얹는 정도로 둡니다
 * (1m 0.71배 ~ 100m 1.5배, 배율 상한에서 잘림).
 */
/**
 * 지금 구도의 카메라 조작 속도 배수. 없거나 이상하면 1.
 *
 * 회전·걷기·줌이 **같은 값** 을 곱해야 손맛이 한 덩어리로 움직입니다. 회전만 늦추면
 * 걷기가 상대적으로 더 빨라져서 「이번엔 걷기가 빠르다」 가 됩니다.
 */
export function orbitSpeedOf(state: { cameraSpeed?: number }): number {
  const value = state.cameraSpeed;
  if (!Number.isFinite(value ?? NaN)) return 1;
  return Math.min(
    CAMERA_SPEED_MAX,
    Math.max(CAMERA_SPEED_MIN, value as number),
  );
}

/** 카메라 조작 속도 배수를 바꿉니다. 되돌리기 대상입니다. */
export function setCameraSpeedIn(
  current: CompositionState,
  speed: number,
): CompositionState {
  const next = Math.min(
    CAMERA_SPEED_MAX,
    Math.max(CAMERA_SPEED_MIN, Number(speed) || 1),
  );
  return { ...current, cameraSpeed: Number(next.toFixed(2)) };
}

export function orbitRotateSpeed(fovDegrees: number, distance: number): number {
  const fov = Number.isFinite(fovDegrees)
    ? Math.max(CAMERA_FOV_MIN, Math.min(CAMERA_FOV_MAX, fovDegrees))
    : ORBIT_ROTATE_FOV_REF;
  /*
    거리 배수는 뺐습니다(2026-09-11).

    멀리서 볼수록 빠르게(최대 ×1.5) 돌리던 것인데, 같은 드래그가 줌에 따라 다른 각도를
    내서 «손에 익지 않는» 원인이 됩니다. 블렌더·언리뮬 모두 감도는 **픽셀당 각도로 일정**
    합니다. 화각 배수만 남깁니다 — 망원(좁은 화각)에서 같은 각도를 돌리면 화면이 그만큼
    더 크게 움직이므로, 그때 느려지는 것은 «같은 손맛» 을 위한 보정입니다.
  */
  void distance;
  return ORBIT_ROTATE_BASE * (fov / ORBIT_ROTATE_FOV_REF);
}

/**
 * 감쇠 계수(`OrbitControls.dampingFactor`).
 *
 * 0.05 → 0.22. 0.22 면 95% 에 닿는 데 12프레임(0.2초)이라 «부드럽지만 붙어 있는»
 * 느낌이 됩니다. 0 으로 끄면 3D 화면이 딱딱 끊겨 보여 오히려 조준이 어렵습니다.
 */
export const ORBIT_DAMPING = 0.22;

/**
 * W/A/S/D·Q/E 걸음 속도(m/초). 시선점까지 거리에 비례합니다 —
 * 방 한 칸을 볼 때와 100m 벌판을 볼 때 같은 속도면 한쪽은 늘 답답합니다.
 * Shift = 정밀(0.3배), Alt = 성큼(3배).
 */
export function orbitKeyboardSpeed(
  distance: number,
  modifier: { slow?: boolean; fast?: boolean } = {},
): number {
  const radius = Number.isFinite(distance)
    ? Math.max(ORBIT_MIN_RADIUS, Math.min(ORBIT_MAX_RADIUS, distance))
    : ORBIT_ROTATE_DIST_REF;
  const base = Math.min(25, Math.max(0.5, radius * 0.5));
  return base * (modifier.slow ? 0.3 : 1) * (modifier.fast ? 3 : 1);
}

/**
 * 눈에서 쏜 광선이 바닥(y=0)과 만나기까지의 거리(m). 없으면 null.
 *
 * 화면 한가운데로 쏘면 그 교점은 **시선 축 위**에 있습니다. 그래서 시선점을
 * 그리로 옮겨도 카메라가 보는 방향이 하나도 안 바뀝니다 — 화면이 안 튑니다.
 * 「회전축이 어디인지 모르겠다」 를 공짜로 고치는 자리입니다.
 *
 * 지평선은 늘 눈높이에 있으므로 위를 보면(forwardY ≥ 0) 교점이 없고, 지평선
 * 바로 아래는 d 가 발산합니다(눈높이 1.6m·0.01° 에서 9167m). 그래서 상한을 둡니다.
 */
export function orbitGroundAhead(
  eyeY: number,
  forwardY: number,
): number | null {
  if (!Number.isFinite(eyeY) || !Number.isFinite(forwardY)) return null;
  if (eyeY <= 0.01 || forwardY >= -1e-4) return null;
  const distance = eyeY / -forwardY;
  if (!Number.isFinite(distance) || distance < ORBIT_MIN_RADIUS) return null;
  return Math.min(ORBIT_MAX_RADIUS, distance);
}

/** 발밑에서 키의 몇 %가 «가슴» 인가. 회전 중심을 얼굴이 아니라 몸통에 둡니다. */
export const ORBIT_CHEST_RATIO = 0.72;

/** 물체의 아래·위 높이에서 가슴 높이를 냅니다. */
export function orbitChestHeight(bottomY: number, topY: number): number {
  if (!Number.isFinite(bottomY) || !Number.isFinite(topY)) return 0;
  return bottomY + (topY - bottomY) * ORBIT_CHEST_RATIO;
}

/** 회전 중심을 옮기는 데 쓸 시간(ms). 멀리 옮길수록 길게, 그래도 0.42초를 안 넘게. */
export function orbitGlideMs(moveDistance: number, radius: number): number {
  const relative = radius > 1e-6 ? moveDistance / radius : 1;
  return Math.min(420, Math.max(160, 160 + relative * 320));
}

/** 0→1 을 부드럽게(smoothstep). 시작과 끝에서 속도가 0 이라 «툭» 하는 느낌이 없습니다. */
export function orbitEase(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

// ─────────────────────────────────────────────────────────────────────────────
// 시간대별 «있다/없다» · «가린다/안 가린다» — 계단 트랙
// ─────────────────────────────────────────────────────────────────────────────

/** 0.05초 눈금. 자리 트랙과 같은 눈금이라 두 트랙의 키가 같은 자리에 섭니다. */
const snapStep = (time: number) => Math.max(0, Math.round(time * 20) / 20);

/**
 * 계단 트랙의 **그 시각 값**. 키가 없으면 null(부르는 쪽이 기본값을 씁니다).
 *
 * 마지막으로 지나온 키의 값이고, 첫 키 **앞**은 첫 키의 반대입니다 — 「2초에 나타남」
 * 하나만 찍으면 그 앞은 없고, 「3초에 사라짐」 하나만 찍으면 그 앞은 있습니다.
 */
export function stepValueAt<K extends { time: number }>(
  keys: readonly K[],
  time: number,
  value: (key: K) => boolean,
): boolean | null {
  if (!keys.length) return null;
  const sorted = keys.slice().sort((a, b) => a.time - b.time);
  let current: boolean | null = null;
  for (const key of sorted) {
    if (key.time <= time + 1e-6) current = value(key);
    else break;
  }
  return current ?? !value(sorted[0]);
}

export function layersOf(current: CompositionState): TargetLayer[] {
  return current.layers ?? [];
}

/**
 * 대상의 **있는 구간** — 레이어가 없으면 타임라인 처음부터 끝까지.
 * `end` 는 늘 숫자로 돌려줍니다(그려야 하니까요).
 */
export function layerSpanOf(
  current: CompositionState,
  targetId: string,
): { start: number; end: number; hidden: boolean; explicit: boolean } {
  const duration = timelineOf(current).duration;
  const layer = layersOf(current).find((item) => item.targetId === targetId);
  if (!layer) return { start: 0, end: duration, hidden: false, explicit: false };
  return {
    start: Math.max(0, layer.start),
    end: layer.end ?? duration,
    hidden: layer.hidden === true,
    explicit: true,
  };
}

/**
 * 대상이 그 시각에 화면에 있는가 — 막대 안이고 눈을 안 껐으면.
 *
 * 끝 시각은 **포함**합니다. 타임라인 끝까지 있는 사람이 마지막 프레임에서 사라지면 안 됩니다.
 */
export function visibleAtIn(
  current: CompositionState,
  targetId: string,
  time: number,
): boolean {
  const span = layerSpanOf(current, targetId);
  if (span.hidden) return false;
  return time >= span.start - 1e-6 && time <= span.end + 1e-6;
}

/**
 * 막대를 옮기거나 자릅니다. 넘긴 값만 바꿉니다.
 *
 * 0.05초 눈금에 붙이고, 최소 0.1초 길이를 지킵니다 — 시작과 끝이 겹치면 막대가 사라져
 * 다시 잡을 수가 없습니다. 레이어가 없던 대상이면 이때 만듭니다.
 */
export function setLayerSpanIn(
  current: CompositionState,
  targetId: string,
  span: { start?: number; end?: number },
): CompositionState {
  const duration = timelineOf(current).duration;
  const was = layerSpanOf(current, targetId);
  let start = snapStep(span.start ?? was.start);
  let end = snapStep(span.end ?? was.end);
  start = Math.min(Math.max(0, start), Math.max(0, duration - 0.1));
  end = Math.min(duration, Math.max(start + 0.1, end));
  const found = layersOf(current).find((item) => item.targetId === targetId);
  const next: TargetLayer = {
    id: found?.id ?? cameraMoveId(),
    targetId,
    start,
    // 끝까지 가면 «끝 없음» 으로 둡니다 — 나중에 타임라인을 늘려도 끝까지 따라가게.
    ...(end >= duration - 1e-6 ? {} : { end }),
    ...(found?.hidden ? { hidden: true } : {}),
  };
  return {
    ...current,
    layers: found
      ? layersOf(current).map((item) => (item === found ? next : item))
      : [...layersOf(current), next],
  };
}

/** 막대의 눈 — 막대는 두고 화면에서만 뺍니다. */
export function setLayerHiddenIn(
  current: CompositionState,
  targetId: string,
  hidden: boolean,
): CompositionState {
  const found = layersOf(current).find((item) => item.targetId === targetId);
  if (!found) {
    return {
      ...current,
      layers: [...layersOf(current), { id: cameraMoveId(), targetId, start: 0, ...(hidden ? { hidden } : {}) }],
    };
  }
  return {
    ...current,
    layers: layersOf(current).map((item) =>
      item === found ? { ...item, hidden: hidden || undefined } : item,
    ),
  };
}

export function occludeTracksOf(current: CompositionState): OccludeTrack[] {
  return current.occludeTracks ?? [];
}

/** 방의 한 면이 그 시각에 가리는가. 트랙이 없거나 꺼 두었으면 방의 고정 스위치. */
/**
 * 그 시각에 이 소품이 **비쳐 보이는가**. 키가 없으면 소품의 «투시» 체크를 따릅니다.
 *
 * 방 면의 `occludeAtIn` 과 **반대 방향**의 말입니다(면은 «가린다», 소품은 «비친다») — 화면에서 쓰는 말을 그대로
 * 두는 편이 헷갈리지 않습니다. 키의 `on` 은 «투시 켬» 입니다.
 */
export function objectSeeThroughAtIn(
  current: CompositionState,
  objectId: string,
  time: number,
): boolean {
  const object = current.objects.find((item) => item.id === objectId);
  const fallback = object?.seeThrough === true;
  const track = occludeTracksOf(current).find((item) => item.objectId === objectId);
  if (!track || track.muted) return fallback;
  return stepValueAt(track.keys, time, (key) => key.on) ?? fallback;
}

/** 그 시각부터 이 소품의 투시를 **뒤집는** 키를 찍습니다(같은 시각에 있으면 지웁니다). */
export function toggleObjectSeeThroughKeyIn(
  current: CompositionState,
  objectId: string,
  time: number,
): CompositionState {
  const stamp = Math.max(0, Number(time.toFixed(3)));
  const tracks = occludeTracksOf(current);
  const track = tracks.find((item) => item.objectId === objectId);
  const next = !objectSeeThroughAtIn(current, objectId, stamp);
  if (!track)
    return {
      ...current,
      occludeTracks: [
        ...tracks,
        { id: uid("occ"), objectId, keys: [{ id: uid("occk"), time: stamp, on: next }] },
      ],
    };
  const at = track.keys.find((key) => Math.abs(key.time - stamp) < 0.001);
  const keys = at
    ? track.keys.filter((key) => key !== at)
    : [...track.keys, { id: uid("occk"), time: stamp, on: next }].sort(
        (a, b) => a.time - b.time,
      );
  return {
    ...current,
    occludeTracks: tracks.map((item) =>
      item === track ? { ...item, keys } : item,
    ),
  };
}

export function occludeAtIn(
  current: CompositionState,
  roomId: string,
  face: CompositionCubeFace,
  time: number,
): boolean {
  const room = roomsOf(current).find((item) => item.id === roomId);
  const fallback = room?.occludeFaces?.[face] === true;
  const track = occludeTracksOf(current).find(
    (item) => item.roomId === roomId && item.face === face,
  );
  if (!track || track.muted) return fallback;
  return stepValueAt(track.keys, time, (key) => key.on) ?? fallback;
}

/** 지금 시각에서 그 면의 가림을 뒤집는 키를 찍습니다. */
export function toggleOccludeKeyIn(
  current: CompositionState,
  roomId: string,
  face: CompositionCubeFace,
  time: number,
): CompositionState {
  const stamp = snapStep(time);
  const now = occludeAtIn(current, roomId, face, stamp);
  const key: OccludeKey = { id: cameraMoveId(), time: stamp, on: !now };
  const tracks = occludeTracksOf(current);
  const found = tracks.find((item) => item.roomId === roomId && item.face === face);
  const next = found
    ? tracks.map((item) =>
        item === found
          ? { ...item, keys: [...item.keys.filter((k) => Math.abs(k.time - stamp) > 0.001), key] }
          : item,
      )
    : [...tracks, { id: cameraMoveId(), roomId, face, keys: [key] }];
  return { ...current, occludeTracks: next };
}

export function moveOccludeKeyIn(
  current: CompositionState,
  trackId: string,
  keyId: string,
  time: number,
): CompositionState {
  const stamp = snapStep(time);
  return {
    ...current,
    occludeTracks: occludeTracksOf(current).map((track) =>
      track.id === trackId
        ? { ...track, keys: track.keys.map((key) => (key.id === keyId ? { ...key, time: stamp } : key)) }
        : track,
    ),
  };
}

export function removeOccludeKeyIn(
  current: CompositionState,
  trackId: string,
  keyId: string,
): CompositionState {
  return {
    ...current,
    occludeTracks: occludeTracksOf(current)
      .map((track) =>
        track.id === trackId ? { ...track, keys: track.keys.filter((key) => key.id !== keyId) } : track,
      )
      .filter((track) => track.keys.length > 0),
  };
}

/**
 * **화면에 보이는 그 시각의 값**으로 키를 찍습니다 — K 키와 타임라인 「+」 가 씁니다.
 *
 *
 *
 * # `addMotionKeyIn` 과 무엇이 다른가
 *
 * `addMotionKeyIn` 은 **상태에 적힌 값**(인물의 `position`)을 찍습니다. 사람이 방금 옮긴
 * 값을 적는 자동 키에는 그게 맞습니다. 그런데 3초의 화면은 상태가 아니라 **트랙이 계산한
 * 자세**입니다 — 키를 옮기거나 다른 시각에서 만진 뒤에는 둘이 달라서, 3초에 K 를 눌렀는데
 * 엉뚱한 자세가 찍혔습니다. 그래서 트랙이 있으면 그 시각의 계산값을, 없으면 상태 값을 씁니다.
 */
export function addMotionKeyAtIn(
  current: CompositionState,
  targetId: string,
  channel: MotionChannel,
  time: number,
): CompositionState {
  if (channel === "pose") return addPoseKeyIn(current, targetId, time);
  const track = motionTracksOf(current).find(
    (item) => item.targetId === targetId && item.channel === channel && item.keys.length > 0,
  );
  const shown = track ? evaluateMotionTrack(track, time) : null;
  if (!shown) return addMotionKeyIn(current, targetId, channel, time);
  const stamp = Math.max(0, Math.round(time * 20) / 20);
  const key: MotionKey = { id: cameraMoveId(), time: stamp, value: { ...shown } };
  return {
    ...current,
    motionTracks: motionTracksOf(current).map((item) =>
      item === track
        ? { ...item, keys: [...item.keys.filter((k) => Math.abs(k.time - stamp) > 0.001), key] }
        : item,
    ),
  };
}
