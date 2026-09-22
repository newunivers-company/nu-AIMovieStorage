import type { ProjectAssetType } from "@/lib/mediaLibrary";
import type { ProjectDraft } from "@/lib/projectTypes";
import type { VisualAsset } from "@/lib/visualAsset";
import { alternateStem, ownedAssetStem, variationStemOf } from "@/lib/assetStem";

/**
 * 마그니픽으로 «무엇을» 보냈는지 기억하고, 돌아온 것이 «누구 것 같은지» 미리 골라 둡니다.
 *
 * 마그니픽의 기본 파일 이름 규칙은 `magnific_<prompt_short>_<identifier>.확장자` 입니다
 * (설정 › 파일 이름 규칙에서 확인한 것). 예: `magnific_mountain-dusk_NZmWo7H6D9.jpg`.
 * prompt_short 는 프롬프트에서 뽑은 낱말 두어 개를 하이픈으로 이은 것입니다.
 * 어느 카드에서 어떤 프롬프트를 보냈는지 알고 있으니, 그 조각의 낱말이 **전부** 보낸
 * 프롬프트에 있으면 그 카드를 기본값으로 채웁니다. **옮기는 건 사람이 «채택» 할 때** 입니다 —
 * A·B·C컷이 섞여 오므로 알아맞힌 것을 그대로 옮기면 안 씁니다.
 */

export interface MagnificOwnerHint {
  /**
   * 어느 자리에서 보냈는가.
   *
   * "scene" 은 **장면 하나를 통째로** 뽑은 것입니다 — 스토리보드 시트로 만든 씬 영상.
   * 컷 것과 갈래가 갈려야 확인 탭에서 씬 영상 자리로 올라갑니다.
   */
  kind: "character" | "background" | "asset" | "cut" | "scene";
  /** 카드 이름. 변형이면 변형 이름입니다. */
  name: string;
  cutId?: string;
  sceneId?: string;
}

interface SentRecord extends MagnificOwnerHint {
  at: number;
  words: string[];
}

const STORAGE_KEY = "frameforge.magnificSent";
const SENT_FILES_KEY = "frameforge.magnificSentFiles";
const KEEP = 100;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word.length > 1);
}

function load(): SentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SentRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** «마그니픽» 단추를 누를 때 부릅니다. 최근 100건만 남깁니다. */
export function rememberMagnificSend(owner: MagnificOwnerHint, prompt: string): void {
  // prompt_short 가 프롬프트 어디의 낱말을 고르는지 모르므로 넉넉히 기억합니다.
  const words = tokens(prompt).slice(0, 60);
  if (!words.length) return;
  const next: SentRecord[] = [{ ...owner, at: Date.now(), words }, ...load()].slice(0, KEEP);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 저장 공간이 없으면 기억을 포기합니다. 미리 고르기만 못 할 뿐입니다. */
  }
}

/**
 * 마그니픽에 붙여넣은 그림의 지문을 기억합니다.
 *
 * 마그니픽은 붙여넣은 그림을 생성물로 올리고, 동기화가 그것을 후보함에 다시 내려줍니다.
 * 우리 것이 후보로 되돌아오면 헷갈리니 지문이 같은 후보는 자동으로 숨깁니다.
 */
export function rememberMagnificSentFiles(fingerprints: string[]): void {
  if (!fingerprints.length) return;
  try {
    const have = new Set<string>(JSON.parse(localStorage.getItem(SENT_FILES_KEY) || "[]") as string[]);
    for (const fp of fingerprints) have.add(fp);
    localStorage.setItem(SENT_FILES_KEY, JSON.stringify([...have].slice(-500)));
  } catch {
    /* 기억 못 하면 되돌아온 것을 사람이 숨기면 됩니다. */
  }
}

export function isMagnificSentFile(fingerprint: string): boolean {
  if (!fingerprint) return false;
  try {
    return (JSON.parse(localStorage.getItem(SENT_FILES_KEY) || "[]") as string[]).includes(fingerprint);
  } catch {
    return false;
  }
}

