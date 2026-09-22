import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BackgroundGallery } from "@/components/composition/planner/BackgroundGallery";
import { BlenderPromptOverlay } from "@/components/composition/planner/BlenderPromptOverlay";
import { MotionCaptureDialog } from "@/components/composition/planner/MotionCaptureDialog";
import { RoomPlaceDialog } from "@/components/composition/planner/RoomPlaceDialog";
import BorrowCardsDialog from "@/components/BorrowCardsDialog";
import StepBackgrounds from "@/components/project/StepBackgrounds";
import SharedAssetSection from "@/components/SharedAssetSection";
import { activeRoomOf, setRoomBackgroundIn, type UpdateComposition } from "@/lib/compositionEdit";
import { assetSrc } from "@/lib/mediaLibrary";
import type { CompositionCharacterSource } from "@/lib/composition";
import type { CompositionState } from "@/lib/composition";
import type { Background, ProjectDraft } from "@/lib/projectTypes";
import type { RoomPreset } from "@/lib/roomPreset";
import type { VisualAsset } from "@/lib/visualAsset";
import type { PlannerMedia } from "@/components/composition/planner/usePlannerMedia";

/**
 * **구도잡기 위에 겹쳐 뜨는 창 모음** — 배경 전체보기 · 장소 라이브러리 · 방 끌어오기 ·
 * 장소 카드 · 배경 에셋 · 인물 줄 메뉴 · 모캡 · 블렌더 지시문.
 *
 * `CompositionPlanner.tsx` 에서 떼어 냈습니다. 여덟 개가 전부 «조건이
 * 맞을 때만 뜨는 덮개» 라, 본문(3D 화면 + 오른쪽 판)과 섞여 있으면 화면을 고칠 때마다
 * 덮개를 지나쳐 스크롤해야 했습니다. 여는 열쇠는 전부 부모가 들고 있으므로 여기는
 * **그리기만** 합니다.
 */
