import { describe, expect, it } from "vitest";
import { safeFileName } from "@/lib/mediaLibrary";

/*
  **휴지통 이름은 사람이 지을 수 없어야 합니다.**

  지운 것은 프로젝트 폴더 안 `.휴지통/` 에 한 단계 둡니다(`src-tauri/src/trash.rs`).
  인물·배경 이름이 그 폴더와 같아지면 「지운 것이 목록에 딸려 오는」 상태가 되고,
  더 나쁘게는 새 인물을 만들다 휴지통을 건드립니다.

  실제로 막고 있는 것은 **앞뒤 점 떼기** 한 줄입니다(`safeFileName` · Rust `safe_name`
  양쪽). 이름을 «.휴지통» 으로 지어도 점이 떨어져 «휴지통» 이 되므로 절대 겹치지 않습니다.
  눈에 잘 안 띄는 성질이라 여기서 셉니다 — 점 떼기를 지우면 여기가 먼저 웁니다.
*/
describe("휴지통 이름은 지을 수 없습니다", () => {
  const TRASH = ".휴지통";

  it("점으로 시작하는 이름은 점이 떨어집니다", () => {
    expect(safeFileName(TRASH)).toBe("휴지통");
    expect(safeFileName(TRASH)).not.toBe(TRASH);
    expect(safeFileName("..휴지통")).not.toBe(TRASH);
    expect(safeFileName("  .휴지통  ")).not.toBe(TRASH);
  });

  it("점만 있는 이름도 폴더를 가리키지 않습니다", () => {
    // 빈 이름이 경로에 들어가면 상위 폴더 자체를 가리킵니다(2026-09-05 사고).
    for (const name of [".", "..", "...", "   "]) {
      expect(safeFileName(name)).toBe("이름없음");
    }
  });
});
