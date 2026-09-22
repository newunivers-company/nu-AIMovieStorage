import { useState } from "react";
import { toast } from "sonner";
import { expectEmptyProjectSave } from "@/lib/localProjectStore";
import { confirmDialog } from "@/components/ConfirmDialog";
import { createPromptVariation, type PromptVariationState } from "@/lib/promptWorkflow";
import { attachGeneratedImages } from "@/lib/generatedImages";
import {
  deleteOwnerFolder,
  deleteProjectMediaFile,
  deleteVariationFiles,
  collectFilePaths,
  type ProjectAssetType,
} from "@/lib/mediaLibrary";
import { uid, type GeneratedImageAsset, type ReferenceImage } from "@/lib/projectTypes";
import { alternateStem, ownedAssetStem, variationStemOf } from "@/lib/assetStem";

/** 계보를 가진 갈래. 셋 다 같은 훅을 씁니다 */
export type LineageKind = "character" | "background" | "asset";

/**
 * 갈래별로 다른 것 전부.
 *
 * 문구를 여기 모아 두는 이유는, 확인 창의 문장이 «화면에서 지우면 폴더도 지운다»
 * 는 약속을 사람에게 알리는 자리라서입니다. 갈래마다 문장이 흩어져 있으면
 * 한쪽만 고쳐져서 어느 갈래는 경고 없이 파일을 지우게 됩니다.
 */
export const KIND_TEXT = {
  character: {
    /** 이름이 비어 있을 때 폴더 이름과 창 제목에 쓰는 말 */
    noun: "인물",
    unnamed: "이름 없는 인물",
    /** 「~을 지울까요?」 의 조사. 글자를 그대로 유지합니다 — 화면 문구가 바뀌면 안 됩니다 */
    particle: "을",
    removeLoses: "이 인물의 레퍼런스·생성 이미지·변형·시트가 모두 사라집니다.",
    referenceAssetType: "character-reference",
    generatedAssetType: "character-generated",
  },
  background: {
    noun: "장소",
    unnamed: "이름 없는 장소",
    particle: "를",
    removeLoses: "이 장소의 레퍼런스·생성 이미지·변형·시트가 모두 사라집니다.",
    referenceAssetType: "background-reference",
    generatedAssetType: "background-generated",
  },
  asset: {
    noun: "에셋",
    unnamed: "이름 없는 에셋",
    particle: "을",
    // 공용 에셋은 시트를 만들지 않아서 «시트» 가 빠집니다.
    removeLoses: "이 에셋의 레퍼런스·생성 이미지·변형이 모두 사라집니다.",
    referenceAssetType: "asset-reference",
    generatedAssetType: "asset-generated",
  },
} as const satisfies Record<
  LineageKind,
  {
    noun: string;
    unnamed: string;
    particle: string;
    removeLoses: string;
    referenceAssetType: "character-reference" | "background-reference" | "asset-reference";
    generatedAssetType: "character-generated" | "background-generated" | "asset-generated";
  }
>;

/** 변형 한 판. 캐릭터·배경의 변형은 여기에 sheetLayouts 가 더 붙지만 훅은 그걸 만지지 않습니다 */
export type LineageVariation = PromptVariationState<ReferenceImage, GeneratedImageAsset>;

/**
 * 이 훅이 다루는 공통 모양. 캐릭터·배경·공용 에셋이 전부 이 모양을 갖습니다.
 *
 * 공용 에셋의 `references`·`generatedImages` 는 이름이 다른 타입이지만
 * 칸이 같아서 그대로 들어옵니다.
 */
export interface LineageEntity {
  id: string;
  name: string;
  promptModel?: string;
  references: ReferenceImage[];
  generatedImages: GeneratedImageAsset[];
  /** 예전 공용 에셋 데이터에는 없어서 물음표가 붙습니다 */
  variations?: LineageVariation[];
}

/**
 * 훅이 스스로 고치는 칸.
 *
 * `Partial<T>` 만으로는 안 됩니다 — T 는 갈래마다 다른 타입이라 TS 가
 * 「`{ variations: … }` 가 Partial<T> 에 들어간다」 를 증명하지 못합니다.
 * 그래서 공통 칸만 따로 모양을 두고, 스프레드 결과(`T & …`)가 T 로 돌아가게 합니다.
 * 캐스트 없이 되는 유일한 길입니다.
 */