export default function PlannerOverlays({
  state,
  setState,
  media,
  projectName,
  playhead,
  plannerCharacters,
  galleryOpen,
  setGalleryOpen,
  placeLibrary,
  roomBorrowOpen,
  setRoomBorrowOpen,
  onSaveRoomPreset,
  libraryOpen,
  setLibraryOpen,
  onPatchBackground,
  onRemoveBackground,
  openPlace,
  activePlace,
  placeOpen,
  setPlaceOpen,
  wallImageFor,
  setWallImageFor,
  setWallPlaceId,
  sharedAssets,
  onChangeSharedAssets,
  assetsOpen,
  setAssetsOpen,
  openAssetId,
  setOpenAssetId,
  motionMenu,
  setMotionMenu,
  motionIntent,
  setMotionIntent,
  motionCaptureAt,
  setMotionCaptureAt,
  blenderPrompt,
  setBlenderPrompt,
  promptTitle,
}: {
  state: CompositionState;
  setState: UpdateComposition;
  media: PlannerMedia;
  projectName?: string;
  playhead: number;
  plannerCharacters: CompositionCharacterSource[];
  galleryOpen: boolean;
  setGalleryOpen: (next: boolean) => void;
  /** 장소 목록 화면을 그대로 띄우기 위한 프로젝트 초안. 없으면 라이브러리 창이 없습니다. */
  placeLibrary?: {
    draft: ProjectDraft;
    onChange: (updater: (current: ProjectDraft) => Partial<ProjectDraft>) => void;
  };
  roomBorrowOpen: boolean;
  setRoomBorrowOpen: (next: boolean) => void;
  onSaveRoomPreset?: (preset: RoomPreset) => void;
  libraryOpen: boolean;
  setLibraryOpen: (next: boolean) => void;
  onPatchBackground?: (
    backgroundId: string,
    updater: (current: Background) => Partial<Background>,
  ) => void;
  onRemoveBackground?: (id: string) => void;
  /** 지금 열어 둔 장소 카드(방에 이어 둔 것 또는 벽 그림). */
  openPlace: Background | null;
  /** 방에 이어 둔 장소. 지울 때 이음을 끊을지 가르는 기준입니다. */
  activePlace: Background | null;
  placeOpen: boolean;
  setPlaceOpen: (next: boolean) => void;
  /** «이 벽의 그림을 만든다» 로 열었으면 그 소품 id. 카드를 벽 모드로 좁힙니다. */
  wallImageFor: string | null;
  setWallImageFor: (next: string | null) => void;
  setWallPlaceId: (next: string | null) => void;
  sharedAssets?: VisualAsset[];
  onChangeSharedAssets?: (updater: (current: VisualAsset[]) => VisualAsset[]) => void;
  assetsOpen: boolean;
  setAssetsOpen: (next: boolean) => void;
  openAssetId: string | null;
  setOpenAssetId: (next: string | null) => void;
  /** 인물 줄 오른쪽 단추로 연 메뉴의 자리와 대상. */
  motionMenu: {
    x: number;
    y: number;
    targetId: string;
    targetName: string;
    sourceId?: string;
    sourceName?: string;
  } | null;
  setMotionMenu: (next: null) => void;
  motionIntent: { characterId: string; sourceId?: string; reanalyze?: boolean } | null;
  setMotionIntent: (
    next: { characterId: string; sourceId?: string; reanalyze?: boolean } | null,
  ) => void;
  /** 모캡 창을 연 시각(초). null 이면 안 뜹니다. */
  motionCaptureAt: number | null;
  setMotionCaptureAt: (next: number | null) => void;
  blenderPrompt: string | null;
  setBlenderPrompt: (next: string | null) => void;
  promptTitle: string;
}) {
  return (
    <>
          {/* ── 배경 전체보기 ─────────────────────────────────────── */}
          {galleryOpen && (
            <BackgroundGallery
              /*
                낱장이 아니라 **세트**를 늘어놓습니다 — 여기 모인 것은 전개도에서 잘라낸 6면 세트라,
                낱장 하나를 고르면 방의 한 면만 갈리고 나머지 다섯 면이 어긋납니다. 공간에 앉는 단위가 세트입니다.
              */
              sets={media.faceSets}
              // 전개도 원본(자르기 전 한 장)도 같이 — 라이브러리니까요.
              sources={media.listedBackgrounds.map((item) => ({
                id: item.id,
                name: item.name,
                thumb: assetSrc(item.filePath) || item.thumb,
              }))}
              roomName={activeRoomOf(state).name || "방"}
              isAssigned={media.isFaceSetAssigned}
              onPick={media.assignFaceSet}
              onClose={() => setGalleryOpen(false)}
            />
          )}

          {/*
            방에 이어 둔 **장소 카드** — 씬 탭의 장소 목록과 같은 카드를 창으로 띄웁니다(공통 규칙 1).
            여기서 그림을 등록하면 자동 6면 커팅이 돌고, 그 세트가 아래 효과로 이 방에 걸립니다.
          */}
          {/*
            ── 장소 라이브러리 ────────────────────────────────────────
            씬 단계에 있던 «배경» 화면 그대로입니다 — 장소 목록·계보(관계도)·보유 에셋·다른 원본까지.
            만드는 일은 방 속성에서, **관리하는 일**은 여기서 합니다.
          */}
          {/*
            **다른 작품에서 방 끌어오기.** 방·소품·묶음과 **걸려 있는 면 그림만** 이
            작품 폴더로 복사해 들여옵니다(안 건 면은 안 가져옵니다).
          */}
          {placeLibrary && roomBorrowOpen && onSaveRoomPreset && (
            <BorrowCardsDialog
              kind="room"
              draft={placeLibrary.draft}
              projectName={projectName ?? ""}
              onClose={() => setRoomBorrowOpen(false)}
              onDone={(made) => (made.rooms ?? []).forEach((preset) => onSaveRoomPreset(preset))}
            />
          )}

          {placeLibrary && (
            <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
              <DialogContent
                /*
                  관계도는 가로로 뻗는 그림이라 **화면 폭을 그대로** 씁니다 — 좁은 창에 넣으면 관계도가
                  접혀서 무엇이 무엇에 이어졌는지 안 보입니다.
                  구도잡기·시트 합성 창과 같은 크기입니다.
                */
                className="h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-none"
                style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 10%)" }}
              >
                <DialogTitle className="text-sm text-white">장소 라이브러리 — 관계도 · 보유 에셋</DialogTitle>
                <p className="mb-2 text-[10px]" style={{ color: "oklch(0.50 0.01 265)" }}>
                  씬 탭에 있던 «배경» 화면 그대로입니다. 여기서 고친 것은 프로젝트에 바로 들어갑니다.
                </p>
                <StepBackgrounds draft={placeLibrary.draft} onChange={placeLibrary.onChange} />
              </DialogContent>
            </Dialog>
          )}

          {onPatchBackground && (
            <RoomPlaceDialog
              background={openPlace}
              roomName={activeRoomOf(state).name || "방"}
              /*
                카드를 **이 일에 맞게** 좁힙니다. 벽 그림은 구성 칸이 아예 필요 없고,
                방은 전개도 칩만, 실외 방은 파노라마 칩만 — 그리고 셋 다 «첫 레퍼런스 프롬프트» 는 뺍니다.
                호리존 방은 여기까지 안 옵니다 — 장소 칸이 없어 «열기»·«만들기» 가 없고(`EnvironmentPanel`),
                이어 둔 카드도 생기지 않습니다.
              */
              placeScope={
                wallImageFor ? "wall" : activeRoomOf(state).outdoor ? "dome" : "room"
              }
              open={placeOpen}
              onOpenChange={(next) => {
                setPlaceOpen(next);
                // 닫으면 «벽 때문에 열었다» 를 잊습니다 — 안 그러면 다음에 만든 그림이 엉뚱한 벽에 붙습니다.
                if (!next) {
                  setWallImageFor(null);
                  setWallPlaceId(null);
                }
              }}
              onPatch={(updater) => {
                if (openPlace) onPatchBackground(openPlace.id, updater);
              }}
              onRemove={() => {
                if (!openPlace) return;
                onRemoveBackground?.(openPlace.id);
                // 방에 이어 둔 장소를 지웠을 때만 이음을 끊습니다(벽 그림은 방과 무관).
                if (openPlace.id === activePlace?.id)
                  setState((current) => setRoomBackgroundIn(current, ""));
              }}
            />
          )}

          {/*
            ── 배경 에셋(공용) ───────────────────────────────────────────
            씬 탭에 있던 목록을 구도잡기 안으로 들였습니다 — 소품에 이어 둘 시트를 만들려고 화면을 오갈 일이 없게.
            띄우는 것은 캐릭터·장소 화면이 쓰던 **같은 목록**입니다(공통 규칙 1).
          */}
          {onChangeSharedAssets && (
            <Dialog open={assetsOpen} onOpenChange={setAssetsOpen}>
              <DialogContent
                className="max-h-[92vh] max-w-[1100px] overflow-y-auto"
                style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 10%)" }}
              >
                <DialogTitle className="text-sm text-white">배경 에셋</DialogTitle>
                <DialogDescription className="text-[10px]" style={{ color: "oklch(0.50 0.01 265)" }}>
                  소품에 이어 둘 시트를 여기서 만듭니다. 캐릭터·장소 화면에서 보던 그 목록입니다.
                </DialogDescription>
                <SharedAssetSection
                  assets={sharedAssets ?? []}
                  projectName={projectName || ""}
                  onChange={onChangeSharedAssets}
                  openId={openAssetId}
                  onOpened={() => setOpenAssetId(null)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/*
            ── 인물 줄 오른쪽 단추 메뉴 ───────────────────────────────
            인물에 걸린 모션을 **이미 분석해 둔 것 중에서 바꾸거나, 그 자리에서 다시 분석**합니다 —
            모션 하나 갈아 끼우려고 창을 나갔다 들어올 일이 없게.

            «분석된 모션 중에서 고르기» 는 모캡 창이 이미 다 갖고 있습니다(목록·미리보기·
            보정·번호↔캐릭터). 그래서 메뉴는 **그 창을 알맞게 열어 주는 일**만 합니다 —
            여기서 목록을 또 그리면 미리보기·보정이 두 벌이 됩니다(공통 규칙 1).
          */}
          {motionMenu && (
            <div className="fixed inset-0 z-[70]" onClick={() => setMotionMenu(null)}>
              <div
                onClick={(event) => event.stopPropagation()}
                className="absolute w-60 overflow-hidden rounded-lg py-1 text-[11px]"
                style={{
                  left: Math.min(motionMenu.x, window.innerWidth - 250),
                  top: Math.min(motionMenu.y, window.innerHeight - 190),
                  background: "oklch(0.17 0.01 265)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  boxShadow: "0 12px 28px oklch(0 0 0 / 45%)",
                }}
              >
                <p
                  className="truncate px-3 py-1.5 text-[10px]"
                  style={{ color: "oklch(0.55 0.01 265)" }}
                >
                  {motionMenu.targetName}
                  {motionMenu.sourceName ? ` · ${motionMenu.sourceName}` : " · 넣은 모션 없음"}
                </p>
                {(
                  [
                    {
                      label: motionMenu.sourceName ? "다른 모션으로 바꾸기" : "모션 넣기",
                      hint: "분석해 둔 영상 중에서 고릅니다",
                      reanalyze: false,
                      needSource: false,
                    },
                    {
                      label: "이 모션 다시 분석",
                      hint: "보정을 고쳐 다시 돌리고, 끝나면 키가 바뀝니다",
                      reanalyze: true,
                      // 넣은 모션이 없으면 다시 볼 영상도 없습니다.
                      needSource: true,
                    },
                  ] as const
                ).map((item) => {
                  const off = item.needSource && !motionMenu.sourceId;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={off}
                      onClick={() => {
                        setMotionIntent({
                          characterId: motionMenu.targetId,
                          sourceId: motionMenu.sourceId,
                          reanalyze: item.reanalyze,
                        });
                        setMotionCaptureAt(playhead);
                        setMotionMenu(null);
                      }}
                      title={item.hint}
                      className="block w-full px-3 py-1.5 text-left hover:bg-white/10 disabled:opacity-35"
                      style={{ color: "oklch(0.84 0.01 265)" }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {motionCaptureAt !== null && (
            <MotionCaptureDialog
              state={state}
              setState={setState}
              plannerCharacters={plannerCharacters}
              projectName={projectName ?? ""}
              playhead={motionCaptureAt}
              /*
                타임라인에서 «모션 바꾸기»·«재분석» 으로 열었으면 그 줄과 그 사람을 미리
                골라 둡니다 — 창을 열고 다시 찾게 하면 우클릭으로 연 뜻이 없습니다.
              */
              openWith={motionIntent}
              onClose={() => {
                setMotionCaptureAt(null);
                setMotionIntent(null);
              }}
            />
          )}

          {/* 블렌더 지시문. 인물 동작은 앱이 알 수 없으므로 보내기 전에 직접 적어 넣게 합니다. */}
          {blenderPrompt !== null && (
            <BlenderPromptOverlay
              title={promptTitle}
              hint={
                promptTitle.startsWith("6면")
                  ? "배경 목록에 생긴 «전개도 틀» 그림을 레퍼런스로 함께 올리세요. # 줄은 빼고 보냅니다"
                  : "LLM 에 붙여넣고 블렌더 MCP 로 실행하세요"
              }
              note={
                promptTitle.startsWith("6면")
                  ? "{{ }} 자리에는 그 공간의 재질·빛·붙박이를 적어 넣으세요. 치수와 비율은 이미 들어가 있습니다."
                  : "인물 동작은 앱이 알 수 없습니다. 주석 자리에 원하는 움직임을 적어 주세요."
              }
              text={blenderPrompt}
              onChange={setBlenderPrompt}
              onClose={() => setBlenderPrompt(null)}
            />
          )}
    </>
  );
}
