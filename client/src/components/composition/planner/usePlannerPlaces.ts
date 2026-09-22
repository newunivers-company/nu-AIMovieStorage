import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  activeRoomOf,
  setObjectImageIn,
  setRoomBackgroundIn,
  wallDistanceOf,
  type UpdateComposition,
} from "@/lib/compositionEdit";
import { placeFromRoom } from "@/lib/placeFromRoom";
import { DOME_CHIP_ID } from "@/lib/blueprint";
import {
  COMPOSITION_CUBE_FACES,
  isPanoramaAspect,
  type CompositionState,
} from "@/lib/composition";
import type { Background } from "@/lib/projectTypes";
import type { PlannerMedia } from "@/components/composition/planner/usePlannerMedia";

/**
 * **방과 벽에 걸 «장소 카드»** — 만들기와, 그림이 들어오면 자동으로 거는 일.
 *
 * `CompositionPlanner.tsx` 에서 떼어 냈습니다. 만드는 곳과 거는 곳이 창 본문의 위아래로
 * 130줄쯤 떨어져 있어서, 그림을 등록했는데 안 걸리는 일을 볼 때 두 곳을 오가며 읽어야
 * 했습니다. 실은 **한 흐름**입니다 —
 * 카드를 만든다 → 그 카드에서 그림을 뽑는다 → 폴더 읽기가 들여온다 → 여기서 건다.
 */
