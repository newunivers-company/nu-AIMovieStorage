import AssetEditorDialog from "@/components/project/AssetEditorDialog";
import VariationDialog from "@/components/project/VariationDialog";
import type { EntityLineage } from "@/components/project/useEntityLineage";
import type { VisualAsset } from "@/lib/visualAsset";

/**
 * 에셋 계보가 여는 두 창 — 원본 편집(`AssetEditorDialog`)과 변형 편집(`VariationDialog`).
 *
 * 공용 에셋(`SharedAssetSection`)과 보유 에셋(`OwnedAssetLineage`)이 **이 하나** 를 씁니다.
 * 어느 창을 열지는 훅의 `editing` 이 정하고, 파일이 들어갈 폴더는 훅의 `folderFor` 가
 * 정합니다 — 공용이면 제 폴더, 보유면 주인 폴더. 여기서 갈래를 따로 알 필요가 없습니다.
 *
 * 열려 있는 창 하나만 마운트합니다. 폴더 읽기가 마운트마다 한 번이라서요.
 */
export default function AssetLineageDialogs({
  lineage,
  rootIndexOf,
}: {
  lineage: EntityLineage<VisualAsset>;
  /** 계보에 뜨는 번호. 원본 편집 창 머리의 「①」 이 됩니다 */
  rootIndexOf: (id: string) => number;
}) {
  const { editing, setEditing, openEntity: openAsset, patchEntity: patchAsset } = lineage;
  if (!openAsset || !editing) return null;

  if (editing.kind === "root") {
    return (
      <AssetEditorDialog
        asset={openAsset}
        rootIndex={rootIndexOf(openAsset.id)}
        folder={lineage.folderFor(openAsset)}
        claimedPaths={() => lineage.claimedFor(openAsset)}
        reservedStems={() => lineage.reservedFor(openAsset)}
        onPatch={(updater) => patchAsset(openAsset.id, updater)}
        onRemove={() => void lineage.remove(openAsset)}
        onClose={() => setEditing(null)}
      />
    );
  }

  const variation = (openAsset.variations || []).find((item) => item.id === editing.id);
  if (!variation) return null;
  const parent = (openAsset.variations || []).find((item) => item.id === variation.parentVariationId);
  // 변형의 변형이면 바로 위 판의 그림이 정체성 기준입니다.
  const source = parent?.generatedImages || openAsset.generatedImages;
  const folder = lineage.folderFor(openAsset);

  return (
    <VariationDialog
      open
      onOpenChange={(next: boolean) => !next && setEditing(null)}
      kind="asset"
      ownerName={openAsset.name || "에셋"}
      ownerDescription={openAsset.description || ""}
      parentImage={source.find((image) => image.isPrimary) || source[0] || null}
      ownerImages={openAsset.generatedImages}
      onOwnerImagesChange={(update) =>
        patchAsset(openAsset.id, (current) => ({ generatedImages: update(current.generatedImages || []) }))
      }
      ownerReferences={openAsset.references}
      ownerAnalysis={openAsset.analysis}
      siblings={openAsset.variations || []}
      variation={variation}
      onSave={(next) =>
        patchAsset(openAsset.id, (current) => ({
          variations: (current.variations || []).map((item) => (item.id === next.id ? next : item)),
        }))
      }
      /*
        보유 에셋의 변형은 kind="asset" 이지만 폴더는 주인 것입니다. `folder` 없이 열면
        변형 창이 kind 만 보고 `character/공용에셋/<에셋>/` 에 저장합니다(규칙 5 위반).
        이름을 아직 안 적은 에셋이면 «주인_에셋» 으로 — 주인 파일 `냥이_001` 과 겹치지 않게.
      */
      folder={
        lineage.owner
          ? {
              ownerName: folder.ownerName,
              referenceAssetType: folder.referenceAssetType,
              generatedAssetType: folder.generatedAssetType,
              stemBase: folder.stemBase ?? `${folder.ownerName}_${lineage.text.noun}`,
              claimedPaths: () => lineage.claimedFor(openAsset),
            }
          : undefined
      }
      // 에셋 전용 문구는 따로 없습니다. 원본 창과 같은 것을 씁니다 —
      // 갈래마다 문구를 늘리면 가이드 문서만 늘고 관리가 안 됩니다.
      analysisTemplate="character-analysis"
      analysisTask="characterAnalysis"
      promptTemplate="asset-prompt"
      promptTask="assetPrompt"
    />
  );
}
