import { useRef } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ConfirmDialog";
import { fileStem, renameStemFiles, safeFileName, stemHasPrefix } from "@/lib/mediaLibrary";
import { isPlaceholderStem, ownedAssetStem } from "@/lib/assetStem";
import type { LineageFolder } from "@/components/project/useEntityLineage";

/**
 * 보유 에셋의 이름을 바꾸면 파일 이름 앞부분도 따라가게 합니다.
 *
 * 파일 이름이 곧 마그니픽 @태그입니다. 「단검」 을 「검」 으로 고쳤는데 파일이
 * `냥이_단검_001` 로 남으면 태그가 옛 이름을 부르고, 폴더를 다시 읽을 때 접두
 * (`냥이_검_`)가 안 맞아 제 그림을 «남의 것» 으로 봅니다. 변형 창의
 * `renameFilesIfNeeded`(VariationDialog) 와 같은 처리를 보유 에셋에도 둡니다 —
 * 로드맵 09 §11 「보유 에셋 이름을 바꿔도 파일 접두는 안 따라감」.
 *
 * 원본 편집 창(닫을 때)과 「보유 애셋」 이름 줄(포커스 빠질 때)이 **같은 함수** 를 씁니다.
 * 글자마다 바꾸면 「겨」「겨울」 파일이 줄줄이 생기고 확인 창이 계속 뜹니다.
 *
 * 다른 원본(«냥이_어린시절_001», 2026-09-08)도 주인 폴더 안에 접두로 구분되므로 **같은 함수**
 * 입니다 — 자리표시(`folder.placeholder`)와 확인 문구의 낱말(`noun`)만 다릅니다. 그래서 `asset`
 * 은 `VisualAsset` 이 아니라 «이름과 그림 목록이 있는 것» 이면 무엇이든 받습니다.
 *
 * 공용 에셋은 여기서 아무것도 안 합니다 — 제 폴더가 있어 저장 때 `syncOwnerFolders` 가
 * 폴더째 옮깁니다(`ownerFolders.ownersOf` 가 sharedAssets 를 폴더 주인으로 봄, 2026-09-08 확인).
 */

/** 이름을 따라 바꿀 수 있는 것의 최소 모양. `VisualAsset`·`Character`·`Background`·`LineageEntity` 가 전부 맞습니다 */
export interface RenameableEntity {
  name: string;
  references?: RenameableReference[];
  generatedImages?: { filePath?: string }[];
  variations?: { references?: RenameableReference[]; generatedImages?: { filePath?: string }[] }[];
}

/** 레퍼런스 한 장 — «남의 파일인가» 를 가리는 표시만 봅니다 */
interface RenameableReference {
  id: string;
  filePath?: string;
  isParentReference?: boolean;
  sharedFile?: boolean;
}

export interface RenameOwnedAssetFilesOptions {
  projectName: string;
  /** `useEntityLineage.folderFor(asset)`. `stemBase` 가 없으면 공용 에셋이라 건너뜁니다 */
  folder: LineageFolder;
  asset: RenameableEntity;
  /** 옛 접두 후보(«냥이_단검»). 열 때 이름으로 만든 것과 실제 저장에 쓴 것 */
  oldStems: string[];
  newName: string;
  /**
   * 주인·형제 에셋(과 그 변형)이 쓰는 파일 — `useEntityLineage.claimedFor(asset)`.
   *
   * Rust 의 `rename_stem_files` 는 **주인 폴더 전체** 에서 접두를 바꿉니다. 주인의 변형
   * 이름이 이 에셋과 같으면(`냥이_단검_`) 그 변형 파일까지 같이 바뀌므로, 남의 파일에
   * 같은 접두가 있으면 아예 손대지 않습니다.
   */
  foreignPaths: Set<string>;
  /** 옮긴 경로를 초안 전체에 반영. `useProjectMedia().renamePaths` */
  renamePaths: (moved: Map<string, string>) => void;
  /** 확인 문구에서 이 항목을 부르는 말. 보유 에셋은 «에셋»(기본), 다른 원본은 «원본» */
  noun?: string;
  /**
   * 다른 항목이 **이미 쓰는 접두**(주인 변형·보유 에셋·다른 원본·형제) — `useEntityLineage.reservedFor`.
   *
   * `foreignPaths` 는 파일이 있어야 잡습니다. 다른 원본 «겨울» 이 아직 파일이 없을 때 주인 변형과
   * 같은 이름을 적으면 아무 검사 없이 통과해, 이후 저장부터 `숲_겨울_` 번호를 나눠 쓰기 시작합니다
   * (검토 2026-09-08). 새 접두가 여기 있으면 파일이 없어도 거부합니다.
   */
  reservedStems?: string[];
}

