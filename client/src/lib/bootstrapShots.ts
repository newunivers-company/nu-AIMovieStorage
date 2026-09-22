import {
  DEFAULT_COMPOSITION,
  normalizeComposition,
  type CompositionState,
  type Vector3Value,
} from "@/lib/composition";

/**
 * **AI 일괄 생성 3단계 — 컷마다 구도를 세웁니다.**
 *
 * 주제 한 줄만 던져도 씬·컷·캐릭터·구도·키컷까지 한 번에 채워지는 것이 이 길의 목표입니다.
 * 그림과 영상은 바깥 생성기에서 사람이 뽑지만, 그 앞까지 — 프롬프트를 포함해 — 는
 * 손으로 채우지 않습니다. 여기는 그중 **구도**를 맡습니다.
 *
 * # LLM 에게 카메라 좌표를 묻지 않습니다
 *
 * 「카메라를 (3.2, 1.6, -4.1)에 두라」 고 시키면 답이 늘 어긋납니다 — 화각과 인물 키를
 * 함께 풀어야 나오는 값이라, 말로 시키면 사람이 서 있는 자리와 맞지 않습니다.
 *
 * 그래서 LLM 에게는 **감독이 쓰는 말**만 받습니다 — 「웨이스트 샷 · 약한 앙각」,
 * 그리고 사람이 바닥 어디에 서는지(−1~1 의 자리). 거리와 높이는 **여기서 풉니다**.
 * `shotSizeOf` 가 거리에서 샷 이름을 내는 함수이므로, 그것을 거꾸로 돌리면 됩니다.
 */

/** 샷 이름 → 화면 세로에서 인물이 차지하는 비율. `shotSizeOf` 의 문턱 사이 한가운데 값입니다. */
const SHOT_SHARE: Record<string, number> = {
  "익스트림 클로즈업": 3.0,
  클로즈업: 1.7,
  "바스트 샷": 1.0,
  바스트: 1.0,
  "웨이스트 샷": 0.65,
  웨이스트: 0.65,
  "니 샷": 0.42,
  니: 0.42,
  "풀 샷": 0.26,
  풀: 0.26,
  "롱 샷": 0.14,
  롱: 0.14,
  "익스트림 롱 샷": 0.08,
};

/** 앵글 이름 → 눈높이에서 카메라를 얼마나 올릴까(m). `angleOf` 의 문턱과 짝입니다. */
const ANGLE_LIFT: Record<string, number> = {
  "높은 부감": 1.8,
  부감: 1.0,
  "약한 부감": 0.7,
  눈높이: 0,
  "약한 앙각": -0.7,
  앙각: -1.0,
  "낮은 앙각": -1.6,
};

export interface ShotPerson {
  /** 구도에 세울 대상 — 캐릭터 카드의 id. */
  characterId: string;
  heightCm: number;
  /** 바닥 자리. −1(왼쪽)~1(오른쪽), −1(카메라 쪽)~1(안쪽). */
  x: number;
  z: number;
  /** 몸이 향하는 방향(도). 0 이면 카메라 쪽. */
  facing?: number;
}

export interface ShotPlan {
  shot?: string;
  angle?: string;
  /** 공간 — 실외면 돔, 실내면 상자. 한 변(m). */
  place?: { outdoor?: boolean; size?: number; height?: number };
  people: ShotPerson[];
}

/** 자리(−1~1)를 미터로. 방이 크면 사람도 넓게 섭니다. */
const spread = (value: number, size: number) =>
  Math.round(Math.max(-1, Math.min(1, value)) * (size / 2) * 0.45 * 100) / 100;

/**
 * 한 컷의 **구도 상태**를 세웁니다.
 *
 * 카메라는 사람들의 한가운데를 봅니다 — 한 명이면 그 사람, 여럿이면 가운뎃점.
 * 거리는 **가장 큰 사람**을 기준으로 잽니다. 작은 사람에 맞추면 큰 사람의 머리가 잘립니다.
 */
export function buildShotComposition(plan: ShotPlan): CompositionState {
  const size = Math.max(4, plan.place?.size ?? (plan.place?.outdoor ? 30 : 8));
  const people = plan.people.filter((person) => person.characterId);

  const placed = people.map((person) => ({
    characterId: person.characterId,
    position: { x: spread(person.x, size), y: 0, z: spread(person.z, size) } as Vector3Value,
    rotation: { x: 0, y: ((person.facing ?? 0) * Math.PI) / 180, z: 0 } as Vector3Value,
    rotationY: ((person.facing ?? 0) * Math.PI) / 180,
    pose: "stand" as const,
    heightCm: person.heightCm,
  }));

  const middle = placed.length
    ? {
        x: placed.reduce((total, item) => total + item.position.x, 0) / placed.length,
        z: placed.reduce((total, item) => total + item.position.z, 0) / placed.length,
      }
    : { x: 0, z: 0 };
  const tall = Math.max(1.4, ...people.map((person) => person.heightCm / 100));
  const eye = tall * 0.94;

  const fov = DEFAULT_COMPOSITION.camera.fovDegrees;
  const share = SHOT_SHARE[(plan.shot ?? "").trim()] ?? SHOT_SHARE["웨이스트 샷"];
  /*
    `shotSizeOf` 를 거꾸로 — share = 키 / (2 · 거리 · tan(화각/2)) 이므로
    거리 = 키 / (2 · share · tan(화각/2)) 입니다.
  */
  const half = Math.tan((fov * Math.PI) / 360);
  const distance = Math.max(0.6, tall / (2 * share * half));
  const lift = ANGLE_LIFT[(plan.angle ?? "").trim()] ?? 0;

  /*
    카메라는 **−Z 쪽**에 섭니다(사람이 기본으로 그쪽을 봅니다). 방보다 멀리 물러나지
    않게 막습니다 — 벽 밖에서 찍으면 실내가 통째로 가려집니다.
  */
  const back = plan.place?.outdoor ? distance : Math.min(distance, size / 2 - 0.4);
  const camera = {
    ...DEFAULT_COMPOSITION.camera,
    position: {
      x: middle.x,
      y: Math.max(0.3, eye + lift),
      z: middle.z - Math.max(0.6, back),
    },
    target: { x: middle.x, y: eye, z: middle.z },
    fovDegrees: fov,
  };

  return normalizeComposition({
    ...DEFAULT_COMPOSITION,
    camera,
    characters: placed,
    rooms: [
      {
        id: "room-1",
        name: plan.place?.outdoor ? "실외 1" : "실내 1",
        outdoor: plan.place?.outdoor || undefined,
        // 실외는 돔이 기본입니다 — 파노라마 한 장이 모서리 없이 감깁니다. 실내는 늘 상자입니다.
        outdoorShape: plan.place?.outdoor ? undefined : "box",
        width: size,
        depth: size,
        height: Math.max(2.4, plan.place?.height ?? (plan.place?.outdoor ? size / 2 : 3)),
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
      },
    ],
  } as unknown as Partial<CompositionState>);
}

