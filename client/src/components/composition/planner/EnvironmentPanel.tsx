import { HOLDS_ENTITY_CARD } from "@/lib/useTutorialPanel";
import { useState, type DragEvent } from "react";
import PlannerRange from "@/components/composition/planner/PlannerRange";
import { Grid3X3, X } from "lucide-react";
import { NumberInput, PanelSection } from "@/components/composition/fields";
import {
  COMPOSITION_CUBE_FACES,
  CUBE_FACE_LABELS,
  HORIZON_COLOR_PRESETS,
  ROOM_SIZE_MIN,
  isHorizonRoom,
  isPanoramaAspect,
  type CompositionCubeFace,
  type CompositionRoom,
  type CompositionState,
} from "@/lib/composition";
import {
  addObjectInRoom,
  mountObjectToFaceIn,
  objectGroupOf,
  objectsInRoom,
  roomsOf,
  setObjectSwapIn,
  setRoomDimsIn,
  setRoomHorizonColorIn,
  setRoomPanoramaIn,
  setOutdoorShapeIn,
  setFaceOccludesIn,
  updateObjectIn,
  type UpdateComposition,
} from "@/lib/compositionEdit";
import { OBJECT_KINDS, SWAPPABLE_KINDS } from "./objectKinds";
import { ObjectList } from "./ObjectList";
import { ObjectFields } from "./ObjectFields";
import { GroupCards } from "./ObjectGroupPanel";
import FaceSetCard from "@/components/FaceSetCard";
import RoomList from "./RoomList";
import type { FaceSet } from "@/lib/faceSets";
import type { RoomPreset } from "@/lib/roomPreset";
import type { PlannerBackground } from "./usePlannerMedia";
import type { SectionToggles } from "./PlannerChrome";

/**
 * 환경 탭 — **방을 세우고, 방마다 그 속성**.
 *
 * # 속성을 방 아래로 모은 까닭
 *
 * 6면 세트·파노라마 목록·배경 이미지 목록이 방과 따로 떨어져 있으면 어느 방에 무엇이 붙었는지
 * 화면에서 읽히지 않고, 방이 여럿일 때 엉뚱한 방에 세트를 겁니다. 게다가 실내와 실외는 필요한
 * 속성이 서로 다른데, 한 목록으로는 그 차이가 드러나지 않습니다.
 *
 * 그래서 이 탭에는 **목록 하나**만 있습니다 — 방 목록. 방을 누르면 그 아래가 펴지고, 그 방의 것만 나옵니다.
 *
 * 실내 방 : 치수 · 뒤를 가릴 면 · 외벽 투시 · 장소(전개도 만들기) · 6면 세트
 * 실외 방 : 치수 · 장소(파노라마 만들기) · 파노라마 그림 목록
 * 호리존 : 치수 · 호리존 색 (그림 없이 여섯 면이 한 가지 색인 제품 컷 스튜디오)
 *
 * 세 갈래 모두 그 아래에 «이 방의 소품» 이 옵니다 — 호리존의 제품도 소품입니다.
 *
 * 걷어낸 것: 면 하나하나 고르기(«여섯 면»), 안쪽/바깥쪽 토글(세트 이름이 정합니다), 배경 이미지 목록.
 * 한 컷에 필요한 배경은 대개 «정면 한 장» 이라 **배치 탭의 «벽»** 이 그 자리를 대신합니다.
 */
/** 이 창을 열면 생기는 자리들 — 장소 카드 몸통과 그 안의 가위(전개도·파노라마) 전부. */
const PLACE_LIBRARY_OPENS = HOLDS_ENTITY_CARD;

export interface EnvironmentPanelProps extends SectionToggles {
  state: CompositionState;
  setState: UpdateComposition;
  /** 6면 세트의 낱장을 뺀 목록 — 실외 방의 «파노라마 그림» 도 여기서 고릅니다. */
  listedBackgrounds: PlannerBackground[];
  faceSets: FaceSet<PlannerBackground>[];
  /** 세트 하나를 여섯 면에 한 번에. 빠진 면은 비웁니다. */
  assignFaceSet: (set: FaceSet<PlannerBackground>) => void;
  /** 그림 한 장을 활성 방의 파노라마 돔으로(크기는 그 카드의 프롬프트에서). */
  assignPanorama: (background: PlannerBackground) => void;
  /**
   * 파노라마 파일을 **바깥에서 바로** 들여옵니다(고르기 또는 끌어다 놓기).
   *
   * 여태는 앱에서 뽑은 것만 목록에 올랐습니다 — 밖에서 만든 360° 사진(블록케이드 스카이박스·실촬 360)을
   * 쓸 길이 없었습니다. 끌어다 놓기도 같이 받습니다.
   */
  onImportPanorama?: (file: File) => void | Promise<void>;
  /**
   * 목록에서 파노라마 한 장을 **지웁니다** — 들여오기가 생겼으니 잘못 들여온 것을 뺄 길도 있어야 합니다.
   * 폴더의 원본 파일도 함께 지웁니다 — 이 앱의 규칙이고, 안 지우면 폴더를 다시 읽을 때 되살아납니다.
   */
  onDeletePanorama?: (background: PlannerBackground) => void | Promise<void>;
  isFaceSetAssigned: (set: FaceSet<PlannerBackground>) => boolean;
  /**
   * 이 방의 크기로 **장소 카드**를 만들고 그 카드를 바로 엽니다.
   * 안 주면 칸이 안 보입니다(구도잡기를 프로젝트 밖에서 열었을 때).
   */
  onCreatePlace?: (spec: {
    kind: "outdoor" | "dome" | "roomInner" | "roomOuter";
    name: string;
    width: number;
    depth: number;
    height: number;
  }) => void;
  /** 이 방에 이어 둔 장소 카드를 창으로 엽니다. */
  onOpenPlace?: () => void;
  /** 이어 둔 장소 카드의 이름. */
  placeName?: string | null;
  /**
   * 프로젝트에 이미 있는 **장소 카드 목록**과 그중 하나를 이 방에 잇는 길.
   *
   * 한 번 고르면 잠기던 것을 풀었습니다 — 고른 뒤에도 목록은 그대로 있고, 빈 칸을 고르면 이음을 끊습니다.
   */
  places?: { id: string; name: string }[];
  onPickPlace?: (backgroundId: string) => void;
  /** 저장해 둔 방 라이브러리. 안 주면 칸이 안 보입니다. */
  roomLibrary?: {
    presets: RoomPreset[];
    save: () => void;
    apply: (preset: RoomPreset) => void;
    remove: (id: string) => void;
    /**
     * **다른 작품에서 방 끌어오기** 를 여는 자리. 안 주면 단추가 안 보입니다.
     *
     * 끌어올 때 그 방에 **적용된** 6면 이미지·파노라마도 같이 따라옵니다(그 작품의 그림 전부가 아니라
     * 적용된 것만) — 치수만 와서는 빈 상자라 다시 붙이는 일이 그대로 남습니다.
     */
    borrow?: () => void;
  };
  /** 그림을 큰 화면으로 훑어보는 창(면에 직접 붙이고 싶을 때). */
  onOpenGallery: () => void;
  /**
   * **장소 라이브러리**(옛 배경 단계) 열기 — 계보(관계도)·보유 에셋을 봅니다.
   * 배경 단계를 걷으면서 이 자리가 그 몫을 그대로 이어받습니다 — 에셋 관계도도, 방(배경) 관계도도
   * 볼 곳이 없어지면 안 됩니다.
   */
  onOpenLibrary?: () => void;
  /**
   * **배경 소품**에 이어 붙일 시트들(에셋만) — 소품을 «무엇으로 바꿔 그릴까» 에 씁니다.
   *
   * 배치 탭은 캐릭터와 캐릭터 소품, 환경 탭은 배경과 배경 소품으로 갈라 둡니다 — 그래야 배치한 소품과
   * 소품 에셋이 짝을 이루고, 프롬프트에서 @ 로 거는 이름도 한쪽에서만 나옵니다.
   */
  assetOptions?: { kind: "character" | "asset" | "background"; id: string; name: string; group: string }[];
  /** 고른 소품의 에셋 카드를 만들어 바로 잇거나, 이미 이어 둔 카드를 엽니다. */
  onCreateAsset?: (objectId: string, label: string) => void;
  /** 묶음(덩어리) 쪽 에셋 — 낱개가 아니라 묶음으로 만들었다는 것이 표시에도 그대로 남습니다. */
  onCreateGroupAsset?: (groupId: string, label: string) => void;
  /** 3D 화면에서 그 소품을 고릅니다(«object:<id>»). */
  selected?: string;
  setSelected?: (value: string) => void;
  /** 되돌리기에 **안 쌓는** 갱신 — 손잡이를 끄는 동안 씁니다. 까닭은 `PlannerRange`. */
  setStateRaw: UpdateComposition;
  mark: () => void;
}

