import { Package, Trash2 } from "lucide-react";
import { EDITOR_DIALOG } from "@/lib/layout";
import { uid } from "@/lib/projectTypes";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import PromptCardBody from "@/components/project/PromptCardBody";
import GeneratedImageShelf from "@/components/project/GeneratedImageShelf";
import { usePromptCard } from "@/components/project/usePromptCard";
import { useProjectMedia } from "@/components/project/ProjectMediaContext";
import { fieldStyle } from "@/components/project/fieldStyle";
import { useOwnedEditorClose } from "@/components/project/useOwnedAssetRename";
import type { LineageFolder } from "@/components/project/useEntityLineage";
import type { VisualAsset } from "@/lib/visualAsset";

/**
 * 에셋 원본 편집 창.
 *
 * 공용 에셋과 보유 에셋이 **같은 창** 을 씁니다. 다른 것은 파일이 들어가는 폴더와
 * 이름 규칙(`folder`)뿐입니다 — 공용은 제 폴더(`character/공용에셋/<이름>`)에 `이름_001`,
 * 보유는 주인 폴더에 `주인_에셋_001`(규칙 5). 창을 두 벌로 두면 규칙 하나를 고칠 때
 * 한쪽을 빠뜨립니다(규칙 1).
 *
 * 머리는 캐릭터 원본 편집 창(`CharacterCard`)과 같은 얼개입니다 — 번호 배지·썸네일·이름·
 * 갈래 칩·«분석완료» 칩·휴지통. 설계서 05 「모달 머리: [① 배지][이름] + ✕」, 로드맵 09
 * 「원본 카드 머리가 세 벌 — 캐릭터에만 배지·칩」 지적을 여기서 맞춥니다(규칙 2).
 *
 * 예전 관리 창(`AssetLibraryDialog`)은 목록 전체의 카드를 한꺼번에 마운트해 폴더를 전부
 * 읽었습니다. 이 창은 **편집 중인 하나만** 마운트합니다 — `usePromptCard` 의 폴더 읽기가
 * 마운트당 한 번이라, 여럿을 띄우면 patch 가 여러 번 들어옵니다.
 */