export function usePlannerPlaces({
  open,
  state,
  setState,
  backgrounds,
  sceneTitle,
  onCreatePlace,
  media,
}: {
  open: boolean;
  state: CompositionState;
  setState: UpdateComposition;
  backgrounds: Background[];
  sceneTitle?: string;
  /** 장소 카드를 프로젝트에 새로 답니다. 안 주면 «만들기» 가 아무 일도 안 합니다. */
  onCreatePlace?: (background: Background) => void;
  media: PlannerMedia;
}) {
  /*
    ── 방에 이어 둔 장소 카드 ────────────────────────────────────────────
    방을 세운 자리에서 전개도까지 이어지게 하려고 둡니다 — 방 추가 → 전개도 만들기 → 고르면 바로 6면.
    카드는 프로젝트가 들고 있고(씬 탭의 장소 목록과 **같은 카드**), 방은 그 id 만 가리킵니다.
  */
  const [placeOpen, setPlaceOpen] = useState(false);
  /**
   * 장소 카드를 «**이 벽에 붙일 그림**» 때문에 열었는가. 그 카드에 그림이 들어오면 그 벽에 바로 붙입니다.
   * 방에 걸 때(6면·돔)와 길이 달라 따로 기억합니다.
   */
  const [wallImageFor, setWallImageFor] = useState<string | null>(null);
  /** 벽 때문에 연 장소 카드의 id. 방에 이어 둔 장소와 달라서 따로 둡니다(벽은 방에 걸지 않습니다). */
  const [wallPlaceId, setWallPlaceId] = useState<string | null>(null);
  const activePlace =
    backgrounds.find((item) => item.id === activeRoomOf(state).backgroundId) ?? null;
  /** 지금 창에 띄울 카드 — 벽 때문에 열었으면 그 카드, 아니면 방에 이어 둔 장소. */
  const openPlace =
    (wallPlaceId ? backgrounds.find((item) => item.id === wallPlaceId) : null) ?? activePlace;
  const createPlaceForRoom = (spec: {
    kind: "outdoor" | "dome" | "roomInner" | "roomOuter";
    name: string;
    width: number;
    depth: number;
    height: number;
  }) => {
    if (!onCreatePlace) return;
    const background = placeFromRoom({ ...spec, sceneTitle });
    onCreatePlace(background);
    setState((current) => setRoomBackgroundIn(current, background.id));
    setPlaceOpen(true);
  };

  /*
    ── 벽에 붙일 **배경 그림 만들기** ────────────────────────────────────
    벽을 세운 자리에서 그 벽에 붙일 그림까지 한 번에 갑니다 — 만들고 바로 적용됩니다.

    장소 카드를 그대로 씁니다(씬 탭에서 쓰던 그 카드) — 프롬프트·그림 등록·폴더 저장이 이미 거기 다 있습니다(공통 규칙 1).
    카드에는 **벽의 실제 크기와 인물까지의 거리**를 적어 둡니다. 생성기는 미터를 지키지 않지만 «4 m 벽을 3 m 뒤에서 본 그림» 은
    화각과 원근을 정하는 말이라, 이 두 숫자가 그림의 크기감을 좌우합니다.
  */
  const createWallImage = (objectId: string) => {
    if (!onCreatePlace) return;
    const wall = state.objects.find((item) => item.id === objectId);
    if (!wall) return;
    const gap = wallDistanceOf(state, objectId);
    const width = Math.max(0.1, wall.scale.x);
    const height = Math.max(0.1, wall.scale.y);
    const background = placeFromRoom({
      kind: "roomInner",
      name: `${wall.label?.trim() || "벽"} 그림`,
      width,
      // 벽 한 장이라 «깊이» 는 뜻이 없습니다 — 인물이 선 거리를 넣어 두면 원근이 맞습니다.
      depth: gap ? Math.max(0.5, gap.near) : Math.max(1, width / 2),
      height,
      sceneTitle,
    });
    onCreatePlace({
      ...background,
      // 벽 그림 카드는 **방의 장소 목록에 안 뜹니다** — 방에 거는 장소가 아니라 판 한 장에 붙일 그림입니다.
      usage: "wall",
      description: [
        `벽 한 장에 붙일 배경입니다. 실제 크기 ${width.toFixed(1)} m × ${height.toFixed(1)} m (가로 × 높이), 그림 비율 ${(width / height).toFixed(2)}:1.`,
        gap
          ? `인물은 이 벽에서 ${gap.near.toFixed(1)} m 앞에 서 있습니다(${gap.count}명, 가장 먼 사람 ${gap.far.toFixed(1)} m). 그 거리에서 보이는 만큼의 넓이·원근으로 그리세요.`
          : "인물은 아직 놓지 않았습니다.",
        "이 그림은 벽 한 장에 그대로 붙습니다 — 가장자리가 잘리지 않게 여백 없이 꽉 채우고, 바닥선이 벽 아래에 닿게 그리세요.",
      ].join(" "),
    });
    // 만든 카드를 바로 열어 프롬프트를 뽑습니다. 그림을 등록하면 아래 효과가 이 벽에 붙입니다.
    setWallImageFor(objectId);
    setWallPlaceId(background.id);
    setPlaceOpen(true);
  };
  /*
    ── 뽑아 온 6면을 **그 방에** 자동으로 겁니다 ──────────────────────────
    뽑은 전개도를 사람이 다시 찾아 거는 걸음을 없앱니다.

    장소 카드에 전개도를 등록하면 자동 커팅(`useAutoUnfold`)이 «<장소>_NNN» 세트를 만들고, 폴더 읽기가 그것을 `media.faceSets`
    로 들여옵니다. 그때 **면이 아직 비어 있는 방**이면 손을 안 대고 겁니다 — 사람이 이미 다른 세트를 걸어 둔 방은 건드리지
    않습니다(덮어쓰면 방금 고른 것이 사라집니다). 한 세트를 한 번만 걸도록 기억해 둡니다.
  */
  /*
    ── 벽에 붙일 그림이 들어오면 **그 벽에** ────────────────────────────
    «이 크기로 배경 그림 만들기» 로 연 카드에 그림이 등록되면
    (폴더 읽기가 그 그림을 들여옵니다) 그 벽에 곧바로 붙입니다. 사람이 목록에서 다시 찾아 고를 까닭이 없습니다.
  */
  const wallHungRef = useRef<string>("");
  useEffect(() => {
    if (!open || !wallImageFor || !openPlace) return;
    const name = openPlace.name?.trim();
    if (!name) return;
    // 그 장소에서 온 그림 중 **가장 나중 것**. 6면 세트 낱장은 빼고 봅니다(벽에는 한 장을 붙입니다).
    const picture = media.listedBackgrounds
      .filter((item) => item.name.startsWith(name))
      .slice(-1)[0];
    const path = picture?.filePath;
    if (!path) return;
    const key = `${wallImageFor}:${path}`;
    if (wallHungRef.current === key) return;
    wallHungRef.current = key;
    setState((current) => setObjectImageIn(current, wallImageFor, path));
    const wall = state.objects.find((item) => item.id === wallImageFor);
    toast.success(`«${picture.name}» 을 ${wall?.label || "벽"} 에 붙였습니다.`, {
      description: "벽 크기에 맞춰 늘어납니다 — 크기를 바꾸면 그림도 함께 따라갑니다",
    });
  }, [open, wallImageFor, openPlace, media.listedBackgrounds]);

  const hungSetsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open || !activePlace || wallImageFor) return;
    const room = activeRoomOf(state);
    // 호리존은 그림을 안 붙이는 방입니다 — 세트든 파노라마든 걸 자리가 없습니다.
    if (room.horizon) return;
    const name = activePlace.name?.trim();
    if (!name) return;
    const mine = media.faceSets
      .filter((set) => set.complete && set.prefix.startsWith(name))
      .sort((a, b) => a.number.localeCompare(b.number));
    /*
      **안쪽·바깥은 따로** 겁니다 — 한 방이 안팎 두 벌의 껍질을 가질 수 있어, 한쪽에 건다고 다른 쪽이 정해지지 않습니다.
      세트 이름이 «…외벽» 이면 바깥 껍질입니다(`usePlannerMedia.shellOfSet` 과 같은 규칙). 각각 그 껍질이 비어 있을 때만
      손대고, 사람이 이미 걸어 둔 것은 덮지 않습니다.
    */
    const innerEmpty = COMPOSITION_CUBE_FACES.every((face) => !room.faces[face]);
    const outerEmpty = COMPOSITION_CUBE_FACES.every((face) => !room.outerFaces?.[face]);
    const last = (outer: boolean) =>
      mine.filter((set) => /외벽$/.test(set.prefix) === outer).slice(-1)[0];
    for (const [outer, empty] of [
      [false, innerEmpty],
      [true, outerEmpty],
    ] as const) {
      const set = last(outer);
      if (!set || !empty) continue;
      const key = `${room.id}:${set.id}`;
      if (hungSetsRef.current.has(key)) continue;
      hungSetsRef.current.add(key);
      media.assignFaceSet(set);
      toast.success(
        `«${set.label}» 을 ${room.name || "방"} 의 ${outer ? "바깥면" : "안쪽면"} 에 걸었습니다.`,
        { description: "뽑아 온 전개도가 여섯 면으로 잘려 그대로 들어갔습니다" },
      );
      return;
    }
    /*
      실외 방은 잘릴 것이 없습니다 — 돔이라 등장방형 한 장이 그대로 둘러집니다.
    */
    if (!room.outdoor && !activePlace.blueprint?.includes(DOME_CHIP_ID)) return;
    if (room.panorama) return;
    const panorama = media.listedBackgrounds
      .filter((item) => item.name.startsWith(name) && isPanoramaAspect(item.aspect))
      .slice(-1)[0];
    if (!panorama || hungSetsRef.current.has(`${room.id}:${panorama.id}`)) return;
    hungSetsRef.current.add(`${room.id}:${panorama.id}`);
    media.assignPanorama(panorama);
    toast.success(`«${panorama.name}» 을 ${room.name || "실외"} 의 돔으로 걸었습니다.`, {
      description: "제자리 컷용입니다 — 카메라 무빙이 있으면 6면 전개도가 맞습니다",
    });
  }, [open, activePlace, media.faceSets, media.listedBackgrounds]);

  return {
    placeOpen,
    setPlaceOpen,
    wallImageFor,
    setWallImageFor,
    wallPlaceId,
    setWallPlaceId,
    /** 방에 이어 둔 장소. */
    activePlace,
    /** 지금 창에 띄울 카드 — 벽 때문에 열었으면 그 카드. */
    openPlace,
    createPlaceForRoom,
    createWallImage,
  };
}