export type LineagePatch = Partial<Pick<LineageEntity, "name" | "variations" | "generatedImages">>;

/** 지금 창으로 열어 둔 것. 원본이면 kind="root", 변형이면 그 id. */
export type LineageEditing =
  | { entityId: string; kind: "root" }
  | { entityId: string; kind: "variation"; id: string }
  | null;

/**
 * 보유 에셋의 주인(인물·장소).
 *
 * 보유 에셋은 제 폴더가 없습니다. **주인 폴더 안** 에 «주인_에셋_번호» 로 들어갑니다(규칙 5:
 * 폴더는 인물당 하나). 그래서 이 훅이 폴더·파일 이름·지우기 범위를 정할 때 주인을 알아야 합니다.
 */
export interface LineageOwner {
  kind: "character" | "background";
  name: string;
  /**
   * 주인(과 그 변형)이 쓰는 파일 전부. 같은 폴더를 쓰니 폴더를 다시 읽을 때 주인 파일을
   * «내 것» 으로 줍지 않게 하고, 변형을 지울 때 정체성 기준이 가리키는 주인 파일은 남깁니다.
   */
  claimedPaths?: () => Set<string>;
  /**
   * 이름을 아직 안 적은 항목의 접두 낱말. 없으면 «에셋»(`OWNED_ASSET_PLACEHOLDER`).
   *
   * 다른 원본은 «원본»(`ALTERNATE_PLACEHOLDER`) — 보유 에셋과 같은 «에셋» 을 쓰면 이름 없는
   * 원본과 이름 없는 에셋의 파일이 폴더에서 섞여, 이름을 적을 때 서로의 파일을 가져갑니다.
   */
  placeholder?: string;
  /**
   * 주인 쪽에서 **이미 쓰는 파일 접두** — 주인 변형(«숲_겨울»), 보유 에셋(«숲_제단»), 다른 원본(«숲_겨울»).
   *
   * 다른 원본과 주인 변형의 접두 규칙이 같아서(`숲_겨울`) 이름만 같으면 파일 이름 공간이 하나가
   * 됩니다 — 변형 창이 다른 원본의 파일을 제 것으로 줍고, 이름 바꾸기가 남의 파일까지 끌고 갑니다
   * 파일이 아직 없을 때는 접두 충돌 검사(`renameOwnedAssetFiles` 의 foreignPaths)가
   * 잡지 못하므로, 새 이름의 접두가 여기 있으면 **파일이 없어도** 거부합니다.
   */
  reservedStems?: () => string[];
}

/**
 * 한 항목의 파일이 어디에 어떤 이름으로 들어가는지.
 *
 * 공용 에셋·인물·장소는 제 폴더(`ownerName` = 제 이름)에 `이름_001`. 보유 에셋만 주인 폴더에
 * `주인_에셋_001` 이라 `stemBase` 가 따로 있습니다. 이름을 아직 안 적은 보유 에셋은 `stemBase`
 * 가 없습니다 — 그때 저장하면 `냥이_001` 이 되어 주인 파일과 섞이므로 부르는 쪽이 막습니다.
 */
export interface LineageFolder {
  referenceAssetType: ProjectAssetType;
  generatedAssetType: ProjectAssetType;
  /** 폴더 이름 */
  ownerName: string;
  /** 파일 이름 앞부분. 보유 에셋·다른 원본에만(«주인_에셋» · «주인_원본»). 없으면 폴더 이름 그대로 */
  stemBase?: string;
  /**
   * `stemBase` 를 만들 때 쓴 자리표시(«에셋» · «원본»). `LineageOwner.placeholder` 가 실려 옵니다.
   * 이름 바꾸기가 «자리표시에서 진짜 이름으로 가는 것은 묻지 않는다» 를 판단할 때 같은 낱말을 봐야 합니다.
   */
  placeholder?: string;
}

/** `collectFilePaths` 가 받는 모양 — 원본 하나(와 그 변형)의 파일 주머니 */
type FileBag = Parameters<typeof collectFilePaths>[0];

