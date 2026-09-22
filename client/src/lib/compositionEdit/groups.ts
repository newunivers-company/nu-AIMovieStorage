/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다.

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { CompositionObjectGroup, CompositionSwapRef, CompositionState, ObjectComposition, Vector3Value } from "@/lib/composition";
import { uid } from "./core";
import { updateObjectIn } from "./props";

// ── 소품 묶음 ────────────────────────────────────────────────────────────
/*
  상자 여럿을 쌓아 모양을 만든 뒤 하나로 묶어 한 물건처럼 다루고, 묶인 것은 색도 함께 바뀝니다.

  구도잡기의 소품은 회색 덩어리라, 여럿을 쌓아 두면 어디부터 어디까지가 한 물건인지
  화면에서 구분이 안 됩니다. 묶음마다 색을 주면 눈으로도 한 덩어리가 되고, 그 색이
  그대로 프롬프트의 이름표가 됩니다 — «노란 덩어리는 안개» 처럼.
*/

/**
 * 묶음에 돌아가며 주는 색.
 *
 * 채도를 높게 잡았습니다 — 회색 소품들 사이에서 «묶인 것» 이 바로 눈에 띄어야 합니다.
 * 서로 충분히 멀어서 묶음이 넷쯤 돼도 헷갈리지 않습니다.
 */
export const OBJECT_GROUP_COLORS = [
  "#e8c15a",
  "#6fb7e8",
  "#d98ad4",
  "#7fd6a3",
  "#e8906a",
  "#9a9ae8",
];

export function objectGroupsOf(
  current: CompositionState,
): CompositionObjectGroup[] {
  return current.objectGroups ?? [];
}

export function objectGroupOf(
  current: CompositionState,
  groupId?: string,
): CompositionObjectGroup | null {
  if (!groupId) return null;
  return objectGroupsOf(current).find((group) => group.id === groupId) ?? null;
}

/**
 * 묶음에 **결국 속하는 소품** 전부. 안에 묶음이 또 있으면 그 속까지 훑습니다.
 *
 * 한 번 묶은 것을 또 묶을 수 있습니다. 그렇게 겹쳐 묶으면 «이 덩어리를 움직인다» 가
 * 곧 «속의 속까지 전부 움직인다» 라야 모양이 유지됩니다.
 *
 * 고리(A 안에 B, B 안에 A)는 사람이 만들 수 없게 막아 두지만(`groupObjectsIn`),
 * 저장본이 깨졌을 때를 대비해 본 묶음은 다시 안 봅니다 — 안 그러면 프레임마다 무한히 돕니다.
 */
export function groupMemberIdsOf(
  current: CompositionState,
  groupId: string,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    current.objects.forEach((item) => {
      if (item.groupId === id) ids.push(item.id);
    });
    objectGroupsOf(current)
      .filter((group) => group.groupId === id)
      .forEach((group) => walk(group.id));
  };
  walk(groupId);
  return ids;
}

/** 맨 바깥 묶음들 — 목록에 한 줄씩 서는 것들입니다. */
export function topObjectGroupsOf(
  current: CompositionState,
): CompositionObjectGroup[] {
  return objectGroupsOf(current).filter((group) => !group.groupId);
}

/**
 * 소품이 결국 어느 **맨 바깥 묶음**에 속하는가. 안 묶였으면 null.
 *
 * 목록에서 «묶인 것은 감추고 묶음만 보여 주는» 규칙이 이 값을 씁니다.
 */
export function outerGroupOf(
  current: CompositionState,
  item: ObjectComposition,
): CompositionObjectGroup | null {
  let group = objectGroupOf(current, item.groupId);
  const seen = new Set<string>();
  while (group?.groupId && !seen.has(group.id)) {
    seen.add(group.id);
    const up = objectGroupOf(current, group.groupId);
    if (!up) break;
    group = up;
  }
  return group;
}

/**
 * 고른 소품들을 **한 덩어리로** 묶습니다. 조명은 빼고 묶습니다.
 *
 * 조명을 함께 묶으면 묶음 색이 빛 색을 덮어써서, 노란 덩어리를 만들었더니 방 조명까지
 * 노랗게 되는 일이 납니다. 빛은 «물건» 이 아니라 «환경» 이라 갈래가 다릅니다.
 */