export function EnvironmentPanel({
  state,
  setState,
  listedBackgrounds,
  faceSets,
  assignFaceSet,
  assignPanorama,
  onImportPanorama,
  onDeletePanorama,
  isFaceSetAssigned,
  onCreatePlace,
  onOpenPlace,
  placeName,
  places,
  onPickPlace,
  roomLibrary,
  onOpenGallery,
  onOpenLibrary,
  assetOptions,
  onCreateAsset,
  onCreateGroupAsset,
  selected,
  setSelected,
  openSections,
  toggleSection,
  setStateRaw,
  mark,
}: EnvironmentPanelProps) {
  const rooms = roomsOf(state);

  return (
    <div className="space-y-3">
      {/*
        앵커는 PanelSection 의 `tour` 로 넘깁니다 — 뿌리 <section> 에 달려야 방이 하나도 없을 때도
        머리줄을 잡을 수 있습니다. 여기 open 은 늘 참이라 접혀서 앵커가 사라질 일은 없습니다.
      */}
      <PanelSection title="방" tour="env-room-section" open onToggle={() => undefined}>
        {/*
          방은 **처음에 없습니다** — 기본 방을 하나 깔아 두면 쓰지도 않는 상자가 늘 화면에 서 있습니다.
          «방 추가» 로 필요한 것만 세웁니다.
          목록에서 방을 누르면 그 아래가 펴지고, 거기부터가 그 방의 속성입니다.
        */}
        <RoomList
          state={state}
          setState={setState}
          renderProperties={(room) => (
            <RoomProperties
              room={room}
              state={state}
              setState={setState}
              listedBackgrounds={listedBackgrounds}
              faceSets={faceSets}
              assignFaceSet={assignFaceSet}
              assignPanorama={assignPanorama}
              onImportPanorama={onImportPanorama}
              onDeletePanorama={onDeletePanorama}
              isFaceSetAssigned={isFaceSetAssigned}
              onCreatePlace={onCreatePlace}
              onOpenPlace={onOpenPlace}
              placeName={placeName}
              places={places}
              onPickPlace={onPickPlace}
              onOpenGallery={onOpenGallery}
              assetOptions={assetOptions}
              onCreateAsset={onCreateAsset}
              onCreateGroupAsset={onCreateGroupAsset}
              selected={selected}
              setSelected={setSelected}
              setStateRaw={setStateRaw}
              mark={mark}
            />
          )}
        />

        {rooms.length === 0 && (
          <p className="mt-2 text-[9px] leading-relaxed" style={{ color: "oklch(0.48 0.01 265)" }}>
            아직 방이 없습니다 — <b>구도만 잡는 컷</b>입니다. 위의 «실내»·«실외» 로 방을 세우면 여섯 면이 아직 없는 빈 방이
            생기고, 인물을 놓아 크기를 견주며 치수를 정한 뒤 그 치수로 이미지를 뽑습니다. «호리존» 은 그림 없이 색 하나로
            잇는 제품 컷 스튜디오입니다. 배경이 한쪽만 필요하면 방 대신 <b>배치 탭의 «벽»</b> 이 더 빠릅니다.
          </p>
        )}
      </PanelSection>

      {/*
        ── 장소 라이브러리 ───────────────────────────────────────────────
        배경 탭을 걷어내도 계보를 다루던 자리는 남아야 합니다 — 에셋 관계도도, 방(배경) 관계도도
        여기서 그대로 설정합니다. 장소를 **만드는** 일은 방 속성에서 하고, 목록 전체를 봐야 하는 일
        (계보·다른 원본·보유 에셋)은 여기서 창으로 엽니다 — 씬 탭에 있던 그 화면 그대로입니다.
      */}
      {onOpenLibrary && (
        <button
          type="button"
          onClick={onOpenLibrary}
          /*
            **장소 카드는 이 창 안에 있습니다.** 전개도 여섯 면·파노라마·앵커 찍기·표시하기는 장소
            그림에서 하는 일인데, 그 카드로 가는 길이 여기 하나뿐입니다. 안내가 이 문을 먼저 열어 주지
            않으면 안쪽 앵커가 아직 없어서 안내 풍선이 붙을 자리를 못 찾습니다.
          */
          data-tour-open={PLACE_LIBRARY_OPENS}
          className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold"
          style={{
            background: "oklch(0.62 0.22 290 / 14%)",
            border: "1px solid oklch(0.62 0.22 290 / 36%)",
            color: "oklch(0.84 0.16 290)",
          }}
        >
          <Grid3X3 className="h-3 w-3" /> 장소 라이브러리 — 관계도 · 보유 에셋
        </button>
      )}

      {/*
        ── 방 라이브러리 ─────────────────────────────────────────────────
        같은 장소가 씬마다 다시 나옵니다. 방을 통째로(치수·여섯 면·그 안의 소품과 묶음·이어 둔 에셋) 담아 두고 다음 컷에서
        꺼내 세웁니다. 소품 자리는 **방 기준**으로 담겨 방을 다른 자리에 세워도 안의 것이 따라옵니다(`lib/roomPreset.ts`).
      */}
      {roomLibrary && (
        <PanelSection
          tour="env-room-library"
          title="방 라이브러리"
          count={roomLibrary.presets.length}
          open={openSections.roomLibrary ?? false}
          onToggle={() => toggleSection("roomLibrary")}
        >
          {/*
            목록은 **이 작품 것만** 입니다(`draft.roomPresets`) — 모든 작품의 방이 한 목록에 쌓이면
            금세 길어져 정작 이 작품 방을 찾지 못합니다. 다른 작품 것은 이 단추로 **복사해** 들여옵니다.
          */}
          {roomLibrary.borrow && (
            <button
              type="button"
              onClick={roomLibrary.borrow}
              className="mb-1.5 w-full rounded-md px-2 py-1.5 text-[10px] font-semibold"
              style={{
                background: "oklch(0.55 0.15 200 / 14%)",
                border: "1px dashed oklch(0.55 0.15 200 / 34%)",
                color: "oklch(0.78 0.12 200)",
              }}
            >
              다른 작품에서 방 끌어오기
            </button>
          )}
          {rooms.length > 0 && (
            <button
              type="button"
              onClick={roomLibrary.save}
              className="w-full rounded-md px-2 py-1.5 text-[10px] font-semibold"
              style={{
                background: "oklch(0.78 0.14 30 / 16%)",
                border: "1px solid oklch(0.78 0.14 30 / 40%)",
                color: "oklch(0.86 0.12 30)",
              }}
            >
              지금 방 저장 — 방 + 안의 소품까지
            </button>
          )}
          {roomLibrary.presets.length === 0 ? (
            <p className="mt-1.5 text-[9px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
              아직 없습니다. 방을 세우고 소품을 놓은 뒤 저장하면, 다른 컷에서 그대로 꺼내 씁니다.
            </p>
          ) : (
            <div className="composition-scroll mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
              {roomLibrary.presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => roomLibrary.apply(preset)}
                    title={`${preset.room.width.toFixed(1)} × ${preset.room.depth.toFixed(1)} × ${preset.room.height.toFixed(1)} m · 소품 ${preset.objects.length}개 — 누르면 새 방으로 세웁니다`}
                    className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-[10px]"
                    style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.80 0.01 265)" }}
                  >
                    {preset.name}
                    <span className="ml-1 text-[9px]" style={{ color: "oklch(0.50 0.01 265)" }}>
                      {preset.room.width.toFixed(1)}×{preset.room.depth.toFixed(1)}×
                      {preset.room.height.toFixed(1)}m
                      {preset.objects.length ? ` · 소품 ${preset.objects.length}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => roomLibrary.remove(preset.id)}
                    aria-label="라이브러리에서 지우기"
                    title="라이브러리에서만 지웁니다 — 세워 둔 방과 그림 파일은 그대로입니다"
                    className="shrink-0 rounded p-1 hover:bg-white/10"
                    style={{ color: "oklch(0.60 0.15 25)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      )}

      <PanelSection tour="env-display" title="화면" open onToggle={() => undefined}>
        <label className="flex items-center gap-2 text-[10px]" style={{ color: "oklch(0.62 0.01 265)" }}>
          <input
            type="checkbox"
            checked={state.showLabels}
            onChange={(event) =>
              setState((current) => ({ ...current, showLabels: event.target.checked }))
            }
          />
          이름표 — 캡처·영상에는 나오지 않습니다
        </label>
        <label
          className="mt-1.5 flex items-center gap-2 text-[10px]"
          style={{ color: "oklch(0.62 0.01 265)" }}
        >
          <input
            type="checkbox"
            checked={state.showCharacterPaths}
            onChange={(event) =>
              setState((current) => ({ ...current, showCharacterPaths: event.target.checked }))
            }
          />
          인물 동선
        </label>

        {/* 조명을 하나도 안 켰는데 배경만 환하면 인물이 배경 위에 오려 붙인 것처럼 보입니다. */}
        {rooms.length > 0 && (
          <div className="mt-2 text-[10px]" style={{ color: "oklch(0.52 0.01 265)" }}>
            <span className="flex items-center justify-between">
              <span>배경 밝기 — 하늘 조명이 없을 때</span>
              <span className="tabular-nums">{state.skylessBrightness.toFixed(2)}</span>
            </span>
            <PlannerRange
              min={0.05}
              max={1}
              step={0.01}
              value={state.skylessBrightness}
              mark={mark}
              onChange={(next) =>
                setStateRaw((current) => ({ ...current, skylessBrightness: next }))
              }
              className="mt-1 w-full"
            />
          </div>
        )}
      </PanelSection>
    </div>
  );
}

/**
 * 방 하나의 속성 — **그 방 아래에** 펴집니다.
 *
 * 실내와 실외는 필요한 것이 다릅니다. 실외는 뒤를 가릴 면이 없고 돔이라 여섯 면도 없습니다 —
 * 파노라마 한 장이 전부입니다. 호리존은 그림 자체가 없습니다 — 치수와 색 하나뿐입니다.
 */
function RoomProperties({
  room,
  state,
  setState,
  listedBackgrounds,
  faceSets,
  assignFaceSet,
  assignPanorama,
  onImportPanorama,
  onDeletePanorama,
  isFaceSetAssigned,
  onCreatePlace,
  onOpenPlace,
  placeName,
  places,
  onPickPlace,
  onOpenGallery,
  assetOptions,
  onCreateAsset,
  onCreateGroupAsset,
  selected,
  setSelected,
  setStateRaw,
  mark,
}: {
  room: CompositionRoom;
  state: CompositionState;
  setState: UpdateComposition;
  /** 되돌리기에 **안 쌓는** 갱신과 «지금 판 기록» — 색 고르기 창을 끄는 동안 씁니다(`PlannerRange` 와 같은 규칙). */
  setStateRaw: UpdateComposition;
  mark: () => void;
  listedBackgrounds: PlannerBackground[];
  faceSets: FaceSet<PlannerBackground>[];
  assignFaceSet: (set: FaceSet<PlannerBackground>) => void;
  assignPanorama: (background: PlannerBackground) => void;
  onImportPanorama?: EnvironmentPanelProps["onImportPanorama"];
  onDeletePanorama?: EnvironmentPanelProps["onDeletePanorama"];
  isFaceSetAssigned: (set: FaceSet<PlannerBackground>) => boolean;
  onCreatePlace?: EnvironmentPanelProps["onCreatePlace"];
  onOpenPlace?: () => void;
  placeName?: string | null;
  places?: { id: string; name: string }[];
  onPickPlace?: (backgroundId: string) => void;
  onOpenGallery: () => void;
  assetOptions?: EnvironmentPanelProps["assetOptions"];
  onCreateAsset?: (objectId: string, label: string) => void;
  onCreateGroupAsset?: (groupId: string, label: string) => void;
  selected?: string;
  setSelected?: (value: string) => void;
}) {
  const outdoor = room.outdoor === true;
  /**
   * **호리존**인가 — 그림을 안 붙이는 방. 장소·전개도·파노라마·6면 세트·가릴 면 칸이 전부 빠지고
   * 색 칸 하나가 들어옵니다. `boxLike` 에서도 빼야 «6면 세트» 가 안 뜹니다.
   */
  const horizon = isHorizonRoom(room);
  /**
   * 실외를 **무엇으로 두르는가**. 돔이면 파노라마 한 장, 상자면 여섯 면입니다.
   * 실내는 늘 상자입니다.
   */
  const domeLike = outdoor && room.outdoorShape !== "box";
  /** 파노라마를 끌어다 놓는 중인가 — 테두리로 «여기 놓으면 됩니다» 를 보입니다. */
  const [dropping, setDropping] = useState(false);
  /** 목록이 비어 있든 아니든 **이 칸 어디에나** 놓을 수 있게, 손잡이를 한 벌 만들어 씁니다. */
  const dropHandlers = onImportPanorama
    ? {
        onDragOver: (event: DragEvent) => {
          event.preventDefault();
          setDropping(true);
        },
        onDragLeave: () => setDropping(false),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setDropping(false);
          const file = Array.from(event.dataTransfer.files).find((item) =>
            item.type.startsWith("image/"),
          );
          if (file) void onImportPanorama(file);
        },
      }
    : {};
  const boxLike = !domeLike && !horizon;
  const assets = (assetOptions ?? []).filter((item) => item.kind === "asset");
  const panorama = room.panorama
    ? listedBackgrounds.find((item) => item.id === room.panorama)
    : null;
  /** 실외 방에 걸 수 있는 그림 — 2:1 등장방형만. 벽지·낱장을 걸면 돔이 우그러집니다. */
  const panoramas = listedBackgrounds.filter((item) => isPanoramaAspect(item.aspect));

  return (
    <div
      className="mt-1 space-y-2 rounded-md p-2"
      style={{ background: "oklch(1 0 0 / 3%)", border: "1px solid oklch(1 0 0 / 7%)" }}
    >
      {/*
        ── 치수를 먼저 정합니다 ────────────────────────────────────────
        이미지는 **이 숫자대로** 뽑힙니다(프롬프트에 미터가 박힙니다). 인물을 놓고 화면에서 공간 크기를 눈으로 본 다음
        여기서 확정하고 «만들기» 로 갑니다.
      */}
      {/*
        **돔은 구면이라 숫자가 하나입니다.** 가로·깊이를 따로 받을 까닭이 없습니다 — 셋을 따로 받으면
        서로 어긋난 «찌그러진 돔» 을 만들 수 있는데, 화면에도 프롬프트에도
        그런 모양은 없습니다. 안에는 여전히 가로=깊이=지름, 높이=반지름으로 적어 둡니다 — 축척·인물 비율·저장본이
        전부 그 셋을 보고 돌아갑니다.
      */}
      {domeLike ? (
        <div data-tour="env-room-size" className="grid grid-cols-2 gap-1">
          <label className="text-[9px]" style={{ color: "oklch(0.55 0.01 265)" }}>
            반지름 (m)
            <NumberInput
              value={Math.round((room.width / 2) * 100) / 100}
              step={0.5}
              min={ROOM_SIZE_MIN}
              onChange={(next) =>
                setState((current) =>
                  setRoomDimsIn(
                    current,
                    { width: next * 2, depth: next * 2, height: next },
                    room.id,
                    true,
                  ),
                )
              }
            />
          </label>
          <p className="self-end text-[9px] leading-relaxed" style={{ color: "oklch(0.48 0.01 265)" }}>
            지름 {Math.round(room.width * 10) / 10} m · 꼭대기 {Math.round((room.width / 2) * 10) / 10} m
          </p>
        </div>
      ) : (
        <div data-tour="env-room-size" className="grid grid-cols-3 gap-1">
          {(
            [
              ["width", "가로", room.width],
              ["depth", "깊이", room.depth],
              ["height", outdoor ? "높이" : "층고", room.height],
            ] as const
          ).map(([key, label, value]) => (
            <label key={key} className="text-[9px]" style={{ color: "oklch(0.55 0.01 265)" }}>
              {label} (m)
              <NumberInput
                value={Math.round(value * 100) / 100}
                step={0.1}
                min={ROOM_SIZE_MIN}
                onChange={(next) =>
                  setState((current) => setRoomDimsIn(current, { [key]: next }, room.id, true))
                }
              />
            </label>
          ))}
        </div>
      )}
      <p className="text-[9px] leading-relaxed" style={{ color: "oklch(0.48 0.01 265)" }}>
        밑면이 바닥(y=0)이라 <b>인물이 뜨지 않습니다.</b> {domeLike ? "반지름" : outdoor ? "한 변" : "방 크기"}가 곧
        축척이에요 — 줄이면 인물이 차지하는 비율이 커져 배경보다 커 보입니다.
        {domeLike && " 파노라마의 지평선은 눈높이 1.6 m 에 옵니다."}
      </p>

      {/*
        ── 호리존: 색 ─────────────────────────────────────────────────
        제품 컷은 배경 그림이 아니라 **한 가지 색**이 배경입니다. 그래서 호리존 방만 방의 색을 직접 고릅니다.

        색 고르기 창(`<input type="color">`)은 **끄는 동안 한 눈금마다** change 가 옵니다 — 슬라이더와 같습니다.
        그대로 되돌리기에 쌓으면 한 번의 색 고르기가 앞의 기록을 통째로 밀어냅니다(`PlannerRange` 머리말).
        그래서 창을 여는 순간(pointerdown·키 누름)에 한 번만 `mark` 하고, 도중은 `setStateRaw` 로 갑니다.
        프리셋 단추는 한 번에 한 색이라 보통 `setState` 로 — 누름 하나가 되돌리기 한 칸입니다.

        `mark` 는 **<label> 에** 겁니다, <input> 이 아니라. 색 글자(#f2f2f2)도 label 안이라 그걸 눌러도 창이 열리는데,
        label 활성화는 input 에 **합성 click 만** 보냅니다 — input 의 pointerdown 은 영영 안 옵니다. 거기 걸어 두면
        글자를 눌러 고른 색은 되돌리기 판이 없이 `setStateRaw` 로만 가서 Ctrl+Z 가 못 되돌립니다(규칙 4).
        label 에 걸면 색칸을 누르든 글자를 누르든 pointerdown 이 label 을 한 번 지나가고, 두 벌로 안 찍힙니다.
      */}
      {horizon && room.horizon && (
        <div data-tour="env-horizon-color" className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
              호리존 색
            </span>
            <label
              className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] tabular-nums"
              style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.80 0.01 265)" }}
              title="색을 직접 고릅니다 — 여섯 면 전부가 이 색이 됩니다"
              onPointerDown={mark}
              onKeyDown={mark}
            >
              <input
                type="color"
                value={room.horizon.color}
                onChange={(event) => {
                  const next = event.target.value;
                  setStateRaw((current) => setRoomHorizonColorIn(current, room.id, next));
                }}
                className="h-4 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              {room.horizon.color}
            </label>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {HORIZON_COLOR_PRESETS.map((preset) => {
              const on = preset.color === room.horizon?.color;
              return (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setState((current) => setRoomHorizonColorIn(current, room.id, preset.color))}
                  title={`${preset.label} ${preset.color}`}
                  aria-label={preset.label}
                  className="h-6 rounded"
                  style={{
                    background: preset.color,
                    border: `2px solid ${on ? "oklch(0.80 0.15 200)" : "oklch(1 0 0 / 18%)"}`,
                    boxShadow: on ? "0 0 0 1px oklch(0.80 0.15 200 / 50%)" : "none",
                  }}
                />
              );
            })}
          </div>
          <p className="text-[9px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
            호리존은 그림을 안 붙입니다 — 전개도·파노라마·6면 세트·가릴 면 대신 <b>여섯 면이 한 가지 색</b>으로 이어집니다.
            컷 프롬프트에는 «이음매 없는 단색 배경(색 {room.horizon.color})» 으로 실립니다. 제품은 아래 «이 방의 소품» 으로 세우세요.
          </p>
        </div>
      )}

      {/*
        ── 뒤를 가릴 면 — **실내만** ───────────────────────────────────
        가릴 면은 방마다 다릅니다 — 어느 쪽을 등지고 찍느냐가 공간마다 다르기 때문입니다.
        실외는 돔이라 가릴 벽이 아예 없어서 칸 자체를 안 냅니다.
      */}
      {/*
        ── 실외를 무엇으로 두를까 ────────────────────────────────────────
        실외라고 다 돔은 아닙니다 — 카메라가 어떻게 움직이느냐에 따라 필요한 그림이 갈립니다.
        그래서 방형(6면 세트)과 돔(파노라마 한 장) 중에 고릅니다.

        **돔**은 각도만 맞습니다 — 제자리에서 도는 컷이면 이음매 없이 깔끔하고 그림 한 장이면 됩니다.
        **상자**는 여섯 면이 실제 기하라 카메라가 옮겨 다녀도 앞뒤·가림이 맞습니다(대신 모서리와 여섯 장의 색을 맞춰야 합니다).
      */}
      {outdoor && (
        <div data-tour="env-outdoor-shape" className="space-y-1">
          <span className="text-[9px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
            무엇으로 두를까
          </span>
          <div className="grid grid-cols-2 gap-1">
            {([
              ["dome", "돔 (파노라마 한 장)", "카메라가 제자리에서 돌 때 — 이음매 없음, 시차 없음"],
              ["box", "방형 (6면 세트)", "카메라가 옮겨 다닐 때 — 앞뒤·가림이 맞음, 모서리 이음매"],
            ] as const).map(([value, label, hint]) => {
              const on = value === (room.outdoorShape === "box" ? "box" : "dome");
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setState((current) => setOutdoorShapeIn(current, room.id, value))
                  }
                  title={hint}
                  className="rounded px-2 py-1.5 text-[9px] font-semibold"
                  style={{
                    background: on ? "oklch(0.72 0.16 60 / 22%)" : "oklch(1 0 0 / 5%)",
                    border: `1px solid ${on ? "oklch(0.72 0.16 60 / 45%)" : "transparent"}`,
                    color: on ? "oklch(0.86 0.14 60)" : "oklch(0.60 0.01 265)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {boxLike && (
        <div data-tour="env-occlude-faces">
          <p className="text-[9px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
            뒤를 가릴 면 — 누른 면만 벽이 됩니다
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {COMPOSITION_CUBE_FACES.map((face) => {
              const on = room.occludeFaces?.[face] === true;
              return (
                <button
                  key={face}
                  type="button"
                  onClick={() =>
                    setState((current) => setFaceOccludesIn(current, face, !on, room.id))
                  }
                  title={`${CUBE_FACE_LABELS[face]} 뒤에 있는 것을 ${on ? "보이게" : "가리게"} 합니다`}
                  className="rounded px-1 py-1 text-[9px] font-semibold"
                  style={{
                    background: on ? "oklch(0.55 0.15 200 / 30%)" : "oklch(1 0 0 / 6%)",
                    color: on ? "oklch(0.84 0.13 200)" : "oklch(0.60 0.01 265)",
                  }}
                >
                  {CUBE_FACE_LABELS[face]}
                </button>
              );
            })}
          </div>
          <label
            className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-md p-2 text-[9px] leading-relaxed"
            style={{ background: "oklch(1 0 0 / 4%)", color: "oklch(0.58 0.01 265)" }}
          >
            <input
              type="checkbox"
              checked={state.outerCutaway !== false}
              onChange={(event) => {
                const on = event.target.checked;
                setState((current) => ({ ...current, outerCutaway: on }));
              }}
              className="mt-0.5"
            />
            <span>
              <b style={{ color: "oklch(0.80 0.01 265)" }}>방 밖에서 외벽 투시</b>
              <br />
              외벽 그림을 붙인 방을 <b>밖</b>에서 볼 때, 안에 선 인물을 가리는 외벽만 반투명하게 걷습니다(<b>기본</b>).
            </span>
          </label>
        </div>
      )}

      {/*
        ── 이 방의 장소 ────────────────────────────────────────────────
        이 칸은 **앞에서 만들어 둔 공간을 가져오는** 자리입니다. 고르자마자 파노라마 만들기 창이 뜨면
        이미 있는 것을 쓰려던 사람이 매번 새로 뽑는 창을 닫아야 하고, 이어 둔 공간을 바꿀 길도 막힙니다.

        그래서 **고르기는 고르기만** 합니다(창이 안 뜹니다). 창은 «열기» 나 «만들기» 를 눌렀을 때만 뜹니다.
        호리존에는 이 칸이 없습니다 — 장소 카드가 없는 방이라, 두면 «전개도 만들기» 가 단색 벽에 그림을 뽑으려 듭니다.
      */}
      {onCreatePlace && !horizon && (
        <div className="space-y-1.5">
          {/*
            ── 이 공간의 장소 ────────────────────────────────────────
            이어 둔 장소를 **뺄** 길이 있어야 합니다. 빼고 나면 «만들기» 가 저절로 돌아오니
            «새 장소로» 같은 단추를 따로 둘 까닭이 없습니다.

            그래서 이어 둔 장소가 있으면 «열기 + ×», 없으면 «만들기» 하나입니다. 실외 목록에는 파노라마 카드만 뜹니다.
            실내는 6면 세트를 고르는 것이 곧 장소를 고르는 것이라(아래) 드롭다운을 따로 두지 않습니다.
          */}
          {outdoor && (places?.length ?? 0) > 0 && onPickPlace && !placeName && (
            <select
              value=""
              onChange={(event) => onPickPlace(event.target.value)}
              className="w-full rounded-md px-2 py-1.5 text-[10px] outline-none"
              style={{
                background: "oklch(0.11 0.008 265)",
                border: "1px solid oklch(1 0 0 / 10%)",
                color: "oklch(0.86 0.01 265)",
              }}
            >
              <option value="">만들어 둔 파노라마 장소에서 고르기 — {places?.length}곳</option>
              {(places ?? []).map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name || "이름 없는 장소"}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1">
            {placeName && onOpenPlace ? (
              <>
                <button
                  type="button"
                  data-tour="env-room-make-image"
                  onClick={onOpenPlace}
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-[10px] font-semibold"
                  style={{
                    background: "oklch(0.55 0.15 200 / 18%)",
                    border: "1px solid oklch(0.55 0.15 200 / 45%)",
                    color: "oklch(0.82 0.14 200)",
                  }}
                >
                  «{placeName}» 열기 — 프롬프트·그림
                </button>
                {onPickPlace && (
                  <button
                    type="button"
                    onClick={() => onPickPlace("")}
                    title="이 공간에서 장소를 뺍니다 — 카드와 그림은 그대로 남습니다"
                    aria-label="장소 빼기"
                    className="shrink-0 rounded-md px-2 py-1.5"
                    style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.62 0.16 25)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                data-tour="env-room-make-image"
                onClick={() =>
                  onCreatePlace({
                    kind: domeLike ? "dome" : outdoor ? "outdoor" : "roomInner",
                    name: room.name,
                    width: room.width,
                    depth: room.depth,
                    height: room.height,
                  })
                }
                className="w-full rounded-md px-2 py-1.5 text-[10px] font-semibold"
                style={{
                  background: "oklch(0.55 0.15 200 / 18%)",
                  border: "1px solid oklch(0.55 0.15 200 / 45%)",
                  color: "oklch(0.82 0.14 200)",
                }}
              >
                {domeLike ? "파노라마 만들기" : "전개도 만들기"}
              </button>
            )}
          </div>
          <p className="text-[9px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
            지금 치수 {room.width.toFixed(1)} × {room.depth.toFixed(1)} × {room.height.toFixed(1)} m 가 프롬프트에 그대로
            박힙니다. 카드에서 그림을 등록하면{" "}
            {domeLike ? "파노라마 한 장이 이 실외의 돔으로" : "여섯 면이 잘려 이 방에"} 걸립니다.
          </p>
        </div>
      )}

      {/*
        ── 실외: 파노라마 그림 ─────────────────────────────────────────
        파노라마는 실외 돔에만 걸립니다 — 그래서 목록도 그 방의 속성 안에 둡니다.
      */}
      {domeLike && (
        <div
          {...dropHandlers}
          data-tour="env-panoramas"
          className="space-y-1.5 rounded-md"
          style={{
            outline: dropping ? "1px dashed oklch(0.70 0.15 200)" : "none",
            outlineOffset: 4,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
              파노라마 그림 {panoramas.length > 0 && `(${panoramas.length})`}
            </span>
            <div className="flex items-center gap-1">
              {/*
                **바깥에서 바로 들여오기.** 여태는 앱에서 뽑은 것만 목록에 올라, 밖에서 만든
                360°(스카이박스 생성기·실촬)를 쓸 길이 없었습니다. 끌어다 놓기도 같이 받습니다.
              */}
              {onImportPanorama && (
                <label
                  className="cursor-pointer rounded px-1.5 py-0.5 text-[9px]"
                  style={{ background: "oklch(0.55 0.15 200 / 20%)", color: "oklch(0.80 0.14 200)" }}
                  title="360° 그림 파일을 골라 목록에 넣습니다"
                >
                  불러오기
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      // 같은 파일을 다시 고를 수 있게 칸을 비웁니다 — 안 비우면 change 가 안 옵니다.
                      event.target.value = "";
                      if (file) void onImportPanorama(file);
                    }}
                  />
                </label>
              )}
              {room.panorama && (
                <button
                  type="button"
                  onClick={() => setState((current) => setRoomPanoramaIn(current, "", null, room.id))}
                  className="rounded px-1.5 py-0.5 text-[9px]"
                  style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.66 0.01 265)" }}
                >
                  돔 풀기
                </button>
              )}
            </div>
          </div>
          {panoramas.length === 0 ? (
            <div
              className="rounded-md px-2 py-3 text-center text-[9px] leading-relaxed"
              style={{
                border: `1px dashed ${dropping ? "oklch(0.70 0.15 200)" : "oklch(1 0 0 / 12%)"}`,
                background: dropping ? "oklch(0.55 0.15 200 / 12%)" : "transparent",
                color: "oklch(0.50 0.01 265)",
              }}
            >
              아직 없습니다 — 위 «파노라마 만들기» 로 뽑거나, <b>360° 그림을 여기로 끌어다 놓으세요.</b>
              <br />
              2:1 등장방형이 가장 잘 맞습니다. 앱에서 뽑은 것은 16:9(1.79:1)이라 위아래가 조금 눌립니다 —
              정확한 돔이 필요하면 2:1 로 뽑아 주는 곳(스카이박스 생성기·실촬 360)에서 받아 여기로 끌어다 놓으세요.
            </div>
          ) : (
            <div className="composition-scroll grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {panoramas.map((item) => {
                const on = item.id === room.panorama;
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => assignPanorama(item)}
                      title={`${item.name} — 누르면 이 실외의 돔이 됩니다`}
                      className="relative block h-12 w-full overflow-hidden rounded-md text-left"
                      style={{
                        border: `1px solid ${on ? "oklch(0.55 0.15 200)" : "oklch(1 0 0 / 8%)"}`,
                      }}
                    >
                      {item.thumb && (
                        <img src={item.thumb} alt={item.name} className="h-full w-full object-cover" />
                      )}
                      <span
                        className="absolute inset-x-0 bottom-0 truncate px-1 py-0.5 text-[9px]"
                        style={{
                          background: "oklch(0 0 0 / 70%)",
                          color: on ? "oklch(0.80 0.15 200)" : "white",
                        }}
                      >
                        {on ? "● " : ""}
                        {item.name}
                      </span>
                    </button>
                    {/* 지우기는 카드 위에 겹쳐 둡니다 — 줄을 하나 더 쓰면 카드가 반으로 작아집니다. */}
                    {onDeletePanorama && (
                      <button
                        type="button"
                        onClick={() => void onDeletePanorama(item)}
                        title="이 파노라마를 지웁니다 — 폴더의 원본도 함께"
                        className="absolute right-0.5 top-0.5 rounded p-0.5"
                        style={{ background: "oklch(0 0 0 / 65%)", color: "oklch(0.72 0.16 25)" }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {panorama && (
            <p className="text-[9px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
              지금 «{panorama.name}» 이 걸려 있습니다. 카메라가 제자리인 컷용입니다 — 한가운데 눈높이 1.6 m 에서 가장
              정확하고, 멀어지면 바닥이 번집니다(무빙 컷은 6면 전개도).
            </p>
          )}
        </div>
      )}

      {/*
        ── 실내: 6면 세트 ──────────────────────────────────────────────
        6면 세트는 상자 방에만 걸립니다 — 그래서 그 방의 속성 안에 둡니다. 면 하나하나 고르는 칸은 걷었습니다 —
        세트를 누르면 여섯 면이 한 번에 걸리고, 이름이 «…외벽» 인 세트는 바깥 껍질로 갑니다.
      */}
      {boxLike && (
        <div data-tour="env-face-sets" className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
              6면 세트 {faceSets.length > 0 && `(${faceSets.length})`}
            </span>
            <button
              type="button"
              onClick={onOpenGallery}
              title="그림을 큰 화면으로 훑어보고 면에 직접 붙입니다"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: "oklch(0.55 0.15 200 / 14%)", color: "oklch(0.72 0.15 200)" }}
            >
              <Grid3X3 className="h-2.5 w-2.5" /> 그림 전체보기
            </button>
          </div>
          {faceSets.length === 0 ? (
            <p className="text-[9px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
              아직 없습니다 — 위 «전개도 만들기» 로 뽑은 그림이 잘리면 여기 뜹니다.
            </p>
          ) : (
            <div className="composition-scroll grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {faceSets.map((set) => (
                <FaceSetCard
                  key={set.id}
                  set={set}
                  cellHeight={22}
                  selected={isFaceSetAssigned(set)}
                  title={`${set.label} — 누르면 여섯 면에 한 번에 걸립니다${set.complete ? "" : ` (${set.missing.length}면 없음 → 비워 둠)`}`}
                  onClick={() => assignFaceSet(set)}
                  caption={
                    <span
                      style={{
                        color: isFaceSetAssigned(set)
                          ? "oklch(0.80 0.15 200)"
                          : "oklch(0.62 0.01 265)",
                      }}
                    >
                      {set.label}
                      {isFaceSetAssigned(set) && " · 걸림"}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        ── 이 방의 소품 ───────────────────────────────
        배치 탭은 캐릭터와 캐릭터 소품, 환경 탭은 배경과 배경 소품으로 갈라 둡니다 — 그래야 배치한
        소품과 소품 에셋이 짝을 이루고, 프롬프트에서 @ 로 거는 이름도 한쪽에서만 나옵니다.
        다만 갈랐다고 기능을 덜면 안 됩니다 — 묶기도, 방 벽에 붙이기도 여기 그대로 있습니다.

        소품은 «세우기 · 붙이기 · 묶기 · 에셋 잉기» 네 가지가 한자리에 있어야 합니다 — 세운 뒤 다른 탭으로 건너가면
        무엇을 세웠는지 잊습니다.
      */}
      <RoomProps
        state={state}
        setState={setState}
        room={room}
        assets={assets}
        onCreateAsset={onCreateAsset}
        onCreateGroupAsset={onCreateGroupAsset}
        selected={selected}
        setSelected={setSelected}
      />
    </div>
  );
}

/** 방 하나에 딸린 소품들 — 세우고, 면에 붙이고, 묶고, 에셋과 잉습니다. */
function RoomProps({
  state,
  setState,
  room,
  assets,
  onCreateAsset,
  onCreateGroupAsset,
  selected,
  setSelected,
}: {
  state: CompositionState;
  setState: UpdateComposition;
  room: CompositionRoom;
  assets: NonNullable<EnvironmentPanelProps["assetOptions"]>;
  onCreateAsset?: (objectId: string, label: string) => void;
  onCreateGroupAsset?: (groupId: string, label: string) => void;
  selected?: string;
  setSelected?: (value: string) => void;
}) {
  const props = objectsInRoom(state, room.id);
  const pickedId = selected?.startsWith("object:") ? selected.slice(7) : null;
  const picked = props.find((item) => item.id === pickedId) ?? null;
  /** 고른 것이 **덩어리**인가 — 그러면 덩어리 카드만 냅니다(낱개 칸은 뜻이 없습니다). */
  const pickedGroup = objectGroupOf(state, picked?.groupId);
  /** 이어 둔 에셋이 아직 있는가 — 지운 에셋을 가리키면 «없는 것» 으로 봅니다. */
  const linkedAsset =
    picked?.swapRef &&
    assets.find(
      (item) => item.kind === picked.swapRef!.kind && item.id === picked.swapRef!.id,
    );

  return (
    <div data-tour="env-room-props" className="space-y-1.5">
      <span className="text-[9px] font-semibold" style={{ color: "oklch(0.52 0.01 265)" }}>
        이 방의 소품 {props.length > 0 && `(${props.length})`}
      </span>

      <div className="grid grid-cols-3 gap-1">
        {OBJECT_KINDS.map((kind) => (
          <button
            key={kind.label}
            type="button"
            onClick={() =>
              setState((current) => {
                const seated = addObjectInRoom(current, kind, room.id);
                setSelected?.(`object:${seated.id}`);
                return seated.state;
              })
            }
            title={`«${room.name}» 안에 ${kind.label} 을(를) 세웁니다`}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[9px]"
            style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.64 0.01 265)" }}
          >
            <kind.icon className="h-3 w-3 shrink-0" style={{ opacity: 0.7 }} />
            {kind.label}
          </button>
        ))}
      </div>

      {/* 목록·묶기·이름 고치기는 배치 탭과 **같은 부품**입니다(CLAUDE.md 규칙 1). */}
      <ObjectList
        state={state}
        setState={setState}
        objects={props}
        selected={selected ?? "none"}
        setSelected={(value) => setSelected?.(value)}
        emptyNote="아직 없습니다 — 위에서 골라 세우면 방 한가운데에 서고, «붙일 면» 을 고르면 그 면에 닿습니다."
      />

      {/* ── 고른 덩어리 ─────────────────────────────────────────────── */}
      {pickedGroup && (
        <GroupCards
          state={state}
          setState={setState}
          groupIds={[pickedGroup.id]}
          assets={assets}
          onCreateAsset={onCreateGroupAsset}
        />
      )}

      {/* ── 고른 소품 ───────────────────────────────────────────────── */}
      {picked && !pickedGroup && (
        <div
          className="space-y-1 rounded p-1.5"
          style={{ background: "oklch(0.55 0.15 200 / 10%)", border: "1px solid oklch(0.62 0.15 200 / 35%)" }}
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 truncate text-[10px] font-semibold" style={{ color: "oklch(0.86 0.13 200)" }}>
              {picked.label}
            </span>
            {/*
              투시 — 벽만 투시되고 소품은 안 되면 벽 너머로 소품이 가로막고, 거꾸로 벽을 막았는데 소품만
              비쳐도 어색합니다. 그래서 소품에도 같은 스위치를 둡니다.
              시간대별로 바꾸려면 타임라인의 그 소품 줄에 키를 찍습니다.
            */}
            <button
              type="button"
              onClick={() =>
                setState((current) =>
                  updateObjectIn(current, picked.id, { seeThrough: !picked.seeThrough }),
                )
              }
              title={
                picked.seeThrough
                  ? "투시 끄기 — 뒤를 다시 가립니다"
                  : "투시 — 뒤가 비치고 카메라를 막지 않습니다"
              }
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold"
              style={{
                background: picked.seeThrough ? "oklch(0.72 0.16 60 / 26%)" : "oklch(1 0 0 / 5%)",
                color: picked.seeThrough ? "oklch(0.86 0.14 60)" : "oklch(0.52 0.01 265)",
              }}
            >
              투시
            </button>
          </div>

          {/*
            붙일 면 — 소품은 결국 바닥이든 벽이든 천장이든 어딘가에 닿아 있습니다. 떠 있는 소품을 손으로
            맞추면 방 치수를 고칠 때마다 다시 맞춰야 합니다.
            붙이면 닿는 축만 방이 잡고 나머지는 끄는 대로 미끄러집니다 — 방을 넓혀도 따라붙습니다.
          */}
          <label className="flex items-center gap-1 text-[9px]" style={{ color: "oklch(0.52 0.01 265)" }}>
            붙일 면
            <select
              value={picked.mount?.roomId === room.id ? picked.mount.face : ""}
              onChange={(event) =>
                setState((current) =>
                  mountObjectToFaceIn(
                    current,
                    picked.id,
                    room.id,
                    (event.target.value || null) as CompositionCubeFace | null,
                  ),
                )
              }
              className="min-w-0 flex-1 rounded px-1 py-0.5 text-[9px] outline-none"
              style={{
                background: "oklch(0.18 0.01 265)",
                border: "1px solid oklch(1 0 0 / 10%)",
                color: "oklch(0.86 0.01 265)",
              }}
            >
              <option value="">안 붙임 — 공중에 둡니다</option>
              {COMPOSITION_CUBE_FACES.map((face) => (
                <option key={face} value={face}>
                  {CUBE_FACE_LABELS[face]}
                </option>
              ))}
            </select>
          </label>

          {/*
            **벽과 조명에는 에셋이 없습니다.** 에셋은 «이 덩어리를 무엇으로 바꿔 그릴까» 인데,
            벽과 조명은 그릴 물건이 아니라 공간과 빛이라 바꿔 그릴 것이 없습니다 — 박스·구·실린더에만 답니다.
          */}
          {SWAPPABLE_KINDS.includes(picked.kind) && (
            <>
              <select
                value={linkedAsset ? `${linkedAsset.kind}:${linkedAsset.id}` : ""}
                onChange={(event) => {
                  const found = assets.find(
                    (item) => `${item.kind}:${item.id}` === event.target.value,
                  );
                  setState((current) => setObjectSwapIn(current, picked.id, found ?? null));
                }}
                className="w-full rounded px-1 py-0.5 text-[9px] outline-none"
                style={{
                  background: "oklch(0.18 0.01 265)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  color: "oklch(0.86 0.01 265)",
                }}
              >
                <option value="">
                  {assets.some((item) => item.kind === "asset")
                    ? "에셋 안 고름 — 이름만 프롬프트에"
                    : "만들어 둔 에셋이 없습니다"}
                </option>
                {assets
                  .filter((item) => item.kind === "asset")
                  .map((item) => (
                    <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                      {item.group} · {item.name}
                    </option>
                  ))}
              </select>

              {onCreateAsset && (
                <button
                  type="button"
                  onClick={() => onCreateAsset(picked.id, picked.label)}
                  className="w-full rounded px-2 py-1 text-[9px] font-semibold"
                  style={{
                    background: "oklch(0.70 0.15 160 / 16%)",
                    border: "1px solid oklch(0.70 0.15 160 / 40%)",
                    color: "oklch(0.82 0.14 160)",
                  }}
                >
                  {linkedAsset
                    ? `«${linkedAsset.name}» 열기 — 시트 뽑기`
                    : "이 소품의 에셋 만들기 — 시트를 뽑아 바로 잇습니다"}
                </button>
              )}
            </>
          )}

          <ObjectFields
            object={picked}
            onChange={(patch) => setState((current) => updateObjectIn(current, picked.id, patch))}
          />
        </div>
      )}
    </div>
  );
}

export default EnvironmentPanel;