/**
 * 주인(인물·장소)이 폴더 안에서 «제 것» 으로 갖는 파일 — 원본·변형에 더해, 옵션으로
 * 보유 에셋(과 변형)·다른 원본(과 변형)까지.
 *
 * 보유 에셋 상자와 다른 원본 상자가 **서로 제 것을 넣지 않게** 옵션을 둡니다. 두 상자는
 * 각자의 훅 `claimedFor` 가 형제를 빼 주는데, 주인 쪽 목록에 제 파일이 들어 있으면 그것을
 * 남의 것으로 봐서 X 로 빼도 파일이 안 지워집니다(규칙 3 위반). 그래서 에셋 상자에는
 * 다른 원본만, 다른 원본 상자에는 에셋만 얹어 넘깁니다.
 *
 * `includeSelf: false` 면 주인 원본의 파일(references·generatedImages)은 빼고 변형부터 —
 * 주인 원본 편집 창이 «남의 것» 목록을 만들 때 씁니다(제 파일이 남의 것이 되면 안 되니까요).
 * `includeVariations: false` 면 주인 변형의 파일도 뺍니다 — 주인 변형 창이 «남의 것» 을 만들 때
 * 씁니다(제 파일과 형제 변형은 창이 따로 셉니다). 둘 다 false 면 에셋·다른 원본만 남습니다.
 */
export function ownerClaimedPaths(
  entity: FileBag & { assets?: FileBag[]; alternates?: FileBag[] },
  opts: { includeAssets: boolean; includeAlternates: boolean; includeSelf?: boolean; includeVariations?: boolean },
): Set<string> {
  const out = new Set<string>();
  const merge = (paths: Set<string>) => paths.forEach((path) => out.add(path));
  if (opts.includeSelf !== false) merge(collectFilePaths({ ...entity, variations: [] }));
  if (opts.includeVariations !== false) {
    for (const variation of entity.variations || []) merge(collectFilePaths(variation));
  }
  if (opts.includeAssets) for (const asset of entity.assets || []) merge(collectFilePaths(asset));
  if (opts.includeAlternates) for (const alternate of entity.alternates || []) merge(collectFilePaths(alternate));
  return out;
}

/** `ownerReservedStems` 가 받는 모양 — 이름만 있으면 됩니다 */
type NamedBag = { name?: string; variations?: { name?: string }[]; assets?: { name?: string }[]; alternates?: { name?: string }[] };

/**
 * 주인 폴더 안에서 **이미 쓰이는 파일 접두** — 주인 변형 «숲_겨울», 보유 에셋 «숲_제단», 다른 원본 «숲_겨울».
 *
 * 셋의 접두 규칙이 같아서 이름이 같으면 폴더 안에서 파일 이름 공간이 하나가 됩니다.
 * 파일이 생긴 뒤에는 접두 충돌 검사가 잡지만, **파일이 아직 없을 때** 같은 이름을 적는 것은 아무도
 * 안 막아 이후 저장부터 번호를 나눠 쓰기 시작합니다. 그래서 이름을 정하는 자리(다른 원본·보유 에셋의
 * 이름 줄과 창 닫기, 주인 변형 창)가 이 목록과 견주어 같으면 거부합니다. 각 상자는 **제 갈래를 빼고**
 * 넘깁니다 — 형제끼리는 훅의 `reservedFor` 가 따로 봅니다.
 *
 * `ownerName` 은 폴더 이름(`folderFor` 의 ownerName) — 접두 규칙은 `assetStem.ts` 것을 그대로 씁니다.
 * 이름 없는 변형은 접두가 주인 이름 그대로라(«숲») 다른 이름과 겹칠 수 없어 뺍니다.
 */
export function ownerReservedStems(
  entity: NamedBag,
  ownerName: string,
  opts: { includeVariations: boolean; includeAssets: boolean; includeAlternates: boolean },
): string[] {
  const out: string[] = [];
  if (opts.includeVariations) {
    for (const variation of entity.variations || []) {
      if (variation.name?.trim()) out.push(variationStemOf(ownerName, variation.name));
    }
  }
  if (opts.includeAssets) for (const asset of entity.assets || []) out.push(ownedAssetStem(ownerName, asset.name));
  if (opts.includeAlternates) for (const alternate of entity.alternates || []) out.push(alternateStem(ownerName, alternate.name));
  return out;
}

