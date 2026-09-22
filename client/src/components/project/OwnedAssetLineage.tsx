import { useRef } from "react";
import { Package, Plus, X } from "lucide-react";
import LineageTree, { LINEAGE_ROOT, lineageNodes } from "@/components/project/LineageTree";
import AssetLineageDialogs from "@/components/project/AssetLineageDialogs";
import { lineageAccent } from "@/components/project/lineageGrid";
import { useEntityLineage } from "@/components/project/useEntityLineage";
import { useProjectMedia } from "@/components/project/ProjectMediaContext";
import { renameOwnedAssetFiles } from "@/components/project/useOwnedAssetRename";
import { ownedAssetStem } from "@/lib/assetStem";
import { newVisualAsset, type VisualAsset } from "@/lib/visualAsset";

/** 인물·장소 패널이 「보유 애셋」 상자에 넘기는 것. `EntityLineagePanel` 의 `ownedAssets` */
export interface OwnedAssetsProps {
  /** 주인. 파일이 이 주인의 폴더에 «주인_에셋_번호» 로 들어갑니다(규칙 5) */
  owner: { kind: "character" | "background"; name: string };
  assets: VisualAsset[];
  /**
   * 주인(과 그 변형)이 쓰는 파일 전부. 같은 폴더를 쓰니 폴더를 다시 읽을 때 주인 파일을
   * «내 것» 으로 줍지 않게 합니다. 함수로 넘깁니다 — effect 의존성에 넣지 않으니
   * 매 렌더 새 함수여도 괜찮습니다.
   */
  ownerPaths: () => Set<string>;
  /**
   * 주인 변형과 다른 원본이 **이미 쓰는 접두**(«냥이_겨울») — `ownerReservedStems`. 보유 애셋 «겨울» 은
   * 접두가 같아 파일 이름 공간이 하나가 됩니다. 새 이름의 접두가 여기 있으면 파일이 없어도 거부합니다.
   */
  reservedStems?: () => string[];
  /** 지금 목록을 받아 다음 목록을 만드는 함수. 값으로 넘기면 안 됩니다 */
  onChange: (updater: (current: VisualAsset[]) => VisualAsset[]) => void;
}

/**
 * 「보유 애셋」 상자 — 인물·장소 패널 안의 **미니 계보 목록**.
 *
 * 예전에는 60px 썸네일을 늘어놓고 누르면 관리 창(`AssetLibraryDialog`)이 열렸습니다.
 * 지시 115(08/26)도 같은 말이었습니다 — 「캐릭터랑 배경 페이지에서
 * 카드형태로 분류하고 부모 자식...에셋 정리 하는 부분 반영 안됐네」.
 *
 * 에셋마다 이름 줄(이름 칸 + X) 밑에 작은 계보(원본 → 변형)가 붙습니다. 카드를 누르면
 * 공용 에셋과 **같은 편집 창** 이 열립니다(`AssetLineageDialogs`). 계보 조작은 캐릭터·
 * 배경·공용 에셋과 같은 `useEntityLineage` 이고, `owner` 를 줘서 폴더만 주인 것으로 돌립니다.
 *
 * 원본 카드에는 X 가 없으므로(`LineageTree`) 에셋을 지우는 길은 **이름 줄의 X** 뿐입니다.
 * 이걸 빼면 보유 에셋을 지울 방법이 없어집니다.
 */