/** 결과. 취소·충돌이면 ok=false 이고 revertName 이 «폴더 기준 옛 이름»(자리표시면 빈 이름). */
export interface RenameOwnedAssetOutcome {
  ok: boolean;
  revertName: string | null;
}

/**
 * 파일 이름을 바꿉니다. **취소하거나 못 바꾸면 `ok: false`** — 부르는 쪽이 이름을 `revertName`
 * (없으면 열 때 이름)으로 되돌립니다. 폴더가 진실이라, 화면 이름만 새것이고 파일은 옛 접두면 다음에 열 때
 * 폴더 읽기가 제 파일을 못 봅니다(`ownerFolders.revertOwnerNames` 와 같은 원칙).
 * 할 일이 없었으면(이름 그대로·옛 파일 없음) `true`.
 */
export async function renameOwnedAssetFiles({
  projectName,
  folder,
  asset,
  oldStems,
  newName,
  foreignPaths,
  renamePaths,
  noun = "에셋",
  reservedStems = [],
}: RenameOwnedAssetFilesOptions): Promise<RenameOwnedAssetOutcome> {
  const done = { ok: true, revertName: null } as const;
  if (!folder.stemBase) return done;
  const after = newName.trim();
  if (!after) return done;
  // 접두 규칙과 자리표시는 저장 쪽(`folderFor`)과 같은 것을 씁니다 — 다른 원본은 «냥이_원본».
  const newStem = ownedAssetStem(folder.ownerName, after, folder.placeholder);
  /*
    이름이 **바뀐** 경우에만(옛 접두 후보에 새 접두가 없음) 다른 항목의 접두와 견줍니다. 이름 그대로
    닫는 것까지 거부하면 옛 데이터에 이미 겹친 이름이 있을 때 닫을 때마다 되돌려 끝이 없습니다.
    파일이 있든 없든 거부합니다 — 같은 접두로 한 장이라도 저장되면 그때부터 남의 파일과 섞입니다.
  */
  if (!oldStems.includes(newStem) && reservedStems.includes(newStem)) {
    toast.error(
      `「${after}」 은 주인의 변형·에셋·다른 원본이 이미 쓰는 이름이라 파일 앞부분(${safeFileName(newStem)}_…)이 겹칩니다. ${noun} 이름을 되돌립니다.`,
      { description: "같은 폴더에서 같은 앞부분을 쓰면 서로의 파일을 가져갑니다. 다른 이름을 적으세요." },
    );
    return { ok: false, revertName: null };
  }
  /*
    옛 접두는 «기억» 만 믿지 않고 **실제 파일 이름에서도** 읽습니다(검토 2026-09-08).
    파일이 잠겨 실패한 뒤 다시 열면 기억한 이름은 이미 새 이름이고, 이름을 비웠다 다시 적으면
    기억이 끊기며, 「단」 을 적는 사이 올라간 그림은 기억에 안 남습니다. 폴더가 진실입니다.
    원본의 파일만 봅니다 — 변형 파일은 `_변형` 이 더 붙어 있어 접두를 잘못 읽습니다.
  */
  const prefix = `${folder.ownerName}_`;
  const fromFiles = [...(asset.references || []), ...(asset.generatedImages || [])]
    .map((image) => (image.filePath ? fileStem(image.filePath) : ""))
    .filter(Boolean)
    .map((stem) => stem.replace(/^ref_/, "").replace(/_\d+$/, ""))
    .filter((stem) => stem.startsWith(prefix) && stem.length > prefix.length);
  const candidates = [...new Set([...oldStems, ...fromFiles].map((stem) => stem.trim()).filter(Boolean))].filter(
    (stem) => stem !== newStem,
  );
  if (!candidates.length) return done;
  /** 취소·충돌 때 화면 이름을 무엇으로 되돌릴지 — 실제 파일의 접두에서 이름을 뽑습니다(자리표시면 빈 이름). */
  const revertNameOf = (oldStem: string) =>
    isPlaceholderStem(folder.ownerName, oldStem, folder.placeholder) ? "" : oldStem.slice(prefix.length);

  // 정체성 기준(부모 그림)과 빌려 온 그림(`owner-` id)은 남의 파일이라 세지 않습니다.
  const ownReference = (reference: RenameableReference) =>
    !reference.isParentReference && !reference.sharedFile && !reference.id.startsWith("owner-");
  const own: { filePath?: string }[] = [
    ...(asset.references || []).filter(ownReference),
    ...(asset.generatedImages || []),
    ...(asset.variations || []).flatMap((variation) => [
      ...(variation.references || []).filter(ownReference),
      ...(variation.generatedImages || []),
    ]),
  ];
  const staleByStem = candidates
    .map((oldStem) => ({
      oldStem,
      stale: own.filter((image) => image.filePath && stemHasPrefix(fileStem(image.filePath), oldStem)),
    }))
    .filter((group) => group.stale.length);
  if (!staleByStem.length) return done;
  const revertName = revertNameOf(staleByStem[0].oldStem);

  // 보호 장치 — 남의 파일에 같은 접두가 있으면 Rust 가 그것까지 바꿉니다. 손대지 않습니다.
  const clash = staleByStem.find(({ oldStem }) =>
    [...foreignPaths].some((path) => stemHasPrefix(fileStem(path), oldStem)),
  );
  if (clash) {
    toast.error(
      `주인의 변형이나 다른 항목이 같은 앞부분(${safeFileName(clash.oldStem)}_…)을 쓰고 있어 파일 이름을 바꾸지 않습니다. ${noun} 이름을 되돌립니다.`,
      { description: "겹치는 변형·에셋·원본의 이름을 먼저 바꾼 뒤 다시 시도하세요." },
    );
    return { ok: false, revertName };
  }

  // 자리표시(«냥이_에셋» · «냥이_원본»)에서 진짜 이름으로 가는 것은 묻지 않습니다 — 사람이 고른 이름이
  // 아니라 이름을 적기 전에 그림부터 올린 흔적입니다(`ownerFolders.PLACEHOLDERS` 와 같은 규칙).
  const needsAsk = staleByStem.some(
    ({ oldStem }) => !isPlaceholderStem(folder.ownerName, oldStem, folder.placeholder),
  );
  if (needsAsk) {
    const samples = [
      ...new Set(staleByStem.flatMap((group) => group.stale.map((image) => fileStem(image.filePath || "")))),
    ].slice(0, 3);
    const ok = await confirmDialog({
      title: `${noun} 이름을 「${after}」 로 바꾸면 파일 이름도 바뀝니다`,
      description:
        `이 ${noun}의 파일 이름(${samples.join(", ")} …)이 ${safeFileName(newStem)}_… 로 바뀌고, ` +
        "마그니픽 @태그도 새 이름을 따릅니다. 주인 파일은 그대로입니다.",
      confirmLabel: "바꾸기",
    });
    if (!ok) return { ok: false, revertName };
  }

  let movedCount = 0;
  const failed: { path: string; reason: string }[] = [];
  for (const { oldStem } of staleByStem) {
    // 폴더는 주인 것(`folder.ownerName`). 에셋 이름으로 찾으면 공용 에셋 폴더를 뒤집니다.
    const outcome = await renameStemFiles({
      projectName,
      assetType: folder.referenceAssetType,
      ownerName: folder.ownerName,
      oldStem,
      newStem,
    });
    // 변형의 정체성 기준, 그 그림의 표시(imageMarks)까지 같은 파일을 가리키니 초안 전체에서 갈아 끼웁니다.
    if (outcome.moved.size) renamePaths(outcome.moved);
    movedCount += outcome.moved.size;
    failed.push(...outcome.failed);
  }
  if (failed.length) {
    // 주인 이름 바꾸기와 달리 다음 저장 때 다시 시도하는 큐가 없습니다. 그래서 문구에 밝힙니다.
    toast.error(
      `${failed.length}개 파일은 다른 프로그램이 쓰고 있어 이름을 못 바꿨습니다. 그 파일은 옛 이름으로 남습니다 — 닫고 다시 이름을 고치면 다시 시도합니다.`,
      { description: failed[0].reason },
    );
  } else if (movedCount) {
    toast.success(`파일 ${movedCount}개의 이름을 ${safeFileName(newStem)}_… 로 바꿨습니다.`);
  }
  return done;
}

