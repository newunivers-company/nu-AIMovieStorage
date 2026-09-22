import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/*
  **깃허브 워크플로가 실제로 돌 모양인가** — 여기서 미리 셉니다.

  2026-09-23: 릴리스 워크플로의 job id 를 한글(`검사`)로 적었습니다. YAML 로는 멀쩡히
  파싱되고, 로컬에서는 아무 데서도 안 걸립니다. 그런데 깃허브는 **워크플로 전체를 무효로**
  보고, 이름 자리에 파일 경로를 적은 채 실패시킵니다 — 어느 줄이 문제인지 한 마디도
  안 합니다. 판 두 개가 그렇게 조용히 죽었습니다.

  job id 는 `[A-Za-z_][A-Za-z0-9_-]*` 여야 합니다. 보이는 이름은 `name:` 으로 답니다.
  `needs:` 도 id 를 가리키므로 같이 셉니다 — 한쪽만 고치면 또 무효가 됩니다.
*/
const DIR = resolve(__dirname, "../../../.github/workflows");
const ID = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** `jobs:` 아래 한 칸 들여쓴 열쇠만 모읍니다(YAML 한 벌을 들이지 않으려고). */
function jobIds(text: string): string[] {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.trimEnd() === "jobs:");
  if (at < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^\S/.test(line)) break; // 다음 최상위 열쇠
    const hit = /^ {2}([^\s#][^:]*):\s*$/.exec(line);
    if (hit) out.push(hit[1].trim());
  }
  return out;
}

describe("깃허브 워크플로", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));

  it("파일이 있습니다", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const text = readFileSync(resolve(DIR, file), "utf-8");
    const ids = jobIds(text);

    it(`${file} — job id 는 영문입니다`, () => {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(ID.test(id), `${file} 의 job id «${id}» 를 깃허브가 거절합니다`).toBe(true);
      }
    });

    it(`${file} — needs 가 실제 job 을 가리킵니다`, () => {
      for (const hit of text.matchAll(/^\s*needs:\s*(.+)$/gm)) {
        const named = hit[1]
          .replace(/[[\]]/g, "")
          .split(",")
          .map((one) => one.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        for (const one of named) {
          expect(ids, `${file} 의 needs «${one}» 가 없는 job 입니다`).toContain(one);
        }
      }
    });
  }
});