/** 채택할 수 있는 자리 하나. 인물·변형·배경·에셋·컷·장면. */
export interface MagnificTarget {
  key: string;
  label: string;
  kind: MagnificOwnerHint["kind"];
  /** 폴더를 정하는 값 (그림). 영상은 컷에만 가며 scene-video 를 씁니다. */
  assetType: ProjectAssetType;
  ownerName: string;
  /** 파일 이름 앞부분. 변형이면 «인물_변형» — 폴더는 부모 것이라도 파일 이름에 판이 남습니다. */
  stem?: string;
  /** 인물·장소·공용 에셋의 id. 보유 에셋이면 **주인** 의 id 입니다 */
  rootId: string;
  variationId?: string;
  sceneId?: string;
  cutId?: string;
  /**
   * 보유 에셋이면 그 에셋의 id. `kind` 는 "asset" 그대로 두어 미리 고르기(`targetOfRecord`)의
   * kind+이름 맞추기가 공용·보유를 가리지 않고 되게 합니다.
   */
  assetId?: string;
  /**
   * 다른 원본(«냥이의 어린 시절»)이면 그 원본의 id. `rootId` 는 주인 인물·장소입니다.
   * `kind` 는 주인 갈래 그대로 — 미리 고르기가 kind+이름으로 맞추니 원본 이름으로 찾힙니다.
   */
  alternateId?: string;
  /** 보유 에셋·다른 원본의 주인 갈래. 후보함이 캐릭터 탭·배경 탭을 가를 때 봅니다. 공용 에셋은 없음(양 탭) */
  ownerKind?: "character" | "background";
  /** 미리 고르기용 — 카드 이름 */
  name: string;
}

