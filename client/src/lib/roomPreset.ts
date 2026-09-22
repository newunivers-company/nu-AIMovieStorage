import { compositionRoomId, normalizeCompositionRoom } from "@/lib/composition";
import { uid } from "@/lib/projectTypes";
import type {
  CompositionObjectGroup,
  CompositionRoom,
  CompositionState,
  ObjectComposition,
} from "@/lib/composition";

/**
 * **방 라이브러리** — 방 하나와 그 안의 것들을 통째로 저장해 다른 컷·씬에서 다시 세웁니다.
 *
 * 한 장소는 여러 씬·여러 구도에 되풀이해 나옵니다. 방과 그 안의 소품, 소품에 이어 둔 에셋까지
 * 한 묶음으로 저장해야 다음 컷에서 그대로 다시 세울 수 있습니다.
 *
 * # 무엇을 같이 담는가
 *
 * 방만 담으면 다음 컷에서 책상·제단·문을 다시 놓아야 하고, 자리가 조금씩 달라져 **같은 장소가 컷마다 다른 방**이 됩니다.
 * 그래서 방 안에 선 소품과 그 묶음, 소품에 이어 둔 에셋 시트(`swapRef`)까지 한 덩어리로 담습니다.
 *
 * # 자리는 «방 기준» 으로 적습니다
 *
 * 소품 자리를 월드 좌표 그대로 담으면, 방을 다른 자리에 세우는 순간 소품만 원래 자리에 남습니다. 저장할 때 **방 밑면 한가운데를
 * 원점으로** 빼 두고, 세울 때 새 방의 자리를 더합니다. 방을 옮겨도 안의 것이 따라옵니다.
 */
export interface RoomPreset {
  id: string;
  /** 사람이 읽는 이름 — 기본은 방 이름(«회합방»). */
  name: string;
  /** 저장한 시각(ISO). 목록을 최근 순으로 보여 줄 때 씁니다. */
  savedAt: string;
  /** 방 그대로(치수·여섯 면·돔·가릴 면·이어 둔 장소 카드). 자리는 세울 때 새로 잡습니다. */
  room: CompositionRoom;
  /** 방 안에 있던 소품 — 자리는 **방 기준**입니다. */
  objects: ObjectComposition[];
  /** 그 소품들이 속한 묶음(바깥 묶음까지). */
  groups: CompositionObjectGroup[];
}

/** 소품이 이 방 안에 서 있는가. 벽에 붙은 것도 담으려고 사방 여유를 조금 둡니다. */
function insideRoom(room: CompositionRoom, object: ObjectComposition): boolean {
  const margin = 0.5;
  const dx = Math.abs(object.position.x - room.position.x);
  const dz = Math.abs(object.position.z - room.position.z);
  const dy = object.position.y - room.position.y;
  return (
    dx <= room.width / 2 + margin &&
    dz <= room.depth / 2 + margin &&
    dy >= -margin &&
    dy <= room.height + margin
  );
}

/**
 * 지금 구도에서 방 하나를 **라이브러리 한 칸**으로 떠냅니다.
 *
 * 인물은 담지 않습니다 — 장소는 돌려쓰지만 누가 서는지는 컷마다 다릅니다(담으면 다른 컷에 엉뚱한 사람이 섭니다).
 */
