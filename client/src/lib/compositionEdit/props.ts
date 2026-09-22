/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다.

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

import { CompositionCubeFace, CompositionRoom, CompositionState, ObjectComposition, Vector3Value } from "@/lib/composition";
import { ONE_VECTOR, ZERO_VECTOR, uid } from "./core";
import { roomsOf } from "./rooms";
import { ZERO_ROTATION } from "./timeline";


// ── 소품 ──────────────────────────────────────────────────────────────

/** 소품 목록의 한 줄. 아이콘은 화면 쪽 것이라 여기서는 모릅니다. */
export interface ObjectKindEntry {
  id: ObjectComposition["kind"];
  label: string;
  /** 조명일 때만. 핀=point, LED=area */
  lightType?: "point" | "area";
}

export function createObject(
  entry: ObjectKindEntry,
  id = uid("object"),
): ObjectComposition {
  return {
    id,
    label: entry.label,
    kind: entry.id,
    /*
      벽은 **인물 뒤**(z −3 m)에 섭니다. 소품 기본 자리(−1.2 m)에 두면 인물과 겹쳐,
      세우자마자 화면이 가려집니다. 크기도 «사람이 서는 벽»(가로 4 m · 높이 2.6 m)으로 시작합니다.
    */
    position:
      entry.id === "wall"
        ? { x: 0, y: 0, z: -3 }
        : { x: 0, y: entry.id === "light" ? 2.4 : 0, z: -1.2 },
    rotation: { ...ZERO_VECTOR },
    scale: entry.id === "wall" ? { x: 4, y: 2.6, z: 1 } : { ...ONE_VECTOR },
    visible: true,
    // 핀=point(한 점에서 퍼짐), LED=area(면에서 고르게). 뷰포트는 지금 둘 다
    // PointLight 로 그리지만 저장은 구분해 둡니다 — 블렌더 지시문에 씁니다.
    ...(entry.id === "light"
      ? {
          lightType: entry.lightType || ("point" as const),
          intensity: 8,
          color: "#ffe9b0",
        }
      : {}),
  };
}

/**
 * 소품을 **그 방 안에** 세웁니다. 방 밑면 한가운데에서 조금 뒤(깊이의 1/4)로 놓습니다.
 *
 * 소품은 두 탭 모두에 있습니다 — 배치 탭은 인물과 그 인물이 쥔 것, 환경 탭은 방과 그 방에 놓인 것.
 * 같은 소품이라도 누구에게 딸렸는지가 다르므로 목록을 갈라 둡니다.
 *
 * 방에 속했다는 것은 **자리로** 압니다(`roomPreset.captureRoomPreset` 과 같은 규칙) — 표를 따로 들면 소품을 옮겼을 때
 * 표와 자리가 어긋납니다. 그래서 «방 안에 놓는 일»만 여기서 해 주면 그다음은 자리가 말해 줍니다.
 */
export function addObjectInRoom(
  current: CompositionState,
  entry: ObjectKindEntry,
  roomId: string,
): { state: CompositionState; id: string } {
  const room = roomsOf(current).find((item) => item.id === roomId);
  const created = createObject(entry);
  if (!room) return { state: { ...current, objects: [...current.objects, created] }, id: created.id };
  const placed: ObjectComposition = {
    ...created,
    // **이 방의 배경 소품**이라는 표시. 배치 탭에서 세운 것과 목록이 갈립니다.
    roomId,
    position: {
      x: room.position.x,
      y: room.position.y + (entry.id === "light" ? Math.min(room.height - 0.2, 2.4) : 0),
      z: room.position.z - room.depth / 4,
    },
    // 벽은 방 뒤쪽에 방 너비만큼 세웁니다 — 방 안에서 «뒷벽» 으로 바로 쓰입니다.
    scale:
      entry.id === "wall"
        ? { x: room.width, y: Math.min(room.height, 3), z: 1 }
        : created.scale,
  };
  return { state: { ...current, objects: [...current.objects, placed] }, id: placed.id };
}

/**
 * 이 방의 **배경 소품**들. 자리가 아니라 **표시**(`ObjectComposition.roomId`)로 봅니다.
 *
 * 자리로 가리면 배치 탭에서 놓은 것까지 환경 탭 목록으로 넘어옵니다 —
 * 인물 손에 쥔 검도 방 안에 있다는 이유로 배경 소품이 됩니다. 어디서 세웠는지는 뜻이지 자리가 아닙니다.
 */
export function objectsInRoom(
  current: CompositionState,
  roomId: string,
): ObjectComposition[] {
  return current.objects.filter((object) => object.roomId === roomId);
}