/**
 * 원본 편집 창용 — 열 때 이름과 **실제로 저장에 쓴 접두** 를 기억해 두었다가 닫을 때 한 번 바꿉니다.
 *
 * 이름을 「단」 까지 적고 그림을 올리면 `냥이_단_001` 로 저장됩니다. 닫을 때 «열 때 이름» 만
 * 보면 그 파일을 못 찾아 영영 옛 접두로 남습니다(VariationDialog 의 `usedStem` 과 같은 이유).
 * 그래서 references·generatedImages 가 든 patch 가 올 때마다 그 순간의 접두를 적어 둡니다.
 */
export function useOwnedAssetRename({
  projectName,
  folder,
  asset,
  foreignPaths,
  renamePaths,
  noun,
  reservedStems,
}: {
  projectName: string;
  folder: LineageFolder;
  asset: RenameableEntity;
  foreignPaths: () => Set<string>;
  renamePaths: (moved: Map<string, string>) => void;
  /** 확인 문구의 낱말. 보유 에셋은 «에셋»(기본), 다른 원본은 «원본» */
  noun?: string;
  /** 다른 항목이 이미 쓰는 접두 — `useEntityLineage.reservedFor`. 새 이름이 이것과 겹치면 파일이 없어도 거부 */
  reservedStems?: () => string[];
}) {
  const openedName = useRef(asset.name || "");
  const usedStems = useRef(new Set<string>());
  // 닫을 때는 «지금» 폴더 규칙이 필요합니다. 닫기 핸들러가 옛 렌더의 것이어도 최신을 보게 ref 로.
  const latest = useRef({ folder, asset });
  latest.current = { folder, asset };

  /**
   * 그림이 저장돼 들어오는 patch 마다 부릅니다. Set 에 더하는 것뿐이라 StrictMode 가
   * 갱신 함수를 두 번 돌려도 결과가 같습니다.
   */
  const noteSaved = () => {
    const stem = latest.current.folder.stemBase;
    if (stem) usedStems.current.add(stem);
  };

  /**
   * 창을 닫을 때. 이름이 바뀌었으면 파일도 따라갑니다. `false` 면 취소·충돌 — 부르는 쪽이
   * 이름을 `openedName()` 으로 되돌립니다. 이름을 비웠으면 아무것도 안 하고 옛 이름을
   * 계속 기억합니다 — 나중에 다시 적었을 때 그 접두의 파일을 찾아야 하니까요.
   */
  const finish = async (): Promise<RenameOwnedAssetOutcome> => {
    const { folder: nowFolder, asset: nowAsset } = latest.current;
    const after = nowAsset.name.trim();
    if (!after || !nowFolder.stemBase) return { ok: true, revertName: null };
    const before = openedName.current.trim();
    const outcome = await renameOwnedAssetFiles({
      projectName,
      folder: nowFolder,
      asset: nowAsset,
      // 열 때 이름이 비어 있었으면 자리표시 접두(«냥이_에셋» · «냥이_원본»)로 저장된 파일이 대상입니다.
      oldStems: [ownedAssetStem(nowFolder.ownerName, before, nowFolder.placeholder), ...usedStems.current],
      newName: after,
      foreignPaths: foreignPaths(),
      renamePaths,
      noun,
      reservedStems: reservedStems?.(),
    });
    if (outcome.ok) {
      // 다음에 또 바꿀 때는 지금 이름이 기준입니다.
      openedName.current = after;
      usedStems.current = new Set();
    }
    return outcome;
  };

  return { noteSaved, finish, openedName: () => openedName.current };
}

