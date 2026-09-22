import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/*
  **정밀도 이름이 같아도 «흘리기 방식» 이 바뀌면 다시 올려야 합니다.**

  `plan_precision` 의 `reload` 는 `mode`(실제로 올릴 정밀도)가 바뀌었는지만 봅니다.
  그런데 `SUPPORTED` 가 한 가지뿐인 엔진에서는 `mode` 가 **늘 같습니다** — 규칙이
  「줄여라」 라고 해도 내려갈 자리가 없으니까요. 그런 엔진은 대신 `plan["wanted"]` 를
  보고 «CPU 로 흘릴까» 를 정하는데, 그 값이 바뀌어도 `reload` 는 false 라 **옛 방식으로
  올라간 것을 계속 씁니다.** VRAM 이 빠듯해져 흘려야 하는 상황에서 통째로 올라간
  파이프를 그대로 쓰다 터집니다(2026-09-23, 음악 엔진 둘).

  읽어서는 못 찾는 모양이라 여기서 셉니다 — 「한 가지 정밀도 + wanted 로 갈래를 탄다」
  면 재사용 조건에도 wanted 를 넣었는지.
*/
const ENGINES = resolve(__dirname, "../../../src-tauri/resources/local/engines");

describe("엔진 다시 올리기 조건", () => {
  // 공개판에는 빠진 엔진이 있습니다 — 있는 것만 셉니다(`precisionPolicy.test.ts` 와 같은 까닭).
  const files = existsSync(ENGINES)
    ? readdirSync(ENGINES).filter((name) => name.endsWith(".py") && !name.startsWith("_"))
    : [];

  it("엔진 파일이 있습니다", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const text = readFileSync(resolve(ENGINES, file), "utf-8");
    const supported = /SUPPORTED\s*=\s*\(([^)]*)\)/.exec(text);
    if (!supported) continue;
    const count = supported[1].split(",").filter((one) => one.trim()).length;
    // 고를 수 있는 정밀도가 둘 이상이면 `mode` 가 실제로 바뀌므로 `reload` 로 충분합니다.
    if (count > 1) continue;
    // `wanted` 로 갈래를 타지 않는 엔진은 이 함정이 없습니다.
    if (!text.includes('plan["wanted"]')) continue;

    it(`${file} — 흘리기 방식이 바뀌면 다시 올립니다`, () => {
      expect(
        text.includes('was != plan["wanted"]'),
        `${file} 는 정밀도가 한 가지뿐인데 wanted 로 갈래를 탑니다 — ` +
          "재사용 조건에도 wanted 를 넣어야 옛 방식으로 올라간 것을 계속 쓰지 않습니다",
      ).toBe(true);
    });
  }
});