export default function OwnedAssetLineage({ owner, assets, ownerPaths, reservedStems, onChange }: OwnedAssetsProps) {
  const { projectName, renamePaths } = useProjectMedia();
  const accent = lineageAccent("asset");

  const lineage = useEntityLineage<VisualAsset>({
    kind: "asset",
    entities: assets,
    projectName,
    onChange,
    owner: { kind: owner.kind, name: owner.name, claimedPaths: ownerPaths, reservedStems },
  });
  const { setEditing, patchEntity: patchAsset } = lineage;

  /**
   * 이름 칸에 커서가 들어올 때의 이름(에셋 id 별). 커서가 빠질 때 이것과 다르면 파일 접두를
   * 따라 바꿉니다. 글자마다 바꾸면 「겨」「겨울」 파일이 줄줄이 생기고 확인 창이 계속 뜹니다 —
   * 커서가 빠지는 순간이 «다 적었다» 는 뜻입니다(원본 편집 창은 닫을 때, 같은 함수).
   */
  const focusName = useRef<Record<string, string>>({});
  const followRename = (asset: VisualAsset) => {
    const before = focusName.current[asset.id];
    if (before === undefined || before.trim() === asset.name.trim()) return;
    const folder = lineage.folderFor(asset);
    void renameOwnedAssetFiles({
      projectName,
      folder,
      asset,
      oldStems: [ownedAssetStem(folder.ownerName, before)],
      newName: asset.name,
      foreignPaths: lineage.claimedFor(asset),
      renamePaths,
      // 주인 변형·다른 원본·형제 에셋과 같은 이름은 파일이 없어도 거부 — 접두가 같으면 그때부터 섞입니다.
      reservedStems: lineage.reservedFor(asset),
    }).then((outcome) => {
      // 취소·충돌이면 폴더가 진실입니다 — 화면 이름을 파일 접두의 이름(없으면 커서 들어올 때 이름)으로.
      if (!outcome.ok) patchAsset(asset.id, () => ({ name: outcome.revertName ?? before }));
    });
  };

  // «애셋 생성» 은 관리 창이 아니라 바로 새 보유 애셋을 만들어 엽니다.
  const create = () => {
    const created = newVisualAsset();
    onChange((current) => [...current, created]);
    setEditing({ entityId: created.id, kind: "root" });
  };

  return (
    <div
      className="mt-3 rounded-lg p-3"
      style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(0.70 0.15 160 / 22%)" }}
    >
      <div className="flex items-center gap-2">
        <Package className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
        <p className="shrink-0 text-[11px] font-semibold" style={{ color: "oklch(0.82 0.15 160)" }}>
          보유 애셋
        </p>
      </div>

      {assets.length === 0 ? (
        <p className="mt-1.5 text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          아직 등록된 애셋이 없습니다.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {assets.map((asset, index) => (
            <div key={asset.id}>
              {/* 이름 줄. 인물 패널 머리(이름 칸 + X)와 같은 모양을 작게. */}
              <div className="mb-1.5 flex items-center gap-1.5">
                <input
                  value={asset.name}
                  onChange={(event) => patchAsset(asset.id, () => ({ name: event.target.value }))}
                  onFocus={() => {
                    focusName.current[asset.id] = asset.name;
                  }}
                  onBlur={() => followRename(asset)}
                  placeholder="에셋 이름"
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[11px] font-bold outline-none"
                  style={{ color: "white" }}
                />
                <button
                  type="button"
                  onClick={() => void lineage.remove(asset)}
                  aria-label={`${asset.name || "이름 없는 에셋"} 지우기`}
                  className="shrink-0 rounded-md p-1 hover:bg-white/10"
                  style={{ color: "oklch(0.66 0.16 25)" }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <LineageTree
                compact
                nodes={lineageNodes({
                  name: asset.name,
                  rootImages: asset.generatedImages,
                  variations: asset.variations || [],
                  rootIndex: index + 1,
                  unnamed: "이름 없는 에셋",
                })}
                accent={accent}
                onOpen={(id) =>
                  setEditing(
                    id === LINEAGE_ROOT
                      ? { entityId: asset.id, kind: "root" }
                      : { entityId: asset.id, kind: "variation", id },
                  )
                }
                onBranch={(id) => lineage.branch(asset, id === LINEAGE_ROOT ? null : id)}
                onRemove={(id) => void lineage.removeVariation(asset, id)}
                onDropImages={(id, files) => lineage.dropImages(asset, id === LINEAGE_ROOT ? null : id, files)}
              />
            </div>
          ))}
        </div>
      )}

      {/* «애셋 생성» 은 목록 끝에 — 아래로 길어지니 위에 두면 오르내립니다. */}
      <button
        type="button"
        onClick={create}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold"
        style={{ border: "1px dashed oklch(0.70 0.15 160 / 40%)", color: "oklch(0.84 0.15 160)" }}
      >
        <Plus className="h-2.5 w-2.5" /> 애셋 생성
      </button>

      <AssetLineageDialogs
        lineage={lineage}
        rootIndexOf={(id) => assets.findIndex((item) => item.id === id) + 1}
      />
    </div>
  );
}
