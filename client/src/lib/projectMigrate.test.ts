import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  migrateSavedProject,
  schemaVersionOf,
} from "./projectMigrate";

/**
 * 저장본 판 매기기 시험.
 *
 * 무엇을 지키는 시험인가 — ① 판 없는 옛 저장본이 조용히 지금 판이 되고, ② 이미 지금 판이면
 * 손대지 않고, ③ 모르는 미래 판을 **버리지 않고** 그대로 두며, ④ 판을 붙이느라 초안을
 * 건드리지 않는가. ④ 가 특히 중요합니다 — 저장 관문의 「내용이 그대로면 쓰지 않습니다」 가
 * 초안을 통째로 견주기 때문에, 초안이 조금이라도 달라지면 앱을 켜기만 해도 작품 수만큼
 * 파일 쓰기가 나가고 두 창이 서로를 되돌립니다.
 */

/** 시험용 옛 저장본 한 덩이. 판 칸이 없습니다. */
function oldSave() {
  return {
    id: "p1",
    title: "옛 작품",
    updatedAt: "2026-01-01T00:00:00.000Z",
    draft: { title: "옛 작품", characters: [{ id: "c1", name: "냥이" }] },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("schemaVersionOf", () => {
  it("판이 없으면 0 으로 본다", () => {
    expect(schemaVersionOf(oldSave())).toBe(0);
    expect(schemaVersionOf({})).toBe(0);
    expect(schemaVersionOf(null)).toBe(0);
  });

  it("정수가 아니거나 음수인 값도 0 으로 본다 — 못 읽는 것보다 낫다", () => {
    expect(schemaVersionOf({ schemaVersion: 1.5 })).toBe(0);
    expect(schemaVersionOf({ schemaVersion: -3 })).toBe(0);
    expect(schemaVersionOf({ schemaVersion: "1" })).toBe(0);
    expect(schemaVersionOf({ schemaVersion: Number.NaN })).toBe(0);
  });

  it("적힌 판을 그대로 읽는다", () => {
    expect(schemaVersionOf({ schemaVersion: 0 })).toBe(0);
    expect(schemaVersionOf({ schemaVersion: 99 })).toBe(99);
  });
});

describe("migrateSavedProject", () => {
  it("판 없는 옛 저장본은 지금 판이 된다", () => {
    const moved = migrateSavedProject(oldSave());
    expect(moved.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(PROJECT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("판을 올려도 초안과 나머지 칸은 한 글자도 바뀌지 않는다", () => {
    const saved = oldSave();
    const before = JSON.stringify(saved.draft);
    const moved = migrateSavedProject(saved);

    // 「내용이 그대로면 쓰지 않습니다」 가 견주는 것이 바로 이 초안입니다.
    expect(JSON.stringify(moved.draft)).toBe(before);
    expect(moved.draft).toBe(saved.draft);
    expect(moved.id).toBe("p1");
    expect(moved.title).toBe("옛 작품");
    expect(moved.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("이미 지금 판이면 받은 것을 그대로 돌려준다", () => {
    const saved = { ...oldSave(), schemaVersion: PROJECT_SCHEMA_VERSION };
    expect(migrateSavedProject(saved)).toBe(saved);
  });

  it("두 번 올려도 같다 — 목록 읽기와 되읽기가 같은 결과라야 한다", () => {
    const once = migrateSavedProject(oldSave());
    const twice = migrateSavedProject(once);
    expect(twice).toBe(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it("모르는 미래 판은 버리지 않고 그대로 두되 경고를 남긴다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const future = { ...oldSave(), schemaVersion: 99, 앞으로생길칸: "지우면 안 됨" };

    const moved = migrateSavedProject(future, "p1");

    // 내려 깎으면 새 판에만 있는 칸이 사라져 파일이 상합니다.
    expect(moved).toBe(future);
    expect(moved.schemaVersion).toBe(99);
    expect(moved.앞으로생길칸).toBe("지우면 안 됨");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("p1");
  });

  it("저장본이 아닌 것을 받아도 터지지 않는다", () => {
    expect(migrateSavedProject(null as never)).toBe(null);
    expect(migrateSavedProject(undefined as never)).toBe(undefined);
  });
});
