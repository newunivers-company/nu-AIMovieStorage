import type { VisualAsset } from "@/lib/visualAsset";
import type { GeneratedImageAsset, ReferenceImage } from "@/lib/projectTypes";
import { assetSrc } from "@/lib/mediaLibrary";

/**
 * 시트 창에 «넣을 그림» 으로 올릴 수 있는 것 하나.
 *
 * 그림 자체는 `GeneratedImageAsset` 모양 그대로(굽는 쪽이 id 로 찾습니다)이고,
 * 어디서 온 것인지(`group`) 를 붙입니다. 시트에는 인물뿐 아니라 그 인물이 든 에셋도
 * 같이 앉는데, 예전 목록은 원본·변형·공용 에셋의 생성 이미지뿐이라 보유 에셋과
 * 레퍼런스가 빠져 있었습니다.
 */
export type SheetSourceGroup = "원본" | "변형" | "다른 원본" | "보유 에셋" | "공용 에셋";

export type SheetSource = GeneratedImageAsset & {
  group: SheetSourceGroup;
  /** 변형 이름·에셋 이름·다른 원본 이름. 그룹 머리에 «보유 에셋 · 단검» «다른 원본 · 어린 시절» 처럼 붙습니다 */
  groupDetail?: string;
};

/** 다른 원본 하나의 최소 모양 — 원본과 같은 칸에 제 변형. 한 단계만이라 이 안의 alternates 는 안 봅니다 */
export interface SheetSourceAlternate {
  name?: string;
  generatedImages: GeneratedImageAsset[];
  references?: ReferenceImage[];
  variations?: { name?: string; generatedImages?: GeneratedImageAsset[] }[];
}

/** 모으는 쪽이 요구하는 최소 모양. 캐릭터·배경이 둘 다 맞습니다(규칙 1) */
export interface SheetSourceOwner {
  generatedImages: GeneratedImageAsset[];
  references?: ReferenceImage[];
  variations: { name?: string; generatedImages?: GeneratedImageAsset[] }[];
  assets?: VisualAsset[];
  /** 다른 원본(«어린 시절»). 시트에 같이 놓을 수 있어야 «성장 시트» 같은 것을 만듭니다 */
  alternates?: SheetSourceAlternate[];
}

/** 레퍼런스(올린 사진)를 그림 모양으로. 시트에는 «무엇이든 그림이면» 놓을 수 있어야 합니다 */
function fromReference(reference: {
  id: string;
  name: string;
  thumb: string;
  file: File | null;
  filePath?: string;
  label?: string;
  isParentReference?: boolean;
}): GeneratedImageAsset {
  return {
    id: reference.id,
    name: reference.label?.trim() || reference.name,
    thumb: reference.thumb,
    file: reference.file,
    filePath: reference.filePath,
  };
}

/**
 * 에셋(보유·공용) 하나의 그림 전부 — 원본 생성 이미지·레퍼런스, 그리고 변형의 것.
 *
 * 레퍼런스도 넣는 이유: 에셋은 «밖에서 뽑아 온 그림» 보다 «참고로 올린 사진» 이
 * 전부인 경우가 많습니다. 정체성 기준(부모를 다시 가리키는 것)은 중복이라 뺍니다.
 */
function assetSources(asset: VisualAsset, group: "보유 에셋" | "공용 에셋"): SheetSource[] {
  const assetName = asset.name?.trim() || "에셋";
  const tag = (image: GeneratedImageAsset, detail: string): SheetSource => ({ ...image, group, groupDetail: detail });
  const own = [
    ...(asset.generatedImages || []),
    ...(asset.references || []).filter((reference) => !reference.isParentReference).map(fromReference),
  ].map((image) => tag(image, assetName));
  const variations = (asset.variations || []).flatMap((variation) =>
    [
      ...(variation.generatedImages || []),
      ...(variation.references || []).filter((reference) => !reference.isParentReference).map(fromReference),
    ].map((image) => tag(image, `${assetName} › ${variation.name?.trim() || "변형"}`)),
  );
  return [...own, ...variations];
}