/**
 * 원본 편집 창의 «닫기 = 이름 따라 바꾸기» 한 벌.
 *
 * 보유 에셋 창(`AssetEditorDialog`)에 있던 30줄 — `useOwnedAssetRename` + 그림이 저장되는 patch
 * 가로채기(`noteSaved`) + 닫기 중복 막기 + 실패하면 이름 되돌리기 — 을 다른 원본 창
 * (`AlternateLineage`)도 똑같이 써야 해서 훅으로 뽑았습니다. 두 곳에 복사해 두면 규칙 하나를
 * 고칠 때 한쪽을 빠뜨립니다(규칙 1).
 *
 * `onPatch` 의 updater 가 `Partial<T> | { name: string }` 을 돌려주는 이유: 되돌리기가 `{ name }`
 * 만 고치는데, T 가 갈래마다 달라 TS 가 `{ name }` 이 `Partial<T>` 에 들어감을 증명하지 못합니다
 * (`useEntityLineage.LineagePatch` 와 같은 사정). 부르는 쪽의 구체 타입에서는 그냥 맞습니다.
 */
export function useOwnedEditorClose<T extends RenameableEntity>({
  projectName,
  folder,
  entity,
  foreignPaths,
  renamePaths,
  onPatch,
  onClose,
  noun,
  reservedStems,
}: {
  projectName: string;
  folder: LineageFolder;
  entity: T;
  /** 주인·형제가 쓰는 파일 — `useEntityLineage.claimedFor(entity)` */
  foreignPaths: () => Set<string>;
  renamePaths: (moved: Map<string, string>) => void;
  onPatch: (updater: (current: T) => Partial<T> | { name: string }) => void;
  onClose: () => void;
  /** 확인 문구의 낱말. 보유 에셋은 «에셋»(기본), 다른 원본은 «원본» */
  noun?: string;
  /** 다른 항목이 이미 쓰는 접두 — `useEntityLineage.reservedFor(entity)`. 겹치면 파일이 없어도 이름을 되돌립니다 */
  reservedStems?: () => string[];
}) {
  const rename = useOwnedAssetRename({ projectName, folder, asset: entity, foreignPaths, renamePaths, noun, reservedStems });
  /**
   * 그림이 저장돼 들어오는 patch(references·generatedImages)가 오면 그 순간의 접두를 적어 둡니다.
   * 이름을 「단」 까지 적고 올린 `냥이_단_001` 을 닫을 때 놓치지 않으려고요. 갱신 함수 안에서
   * 부르지만 Set 에 더하는 것뿐이라 두 번 돌아도 같습니다.
   */
  const patch = (updater: (current: T) => Partial<T>) =>
    onPatch((current) => {
      const partial = updater(current);
      if ("references" in partial || "generatedImages" in partial) rename.noteSaved();
      return partial;
    });
  /** 닫기 = 저장. 파일 이름을 따라 바꾸고, 취소·충돌이면 이름을 옛것으로 되돌립니다(폴더가 진실). */
  const closing = useRef(false);
  const finish = async () => {
    // 확인 창을 기다리는 동안 Esc 를 또 누르면 두 번째 확인 창이 첫 번째를 덮어 첫 답이 영영 안 옵니다.
    if (closing.current) return;
    closing.current = true;
    try {
      const outcome = await rename.finish();
      // 되돌릴 이름은 실제 파일 접두에서 — 열 때 이름이 비어 있었어도 파일이 진실입니다.
      if (!outcome.ok) onPatch(() => ({ name: outcome.revertName ?? rename.openedName() }));
      onClose();
    } finally {
      closing.current = false;
    }
  };
  return { patch, finish };
}