export function listMagnificTargets(draft: ProjectDraft): MagnificTarget[] {
  const out: MagnificTarget[] = [];

  /**
   * 주인(인물·장소)의 보유 에셋과 그 변형. 로드맵 09 §11 「후보함이 보유 에셋과 에셋 변형을 모름」.
   *
   * 파일은 **주인 폴더** 에 «주인_에셋[_변형]_001» 로 갑니다(규칙 5). `assetType` 을
   * "asset-generated" 로 두면 `character/공용에셋/<주인>/` 에 떨어져 폴더가 흩어집니다 — 반드시
   * 주인 갈래의 generated 이어야 합니다. 접두 규칙은 `assetStem.ts`(저장 쪽 `folderFor` 와 같은 것).
   */
  const pushOwnedAssets = (
    owner: { id: string; assets?: VisualAsset[] },
    ownerKind: "character" | "background",
    ownerName: string,
  ) => {
    for (const asset of owner.assets || []) {
      const assetName = asset.name?.trim() || "에셋";
      const base = ownedAssetStem(ownerName, asset.name);
      out.push({
        key: `${ownerKind}:${owner.id}:asset:${asset.id}`,
        label: `${ownerName} › ${assetName}`,
        kind: "asset",
        assetType: `${ownerKind}-generated`,
        ownerName,
        stem: base,
        rootId: owner.id,
        assetId: asset.id,
        ownerKind,
        name: asset.name,
      });
      for (const variation of asset.variations || []) {
        out.push({
          key: `${ownerKind}:${owner.id}:asset:${asset.id}:${variation.id}`,
          label: `${ownerName} › ${assetName} › ${variation.name?.trim() || "변형"}`,
          kind: "asset",
          assetType: `${ownerKind}-generated`,
          ownerName,
          // 변형 이름이 비어 있으면 원본 접두 그대로 — 주인 파일(`냥이_001`)과 섞이지 않게.
          stem: variationStemOf(base, variation.name),
          rootId: owner.id,
          assetId: asset.id,
          variationId: variation.id,
          ownerKind,
          name: variation.name,
        });
      }
    }
  };

  /**
   * 주인의 다른 원본(«냥이의 어린 시절»)과 그 변형. 파일은 보유 에셋과 같은 자리 규칙 —
   * **주인 폴더** 에 «주인_원본이름[_변형]_001»(규칙 5, 접두는 `assetStem.alternateStem`).
   * 이름 없는 원본은 «주인_원본» — 접두를 비우면 `냥이_001` 로 주인 파일이 됩니다.
   */
  const pushAlternates = (
    owner: { id: string; alternates?: { id: string; name: string; variations?: { id: string; name: string }[] }[] },
    ownerKind: "character" | "background",
    ownerName: string,
  ) => {
    for (const alternate of owner.alternates || []) {
      const altName = alternate.name?.trim() || "이름 없음";
      const base = alternateStem(ownerName, alternate.name);
      out.push({
        key: `${ownerKind}:${owner.id}:alt:${alternate.id}`,
        label: `${ownerName} › 원본 ${altName}`,
        kind: ownerKind,
        assetType: `${ownerKind}-generated`,
        ownerName,
        stem: base,
        rootId: owner.id,
        alternateId: alternate.id,
        ownerKind,
        name: alternate.name,
      });
      for (const variation of alternate.variations || []) {
        out.push({
          key: `${ownerKind}:${owner.id}:alt:${alternate.id}:${variation.id}`,
          label: `${ownerName} › 원본 ${altName} › ${variation.name?.trim() || "변형"}`,
          kind: ownerKind,
          assetType: `${ownerKind}-generated`,
          ownerName,
          // 변형 이름이 비어 있으면 원본 접두 그대로 — 주인 파일(`냥이_001`)과 섞이지 않게.
          stem: variationStemOf(base, variation.name),
          rootId: owner.id,
          alternateId: alternate.id,
          variationId: variation.id,
          ownerKind,
          name: variation.name,
        });
      }
    }
  };

  for (const character of draft.characters || []) {
    const ownerName = character.name || "인물";
    out.push({
      key: `character:${character.id}`,
      label: ownerName,
      kind: "character",
      assetType: "character-generated",
      ownerName,
      rootId: character.id,
      name: character.name,
    });
    for (const variation of character.variations || []) {
      out.push({
        key: `character:${character.id}:${variation.id}`,
        label: `${ownerName} · ${variation.name || "변형"}`,
        kind: "character",
        assetType: "character-generated",
        ownerName,
        stem: variation.name?.trim() ? `${ownerName}_${variation.name.trim()}` : undefined,
        rootId: character.id,
        variationId: variation.id,
        name: variation.name,
      });
    }
    pushAlternates(character, "character", ownerName);
    pushOwnedAssets(character, "character", ownerName);
  }
  for (const background of draft.backgrounds || []) {
    const ownerName = background.name || "장소";
    out.push({
      key: `background:${background.id}`,
      label: ownerName,
      kind: "background",
      assetType: "background-generated",
      ownerName,
      rootId: background.id,
      name: background.name,
    });
    for (const variation of background.variations || []) {
      out.push({
        key: `background:${background.id}:${variation.id}`,
        label: `${ownerName} · ${variation.name || "변형"}`,
        kind: "background",
        assetType: "background-generated",
        ownerName,
        stem: variation.name?.trim() ? `${ownerName}_${variation.name.trim()}` : undefined,
        rootId: background.id,
        variationId: variation.id,
        name: variation.name,
      });
    }
    pushAlternates(background, "background", ownerName);
    pushOwnedAssets(background, "background", ownerName);
  }
  for (const asset of draft.sharedAssets || []) {
    const ownerName = asset.name || "에셋";
    // 키 `asset:<id>` 는 project.json 의 magnificHandled.target 에 남아 있어 바꾸지 않습니다.
    out.push({
      key: `asset:${asset.id}`,
      label: `공용 › ${ownerName}`,
      kind: "asset",
      assetType: "asset-generated",
      ownerName,
      rootId: asset.id,
      name: asset.name,
    });
    for (const variation of asset.variations || []) {
      out.push({
        key: `asset:${asset.id}:${variation.id}`,
        label: `공용 › ${ownerName} › ${variation.name?.trim() || "변형"}`,
        kind: "asset",
        assetType: "asset-generated",
        ownerName,
        // 공용 에셋 변형은 제 폴더 안에 «에셋_변형_001» (변형 창의 stemBase=에셋 이름과 같은 규칙).
        stem: variationStemOf(ownerName, variation.name),
        rootId: asset.id,
        variationId: variation.id,
        name: variation.name,
      });
    }
  }
  for (const scene of draft.scenes || []) {
    /*
      장면 자리 — 스토리보드 시트로 뽑은 **씬 영상**이 여기로 옵니다.
      컷보다 **앞에** 둡니다: 목록 위쪽이 고르기 쉬운 자리이고, 씬 영상은 한 장면에
      하나뿐이라 컷 수십 개 밑에 묻히면 못 찾습니다.
    */
    out.push({
      key: `scene:${scene.id}`,
      label: `${scene.title || "장면"} · 씬 영상`,
      kind: "scene",
      assetType: "scene-video",
      ownerName: scene.title || "장면",
      rootId: scene.id,
      sceneId: scene.id,
      name: scene.title || "장면",
    });
    for (const cut of scene.cuts || []) {
      out.push({
        key: `cut:${cut.id}`,
        label: `${scene.title || "장면"} · 컷 ${cut.order}`,
        kind: "cut",
        assetType: "scene-cut",
        ownerName: scene.title || "장면",
        rootId: scene.id,
        sceneId: scene.id,
        cutId: cut.id,
        name: `컷 ${cut.order}`,
      });
    }
  }
  return out;
}

function targetOfRecord(record: SentRecord, targets: MagnificTarget[]): MagnificTarget | undefined {
  if (record.kind === "cut") return targets.find((t) => t.kind === "cut" && t.cutId === record.cutId);
  if (record.kind === "scene")
    return targets.find((t) => t.kind === "scene" && t.sceneId === record.sceneId);
  // 원본 카드가 먼저, 그다음 다른 원본(주인 갈래의 kind 로 목록에 있음), 그다음 변형.
  // 이름이 같은 원본과 변형이 있으면 원본으로 봅니다.
  return (
    targets.find((t) => t.kind === record.kind && !t.variationId && !t.alternateId && t.name === record.name) ||
    targets.find((t) => t.kind === record.kind && !t.variationId && t.name === record.name) ||
    targets.find((t) => t.kind === record.kind && t.name === record.name)
  );
}

