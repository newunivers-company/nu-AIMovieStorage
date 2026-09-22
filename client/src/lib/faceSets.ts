import { COMPOSITION_CUBE_FACES, CUBE_FACE_LABELS, type CompositionCubeFace } from "@/lib/composition";
import type { SpaceKind } from "@/lib/blueprint";

/**
 * 6면 세트 — 파노라마에서 잘라낸 여섯 면을 «폴더 하나 + 파일 여섯» 으로 다루는 규칙.
 *
 * # 왜 면 이름을 파일 이름 앞에 두지 않는가
 *
 * 라고 했지만(2026-09-08), 폴더 이름 바꾸기(Rust `rename_owner_tree` — `옛이름_`
 * 으로 시작하는 파일만 따라감)와 마그니픽 @태그가 전부 «접두 먼저» 를 전제로 합니다.
 * 면 이름을 앞에 두면 장소 이름을 바꿀 때 여섯 면이 옛 이름으로 남습니다.
 * 그래서 파일은 `<접두>_<면>_<NNN>` 그대로 두고, **앱이 면 토큰을 이름 어디서든 알아보고**
 * 화면에서는 «정면 · 장소 #1» 처럼 면을 앞에 보여 줍니다. 구도잡기는 이름이 아니라
 * `collectFaceSets` 로 세트를 알아봅니다.
 *
 * # 데이터 모델은 그대로
 *
 * `generatedImages` 에 여섯 장이 낱장으로 들어 있고, 화면 그룹화만 여기서 합니다.
 * 저장할 때 `face`/`faceSet` 를 채워 두지만, 옛 프로젝트(뿌리 폴더에 `…_천장_001`)는
 * 그 필드가 없으니 **이름 파싱으로 보완**합니다 — 폴더 위치와 무관하게 세트로 인식합니다.
 * 단, `6면/` 밖의 이름 인식은 배경 갈래에서만 켭니다(`FaceSetOptions.legacy` 참고).
 */

/** 여섯 면이 들어가는 주인 폴더 안의 하위 폴더. Rust `SIX_FACES_DIR` 와 같은 값. */
export const SIX_FACES_DIR = "6면";

/**
 * 파노라마(돔) 원본이 들어가는 주인 폴더 안의 하위 폴더. Rust `PANORAMA_DIR` 와 같은 값.
 *
 * 실외 방에 거는 것은 파노라마뿐이라,
 * 폴더가 갈려 있어야 목록에서 «이건 돔에 두르는 그림» 을 이름이 아니라 **자리로** 가릴 수 있습니다.
 */
export const PANORAMA_DIR = "파노라마";

/** 이 파일이 파노라마 폴더에 있는가. */
export function isInPanoramaDir(filePath?: string): boolean {
  if (!filePath) return false;
  const parts = filePath.split(/[\/]/);
  return parts.length >= 2 && parts[parts.length - 2] === PANORAMA_DIR;
}

/** 면 키. 구도잡기의 `CompositionCubeFace` 와 같습니다 — 위 면은 `top`, 아래 면은 `bottom`. */
export type FaceKey = CompositionCubeFace;

/** 면 순서(정면·후면·왼쪽·오른쪽·위·아래). 라이트박스 넘겨 보기·세트 카드 배치가 이 순서를 씁니다. */
export const FACE_KEYS: readonly FaceKey[] = COMPOSITION_CUBE_FACES;

/**
 * 파일 이름에 붙는 면 토큰. 위 면은 실외 «하늘», 실내 «천장» 둘 다 `top` 입니다.
 * 옛 파일은 전부 «천장» 으로 저장돼 있어서 두 이름을 다 읽습니다.
 */
export const FACE_TOKENS: Record<FaceKey, readonly string[]> = {
  front: ["정면"],
  back: ["후면"],
  left: ["왼쪽"],
  right: ["오른쪽"],
  top: ["하늘", "천장"],
  bottom: ["바닥"],
};

const TOKEN_TO_FACE: Record<string, FaceKey> = Object.fromEntries(
  FACE_KEYS.flatMap((face) => FACE_TOKENS[face].map((token) => [token, face] as const)),
);

/** 모든 면 토큰을 한 정규식 조각으로. */
const TOKEN_PATTERN = FACE_KEYS.flatMap((face) => FACE_TOKENS[face]).join("|");

