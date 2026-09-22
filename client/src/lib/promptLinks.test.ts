import { describe, expect, it } from "vitest";
import { relinkPromptText, type PromptLinkInput } from "@/lib/promptLinks";

/**
 * 「@ 다시 잇기」 — 2026-09-22 사용자가 잡은 셋을 못 박습니다.
 *
 * ① 그림을 뺀 사람의 태그가 안 빠지던 것(이름에 공백·괄호가 있으면 앞머리만 읽음)
 * ② 「시간대: 밤」 이 누를 때마다 한 벌씩 늘던 것(여러 줄 생김새가 꼬리 줄에 그대로 들어감)
 * ③ 영문 칸의 꼬리에 한글 생김새가 박히던 것
 */

const SHEET = "D:/저장/국호/characters/서진우 (니시무라 진)/서진우 (니시무라 진)_002.png";

const jinwoo = (paths: string[] = []) => ({
  name: "서진우 (니시무라 진)",
  paths,
  look: "42세 / 178cm / 짧게 정돈한 검은 머리",
  aliases: ["Seo Jinwoo"],
});
const hana = { name: "서하나", paths: [] as string[], look: "여성 / 12세 / 150cm", aliases: ["Seo Hana"] };
const highway = {
  name: "중앙고속도로",
  look: "젖은 검은 아스팔트, 연속된 터널 입구\n시간대: 밤\n분위기: 절박하고 차가움",
};

describe("relinkPromptText — 그림을 뺀 사람", () => {
  it("공백·괄호가 든 이름의 죽은 태그를 맨 이름으로 되돌리고 «아직 그림 없음» 에 세운다", () => {
    const text =
      "@서진우 (니시무라 진)_001이 운전하고 서하나가 창밖을 본다.\n\n참고 그림: 서진우 (니시무라 진) @서진우 (니시무라 진)_001";
    const input: PromptLinkInput = { people: [jinwoo([]), hana] };
    const out = relinkPromptText(text, input, "ko");
    expect(out).not.toContain("@");
    expect(out.startsWith("서진우 (니시무라 진)이 운전하고 서하나가 창밖을 본다.")).toBe(true);
    expect(out).toContain("아직 그림 없음: 서진우 (니시무라 진) — 42세 / 178cm / 짧게 정돈한 검은 머리 / 서하나 — 여성 / 12세 / 150cm");
  });

  it("다시 걸면 옛 번호의 태그가 새 그림으로 바뀌고 조사는 남는다", () => {
    const text = "@서진우 (니시무라 진)_001이 운전한다.";
    const out = relinkPromptText(text, { people: [jinwoo([SHEET])] }, "ko");
    expect(out.startsWith("@서진우 (니시무라 진)_002이 운전한다.")).toBe(true);
    expect(out).toContain("참고 그림: 서진우 (니시무라 진) @서진우 (니시무라 진)_002");
  });
});

describe("relinkPromptText — 여러 줄 생김새", () => {
  const input: PromptLinkInput = { people: [hana], background: highway, guideNote: "투 샷, 눈높이" };

  it("꼬리 줄은 한 줄이고, 두 번 눌러도 같다", () => {
    const once = relinkPromptText("차가 터널로 들어간다.", input, "ko");
    expect(once.split("시간대").length - 1).toBe(1);
    expect(once).toContain("중앙고속도로 — 젖은 검은 아스팔트, 연속된 터널 입구 · 시간대: 밤 · 분위기: 절박하고 차가움");
    const twice = relinkPromptText(once, input, "ko");
    expect(twice).toBe(once);
  });

  it("옛 판이 쌓아 둔 「시간대: 밤」 찌꺼기를 한 번에 걷어 낸다", () => {
    const rest = "시간대: 밤\n분위기: 절박하고 차가움 / 서하나 — 여성 / 12세 / 150cm";
    const legacy = [
      "차가 터널로 들어간다.",
      rest,
      rest,
      rest,
      "참고 그림: 서진우 (니시무라 진) @서진우 (니시무라 진)_001",
      `아직 그림 없음: 구도 — 투 샷, 눈높이 / 중앙고속도로 — 젖은 검은 아스팔트, 연속된 터널 입구\n${rest}`,
    ].join("\n\n");
    const out = relinkPromptText(legacy, input, "ko");
    expect(out.split("시간대").length - 1).toBe(1);
    expect(out.startsWith("차가 터널로 들어간다.\n\n아직 그림 없음:")).toBe(true);
  });
});

describe("relinkPromptText — 영문 칸", () => {
  it("꼬리에 한글 생김새를 넣지 않고 로마자 이름으로 자리만 잡는다", () => {
    const out = relinkPromptText("Seo Jinwoo drives into the tunnel.", {
      people: [jinwoo([]), hana],
      background: highway,
      guideNote: "투 샷, 눈높이",
      guideNoteEn: "two shot, eye level",
    }, "en");
    expect(out.startsWith("Seo Jinwoo drives into the tunnel.")).toBe(true);
    expect(out).toContain("Not yet generated: layout — two shot, eye level / 중앙고속도로 / Seo Jinwoo / Seo Hana");
    expect(out).not.toContain("시간대");
    expect(out).not.toContain("42세");
  });

  it("그림이 걸리면 영문 본문의 로마자 이름이 태그가 된다", () => {
    const out = relinkPromptText("Seo Jinwoo drives into the tunnel.", { people: [jinwoo([SHEET])] }, "en");
    expect(out.startsWith("@서진우 (니시무라 진)_002 drives into the tunnel.")).toBe(true);
    expect(out).toContain("Reference images: Seo Jinwoo @서진우 (니시무라 진)_002");
  });
});
