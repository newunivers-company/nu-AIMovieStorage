import { DEFAULT_ASSET_BLUEPRINT } from "@/lib/blueprint";
import type { PromptVariationState, PromptWorkflowState } from "@/lib/promptWorkflow";
import type { SavedPromptEntry } from "@/lib/promptHistory";

/**
 * 에셋 — 소품·무기·의상처럼 인물·장소에 딸린 물건.
 *
 * 두 종류가 있습니다.
 *
 * - **공용 에셋** (`draft.sharedAssets`): 여러 캐릭터·배경이 함께 쓰는 것.
 * 같은 가방을 인물마다 다시 만들면 조금씩 달라지고, 결국 한 작품 안에 같은
 * 물건이 여러 개가 됩니다. 한 번 만들어 두고 어느 시트에서든 불러 씁니다.
 * 폴더는 `character/공용에셋/<이름>/` 으로 따로 둡니다 — 캐릭터 폴더 밑에 두면
 * 그 캐릭터를 지울 때 같이 사라지니까요.
 * - **보유 에셋** (`character.assets` · `background.assets`): 한 인물·장소만 쓰는
 * 전용 무기·소품. 파일은 **주인 폴더 안** 에 «주인_에셋_번호» 로 들어갑니다(규칙 5).
 * ()
 *
 * 안쪽의 «레퍼런스 → 분석 → 프롬프트» 흐름은 캐릭터·배경과 **똑같습니다.**
 *
 * 이 타입이 `lib/` 에 있는 이유: `projectTypes.ts`·`ProjectMediaContext.ts` 가 쓰는데,
 * 예전에는 `components/AssetLibraryDialog.tsx` 에 있어서 lib → components 로 거꾸로
 * 의존했습니다. 그 창을 없애면서(2026-09-08, 에셋 계보화) 여기로 옮겼습니다.
 */

export interface VisualAssetImage {
  id: string;
  name: string;
  thumb: string;
  file: File | null;
  filePath?: string;
  isPrimary?: boolean;
  isCompositeSheet?: boolean;
  sheetLabel?: string;
  /**
   * 마그니픽 후보함에서 채택한 그림의 원래 파일 이름.
   *
   * 마그니픽은 `magnific_프롬프트_식별자` 로 내려 주고, 우리는 채택하면서 «가방_001» 로
   * 바꿉니다. 어느 생성물이었는지 되짚을 때 이것만 남습니다(`GeneratedImageAsset` 과 같은 이유).
   * 에셋·에셋 변형에도 채택할 수 있게 되면서(2026-09-08) 여기에도 칸이 필요해졌습니다.
   */
  sourceName?: string;
}

export interface VisualAssetReference {
  id: string;
  name: string;
  thumb: string;
  file: File | null;
  filePath?: string;
  label?: string;
  isParentReference?: boolean;
}

/**
 * 에셋에서 갈라져 나온 판.
 *
 * 캐릭터·배경의 변형과 같은 모양입니다. 같은 가방인데 「낡은 판」 「새 판」
 * 처럼 갈래가 생기는 일이 잦고, 그때마다 새 에셋으로 만들면 원본과의
 * 관계가 끊겨 나중에 어느 것이 먼저인지 알 수 없습니다.
 */
export type VisualAssetVariation = PromptVariationState<VisualAssetReference, VisualAssetImage>;

export interface VisualAsset
  extends PromptWorkflowState<VisualAssetReference, VisualAssetImage> {
  id: string;
  name: string;
  /** 「소품」 「의상」 처럼 무엇의 갈래인지 */
  category?: string;
  description?: string;
  /** 받아 둔 프롬프트들 */
  promptHistory?: SavedPromptEntry[];
  /** 이 에셋에서 갈라져 나온 판들. 예전 데이터에는 없어서 물음표가 붙습니다 */
  variations?: VisualAssetVariation[];
}

export function newVisualAsset(): VisualAsset {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
    name: "",
    category: "",
    description: "",
    blueprint: [...DEFAULT_ASSET_BLUEPRINT],
    variations: [],
    references: [],
    generatedImages: [],
    promptKo: "",
    promptEn: "",
    negativeKo: "",
    negativeEn: "",
    promptModel: "nbpro",
    promptHistory: [],
    analysisHistory: [],
  };
}