/** 배치 탭이 다루는 **캐릭터 쪽 소품**들 — 방에 딸리지 않은 것 전부. */
export function characterObjectsOf(current: CompositionState): ObjectComposition[] {
  return current.objects.filter((object) => !object.roomId);
}

/**
 * 종류마다 다른 **로컬 상자**(크기 1 일 때). 3D 화면이 세우는 모양 그대로입니다.
 *
 * 상자·실린더·벽은 **밑동이 원점**입니다(`CompositionViewport` 가 mesh 를 0.5 만큼 올려 세웁니다) —
 * 여기서 한가운데로 잘못 잡으면 바닥에 붙인 물건이 반쯤 파묻힙니다.
 */
function localBoxOf(object: ObjectComposition): {
  min: Vector3Value;
  max: Vector3Value;
} {
  switch (object.kind) {
    // 널판이라 두께가 없습니다. 0 으로 두면 면과 같은 자리에서 깜빡여서 2 cm 만 줍니다.
    case "wall":
      return { min: { x: -0.5, y: 0, z: -0.01 }, max: { x: 0.5, y: 1, z: 0.01 } };
    case "sphere":
      return { min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } };
    case "table":
      return { min: { x: -0.7, y: 0, z: -0.4 }, max: { x: 0.7, y: 0.75, z: 0.4 } };
    case "light":
      return { min: { x: -0.1, y: -0.1, z: -0.1 }, max: { x: 0.1, y: 0.1, z: 0.1 } };
    default:
      return { min: { x: -0.5, y: 0, z: -0.5 }, max: { x: 0.5, y: 1, z: 0.5 } };
  }
}

/**
 * 돌리고 키운 소품이 **한 축으로 얼마나 뻗는가**(원점 기준 min·max, m).
 *
 * 회전값은 three.js 와 같은 **라디안 XYZ** 입니다(`group0.rotation.set(...)`). 도로 계산하면 90 이 90 라디안이
 * 되어 물건이 엉뚱한 각으로 섭니다 — 실제로 벽에 붙인 널판이 회전값째 틀어져 엉뚱한 각으로
 * 섰습니다.
 */
