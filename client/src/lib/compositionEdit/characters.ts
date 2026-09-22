/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { mergeBonePose, releaseFingerPreset } from "@/lib/rig";
import { CharacterComposition, CompositionMannequin, CompositionState, Vector3Value } from "@/lib/composition";
import { uid } from "./core";


// ── 인물 ──────────────────────────────────────────────────────────────

export function updateCharacterIn(
  current: CompositionState,
  id: string,
  patch: Partial<CharacterComposition>,
): CompositionState {
  return {
    ...current,
    characters: current.characters.map((item) =>
      item.characterId === id ? { ...item, ...patch } : item,
    ),
  };
}

/**
 * 처음 놓는 자리는 늘 보이는 곳이라야 합니다. 이미 놓인 수만큼 옆으로 밀어 겹치지 않게 합니다.
 *
 * **숨긴 배치는 세지 않습니다.** 컷↔구도 동기화는 컷에서 뺀 인물을 지우지 않고
 * `hidden` 으로 남겨 자리·포즈를 지키는데(cutCompositionSync 참조), 그것까지 세면
 * 인물을 갈아 끼울수록 새 인물이 옆으로 밀려 화면 밖에 섭니다(셋을 빼고 하나를
 * 넣으면 x=2.25m — 기본 카메라의 반폭 약 2.6m 라 가장자리에 걸칩니다).
 */
const initialPlacement = (current: CompositionState, characterId: string) => ({
  characterId,
  position: {
    x: current.characters.filter((item) => !item.hidden).length * 0.9 - 0.45,
    y: 0,
    z: 0,
  },
  rotation: { x: 0, y: 0, z: 0 },
  rotationY: 0,
  pose: "stand" as const,
  path: [],
});

export function placeCharacterIn(
  current: CompositionState,
  id: string,
): CompositionState {
  return {
    ...current,
    characters: [...current.characters, initialPlacement(current, id)],
  };
}

export function addMannequinIn(
  current: CompositionState,
  gender: "male" | "female",
  id = uid("mannequin"),
): CompositionState {
  return {
    ...current,
    mannequins: [
      ...current.mannequins,
      {
        id,
        name: `마네킹 ${current.mannequins.length + 1}`,
        gender,
        heightCm: gender === "female" ? 162 : 175,
        build: "average" as const,
      },
    ],
    characters: [
      ...current.characters,
      { ...initialPlacement(current, id), isMannequin: true },
    ],
  };
}

/**
 * 마네킹 이름·키·체격.
 * 마네킹은 구도 상태 안에서만 살기 때문에 여기서 고칩니다. 프로젝트에서 넘어온
 * 인물은 캐릭터 카드가 주인이라 상위(onCharacterUpdate)로 올려보내야 합니다 —
 * 두 곳에서 고칠 수 있으면 어느 쪽이 맞는지 알 수 없어집니다.
 */
export function patchMannequinIn(
  current: CompositionState,
  id: string,
  patch: Partial<CompositionMannequin>,
): CompositionState {
  return {
    ...current,
    mannequins: current.mannequins.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

/**
 * 사람 **여럿의 몸 색**을 한 번에 못 박습니다(`undefined` 면 자동으로 되돌림).
 *
 *
 *
 * 마네킹이면 옛 자리(`mannequins[].color`)에도 같은 값을 적습니다 — 한쪽만 바꾸면 둘이 어긋나
 * 어느 쪽을 믿을지 모르게 됩니다. 읽는 쪽은 `compositionColors.pinnedColorOf` 하나뿐입니다.
 */
export function setCharacterColorsIn(
  current: CompositionState,
  ids: readonly string[],
  color: string | undefined,
): CompositionState {
  const targets = new Set(ids);
  if (targets.size === 0) return current;
  return {
    ...current,
    characters: current.characters.map((item) =>
      targets.has(item.characterId) ? { ...item, color } : item,
    ),
    mannequins: current.mannequins.map((item) =>
      targets.has(item.id) ? { ...item, color } : item,
    ),
  };
}

export function removeMannequinIn(
  current: CompositionState,
  id: string,
): CompositionState {
  return {
    ...current,
    mannequins: current.mannequins.filter((item) => item.id !== id),
    characters: current.characters.filter((item) => item.characterId !== id),
  };
}

/**
 * 관절 하나를 직접 돌렸을 때.
 * 손가락 관절을 직접 만지면 그 손가락은 프리셋에서 풀려야
 * 프리셋 굽힘 위에 덧씌워지는 혼란이 없습니다.
 */
export function setBoneRotationIn(
  current: CompositionState,
  characterId: string,
  bone: string,
  rotation: Vector3Value,
): CompositionState {
  const character = current.characters.find(
    (item) => item.characterId === characterId,
  );
  return updateCharacterIn(current, characterId, {
    bonePose: mergeBonePose(character?.bonePose || {}, { [bone]: rotation }),
    fingers: releaseFingerPreset(character?.fingers, bone),
  });
}

/** 여러 관절을 한 번에(IK 등). 손가락 프리셋은 건드리지 않습니다. */
export function mergeBonePoseIn(
  current: CompositionState,
  characterId: string,
  entries: Record<string, Vector3Value>,
): CompositionState {
  const character = current.characters.find(
    (item) => item.characterId === characterId,
  );
  return updateCharacterIn(current, characterId, {
    bonePose: mergeBonePose(character?.bonePose || {}, entries),
  });
}