export function groupObjectsIn(
  current: CompositionState,
  /** 소품 id 와 **묶음 id** 를 섞어 넘길 수 있습니다 — 묶은 것을 다시 묶습니다. */
  ids: string[],
  name?: string,
): { state: CompositionState; id: string | null } {
  const members = current.objects.filter(
    (item) => ids.includes(item.id) && item.kind !== "light",
  );
  const inner = objectGroupsOf(current).filter(
    (group) => ids.includes(group.id) && !group.groupId,
  );
  // 하나짜리 묶음은 뜻이 없습니다 — 그냥 그것에 뜻을 붙이면 됩니다.
  if (members.length + inner.length < 2) return { state: current, id: null };
  const groups = objectGroupsOf(current);
  const color = OBJECT_GROUP_COLORS[groups.length % OBJECT_GROUP_COLORS.length];
  const group: CompositionObjectGroup = {
    id: uid("grp"),
    name: name?.trim() || `덩어리 ${groups.length + 1}`,
    color,
  };
  const taken = new Set(members.map((item) => item.id));
  const innerIds = new Set(inner.map((item) => item.id));
  /*
    안에 든 묶음까지 **색을 물들입니다.** 겹쳐 묶었는데 속이 옛 색으로 남아 있으면
    화면에서 한 덩어리로 안 보입니다 — 색이 곧 «한 덩어리» 라는 표시니까요.
  */
  const deep = new Set(
    inner.flatMap((item) => groupMemberIdsOf(current, item.id)),
  );
  return {
    state: {
      ...current,
      objectGroups: [
        ...groups.map((item) =>
          innerIds.has(item.id) ? { ...item, groupId: group.id, color } : item,
        ),
        group,
      ],
      objects: current.objects.map((item) =>
        taken.has(item.id)
          ? { ...item, groupId: group.id, color: group.color }
          : deep.has(item.id)
            ? { ...item, color }
            : item,
      ),
    },
    id: group.id,
  };
}

/**
 * 묶음을 풉니다 — **한 겹만**. 속에 든 묶음은 그대로 남아 맨 바깥으로 올라옵니다.
 *
 * 속까지 통째로 풀면 의자 넷을 묶었다 풀었을 때 의자까지 흩어집니다. 한 겹씩 벗기는
 * 편이 되돌리기 쉽습니다.
 */
export function ungroupObjectsIn(
  current: CompositionState,
  groupId: string,
): CompositionState {
  return {
    ...current,
    objectGroups: objectGroupsOf(current)
      .filter((group) => group.id !== groupId)
      .map((group) =>
        group.groupId === groupId ? { ...group, groupId: undefined } : group,
      ),
    objects: current.objects.map((item) =>
      item.groupId === groupId
        ? { ...item, groupId: undefined, color: undefined }
        : item,
    ),
  };
}

/** 묶음의 이름·색·뜻·시트를 고칩니다. 색을 바꾸면 속한 소품이 함께 바뀝니다. */
export function patchObjectGroupIn(
  current: CompositionState,
  groupId: string,
  patch: Partial<Omit<CompositionObjectGroup, "id">>,
): CompositionState {
  const groups = objectGroupsOf(current).map((group) =>
    group.id === groupId ? { ...group, ...patch } : group,
  );
  const color = patch.color;
  return {
    ...current,
    objectGroups: groups,
    objects: color
      ? current.objects.map((item) =>
          item.groupId === groupId ? { ...item, color } : item,
        )
      : current.objects,
  };
}

/** 소품 하나에 «이걸로 바꿔 그려라» 를 겁니다. */
export function setObjectSwapIn(
  current: CompositionState,
  objectId: string,
  swapRef: CompositionSwapRef | null,
): CompositionState {
  return {
    ...current,
    objects: current.objects.map((item) =>
      item.id === objectId ? { ...item, swapRef: swapRef ?? undefined } : item,
    ),
  };
}

/**
 * 묶음에 속한 소품을 옮기면 **덩어리가 통째로** 따라옵니다.
 *
 * 묶어 둔 것은 한 번에 옮길 수 있어야 합니다.
 *
 * # 왜 «같은 만큼» 이 아니라 축까지 도는가
 *
 * 자리는 모두 같은 만큼 밀면 됩니다. 그런데 **회전·크기**는 그렇지 않습니다 — 상자 셋을
 * 세워 만든 의자를 돌리면, 셋이 제자리에서 각자 도는 것이 아니라 **덩어리의 한가운데를
 * 축으로** 함께 돌아야 모양이 유지됩니다. 크기도 마찬가지로 중심에서 멀어져야 합니다.
 * 안 그러면 돌리는 순간 의자가 흩어집니다.
 *
 * 축은 **속한 소품들의 한가운데**입니다. 따로 적어 두지 않는 까닭: 소품을 더하거나 빼면
 * 그 중심도 따라 움직여야 하는데, 적어 둔 값은 그걸 모릅니다.
 */
