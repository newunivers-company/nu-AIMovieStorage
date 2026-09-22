import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  activeRoomOf,
  backgroundOnOf,
  roomAutoGrowOf,
  roomDimsOf,
  roomFitExtentOf,
  roomFitRequiredDims,
  roomRatioFromFaces,
  roomScaleIn,
  setRoomDimsIn,
  type UpdateComposition,
} from "@/lib/compositionEdit";
import {
  applyFaceSetSizeIn,
  type PlannerBackground,
} from "@/components/composition/planner/usePlannerMedia";
import { measureAspect } from "@/lib/imageSize";
import { COMPOSITION_CUBE_FACES, type CompositionState } from "@/lib/composition";
import type { FaceSet } from "@/lib/faceSets";

/**
 * **방이 스스로 따르는 규칙 세 가지** — 자동 넓히기 · 세트 크기 한 번 맞추기 · 여섯 면 비율.
 *
 * 2026-09-18 에 `CompositionPlanner.tsx` 에서 떼어 냈습니다. 셋 다 «사람이 한 편집» 이
 * 아니라 «규칙» 이라 되돌리기에는 안 쌓고(`setState` 로 받는 것은 `replace`), 셋 다
 * 되돌이표(무한 루프)를 안 도는 근거를 각자 주석에 달고 있습니다 — 흩어 두면 한쪽을
 * 고칠 때 그 근거를 못 보고 조건을 지웁니다.
 */