/** `<접두>_<면>_<NNN>` — 접두에 밑줄이 들어갈 수 있어(`장소_변형`) 뒤에서부터 잡습니다. */
const FACE_STEM = new RegExp(`^(.+)_(${TOKEN_PATTERN})_(\\d{3,})$`);

/** `<접두>_<NNN>` — 세트 id 꼴. */
const SET_ID = /^(.+)_(\d{3,})$/;

/**
 * 화면에 보이는 면 이름. `spaceKind` 가 실내면 위 면이 «천장», 아니면 «하늘».
 * 파일 이름 토큰도 이것을 그대로 씁니다 (`faceFileToken`).
 */
export function faceLabel(face: FaceKey, spaceKind?: SpaceKind | null): string {
  if (face === "top") return spaceKind === "interior" ? "천장" : "하늘";
  return CUBE_FACE_LABELS[face];
}

/** 저장할 때 파일 이름에 넣는 면 토큰. 화면 이름과 같은 말을 써야 폴더에서도 알아봅니다. */
export const faceFileToken = faceLabel;

export interface ParsedFaceStem {
  /** 면 앞의 접두 — `장소` 또는 `장소_변형` */
  prefix: string;
  face: FaceKey;
  /** 파일에 적힌 토큰 그대로(«천장»·«하늘» 구분이 필요할 때) */
  token: string;
  /** 번호 문자열 `001` */
  number: string;
  /** 세트 id `<접두>_<NNN>` */
  setId: string;
}

/** 파일 이름(확장자 없이)에서 면 토큰을 찾습니다. 꼴이 아니면 null. */
export function parseFaceStem(stem: string): ParsedFaceStem | null {
  const bare = stem.startsWith("ref_") ? stem.slice(4) : stem;
  const match = FACE_STEM.exec(bare);
  if (!match) return null;
  const [, prefix, token, number] = match;
  return { prefix, face: TOKEN_TO_FACE[token], token, number, setId: `${prefix}_${number}` };
}

/** 경로에서 파일 이름(확장자 없이). `mediaLibrary.fileStem` 과 같지만 여기서는 의존을 끊습니다. */
function stemOf(path: string): string {
  const base = path.split(/[\\/]/).pop() || "";
  return base.replace(/\.[^.]+$/, "");
}

/** 경로의 폴더 부분. 세트를 폴더별로 묶을 때 씁니다. */
function folderOf(path: string): string {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}

/** 경로가 `…/6면/` 안인가. */
export function isInSixFacesDir(filePath?: string | null): boolean {
  if (!filePath) return false;
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.length >= 2 && parts[parts.length - 2] === SIX_FACES_DIR;
}

/** 경로의 파일 이름에서 면을 읽습니다. */
export function faceOfPath(filePath?: string | null): FaceKey | null {
  if (!filePath) return null;
  return parseFaceStem(stemOf(filePath))?.face ?? null;
}

/** 세트 인식에 필요한 최소 모양. `GeneratedImageAsset`·`PickerImage`·`SheetSource` 가 전부 맞습니다. */
export interface FaceLike {
  filePath?: string;
  thumb?: string;
  name?: string;
  face?: FaceKey;
  faceSet?: string;
}

/**
 * 그림 하나의 면. 저장할 때 채운 `face` 가 먼저, 없으면 경로·이름에서 읽습니다.
 * `name` 도 보는 이유: 저장이 끝나기 전(blob 만 있을 때)에도 세트 카드에 자리를 잡아야 해서.
 */
export function faceOf(image: FaceLike): FaceKey | null {
  if (image.face) return image.face;
  return faceOfPath(image.filePath) ?? (image.name ? parseFaceStem(image.name)?.face ?? null : null);
}

/** 그림 하나가 속한 세트 id (`<접두>_<NNN>`). 세트 아니면 null. */
export function faceSetIdOf(image: FaceLike): string | null {
  if (image.faceSet) return image.faceSet;
  const parsed = (image.filePath && parseFaceStem(stemOf(image.filePath))) || (image.name && parseFaceStem(image.name));
  return parsed ? parsed.setId : null;
}

