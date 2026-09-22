import { describe, expect, it } from "vitest";
import editionRules from "../../../edition.json";
import { EDITION, excludedEnginesIn, isEngineIncluded, isEngineIncludedIn } from "./edition";

/**
 * 판 판정 시험.
 *
 * 제외 목록의 «내용» 은 여기서 못 박지 않습니다 — 그건 `edition.json` 의 몫이고, 여기 다시
 * 적으면 두 벌이 됩니다. 대신 «파일에 적힌 대로 거르는가» 와 «비공개판은 아무것도 안 거르는가»
 * 를 봅니다.
 */
describe("isEngineIncludedIn", () => {
  const excluded = editionRules.public.excludeEngines;

  it("공개판은 edition.json 의 제외 목록을 그대로 거른다", () => {
    expect(excluded.length).toBeGreaterThan(0);
    for (const id of excluded) expect(isEngineIncludedIn("public", id)).toBe(false);
    expect(excludedEnginesIn("public")).toEqual(excluded);
  });

  it("공개판이라도 목록에 없는 엔진은 들어간다", () => {
    for (const id of ["seedvr2", "spandrel", "vosr", "sam3dbody", "krea2", "ltx25", "comfy"]) {
      expect(excluded).not.toContain(id);
      expect(isEngineIncludedIn("public", id)).toBe(true);
    }
  });

  it("비공개판은 아무것도 거르지 않는다", () => {
    expect(excludedEnginesIn("private")).toEqual([]);
    for (const id of excluded) expect(isEngineIncludedIn("private", id)).toBe(true);
  });

  it("제외한 엔진마다 까닭(_why)이 적혀 있다 — 왜 뺐는지 잊지 않게", () => {
    const why = editionRules.public._why as Record<string, string>;
    for (const id of excluded) expect(why[id]?.trim().length ?? 0).toBeGreaterThan(0);
    // 반대로, 까닭만 있고 목록에서 빠진 id 도 없어야 합니다 — 지우다 만 흔적.
    for (const id of Object.keys(why)) expect(excluded).toContain(id);
  });

  it("isEngineIncluded 는 이 빌드의 판(EDITION)을 따른다", () => {
    for (const id of excluded) expect(isEngineIncluded(id)).toBe(isEngineIncludedIn(EDITION, id));
    expect(isEngineIncluded("seedvr2")).toBe(true);
  });
});