export function usePlannerRoomRules({
  open,
  state,
  setState,
  characterHeights,
  faceSets,
  backgroundFaceImages,
}: {
  open: boolean;
  state: CompositionState;
  /** 되돌리기에 안 쌓는 갱신. */
  setState: UpdateComposition;
  /** 인물마다의 키(cm 아닌 m 비율 계산용). 방을 얼마나 넓혀야 하는지의 근거입니다. */
  characterHeights: Record<string, number>;
  faceSets: FaceSet<PlannerBackground>[];
  backgroundFaceImages: Record<string, string>;
}) {
  /*
    ── 방이 인물·소품보다 작을 때 ────────────────────────────────────────
    바닥면은 인물이 선 범위보다 작아지지 않고, 인물을 뒤로 물리면 함께 늘어납니다.
    바닥 격자가 곧 방의 밑면이므로(`floorSizeOf`),
    놓인 것들을 담을 만큼 방을 넓히면 격자도 함께 늘어납니다.

    창이 닫혀 있으면 아무것도 안 합니다 — `CompositionPlanner` 는 컷 카드마다 **항상
    마운트**되므로(`open` 은 Dialog 에만 넘어갑니다), 안 보면 작업실 목록을 그리는 순간
    컷 수만큼 돌아 「방을 넓혔습니다」 토스트가 컷 수만큼 뜹니다.

    되돌리기 스택에는 안 쌓습니다(`setStateRaw`). 이것은 «사람이 한 편집» 이 아니라
    «규칙» 이라, Ctrl+Z 로 작은 방을 되살려도 다음 프레임에 곧바로 다시 넓어집니다.

    무한 루프가 안 도는 까닭: `roomFitRequiredSize` 가 방 한계(400m)로 잘라 주므로 넓힌
    뒤에는 «필요한 크기 ≤ 지금 크기» 가 되어 다시 돌아도 아무 일도 하지 않습니다.
  */
  /** 마지막으로 알린 방 크기(m, 0.5m 단위). 드래그 한 번의 토스트 수백 개를 막습니다. */
  const roomGrowToldRef = useRef(0);
  useEffect(() => {
    /*
      기본은 **고정**입니다. 방 크기가 곧 배경 그림의 크기라, 넓히면 벽도
      같이 커져 인물이 상대적으로 작아집니다 — 실측으로 뽑은 배경에서는 그게 축척이 틀어지는
      것입니다. 문을 열고 들어오는 장면처럼 인물이 방 밖에 서는 구도를 위해서도 고정이
      맞습니다. 넓히기는 환경 탭에서 따로 켭니다.
    */
    if (!open || !backgroundOnOf(state) || !roomAutoGrowOf(state)) return;
    const extent = roomFitExtentOf(state, characterHeights);
    const want = roomFitRequiredDims(extent);
    const now = roomDimsOf(state);
    /*
      비율은 여섯 면 그림이 정하므로(`roomRatioFromFaces`), 한 변만 늘리면 벽 그림이
      늘어납니다. 세 변 중 가장 모자란 쪽의 배수로 **통째로** 키웁니다.
    */
    const factor = Math.max(
      want.width / now.width,
      want.depth / now.depth,
      want.height / now.height,
    );
    if (factor <= 1.01) return;
    const needed = now.width * factor;
    setState((current) => roomScaleIn(current, factor));
    /*
      알림은 «넓힌 값» 이 아니라 «넓혔다는 사실» 로 묶습니다. 방 크기는 연속 슬라이더라
      한 번 끌면 상태가 수백 번 바뀌고, 그대로 두면 토스트가 그만큼 쌓여 화면을 덮습니다.
      같은 id 로 부르면 갱신될 뿐 쌓이지 않고, 0.5m 단위로 반올림해 값이 실제로 달라졌을
      때만 부릅니다. 조사(«이/가»)를 안 붙이는 까닭 — 이름이 소품·GLB 라 「탁자이」 가 됩니다.
    */
    const told = Math.round(needed * 2) / 2;
    if (told === roomGrowToldRef.current) return;
    roomGrowToldRef.current = told;
    toast.info(
      `${extent.label ?? "인물"} 때문에 방을 ${needed.toFixed(1)}m 로 넓혔습니다.`,
      {
        id: "room-auto-grow",
      },
    );
  }, [open, state, characterHeights]);

  /** 지금 있는 세트 목록의 열쇠 — 아래 «세트 크기를 방에» 효과가 «목록이 바뀔 때만» 도는 근거입니다. */
  const faceSetListKey = faceSets.map((set) => set.id).join("|");

  /*
    ── 옛 «6면 세트 자동 걸기» 는 걷었습니다 ──────────────────────────────
    구도잡기를 열기만 해도 알림이 계속 떴습니다.

    예전에는 창을 열 때 «여섯 면이 비어 있으면 프로젝트에서 가장 최근 세트» 를 걸었습니다. 방이 늘 한 칸 서 있던 시절에는
    그것이 편의였지만, 이제 **새 컷에는 방이 없습니다.** 방이 없으면 면도 늘 비어 있으니 열 때마다 규칙이 발동했고,
    걸 방이 없어 아무 일도 안 일어난 채 알림만 떴습니다.

    게다가 지금 흐름에서는 방마다 «이 방의 이미지 만들기» 로 만든 장소가 그 방에 걸립니다(아래 효과). 어느 방에 어느 세트가
    걸릴지는 **사람이 정한 짝**이라, 아무 세트나 가장 최근 것으로 끼워 넣으면 오히려 틀립니다. 손으로 고르는 길은 환경 탭의
    «6면 세트» 목록에 그대로 있습니다.
  */

  /*
    ── 이미 걸려 있는 세트의 크기를 방에 한 번 ──────────────────────────────
    50m 짜리로 프롬프트를 뽑아 놓고 방은 2.8m 에 머무는 일이 있었습니다. 크기는 세트를 **걸 때** 방에 들어가서, 크기를
    알기 전에 이미 걸려 있던 세트(손으로 자른 세트, 크기 읽기를 붙이기 전)는 방이 옛 크기에 머뭅니다. 지금 안쪽 여섯 면이 세트
    하나 통째이고 그 세트에 크기가 있는데 방에 벽 비(`faceRatio`)가 없으면 한 번 맞춥니다. 맞춘 뒤에는 벽 비가 생겨 다시 돌지
    않으므로, 사람이 층고를 손으로 바꿔도 되돌리지 않습니다.
  */
  const activeFaceKey = COMPOSITION_CUBE_FACES.map((face) => activeRoomOf(state).faces[face] || "").join("|");
  useEffect(() => {
    if (!open) return;
    const room = activeRoomOf(state);
    if (room.faceRatio) return;
    // 호리존에는 세트를 걸지 않습니다. 면 id 가 어쩌다 남아 있어도(옛 저장본) 그 세트 크기로 스튜디오를
    // 줄이면 안 됩니다 — 아래 «비율» 효과와 같은 가드입니다.
    if (room.horizon) return;
    const now = COMPOSITION_CUBE_FACES.map((face) => room.faces[face] || "");
    if (now.some((id) => !id)) return;
    const set = faceSets.find(
      (item) =>
        item.complete &&
        !/외벽$/.test(item.prefix) &&
        COMPOSITION_CUBE_FACES.every((face, index) => (item.faces[face]?.image.id ?? "") === now[index]),
    );
    if (!set || !COMPOSITION_CUBE_FACES.some((face) => set.faces[face]?.image.faceSetSize)) return;
    setState((current) => applyFaceSetSizeIn(current, set, "inner"));
    // 세트 목록·걸린 면·창 열림이 바뀔 때만. 상태 객체는 매번 새 참조입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faceSetListKey, activeFaceKey, faceSets]);

  /*
    ── 방의 비율은 여섯 면 그림이 정합니다 ────────────────────────────────
    직육면체의 비율은 사람이 적는 것이 아니라 **여섯 면 그림에서 자동으로** 나옵니다.

    정면 그림의 가로세로비가 곧 W/H, 옆면 그림의 비가 곧 D/H 입니다(`roomRatioFromFaces`).
    절대 크기는 그림에 없으므로 **높이만 사람이 정하고** 가로·깊이가 따라옵니다.
    그림을 읽어야 비율을 알 수 있어 비동기입니다 — 면이 바뀔 때만 한 번 잽니다.
  */
  useEffect(() => {
    if (!open || !backgroundOnOf(state)) return;
    // 파노라마 돔 방은 가로·깊이가 돔 지름입니다 — 면 그림 비율로 고치면 돔이 줄어듭니다(`setRoomPanoramaIn`).
    if (activeRoomOf(state).panorama) return;
    // 호리존은 면 그림이 없어 비율을 잴 것이 없습니다 — 치수는 사람이 적은 그대로 둡니다.
    if (activeRoomOf(state).horizon) return;
    let cancelled = false;
    const faces = backgroundFaceImages;
    void Promise.all([
      measureAspect(faces.front),
      measureAspect(faces.back),
      measureAspect(faces.left),
      measureAspect(faces.right),
    ]).then(([front, back, left, right]) => {
      if (cancelled) return;
      const ratio = roomRatioFromFaces({
        front: front ?? undefined,
        back: back ?? undefined,
        left: left ?? undefined,
        right: right ?? undefined,
      });
      setState((current) => {
        const room = activeRoomOf(current);
        const dims = roomDimsOf(current);
        // 카드 치수가 적힌 세트는 그 벽 비로(`CompositionRoom.faceRatio`). 그림 비율은 생성기가 칸마다 조금씩 틀립니다.
        if (room.faceRatio) {
          const width = dims.height * room.faceRatio.width;
          const depth = dims.height * room.faceRatio.depth;
          if (Math.abs(width - dims.width) < 0.01 && Math.abs(depth - dims.depth) < 0.01) return current;
          return setRoomDimsIn(current, { width, depth });
        }
        if (!ratio) return current;
        /*
          옆면 아래를 버리는 방(실외 세트)은 벽에 붙는 부분이 그림의 (1 − crop) 높이뿐이라, 벽의 가로세로비는 그림의
          비를 그만큼 나눈 값입니다. 안 나누면 50 m 정사각 세트가 26.6 m 폭으로 줄어듭니다.
        */
        const keep = 1 - (room.sideCropBottom ?? 0);
        const width = (dims.height * ratio.width) / keep;
        const depth = (dims.height * ratio.depth) / keep;
        // 이미 맞으면 그대로 — 같은 값을 다시 넣으면 이펙트가 되돌이표가 됩니다.
        if (
          Math.abs(width - dims.width) < 0.01 &&
          Math.abs(depth - dims.depth) < 0.01
        )
          return current;
        return setRoomDimsIn(current, { width, depth });
      });
    });
    return () => {
      cancelled = true;
    };
    // 면이 바뀔 때와 층고가 바뀔 때만. 면 목록은 문자열 키로 봅니다(객체는 매번 새 참조).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    state.backgroundOn,
    roomDimsOf(state).height,
    activeRoomOf(state).sideCropBottom,
    activeRoomOf(state).panorama,
    activeRoomOf(state).horizon?.color,
    JSON.stringify(activeRoomOf(state).faceRatio ?? null),
    JSON.stringify(backgroundFaceImages),
  ]);
}