export function captureRoomPreset(
  state: CompositionState,
  roomId: string,
  name?: string,
  /** 저장 시각. 호출하는 쪽이 넘깁니다(순수 함수로 두려고). */
  savedAt = new Date().toISOString(),
): RoomPreset | null {
  const room = (state.rooms || []).find((item) => item.id === roomId);
  if (!room) return null;
  /*
    **그 방의 배경 소품만** 담습니다 — 인물이 들고 다니는 소품은 장소가 아니라 사람에게 딸린 것이라,
    방과 함께 저장하면 다른 컷에서 방만 세워도 주인 없는 검이 허공에 섭니다.
    자리로 가리던 때에는 인물이 든 검이 방 안에 있다는 이유로 방과 함께 저장됐습니다.
    옛 저장본에는 표시가 없으므로 그때만 자리로 봅니다.
  */
  const marked = (state.objects || []).some((object) => object.roomId);
  const objects = (state.objects || [])
    .filter((object) =>
      marked ? object.roomId === room.id : insideRoom(room, object),
    )
    .map((object) => ({
      ...object,
      position: {
        x: object.position.x - room.position.x,
        y: object.position.y - room.position.y,
        z: object.position.z - room.position.z,
      },
    }));
  // 담은 소품이 가리키는 묶음과, 그 묶음을 다시 묶은 바깥 묶음까지 따라 올라갑니다.
  const wanted = new Set(objects.map((object) => object.groupId).filter(Boolean) as string[]);
  const all = state.objectGroups || [];
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of all) {
      if (!wanted.has(group.id) || !group.groupId || wanted.has(group.groupId)) continue;
      wanted.add(group.groupId);
      grew = true;
    }
  }
  return {
    id: uid(),
    name: name?.trim() || room.name || "방",
    savedAt,
    room,
    objects,
    groups: all.filter((group) => wanted.has(group.id)),
  };
}

/**
 * 라이브러리의 방을 구도에 **새 방으로 세웁니다.** 소품·묶음도 함께 들어오고, 세운 방이 활성 방이 됩니다.
 *
 * id 는 전부 새로 답니다 — 같은 방을 두 번 세우면(복도 둘) id 가 겹쳐 한쪽을 지울 때 둘 다 사라집니다.
 * 자리는 기본이 원점인데, 이미 방이 있으면 **그 방들 오른쪽**에 나란히 세웁니다(겹쳐 세우면 안이 안 보입니다).
 */
export function applyRoomPresetIn(state: CompositionState, preset: RoomPreset): CompositionState {
  const rooms = state.rooms || [];
  const right = rooms.reduce(
    (edge, room) => Math.max(edge, room.position.x + room.width / 2),
    Number.NEGATIVE_INFINITY,
  );
  const position = rooms.length
    ? { x: right + preset.room.width / 2 + 1, y: 0, z: 0 }
    : { x: 0, y: 0, z: 0 };
  const room = normalizeCompositionRoom(
    { ...preset.room, id: compositionRoomId(), position },
    rooms.length,
  );
  /*
    묶음 id 도 새로 답니다. 소품이 가리키는 id 를 «옛 id → 새 id» 표로 갈아 끼우고, 묶음이 다시 가리키는
    바깥 묶음도 같은 표로 옮깁니다 — 한쪽만 옮기면 이름도 색도 없는 «유령 묶음» 이 생깁니다.
  */
  const groupMap = new Map(preset.groups.map((group) => [group.id, uid()]));
  const groups = preset.groups.map((group) => ({
    ...group,
    id: groupMap.get(group.id) as string,
    groupId: group.groupId ? groupMap.get(group.groupId) : undefined,
  }));
  const objects = preset.objects.map((object) => ({
    ...object,
    id: uid(),
    // 꺼낸 소품은 **새 방의** 배경 소품입니다. 옛 방 id 를 그대로 두면 없는 방을 가리킵니다.
    roomId: room.id,
    // 붙여 둔 면도 새 방 기준으로 옮깁니다.
    mount: object.mount ? { ...object.mount, roomId: room.id } : undefined,
    groupId: object.groupId ? groupMap.get(object.groupId) : undefined,
    position: {
      x: object.position.x + position.x,
      y: object.position.y + position.y,
      z: object.position.z + position.z,
    },
    /*
      인물 관절에 붙여 두었던 소품은 **떼고** 들어옵니다. 붙은 상대(그 컷의 인물)가 여기엔 없어서, 그대로 두면
      없는 관절을 따라가며 화면에서 사라집니다.
    */
    attach: undefined,
  }));
  return {
    ...state,
    rooms: [...rooms, room],
    activeRoomId: room.id,
    objects: [...(state.objects || []), ...objects],
    objectGroups: [...(state.objectGroups || []), ...groups],
    // 방을 세웠으면 배경은 켜져 있어야 합니다 — 꺼져 있으면 여섯 면을 걸어도 아무것도 안 보입니다.
    backgroundOn: true,
  };
}
