import {
  faceFileToken,
  nextFaceSetNumber,
  parseFaceStem,
  SIX_FACES_DIR,
  type FaceKey,
} from "@/lib/faceSets";
import {
  listOwnerFiles,
  safeFileName,
  saveProjectMediaAsset,
  type ProjectAssetType,
} from "@/lib/mediaLibrary";
import type { SpaceKind } from "@/lib/blueprint";

/**
 * 여섯 면을 **한 세트로** 저장합니다 — 파노라마 탭·전개도 창·자동 커팅이 같이 씁니다.
 *
 * 예전에는 이 규칙이 `SheetPanelCropper` 안에만 있었습니다. 자동 커팅을 붙이면서
 * 밖으로 뺐습니다 — 두 벌로 두면 «번호를 세트 단위로 한 번만 정한다» 같은 규칙을 한쪽만
 * 고치는 날이 오고, 그때 세트가 둘로 갈립니다(공통 규칙 1).
 *
 * # 번호는 세트 단위로 **한 번** 정합니다
 *
 * 파일 이름이 `<접두>_<면>_<NNN>` 이라, Rust 의 «빈 첫 번호» 를 면마다 따로 받으면
 * 앞 세트가 3장에서 끊겼거나 위 면이 «천장»→«하늘» 로 바뀐 뒤 면끼리 번호가 어긋나
 * 한 번에 저장한 세트가 둘로 갈립니다. 그래서 6면 폴더를 먼저 읽어 최댓값+1 을 정하고
 * 여섯 장에 똑같이 붙입니다.
 *
 * # 면 이름을 앞에 두지 않는 까닭
 *
 * 폴더 이름 바꾸기(Rust `rename_owner_tree`)와 마그니픽 @태그가 «접두 먼저» 를 전제로
 * 합니다. 면을 앞에 두면 장소 이름을 바꿀 때 여섯 면이 옛 이름으로 남습니다.
 * 자세한 내력은 `lib/faceSets.ts` 머리말에 있습니다.
 */

export interface FaceFileToSave {
  file: File;
  face: FaceKey;
}

export interface SavedFaceFile {
  path: string;
  name: string;
  face: FaceKey;
  faceSet?: string;
  thumb?: string;
}

export interface SaveFaceSetOptions {
  files: FaceFileToSave[];
  projectName: string;
  assetType: ProjectAssetType;
  ownerName: string;
  /** 파일 이름 앞부분 — «장소» 또는 «장소_변형». 번호를 셀 때도 이 접두로 견줍니다. */
  prefix: string;
  spaceKind?: SpaceKind | null;
  /** 저장 진행 문구. 화면이 있을 때만 줍니다. */
  onProgress?: (message: string, index: number) => void;
}

export interface SaveFaceSetResult {
  saved: SavedFaceFile[];
  /** 한 번호로 못 묶였을 때의 세트 id 들. 하나뿐이면 정상입니다. */
  setIds: string[];
  /** 도중에 멈춘 까닭(같은 번호의 파일이 이미 있는 등). 없으면 끝까지 갔습니다. */
  stoppedBecause?: string;
}

export async function saveFaceSet(
  options: SaveFaceSetOptions,
): Promise<SaveFaceSetResult> {
  const { files, projectName, assetType, ownerName, prefix, spaceKind } = options;

  // Rust 가 접두를 `safe_name` 으로 다듬으므로 견줄 때도 같은 규칙을 거칩니다.
  const existing = await listOwnerFiles({
    projectName,
    assetType,
    ownerName,
    subdir: SIX_FACES_DIR,
  });
  const number = nextFaceSetNumber(
    existing.map((file) => stemOf(file.filePath)),
    safeFileName(prefix),
  );

  const saved: SavedFaceFile[] = [];
  let stoppedBecause: string | undefined;

  for (const [index, item] of files.entries()) {
    options.onProgress?.(
      `${faceFileToken(item.face, spaceKind)} 저장 중 ${index + 1}/${files.length}`,
      index,
    );
    let result: { path: string } | null = null;
    try {
      result = await saveProjectMediaAsset(item.file, {
        projectName,
        assetType,
        ownerName,
        stem: `${prefix}_${faceFileToken(item.face, spaceKind)}`,
        subdir: SIX_FACES_DIR,
        number,
      });
    } catch (error) {
      /*
        같은 번호의 파일이 이미 있으면(폴더를 읽은 뒤 탐색기로 넣는 등) **덮어쓰지 않고
        멈춥니다.** 번호가 다른 면을 섞어 저장하면 세트가 갈리므로, 저장된 것까지만
        등록하고 다시 만들게 합니다.
      */
      stoppedBecause = String(error);
      break;
    }
    if (!result?.path) continue;
    const parsed = parseFaceStem(stemOf(result.path));
    saved.push({
      path: result.path,
      name: stemOf(result.path),
      face: item.face,
      faceSet: parsed?.setId,
      thumb: URL.createObjectURL(item.file),
    });
  }

  return {
    saved,
    setIds: [...new Set(saved.map((file) => file.faceSet).filter(Boolean))] as string[],
    stoppedBecause,
  };
}

/** 경로에서 확장자를 뗀 파일 이름. */
function stemOf(path: string): string {
  const name = path.split(/[\\/]/).pop() || path;
  return name.replace(/\.[^.]+$/, "");
}
