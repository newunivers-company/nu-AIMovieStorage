/**
 * 보유 에셋·다른 원본의 파일 이름 앞부분 규칙 — **한 곳**.
 *
 * 보유 에셋은 제 폴더가 없고 주인(인물·장소) 폴더 안에 «주인_에셋_번호» 로 들어갑니다
 * (규칙 5). 이 규칙을 `useEntityLineage.folderFor`(저장), 마그니픽 타깃(채택), 이름 바꾸기
 * (옛 접두 찾기)가 각자 문자열로 들고 있으면, 한 곳을 고칠 때 나머지가 어긋나 «저장은
 * 됐는데 폴더 읽기가 제 것으로 못 보는» 파일이 생깁니다. 셋이 전부 여기서 가져갑니다.
 *
 * 다른 원본(«냥이_어린시절_001», 2026-09-08)도 같은 자리 규칙을 씁니다 — 자리표시 낱말만
 * «원본» 으로 다릅니다. 그래서 자리표시를 매개변수로 받습니다.
 */

/** 이름을 아직 안 적은 에셋의 자리표시. `ownerFolders.PLACEHOLDERS` 의 «에셋» 과 같은 말입니다 */
export const OWNED_ASSET_PLACEHOLDER = "에셋";

/**
 * 이름을 아직 안 적은 다른 원본의 자리표시 — «냥이_원본_001».
 *
 * 에셋과 같은 «에셋» 을 쓰면 이름 없는 원본과 이름 없는 에셋의 파일이 폴더에서 섞여
 * 이름을 적을 때 서로의 파일을 가져갑니다(`renameOwnedAssetFiles` 가 접두로 찾으니까요).
 */
export const ALTERNATE_PLACEHOLDER = "원본";

/**
 * 보유 에셋 원본의 접두 — «냥이_단검». 이름이 비어 있으면 «냥이_에셋».
 *
 * 이름이 비었다고 접두를 빼면 `냥이_001` 로 저장돼 주인 파일과 섞이고, 폴더 읽기가
 * 주인 폴더 전체를 제 것으로 줍습니다(검토 2026-09-08). 그래서 자리표시라도 붙입니다.
 */
export function ownedAssetStem(
  ownerName: string,
  assetName: string | undefined,
  placeholder: string = OWNED_ASSET_PLACEHOLDER,
): string {
  return `${ownerName}_${assetName?.trim() || placeholder}`;
}

/** 다른 원본의 접두 — «냥이_어린시절». 이름이 비어 있으면 «냥이_원본» */
export function alternateStem(ownerName: string, name: string | undefined): string {
  return ownedAssetStem(ownerName, name, ALTERNATE_PLACEHOLDER);
}

/** 이 접두가 자리표시(«냥이_에셋» · «냥이_원본»)인가. 자리표시에서 진짜 이름으로 가는 것은 묻지 않습니다 */
export function isPlaceholderStem(
  ownerName: string,
  stem: string,
  placeholder: string = OWNED_ASSET_PLACEHOLDER,
): boolean {
  return stem === ownedAssetStem(ownerName, "", placeholder);
}

/**
 * 변형의 접두 — «냥이_단검_겨울». 변형 이름이 비어 있으면 원본 접두 그대로.
 *
 * 마그니픽 채택처럼 «지금 당장 파일을 놓아야 하는» 자리에서 씁니다. 이름 없는 변형에
 * 접두를 안 주면 주인 폴더에 `냥이_001` 로 떨어져 주인 파일이 됩니다.
 */
export function variationStemOf(base: string, variationName: string | undefined): string {
  const name = variationName?.trim();
  return name ? `${base}_${name}` : base;
}