/**
 * 세트 인식 옵션.
 *
 * `legacy` — `6면/` 밖(주인 폴더 뿌리)에 있는 파일도 이름만 `<접두>_<면>_<NNN>` 이면 세트로 묶을지.
 * 옛 배경 프로젝트(6면 폴더가 생기기 전)를 살리려는 규칙인데, 캐릭터·에셋에는 «정면»·«후면» 칩으로
 * 잘라낸 칸(`소품_정면_001`)이 같은 꼴이라 켜 두면 낱장 두 장이 «6면 세트» 로 접히고 세트 X 가
 * 둘을 함께 지웁니다. 6면은 배경 전용이므로 **배경 갈래에서만 켭니다.** 기본은 끔.
 * 저장 때 `face`·`faceSet` 를 둘 다 채운 그림은 우리가 만든 것이 확실하니 자리와 무관하게 묶습니다.
 */
export interface FaceSetOptions {
  legacy?: boolean;
}

/** 이 그림을 세트로 볼 수 있는 자리인가 — `6면/` 안이거나, legacy 가 켜졌거나, 저장 때 표를 붙였거나. */
function placementAllowed(image: FaceLike, options?: FaceSetOptions): boolean {
  if (!image.filePath || isInSixFacesDir(image.filePath)) return true;
  if (image.face && image.faceSet) return true;
  return Boolean(options?.legacy);
}

/** 세트 카드로 묶어야 하는 그림인가. 면과 세트 id 가 둘 다 잡혀야 합니다. */
export function isFaceSetMember(image: FaceLike, options?: FaceSetOptions): boolean {
  return placementAllowed(image, options) && faceOf(image) !== null && faceSetIdOf(image) !== null;
}

/**
 * 새 세트에 붙일 번호 — 폴더에 있는 같은 접두의 면 파일 번호 최댓값 + 1.
 *
 * 여섯 파일은 이름(`<접두>_<면>`)이 달라 Rust 의 «비어 있는 첫 번호» 를 면마다 따로 받으면
 * 번호가 어긋납니다(앞 세트가 3장에서 끊겼거나, 위 면이 «천장»→«하늘» 로 바뀐 뒤). 세트는
 * 번호로 묶이므로 한 번에 저장한 여섯 장이 둘로 갈립니다. 그래서 저장 전에 폴더를 읽어 번호를
 * **세트 단위로 한 번** 정합니다. «천장»·«하늘» 둘 다 `top` 으로 읽히니 같이 셉니다.
 */
export function nextFaceSetNumber(stems: string[], prefix: string): number {
  let max = 0;
  for (const stem of stems) {
    const parsed = parseFaceStem(stem);
    if (!parsed || parsed.prefix !== prefix) continue;
    max = Math.max(max, Number(parsed.number) || 0);
  }
  return max + 1;
}

export interface FaceSetEntry<T extends FaceLike = FaceLike> {
  path: string;
  thumb?: string;
  name: string;
  /** 원래 항목. 삭제·라이트박스가 이걸로 되돌아갑니다. */
  image: T;
}

export interface FaceSet<T extends FaceLike = FaceLike> {
  /** `<접두>_<NNN>`. 옛 규칙(뿌리 폴더)에 있는 세트는 뒤에 `@root` 가 붙어 새 세트와 겹치지 않습니다. */
  id: string;
  /** 화면 이름 «6면 세트 #1 · 장소» */
  label: string;
  prefix: string;
  /** 번호 문자열 `001` */
  number: string;
  /** 여섯 파일이 있는 폴더 (경로가 하나도 없으면 빈 문자열) */
  folder: string;
  faces: Partial<Record<FaceKey, FaceSetEntry<T>>>;
  /** 여섯 면이 다 있는가 */
  complete: boolean;
  missing: FaceKey[];
  /** `6면/` 이 아니라 주인 폴더 뿌리에 있는 옛 세트인가 */
  legacy: boolean;
}

/** «6면 세트 #1 · 장소». 번호는 사람이 읽게 앞의 0 을 뗍니다. */
export function faceSetLabel(prefix: string, number: string): string {
  return `6면 세트 #${Number(number) || number} · ${prefix}`;
}

