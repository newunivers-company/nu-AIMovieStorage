import editionRules from "../../../edition.json";

/**
 * 앱의 **판** — 비공개(private) / 공개(public).
 *
 *
 *
 * 그래서 판은 **빌드할 때** 정해집니다(`scripts/tauri.mjs --edition public` 이 `VITE_EDITION`
 * 을 심습니다). 실행 중에 바꾸는 값이 아닙니다 — 공개판은 제외 엔진의 워커 스크립트 자체가
 * 번들에 없어서, 화면에서 숨기는 것만으로는 반쪽입니다. Rust(`src-tauri/src/edition.rs`)도
 * 같은 `edition.json` 을 읽어 설치·실행 명령을 막습니다.
 *
 * 제외 목록은 저장소 뿌리의 **`edition.json` 한 곳**에만 있습니다. 여기서는 그 파일을
 * 읽기만 하고, id 를 적지 않습니다.
 */
export type Edition = "private" | "public";

/** 빌드가 심어 준 판. 안 심었으면(개발·사용자의 빌드) 비공개판 = 전부 들어 있음. */
export const EDITION: Edition = import.meta.env.VITE_EDITION === "public" ? "public" : "private";

/** 그 판에서 빠지는 엔진 id. 비공개판은 아무것도 빠지지 않습니다. */
export function excludedEnginesIn(edition: Edition): readonly string[] {
  return edition === "public" ? editionRules.public.excludeEngines : [];
}

/** 순수 판정 — 시험과 «다른 판이면 어떻게 되나» 를 보는 데 씁니다. */
export function isEngineIncludedIn(edition: Edition, id: string): boolean {
  return !excludedEnginesIn(edition).includes(id);
}

/**
 * 이 빌드의 판에 그 엔진이 들어 있는가.
 *
 * 엔진 목록(`UPSCALE_ENGINE_IDS` · `LOCAL_ENGINE_IDS`)이 정의되는 자리에서 한 번 거릅니다.
 * 목록을 쓰는 화면들(설정·로라 서랍·모델 고르기·모션 캡처)은 그래서 손댈 것이 없습니다 —
 * 화면마다 거르면 한 화면을 빠뜨리는 날이 옵니다.
 */
export function isEngineIncluded(id: string): boolean {
  return isEngineIncludedIn(EDITION, id);
}