export function transformObjectGroupIn(
  current: CompositionState,
  objectId: string,
  patch: Partial<ObjectComposition>,
): CompositionState {
  const moved = current.objects.find((item) => item.id === objectId);
  if (!moved?.groupId) return updateObjectIn(current, objectId, patch);
  /*
    **맨 바깥 묶음**을 통째로 움직입니다. 겹쳐 묶었을 때 속 묶음만 움직이면 바깥
    덩어리의 모양이 무너집니다 — 「이 덩어리를 옮긴다」 는 늘 보이는 덩어리 전체입니다.
  */
  const outer = outerGroupOf(current, moved);
  const ids = new Set(outer ? groupMemberIdsOf(current, outer.id) : []);
  const members = current.objects.filter((item) => ids.has(item.id));
  if (members.length < 2) return updateObjectIn(current, objectId, patch);

  /** 덩어리의 한가운데 — 회전·크기의 축. */
  const pivot = {
    x: members.reduce((sum, item) => sum + item.position.x, 0) / members.length,
    y: members.reduce((sum, item) => sum + item.position.y, 0) / members.length,
    z: members.reduce((sum, item) => sum + item.position.z, 0) / members.length,
  };

  const shift = patch.position
    ? {
        x: patch.position.x - moved.position.x,
        y: patch.position.y - moved.position.y,
        z: patch.position.z - moved.position.z,
      }
    : null;
  // 회전은 y 축만 봅니다 — 바닥에 놓인 물건을 돌리는 일이 거의 전부라서요.
  const spin = patch.rotation ? patch.rotation.y - moved.rotation.y : 0;
  const grow =
    patch.scale && moved.scale.x !== 0 ? patch.scale.x / moved.scale.x : 1;

  const cos = Math.cos(spin);
  const sin = Math.sin(spin);

  return {
    ...current,
    objects: current.objects.map((item) => {
      if (!ids.has(item.id)) return item;
      // 축 기준 상대 자리 — 여기에 회전·확대를 걸고 다시 축을 더합니다.
      let rx = item.position.x - pivot.x;
      let rz = item.position.z - pivot.z;
      let ry = item.position.y - pivot.y;
      if (spin) {
        const nx = rx * cos + rz * sin;
        const nz = -rx * sin + rz * cos;
        rx = nx;
        rz = nz;
      }
      if (grow !== 1) {
        rx *= grow;
        ry *= grow;
        rz *= grow;
      }
      return {
        ...item,
        position: {
          x: pivot.x + rx + (shift?.x ?? 0),
          y: pivot.y + ry + (shift?.y ?? 0),
          z: pivot.z + rz + (shift?.z ?? 0),
        },
        rotation: spin
          ? { ...item.rotation, y: item.rotation.y + spin }
          : item.rotation,
        scale:
          grow !== 1
            ? {
                x: item.scale.x * grow,
                y: item.scale.y * grow,
                z: item.scale.z * grow,
              }
            : item.scale,
      };
    }),
  };
}

/**
 * 소품을 인물의 관절에 **붙입니다**.
 *
 * 손에 쥔 검처럼, 붙인 소품은 그 관절을 따라 움직여야 합니다.
 *
 * 붙이는 순간 좌표의 뜻이 바뀝니다 — 월드에서 «그 관절 기준» 으로요. 그대로 두면 검이
 * 엉뚱한 데로 튀므로 자리를 0 으로 되돌립니다(관절에 딱 붙은 상태). 거기서 손잡이 위치를
 * 조금씩 옮겨 맞추는 편이, 튄 물건을 찾아다니는 것보다 훨씬 빠릅니다.
 */
export function attachObjectIn(
  current: CompositionState,
  objectId: string,
  attach: { targetId: string; bone: string },
): CompositionState {
  return {
    ...current,
    objects: current.objects.map((item) =>
      item.id === objectId
        ? {
            ...item,
            attach: { ...attach, pivot: item.attach?.pivot },
            position: { x: 0, y: 0, z: 0 },
          }
        : item,
    ),
  };
}

/**
 * 관절에서 **뗍니다**. 지금 보이는 자리를 월드 좌표로 받아 그대로 세웁니다.
 *
 * 월드 자리를 안 넘기면 원점으로 돌아가 버립니다 — 검을 떼었더니 방 한가운데 바닥에
 * 떨어져 있는 셈이라, 어디 있었는지조차 알 수 없습니다. 3D 를 아는 쪽(뷰포트)이
 * 그때 자리를 재서 넘깁니다.
 */
export function detachObjectIn(
  current: CompositionState,
  objectId: string,
  worldPose?: { position: Vector3Value; rotation?: Vector3Value },
): CompositionState {
  return {
    ...current,
    objects: current.objects.map((item) =>
      item.id === objectId
        ? {
            ...item,
            attach: undefined,
            position: worldPose ? { ...worldPose.position } : item.position,
            rotation: worldPose?.rotation
              ? { ...worldPose.rotation }
              : item.rotation,
          }
        : item,
    ),
  };
}

/** 소품 안에서 관절에 닿는 점(손잡이 자리)을 옮깁니다. */
export function setObjectPivotIn(
  current: CompositionState,
  objectId: string,
  pivot: Vector3Value,
): CompositionState {
  return {
    ...current,
    objects: current.objects.map((item) =>
      item.id === objectId && item.attach
        ? { ...item, attach: { ...item.attach, pivot } }
        : item,
    ),
  };
}