/**
 * 다른 원본 하나의 그림 — 생성 이미지와 부모 기준이 아닌 레퍼런스, 그다음 그 변형의 생성 이미지.
 * 레퍼런스를 넣는 이유는 에셋과 같습니다 — 사진만 올려 두고 그림은 아직 안 뽑은 원본이 흔합니다.
 */
function alternateSources(alternate: SheetSourceAlternate): SheetSource[] {
  const altName = alternate.name?.trim() || "이름 없음";
  const tag = (image: GeneratedImageAsset, detail: string): SheetSource => ({ ...image, group: "다른 원본", groupDetail: detail });
  const own = [
    ...(alternate.generatedImages || []),
    ...(alternate.references || []).filter((reference) => !reference.isParentReference).map(fromReference),
  ].map((image) => tag(image, altName));
  const variations = (alternate.variations || []).flatMap((variation) =>
    (variation.generatedImages || []).map((image) => tag(image, `${altName} › ${variation.name?.trim() || "변형"}`)),
  );
  return [...own, ...variations];
}

/**
 * 시트 창의 «넣을 그림» 목록.
 *
 * 순서: 원본(생성 이미지 → 레퍼런스) → 변형별 → 다른 원본별(원본 → 그 변형) → 보유 에셋별 → 공용 에셋별.
 * 합성 시트(`isCompositeSheet`)는 재료가 아니라 결과라 뺍니다. 같은 id 는 한 번만.
 */
export function collectSheetSources(
  owner: SheetSourceOwner,
  sharedAssets: VisualAsset[] | undefined,
): SheetSource[] {
  const root: SheetSource[] = [
    ...owner.generatedImages.map((image) => ({ ...image, group: "원본" as const })),
    ...(owner.references || [])
      .filter((reference) => !reference.isParentReference)
      .map((reference) => ({ ...fromReference(reference), group: "원본" as const, groupDetail: "레퍼런스" })),
  ];
  const variations: SheetSource[] = owner.variations.flatMap((variation) =>
    (variation.generatedImages || []).map((image) => ({
      ...image,
      group: "변형" as const,
      groupDetail: variation.name?.trim() || "변형",
    })),
  );
  const alternates = (owner.alternates || []).flatMap(alternateSources);
  const owned = (owner.assets || []).flatMap((asset) => assetSources(asset, "보유 에셋"));
  const shared = (sharedAssets || []).flatMap((asset) => assetSources(asset, "공용 에셋"));

  const seen = new Set<string>();
  const out: SheetSource[] = [];
  for (const source of [...root, ...variations, ...alternates, ...owned, ...shared]) {
    if (source.isCompositeSheet) continue;
    if (!source.thumb && !source.filePath) continue;
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    out.push(source);
  }
  return out;
}

/** 소스 타일을 배치 상자로 끌어다 놓을 때 쓰는 DataTransfer 형식 */
export const SHEET_SOURCE_MIME = "application/x-sheet-source";

/**
 * 그림의 뽑힌 크기(naturalWidth × naturalHeight)를 읽습니다. 파일이 없고 thumb 만 있으면 thumb 크기.
 *
 * 시트 칸은 **뽑힌 크기 그대로** 들어가고(줄여 놓으면 시트에서 다시 키울 때 뭉갭니다), 소스
 * 타일 밑에도 이 숫자를 보여 줍니다 — 원본 크기를 알아야 시트에 몇 장 들어가는지 가늠합니다.
 * 소스 목록과 시트 창이 같은 함수로 읽어야 «타일에 적힌 크기 = 놓이는 칸 크기» 가 됩니다.
 * 못 읽으면 null — 부르는 쪽이 기본 크기로 대신합니다.
 */
export function readImageSize(source: {
  filePath?: string;
  thumb?: string;
}): Promise<{ width: number; height: number } | null> {
  const src = assetSrc(source.filePath) || source.thumb || "";
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () =>
      resolve(
        probe.naturalWidth && probe.naturalHeight
          ? { width: probe.naturalWidth, height: probe.naturalHeight }
          : null,
      );
    probe.onerror = () => resolve(null);
    probe.src = src;
  });
}