function rotatedSpanOf(
  object: ObjectComposition,
  axis: "x" | "y" | "z",
): { min: number; max: number } {
  const box = localBoxOf(object);
  const { x: rx, y: ry, z: rz } = object.rotation;
  const [cx, sx] = [Math.cos(rx), Math.sin(rx)];
  const [cy, sy] = [Math.cos(ry), Math.sin(ry)];
  const [cz, sz] = [Math.cos(rz), Math.sin(rz)];
  // three.js 기본 차례(XYZ): R = Rx · Ry · Rz. 필요한 건 그 행렬의 한 줄뿐입니다.
  const row = {
    x: [cy * cz, -cy * sz, sy],
    y: [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    z: [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  }[axis];
  let min = 0;
  let max = 0;
  (["x", "y", "z"] as const).forEach((key, index) => {
    const a = box.min[key] * object.scale[key] * row[index];
    const b = box.max[key] * object.scale[key] * row[index];
    min += Math.min(a, b);
    max += Math.max(a, b);
  });
  return { min, max };
}

/** 붙은 소품 하나를 **그 면에 다시 대는** 자리. 닿는 축만 바꾸고 나머지는 그대로 둡니다. */
function seatedPosition(
  object: ObjectComposition,
  room: CompositionRoom,
  face: CompositionCubeFace,
): Vector3Value {
  const { x, y, z } = object.position;
  const span = (axis: "x" | "y" | "z") => rotatedSpanOf(object, axis);
  switch (face) {
    case "bottom":
      return { x, y: room.position.y - span("y").min, z };
    case "top":
      return { x, y: room.position.y + room.height - span("y").max, z };
    case "back":
      return { x, y, z: room.position.z - room.depth / 2 - span("z").min };
    case "front":
      return { x, y, z: room.position.z + room.depth / 2 - span("z").max };
    case "left":
      return { x: room.position.x - room.width / 2 - span("x").min, y, z };
    case "right":
      return { x: room.position.x + room.width / 2 - span("x").max, y, z };
  }
}

/**
 * 벽에 붙인 **널판**은 그 면과 나란히, 방 안쪽을 보게 돌립니다. 상자·구는 사람이 돌려 둔 각을 건드리지 않습니다.
 *
 * 값은 **라디안**입니다(구도 상태의 회전은 전부 라디안 — 오른쪽 칸만 도로 보여 줍니다).
 */
function seatedRotation(
  object: ObjectComposition,
  face: CompositionCubeFace,
): Vector3Value {
  if (object.kind !== "wall") return object.rotation;
  const deg = (value: number) => (value * Math.PI) / 180;
  // 판은 원래 +Z 를 봅니다. 뒷벽은 그대로, 앞벽은 반 바퀴, 옆벽은 네 분의 한 바퀴.
  const yaw = { front: 180, back: 0, left: 90, right: -90, top: 0, bottom: 0 }[face];
  const pitch = face === "top" ? 90 : face === "bottom" ? -90 : 0;
  return { x: deg(pitch), y: deg(yaw), z: 0 };
}

/**
 * 소품을 방의 한 면에 **붙이거나 뗍니다**(`face` 가 null 이면 뗍니다).
 *
 * 바닥·천장·네 벽 여섯 면 모두에 붙습니다 — 한 면이라도 빠지면 그 면만 손으로 맞춰야 합니다.
 *
 * 인물 관절에 매달려 있던 것은 **먼저 떼어 냅니다**. 매달린 동안 좌표의 뜻이 «그 관절 기준» 이라, 그대로 방에
 * 붙이면 관절 기준 숫자를 방 좌표로 읽어 엉뚱한 데 섭니다 — 인물에 붙였다 벽에 다시 붙이면 값이
 * 틀어졌습니다. 손에 들려 있던 자리는 알 길이 없으므로 **방 한가운데**에서 다시 시작합니다.
 */
export function mountObjectToFaceIn(
  current: CompositionState,
  objectId: string,
  roomId: string,
  face: CompositionCubeFace | null,
): CompositionState {
  const room = roomsOf(current).find((item) => item.id === roomId);
  return {
    ...current,
    objects: current.objects.map((object) => {
      if (object.id !== objectId) return object;
      if (!face || !room) return { ...object, mount: undefined };
      const freed: ObjectComposition = object.attach
        ? {
            ...object,
            attach: undefined,
            position: { ...room.position },
            rotation: { ...ZERO_ROTATION },
          }
        : object;
      const rotation = seatedRotation(freed, face);
      const turned = { ...freed, rotation };
      return {
        ...turned,
        mount: { roomId, face },
        position: seatedPosition(turned, room, face),
      };
    }),
  };
}

/**
 * 방이 커지거나 움직인 뒤 **붙여 둔 소품을 다시 붙입니다**. 방 크기를 바꿀 때마다 부릅니다 —
 * 안 그러면 벽만 물러나고 액자는 허공에 남습니다.
 */
export function snapRoomMountsIn(
  current: CompositionState,
  roomId: string | null = null,
): CompositionState {
  const rooms = roomsOf(current);
  if (!rooms.length) return current;
  let touched = false;
  const objects = current.objects.map((object) => {
    const mount = object.mount;
    // 관절에 매달린 동안은 방이 아니라 인물이 자리를 정합니다.
    if (!mount || object.attach) return object;
    if (roomId && mount.roomId !== roomId) return object;
    const room = rooms.find((item) => item.id === mount.roomId);
    if (!room) return object;
    const position = seatedPosition(object, room, mount.face);
    if (
      Math.abs(position.x - object.position.x) < 1e-6 &&
      Math.abs(position.y - object.position.y) < 1e-6 &&
      Math.abs(position.z - object.position.z) < 1e-6
    )
      return object;
    touched = true;
    return { ...object, position };
  });
  return touched ? { ...current, objects } : current;
}

export function addObjectIn(
  current: CompositionState,
  entry: ObjectKindEntry,
): CompositionState {
  return { ...current, objects: [...current.objects, createObject(entry)] };
}

export function updateObjectIn(
  current: CompositionState,
  id: string,
  patch: Partial<ObjectComposition>,
): CompositionState {
  const next = updateObjectRaw(current, id, patch);
  // 붙여 둔 소품은 면을 따라 **밀리기만** 합니다 — 끌어서 벽을 뚫고 나가면 붙인 뜻이 없습니다.
  const mount = next.objects.find((item) => item.id === id)?.mount;
  return mount ? snapRoomMountsIn(next, mount.roomId) : next;
}

function updateObjectRaw(
  current: CompositionState,
  id: string,
  patch: Partial<ObjectComposition>,
): CompositionState {
  return {
    ...current,
    objects: current.objects.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

export function removeObjectIn(
  current: CompositionState,
  id: string,
): CompositionState {
  return {
    ...current,
    objects: current.objects.filter((item) => item.id !== id),
  };
}
