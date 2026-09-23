import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { heroImageOf } from "@/lib/cutVideoPrompt";
import { findMotionMask } from "@/lib/motionMask";
import type { Cut, GeneratedImageAsset } from "@/types/project";

/*
  **그린 마스크가 워커까지 닿는가** — 사슬을 한 마디씩 셉니다.

  2026-09-23 에 실제로 있던 일입니다. 마스크를 그리는 화면도 있고, 단추에 `motionMask`
  칸도 있고, `opts.motion_mask` 로 보내는 코드도 있었는데 — **그 칸을 채우는 쪽이 아무도
  없었고, 읽는 워커도 없었습니다.** 그린 사람 눈에는 프롬프트 한 줄이 들어가니까
  「먹히긴 하는데 약하다」 로 보입니다. 로라가 조용히 안 붙던 것과 같은 모양입니다.

  이런 사슬은 읽어서는 못 찾습니다(여덟 마디는 맞고 한 마디만 비어 있습니다).
  그래서 양 끝과 가운데를 셉니다.
*/
const asset = (name: string, extra: Partial<GeneratedImageAsset> = {}) =>
  ({ id: name, name, filePath: `D:/p/${name}.png`, ...extra }) as GeneratedImageAsset;

describe("움직임 마스크가 워커까지 닿는가", () => {
  it("마스크는 대표 그림이 되지 않습니다 — 새까만 판이 첫 프레임이 되면 안 됩니다", () => {
    // 선반은 처음 들어온 그림에 별을 답니다. 그림 없는 컷에 마스크를 먼저 그리면 이 모양이 됩니다.
    const cut = {
      images: [asset("차_움직임_001", { isPrimary: true }), asset("차_001")],
    } as unknown as Cut;
    expect(heroImageOf(cut)?.name).toBe("차_001");
  });

  it("그림이 마스크뿐이면 대표는 **없습니다** — 물러서는 길에서도", () => {
    /*
      한때 「걸러 내고 아무것도 안 남으면 원래 목록으로 물러선다」 로 두었고, 이 시험도
      그 동작을 «정상» 으로 적고 있었습니다. 그런데 마스크가 대표가 되면 스토리보드 칸과
      로컬 영상의 **첫 프레임**으로 새까만 판이 들어갑니다. 마스크를 그린 뒤 원본 그림을
      지우면 실제로 그 상태가 됩니다(2026-09-23 검토).
    */
    const cut = { images: [asset("차_움직임_001")] } as unknown as Cut;
    expect(heroImageOf(cut)).toBeNull();
  });

  it("합성 시트뿐이면 그것이라도 씁니다 — 그림이긴 합니다", () => {
    const cut = {
      images: [asset("차_시트", { isCompositeSheet: true }), asset("차_움직임_001")],
    } as unknown as Cut;
    expect(heroImageOf(cut)?.name).toBe("차_시트");
  });

  it("그림 선반에서 마스크를 찾습니다 — 여럿이면 마지막 것", () => {
    const found = findMotionMask([
      asset("차_001"),
      asset("차_움직임_001"),
      asset("차_움직임_002"),
    ]);
    expect(found?.name).toBe("차_움직임_002");
    expect(findMotionMask([asset("차_001")])).toBeNull();
  });

  it("컷 카드가 마스크를 로컬 단추에 넘깁니다", () => {
    const text = readFileSync(
      resolve(__dirname, "../components/project/CutVideoSection.tsx"),
      "utf-8",
    );
    expect(text).toContain("motionMask={motionMask?.filePath");
  });

  it("영상 뼈대에 마스크 이름이 실립니다 — 말해 주지 않으면 모델이 배경까지 흔듭니다", () => {
    const text = readFileSync(resolve(__dirname, "./promptPayloads.ts"), "utf-8");
    expect(text).toContain("motionMaskName: findMotionMask(cut.images)?.name");
  });

  it("영상 워커 셋이 전부 마스크를 읽습니다 — 한 엔진만 빠지면 그 엔진에서만 조용히 무시됩니다", () => {
    const local = resolve(__dirname, "../../../src-tauri/resources/local");
    expect(readFileSync(resolve(local, "common.py"), "utf-8")).toContain("def freeze_by_mask(");
    for (const engine of ["ltx25", "wanvideo", "minimaxh3"]) {
      const text = readFileSync(resolve(local, `engines/${engine}.py`), "utf-8");
      expect(text, `${engine} 가 마스크를 안 읽습니다`).toContain(
        'common.freeze_by_mask(',
      );
      expect(text, `${engine} 가 opts 에서 마스크를 안 꺼냅니다`).toContain('opts.get("motion_mask")');
    }
  });
});