/** `magnific_<prompt_short>_<identifier>.ext` 에서 가운데 조각의 낱말들. 규칙이 다르면 전체 이름에서. */
export function promptSlugTokens(fileName: string): string[] {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const parts = stem.split("_");
  const middle =
    parts.length >= 3 && parts[0].toLowerCase() === "magnific"
      ? parts.slice(1, -1).join(" ")
      : stem.replace(/^magnific[_\- ]?/i, "");
  return tokens(middle);
}

/** 한 카드로만 모이면 그 카드, 둘 이상이면 undefined. */
function soleTarget(records: SentRecord[], targets: MagnificTarget[]): MagnificTarget | undefined {
  let found: MagnificTarget | undefined;
  for (const record of records) {
    const target = targetOfRecord(record, targets);
    if (!target) continue;
    if (found && found.key !== target.key) return undefined;
    found = found || target;
  }
  return found;
}

/** 파일이 온 시각 앞 이만큼 안에 보낸 카드를 봅니다. 생성·동기화에 걸리는 시간을 넉넉히. */
const TIME_WINDOW_MS = 45 * 60 * 1000;

/**
 * 주인을 미리 골라 둡니다. 확신이 없으면 undefined.
 *
 * 1. 이름으로 — 파일 이름의 프롬프트 조각 낱말이 **전부** 들어 있는 카드. 영문 프롬프트일 때.
 * 한글 프롬프트는 마그니픽이 한글을 다 버려 `img1-.-.-6-.-808080` 처럼 모든 시트에 똑같은
 * 조각만 남습니다(실제로 확인한 것). 그럴 땐 이름이 아무것도 말해 주지 않습니다.
 * 2. 시각으로 — 파일이 온 시각 앞 45분 안에 «마그니픽» 을 누른 카드가 하나뿐이면 그 카드.
 * 서로 다른 카드가 둘 다 맞으면 고르지 않습니다 — 틀리게 채우느니 비워 둡니다.
 */
export function guessMagnificOwner(
  fileName: string,
  targets: MagnificTarget[],
  modifiedMs?: number,
): MagnificTarget | undefined {
  const records = load();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = records.filter((record) => record.at >= dayAgo);

  const slug = promptSlugTokens(fileName);
  // 모든 시트 프롬프트에 들어가는 조각(img1 · 808080 같은 것)은 이름 단서로 치지 않습니다.
  const generic = new Set(["img1", "img2", "img3", "808080", "magnific"]);
  const telling = slug.filter((word) => !generic.has(word) && !/^\d+$/.test(word));
  if (telling.length && !(telling.length === 1 && telling[0].length < 4)) {
    const byName = soleTarget(
      recent.filter((record) => {
        const words = new Set(record.words);
        return telling.every((word) => words.has(word));
      }),
      targets,
    );
    if (byName) return byName;
  }

  if (modifiedMs) {
    const byTime = recent.filter((record) => record.at <= modifiedMs && record.at >= modifiedMs - TIME_WINDOW_MS);
    if (byTime.length) return soleTarget(byTime, targets);
  }
  return undefined;
}

/**
 * 주인은 못 정해도 **갈래**(캐릭터/배경/컷)는 정할 수 있는지 봅니다.
 *
 * 한글 프롬프트로 뽑은 파일은 이름이 다 똑같아(`img1-…-808080`) 주인을 못 고르지만, 그 시각
 * 앞 45분에 «마그니픽» 을 누른 카드가 전부 캐릭터였다면 «캐릭터 탭 것» 인 건 확실합니다.
 * 후보함을 탭별로 나눌 때 씁니다. 후보 카드들의 갈래가 갈리면 undefined.
 */
export function guessMagnificKind(fileName: string, modifiedMs?: number): MagnificOwnerHint["kind"] | undefined {
  const records = load();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = records.filter((record) => record.at >= dayAgo);
  const slug = promptSlugTokens(fileName);
  const generic = new Set(["img1", "img2", "img3", "808080", "magnific"]);
  const telling = slug.filter((word) => !generic.has(word) && !/^\d+$/.test(word));
  let candidates: SentRecord[] = [];
  if (telling.length && !(telling.length === 1 && telling[0].length < 4)) {
    candidates = recent.filter((record) => {
      const words = new Set(record.words);
      return telling.every((word) => words.has(word));
    });
  }
  if (!candidates.length && modifiedMs) {
    candidates = recent.filter((record) => record.at <= modifiedMs && record.at >= modifiedMs - TIME_WINDOW_MS);
  }
  const kinds = new Set(candidates.map((record) => record.kind));
  return kinds.size === 1 ? [...kinds][0] : undefined;
}