/**
 * 낱장 목록에서 세트를 찾아 묶습니다. 세트가 아닌 그림은 무시합니다.
 *
 * 묶는 기준은 «같은 폴더 + 같은 `<접두>_<NNN>`». 폴더까지 보는 이유: 옛 프로젝트는
 * 뿌리에 `_001` 세트가 있고 새로 자르면 `6면/` 에도 `_001` 이 생겨 번호가 겹칩니다.
 * 같은 면이 두 장이면 먼저 온 것을 둡니다(목록 순서 = 저장 순서).
 */
export function collectFaceSets<T extends FaceLike>(images: T[], options?: FaceSetOptions): FaceSet<T>[] {
  const sets = new Map<string, FaceSet<T>>();
  for (const image of images) {
    if (!placementAllowed(image, options)) continue;
    const face = faceOf(image);
    const setId = faceSetIdOf(image);
    if (!face || !setId) continue;
    const parsedId = SET_ID.exec(setId);
    const prefix = parsedId?.[1] ?? setId;
    const number = parsedId?.[2] ?? "";
    const folder = image.filePath ? folderOf(image.filePath) : "";
    const legacy = Boolean(image.filePath) && !isInSixFacesDir(image.filePath);
    const key = `${folder}|${setId}`;
    let set = sets.get(key);
    if (!set) {
      set = {
        id: legacy ? `${setId}@root` : setId,
        label: faceSetLabel(prefix, number),
        prefix,
        number,
        folder,
        faces: {},
        complete: false,
        missing: [...FACE_KEYS],
        legacy,
      };
      sets.set(key, set);
    }
    if (set.faces[face]) continue;
    set.faces[face] = {
      path: image.filePath || "",
      thumb: image.thumb,
      name: image.name || (image.filePath ? stemOf(image.filePath) : ""),
      image,
    };
  }
  const out = [...sets.values()];
  for (const set of out) {
    set.missing = FACE_KEYS.filter((face) => !set.faces[face]);
    set.complete = set.missing.length === 0;
  }
  // 새 세트가 앞, 같은 자리면 번호 순.
  return out.sort((a, b) => Number(a.legacy) - Number(b.legacy) || a.prefix.localeCompare(b.prefix) || a.number.localeCompare(b.number));
}

/**
 * 목록을 «세트» 와 «낱장» 으로 가릅니다. 선반·씬 그림 고르기·시트 소스가 세트 카드를
 * 그릴 때 이걸 씁니다 — 세트에 든 그림은 `singles` 에서 빠집니다.
 */
export function splitFaceSets<T extends FaceLike>(images: T[], options?: FaceSetOptions): { sets: FaceSet<T>[]; singles: T[] } {
  const sets = collectFaceSets(images, options);
  const members = new Set<T>();
  for (const set of sets) {
    for (const face of FACE_KEYS) {
      const entry = set.faces[face];
      if (entry) members.add(entry.image);
    }
  }
  return { sets, singles: images.filter((image) => !members.has(image)) };
}

/** 세트의 면을 정해진 순서로. 빠진 면은 `entry` 없이 자리만 냅니다. */
export function orderedFaces<T extends FaceLike>(set: FaceSet<T>): { face: FaceKey; entry?: FaceSetEntry<T> }[] {
  return FACE_KEYS.map((face) => ({ face, entry: set.faces[face] }));
}

/** 세트에 있는 그림 전부(있는 면만). 세트 X 가 여섯 파일을 지울 때 씁니다. */
export function faceSetImages<T extends FaceLike>(set: FaceSet<T>): T[] {
  return FACE_KEYS.flatMap((face) => (set.faces[face] ? [set.faces[face]!.image] : []));
}

/**
 * 낱장 한 장의 화면 이름 — «정면 · 장소 #1». 세트가 아니면 원래 이름.
 * 파일 이름은 접두가 먼저지만(위 설명) 눈으로 고를 때는 면이 먼저 보여야 합니다.
 */
export function faceDisplayName(image: FaceLike, spaceKind?: SpaceKind | null): string {
  const face = faceOf(image);
  const setId = faceSetIdOf(image);
  if (!face || !setId) return image.name || "";
  const parsedId = SET_ID.exec(setId);
  const prefix = parsedId?.[1] ?? setId;
  const number = parsedId ? Number(parsedId[2]) || parsedId[2] : "";
  return `${faceLabel(face, spaceKind)} · ${prefix}${number === "" ? "" : ` #${number}`}`;
}