export default function AssetEditorDialog({
  asset,
  rootIndex,
  folder,
  claimedPaths,
  reservedStems,
  onPatch,
  onRemove,
  onClose,
}: {
  asset: VisualAsset;
  /** 계보 패널의 번호와 같은 번호. 「①」 로 뜹니다 */
  rootIndex: number;
  /** 파일이 들어갈 폴더와 이름 규칙. `useEntityLineage.folderFor` 가 줍니다 */
  folder: LineageFolder;
  /** 다른 카드(주인·형제 에셋)가 쓰는 파일. 폴더 읽기에서 건너뛰고, X 로 빼도 파일은 남깁니다 */
  claimedPaths: () => Set<string>;
  /** 다른 항목(주인 변형·다른 원본·형제 에셋)이 이미 쓰는 접두 — `useEntityLineage.reservedFor`. 겹치면 이름을 되돌립니다 */
  reservedStems?: () => string[];
  onPatch: (updater: (current: VisualAsset) => Partial<VisualAsset>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { projectName, projectContext, renamePaths } = useProjectMedia();

  /**
   * 보유 에셋의 이름이 바뀌면 파일 접두(`냥이_단검_`)도 따라갑니다. **창을 닫을 때 한 번.**
   * 공용 에셋은 `folder.stemBase` 가 없어 훅이 아무것도 안 합니다 — 폴더째 옮기는 것은
   * 저장 때 `syncOwnerFolders` 몫입니다. 닫기 규칙(중복 막기·실패 시 되돌리기)은 다른 원본
   * 창과 같은 훅 — 여기 따로 두면 규칙 하나를 고칠 때 한쪽을 빠뜨립니다(규칙 1).
   */
  const { patch, finish } = useOwnedEditorClose<VisualAsset>({
    projectName,
    folder,
    entity: asset,
    foreignPaths: claimedPaths,
    renamePaths,
    onPatch,
    onClose,
    reservedStems,
  });

  const card = usePromptCard<VisualAsset>({
    kind: "asset",
    entity: asset,
    patch,
    name: asset.name,
    /*
      보유 에셋(stemBase 있음)은 주인 폴더 안이라 변형처럼 **자기 접두 파일만** 줍습니다.
      이름을 아직 안 적었으면 접두는 `냥이_에셋`(folderFor) — 주인 파일을 제 것으로 주우면
      안 되니까요. 공용 에셋은 제 폴더라 전부 제 것입니다.
    */
    scope: folder.stemBase ? "variation" : undefined,
    stem: folder.stemBase,
    // 주인·형제 에셋 파일에 더해 **내 변형** 의 파일도 남의 것입니다 — 접두가 `냥이_단검_` 로
    // 같아서(`냥이_단검_겨울_001`) 안 가리면 변형 그림이 원본 목록에 붙습니다.
    claimedPaths: () =>
      new Set([
        ...claimedPaths(),
        ...(asset.variations || [])
          .flatMap((item) => [...(item.references || []), ...(item.generatedImages || [])])
          .map((image) => image.filePath)
          .filter((path): path is string => Boolean(path)),
      ]),
    description: [asset.category, asset.description].filter(Boolean).join(" — "),
    projectName,
    projectContext,
    referenceAssetType: folder.referenceAssetType,
    ownerName: folder.ownerName,
    // 에셋 전용 분석 문구는 따로 없습니다 — 갈래마다 문구를 늘리면 가이드 문서만 늘고 관리가 안 됩니다.
    analysisTemplate: "character-analysis",
    analysisTask: "characterAnalysis",
    promptTemplate: "asset-prompt",
    promptTask: "assetPrompt",
  });

  const preview =
    asset.generatedImages?.find((image) => image.isPrimary) || asset.generatedImages?.[0];

  return (
    <Dialog open onOpenChange={(next: boolean) => !next && void finish()}>
      <DialogContent className={EDITOR_DIALOG} style={{ background: "oklch(0.13 0.009 265)" }}>
        <DialogTitle className="sr-only">{asset.name || "에셋"} 원본</DialogTitle>
        <DialogDescription className="sr-only">이 에셋의 기준이 되는 첫 그림을 만듭니다</DialogDescription>

        <section
          className="rounded-xl"
          style={{ background: "oklch(0.14 0.009 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
        >
          {/* 오른쪽 48px 는 비워 둡니다 — DialogContent 가 그 자리에 닫기 X 를
              자동으로 그립니다. 안 비우면 휴지통 위에 X 가 포개져서,
              지우려고 눌렀는데 창만 닫힙니다. (캐릭터 창과 같은 규칙) */}
          <div className="flex items-center gap-2 py-2.5 pl-3 pr-12">
            {/* 계보의 번호와 같은 번호 — 어느 카드를 열었는지 잇습니다. 에셋은 초록. */}
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: "oklch(0.70 0.15 160 / 25%)", color: "oklch(0.84 0.15 160)" }}
            >
              {rootIndex}
            </span>

            <div
              className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"
              style={{ background: "oklch(0.10 0.006 265)" }}
            >
              {preview ? (
                <img src={card.previewOf(preview)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-4 w-4" style={{ color: "oklch(0.32 0.01 265)" }} />
                </div>
              )}
            </div>

            <p className="min-w-0 truncate text-sm font-semibold text-white">
              {asset.name || "이름 없는 에셋"}
            </p>
            {/* 갈래(소품·의상)가 캐릭터의 역할 칩 자리에 옵니다. */}
            {asset.category && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: "oklch(1 0 0 / 8%)", color: "oklch(0.72 0.01 265)" }}
              >
                {asset.category}
              </span>
            )}
            {!!asset.analysis?.trim() && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: "oklch(0.70 0.15 160 / 18%)", color: "oklch(0.82 0.15 160)" }}
              >
                분석완료
              </span>
            )}
            <span className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={onRemove}
              aria-label="지우기"
              className="shrink-0 rounded p-1.5 hover:bg-white/10"
              style={{ color: "oklch(0.60 0.15 25)" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
            <PromptCardBody
              // 기본 정보는 레퍼런스 스트립 오른쪽. 캐릭터와 같은 배치입니다.
              fields={
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={asset.name}
                    onChange={(event) => onPatch(() => ({ name: event.target.value }))}
                    placeholder="이름 (예: 낡은 가죽 가방)"
                    className="w-full rounded-md px-2.5 py-2 text-xs outline-none"
                    style={fieldStyle}
                  />
                  <input
                    value={asset.category || ""}
                    onChange={(event) => onPatch(() => ({ category: event.target.value }))}
                    placeholder="갈래 (예: 소품, 의상)"
                    className="w-full rounded-md px-2.5 py-2 text-xs outline-none"
                    style={fieldStyle}
                  />
                </div>
              }
              descriptionLabel="에셋 묘사 — 분석 결과와 합산됩니다"
              descriptionPlaceholder="모양과 재질. 크기도 함께 적으면 좋습니다"
              kind="asset"
              /*
                레퍼런스를 자르거나 표시한 결과도 `folder` 규칙을 따라야 합니다. 이게 없으면 `SheetPanelCropper`
                가 에셋 이름으로 폴더를 잡아 보유 에셋의 잘라낸 칸이 `character/공용에셋/<에셋>/` 로 갑니다 —
                주인 폴더 읽기·이름 바꾸기·주인 지우기가 전부 못 보는 파일(규칙 5·3 위반, 검토 2026-09-08).
                생성 이미지 선반(`GeneratedImageShelf`)과 같은 폴더·접두입니다.
              */
              cropSave={{
                ownerName: folder.ownerName,
                assetType: folder.generatedAssetType,
                stem: folder.stemBase,
                onSaved: (files) =>
                  patch((current) => ({
                    generatedImages: [
                      ...current.generatedImages,
                      // thumb 은 방금 구운 blob — 저장된 파일을 앱이 못 읽을 때 액박 대신 보여 줄 폴백.
                      ...files.map((file) => ({ id: uid(), name: file.name, thumb: file.thumb ?? "", file: null, filePath: file.path })),
                    ],
                  })),
              }}
              entity={asset}
              patch={patch}
              card={card}
              name={asset.name}
              analysisTemplate="character-analysis"
              sheetCaption="Asset reference"
              promptCaption="물건 기준 + 구성에서 고른 칸 + 모델별 문법"
              promptTemplate="asset-prompt"
            />

            <GeneratedImageShelf
              images={asset.generatedImages}
              onChange={(update) => patch((current) => ({ generatedImages: update(current.generatedImages) }))}
              assetLabel={asset.name || "에셋"}
              // 폴더·이름 규칙은 `folder` 하나에서. 보유 에셋이면 주인 폴더에 «주인_에셋_001».
              ownerName={folder.ownerName}
              stem={folder.stemBase}
              assetType={folder.generatedAssetType}
              cropKind="asset"
            />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