/**
 * 계보(원본 + 변형) 를 다루는 공통 훅.
 *
 * # 왜 훅 하나인가
 *
 * 「캐릭터에만 생기고 배경에는 없는 기능이 생기면 안 됩니다」 (CLAUDE.md 규칙 1)
 * 가 이 훅의 존재 이유입니다. 지우기·변형 만들기·변형 지우기·그림 떨구기가
 * 캐릭터·배경·공용 에셋 세 파일에 글자만 다르게 복사돼 있었고, 규칙 하나를
 * 고칠 때마다 세 번 고쳐야 했습니다. 실제로 «변형을 지울 때 파일도 지우기»
 * 를 세 번 고쳤습니다. 한 군데를 빠뜨리면 그 갈래만 예전 동작으로
 * 남고, 아무도 모릅니다.
 *
 * 갈래마다 다른 것은 `KIND_TEXT` 표 하나뿐입니다 — 폴더 종류, 이름이 없을 때
 * 부르는 말, 확인 문구의 낱말. 로직은 한 벌입니다.
 */
export function useEntityLineage<T extends LineageEntity>({
  kind,
  entities,
  projectName,
  onChange,
  owner,
}: {
  kind: LineageKind;
  entities: T[];
  projectName: string;
  /**
   * 목록을 고칩니다. **지금 목록을 받아 다음 목록을 만드는 함수** 여야 합니다.
   *
   * 값으로 덮어쓰면, LLM 요청이 도는 사이에 카드를 더하거나 지웠을 때
   * 나중에 도착한 갱신이 그 사이 변경을 통째로 지웁니다.
   */
  onChange: (updater: (current: T[]) => T[]) => void;
  /**
   * 보유 에셋·다른 원본일 때만. 파일은 주인 폴더 안(규칙 5), 이름은 «주인_에셋[_변형]» · «주인_원본[_변형]».
   *
   * 이게 없이 보유 에셋에 이 훅을 쓰면 `remove` 가 `character/공용에셋/<에셋이름>` 을 통째로
   * 지웁니다 — 같은 이름의 **공용** 에셋 폴더가 날아가고 정작 인물 폴더 안 파일은 남습니다.
   */
  owner?: LineageOwner;
}) {
  const text = KIND_TEXT[kind];

  const [editing, setEditing] = useState<LineageEditing>(null);
  /** 지금 창으로 열어 둔 원본. 없으면 창이 닫혀 있는 것입니다 */
  const openEntity = editing && entities.find((item) => item.id === editing.entityId);

  /**
   * 이 항목의 파일이 들어갈 폴더와 이름 규칙.
   *
   * 주인이 없으면 갈래 폴더에 제 이름으로. 주인이 있으면(보유 에셋) 주인 폴더에 «주인_에셋».
   * 이 규칙은 원본 편집 창(`AssetEditorDialog`)·변형 창·떨구기·지우기가 전부 같이 씁니다 —
   * 한 곳이 다른 폴더를 보면 «저장은 됐는데 목록에는 없는» 파일이 생깁니다.
   */
  const folderFor = (entity: T): LineageFolder => {
    if (!owner) {
      return {
        referenceAssetType: text.referenceAssetType,
        generatedAssetType: text.generatedAssetType,
        ownerName: entity.name || text.noun,
        stemBase: undefined,
      };
    }
    const ownerName = owner.name || KIND_TEXT[owner.kind].noun;
    const name = entity.name?.trim();
    return {
      referenceAssetType: `${owner.kind}-reference`,
      generatedAssetType: `${owner.kind}-generated`,
      ownerName,
      // 주인 폴더를 같이 쓰니 이름에 에셋이 들어가야 폴더에서 구분됩니다(변형과 같은 규칙).
      // 이름을 아직 안 적었어도 접두는 있어야 합니다. 없으면 `냥이_001` 로 주인 파일과 섞이고,
      // 폴더 읽기가 주인 폴더 전체를 제 것으로 줍습니다. 임시 접두는 `냥이_에셋`.
      // 규칙 자체는 `assetStem.ts` 한 곳에 — 마그니픽 채택·이름 바꾸기가 같은 것을 씁니다.
      // 다른 원본은 자리표시가 «원본»(`냥이_원본`) — 에셋과 같은 낱말을 쓰면 폴더에서 섞입니다.
      stemBase: ownedAssetStem(ownerName, name, owner.placeholder),
      placeholder: owner.placeholder,
    };
  };

  /**
   * 이 항목이 아닌 카드들이 쓰는 파일: 주인 것 + 형제(와 그 변형) 것.
   *
   * 보유 에셋은 주인 폴더를 같이 쓰므로, 폴더를 다시 읽을 때 이것들을 «내 것» 으로 줍지
   * 않아야 합니다 — 안 그러면 갓 만든 에셋에 남의 레퍼런스가 이미 들어가 있습니다.
   * 공용 에셋은 제 폴더라 사실상 비어 있어도 무방합니다.
   */
  const claimedFor = (entity: T): Set<string> =>
    new Set([
      ...(owner?.claimedPaths?.() ?? []),
      ...entities
        .filter((item) => item.id !== entity.id)
        .flatMap((item) => [item, ...(item.variations || [])])
        .flatMap((item) => [...(item.references || []), ...(item.generatedImages || [])])
        .map((image) => image.filePath)
        .filter((path): path is string => Boolean(path)),
    ]);

  /**
   * 이 항목이 **쓰면 안 되는 접두**: 주인 쪽이 넘긴 것(`owner.reservedStems`) + 형제의 접두.
   *
   * 형제 둘이 같은 이름이면 같은 폴더에서 같은 접두를 나눠 씁니다(«냥이_겨울_001» 이 누구 것인지
   * 알 수 없음). `claimedFor` 가 형제의 **파일** 을 빼 주듯, 여기는 형제의 **접두** 를 막습니다 —
   * 파일이 아직 없어도. 주인이 없으면(공용 에셋·인물·장소) 제 폴더라 빈 목록입니다.
   */
  const reservedFor = (entity: T): string[] =>
    owner
      ? [
          ...(owner.reservedStems?.() ?? []),
          ...entities
            .filter((item) => item.id !== entity.id)
            .map((item) => folderFor(item).stemBase)
            .filter((stem): stem is string => Boolean(stem)),
        ]
      : [];

  /**
   * 카드 하나를 «지금 값을 받아» 고칩니다.
   *
   * 값으로 덮어쓰면, 요청이 도는 사이에 다른 카드를 만졌을 때 그 변경이
   * 사라집니다. 실제로 「분석 후 바로 특징 정하기를 눌렀더니 분석이 사라졌다」는
   * 일이 있었습니다. 캐릭터·배경·에셋 모두 같은 규칙입니다.
   *
   * 돌려주는 것이 `Partial<T> | LineagePatch` 인 이유는 `LineagePatch` 주석에.
   */
  const patchEntity = (id: string, updater: (current: T) => Partial<T> | LineagePatch) =>
    onChange((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updater(item) } : item)),
    );

  const remove = async (entity: T) => {
    /*
      **화면에서 지우면 폴더의 원본도 지웁니다.** (CLAUDE.md 규칙 3)

      예전에는 카드만 빼고 폴더를 남겼습니다. 그러면 다음에 폴더를 읽을 때
      되살아나고, 탐색기에는 쓰지 않는 인물 폴더가 쌓입니다. 지운 카드의 자료가
      그대로 남는 셈이라 두 번 같은 문제로 되돌아왔습니다.
      배경·공용 에셋도 같은 규칙입니다.
    */
    /*
      다른 원본(인물·장소인데 주인이 있음)은 갈래 문구를 그대로 쓰면 «이 인물의 … 시트가 모두 사라집니다» 가 되어
      주인을 통째로 지우는 줄 오해합니다. 실제로는 제 파일만 지우니 그렇게 말합니다.
      보유 에셋은 KIND_TEXT.asset 이 이미 «이 에셋의 …» 라 그대로입니다.
    */
    const alternate = owner && kind !== "asset";
    const ok = await confirmDialog({
      title: alternate
        ? `다른 원본 「${entity.name || "이름 없는 원본"}」 ${text.particle} 지울까요?`
        : `${entity.name || text.unnamed} ${text.particle} 지울까요?`,
      description:
        "저장 폴더의 원본 파일도 함께 지워집니다. 되돌릴 수 없습니다. " +
        (alternate
          ? `이 원본의 레퍼런스·생성 이미지·변형이 모두 사라집니다. 주인 「${owner.name || KIND_TEXT[owner.kind].noun}」 과 그 변형·애셋은 그대로입니다.`
          : text.removeLoses),
      confirmLabel: "지우기",
      tone: "danger",
    });
    if (!ok) return;
    if (owner) {
      /*
        보유 에셋은 주인 폴더에 섞여 있으니 **이 에셋의 파일만** 하나씩 지웁니다.

        폴더 통째 삭제(`deleteOwnerFolder`)를 쓰면 `character/공용에셋/<에셋이름>` 을 지웁니다 —
        같은 이름의 공용 에셋 폴더가 날아가고 정작 인물 폴더 안 파일은 남습니다(규칙 3 위반).
        마지막 하나여도 «전부 0» 저장 문제는 없습니다 — 주인이 남아 있으니까요.
      */
      onChange((current) => current.filter((item) => item.id !== entity.id));
      // 주인(과 형제)의 파일을 레퍼런스로 빌려 왔을 수 있습니다(변형 창의 «이 캐릭터의 그림» 줄).
      // 그것은 남의 파일이라 남깁니다 — `removeVariation` 의 keep 과 같은 규칙.
      const foreign = owner.claimedPaths?.() ?? new Set<string>();
      const paths = [...collectFilePaths(entity)].filter((path) => !foreign.has(path));
      void Promise.all(paths.map((path) => deleteProjectMediaFile(projectName, path)));
      return;
    }
    // 마지막 하나면 «전부 0» 저장이 막힙니다. 사람이 지운 것이니 통과시킵니다.
    expectEmptyProjectSave();
    onChange((current) => current.filter((item) => item.id !== entity.id));
    void deleteOwnerFolder({
      projectName,
      assetType: text.referenceAssetType,
      ownerName: entity.name || text.noun,
    });
  };

  /**
   * 변형을 만듭니다.
   *
   * `from` 이 있으면 그 판에서 갈라져 나옵니다. 원본이 아니라 **바로 위 판**을
   * 물어야 옷을 갈아입힌 상태에서 머리만 바꾸는 것이 되고, 에셋이라면
   * 「낡게 만든 것」 위에 「색만 바꾼 것」 이 됩니다.
   */
  const branch = (entity: T, fromId: string | null) => {
    const from = (entity.variations || []).find((item) => item.id === fromId);
    const created = createPromptVariation<ReferenceImage, GeneratedImageAsset>({
      id: uid(),
      parentVariationId: fromId || undefined,
      name: from ? `${from.name || "변형"} 에서` : "",
      promptModel: entity.promptModel,
      references: [],
      // 변형은 «무엇을 바꾸는지» 만 고르는 자리라 처음엔 전부 꺼 둡니다.
      // 원본과 같은 다섯 칸을 켜 두면 바꾸지도 않을 칸이 딸려 나옵니다.
      blueprint: [],
    });
    patchEntity(entity.id, (current) => ({ variations: [...(current.variations || []), created] }));
    setEditing({ entityId: entity.id, kind: "variation", id: created.id });
  };

  const removeVariation = async (entity: T, id: string) => {
    const variations = entity.variations || [];
    const target = variations.find((item) => item.id === id);
    const children = variations.filter((item) => item.parentVariationId === id);
    const ok = await confirmDialog({
      title: `${target?.name || "이름 없는 변형"} 을 지울까요?`,
      description: children.length
        ? `이 판에서 갈라진 변형 ${children.length}개는 남습니다. 위 판으로 올라붙습니다. 이 판의 그림은 자식이 기준으로 쓰고 있어 폴더에 남습니다.`
        : "저장 폴더의 원본 파일도 함께 지워집니다. 되돌릴 수 없습니다.",
      confirmLabel: "지우기",
      tone: "danger",
    });
    if (!ok) return;
    // 자식이 없으면 이 판만 쓰던 파일을 폴더에서도 지웁니다. 자식이 있으면 그 그림이
    // 자식의 정체성 기준이라 남깁니다. (규칙 3)
    if (!children.length && target) {
      // 보유 에셋의 변형은 정체성 기준이 주인 파일을 가리킬 수 있습니다. 그것도 남깁니다.
      const keep = new Set([...collectFilePaths(entity, id), ...(owner?.claimedPaths?.() ?? [])]);
      void deleteVariationFiles(projectName, target, keep);
    }
    patchEntity(entity.id, (current) => ({
      variations: (current.variations || [])
        .filter((item) => item.id !== id)
        // 부모를 잃은 자식은 한 단계 위로 올려 붙입니다. 안 그러면 미아가 됩니다.
        .map((item) =>
          item.parentVariationId === id
            ? { ...item, parentVariationId: target?.parentVariationId }
            : item,
        ),
    }));
  };

  /**
   * 계보 카드에 그림을 떨궜을 때. 그 판의 생성 이미지가 됩니다.
   *
   * `variationId` 가 null 이면 원본입니다. 원본과 변형이 폴더도 다르지 않고
   * 하는 일도 같아서, 어느 쪽으로 들어가는지만 갈라 줍니다.
   */
  const dropImages = (entity: T, variationId: string | null, files: FileList) => {
    const folder = folderFor(entity);
    const variationName = (entity.variations || []).find((item) => item.id === variationId)?.name?.trim();
    // 파일 이름 앞부분: 인물·공용 에셋은 «이름», 보유 에셋은 «주인_에셋».
    const base = folder.stemBase || folder.ownerName;
    void attachGeneratedImages({
      files,
      projectName,
      assetType: folder.generatedAssetType,
      ownerName: folder.ownerName,
      // 변형에 떨군 그림은 «인물_변형_001» 로. 폴더는 같아도 파일 이름에 어느 판인지 남아야 합니다.
      // 보유 에셋이면 «주인_에셋_변형_001» — 원본에 떨궈도 «주인_에셋_001» 로 접두가 필요합니다.
      stem: variationName ? `${base}_${variationName}` : folder.stemBase,
      patch: (updater) =>
        patchEntity(entity.id, (current) =>
          variationId === null
            ? updater(current)
            : {
                variations: (current.variations || []).map((item) =>
                  item.id === variationId
                    ? { ...item, ...updater({ generatedImages: item.generatedImages || [] }) }
                    : item,
                ),
              },
        ),
    });
  };

  /** 합성 시트에 사람이 붙인 이름을 바꿉니다. 「겨울 의상」 처럼 무엇의 판인지 적는 것 */
  const renameSheet = (entity: T, imageId: string, sheetLabel: string) =>
    patchEntity(entity.id, (current) => ({
      generatedImages: current.generatedImages.map((image) =>
        image.id === imageId ? { ...image, sheetLabel } : image,
      ),
    }));

  /**
   * 합성 시트를 지웁니다. 화면에서 빼면 폴더의 파일도 지웁니다(규칙 3).
   *
   * 한동안 만든 시트를 지울 길이 아예 없었습니다. 캐릭터·배경·공용 에셋
   * 패널이 같은 훅을 쓰므로 여기 한 번만 — 갈래마다 따로 두면 한쪽은 파일을 남깁니다.
   */
  const removeSheet = async (entity: T, imageId: string) => {
    const sheet = entity.generatedImages.find((image) => image.id === imageId);
    if (!sheet) return;
    const ok = await confirmDialog({
      title: `${sheet.sheetLabel || sheet.name} 을 지울까요?`,
      description: "저장 폴더의 원본 파일도 함께 지워집니다. 되돌릴 수 없습니다.",
      subject: sheet.filePath,
      confirmLabel: "지우기",
      tone: "danger",
    });
    if (!ok) return;
    patchEntity(entity.id, (current) => ({
      generatedImages: current.generatedImages.filter((image) => image.id !== imageId),
    }));
    if (sheet.filePath) {
      const removed = await deleteProjectMediaFile(projectName, sheet.filePath);
      // 파일이 남으면 폴더를 다시 읽을 때 되살아납니다. 조용히 넘기지 않습니다.
      if (!removed) toast.error("폴더의 파일은 지우지 못했습니다.", { description: sheet.filePath });
    }
  };

  return {
    /** 이 갈래의 낱말들. 창 제목·폴더 이름의 기본값이 필요할 때 씁니다 */
    text,
    /** 보유 에셋이면 그 주인. 편집 창이 폴더를 주인 것으로 돌릴 때 봅니다 */
    owner,
    editing,
    setEditing,
    openEntity,
    patchEntity,
    remove,
    branch,
    removeVariation,
    dropImages,
    renameSheet,
    removeSheet,
    folderFor,
    claimedFor,
    reservedFor,
  };
}

/** 훅이 돌려주는 것의 타입. 창 컴포넌트가 훅 결과를 통째로 받을 때 씁니다 */
export type EntityLineage<T extends LineageEntity> = ReturnType<typeof useEntityLineage<T>>;
