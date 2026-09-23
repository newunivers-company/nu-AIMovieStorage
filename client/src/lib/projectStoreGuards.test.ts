import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
  **저장본을 지키는 두 문**을 셉니다.

  둘 다 「읽어서는 안 보이는」 모양입니다 — 코드는 멀쩡해 보이는데 어느 순간 남의 작품이
  비워지거나, 목록에 임자 없는 항목이 앉습니다. 그래서 규칙이 살아 있는지 글로 셉니다.

  ① **빈 저장 허용에는 임자가 있어야 합니다.** 예전에는 참/거짓 하나였습니다. A 에서
     장면을 지우고 곧바로 B 로 옮기면 그 허용이 B 의 첫 자동 저장을 통과시켜 B 를 빈
     값으로 덮을 수 있었습니다 — 허용은 한 번만 쓰이지만 «누구의 한 번인지» 가
     없었기 때문입니다.

  ② **문법만 맞는 파일은 목록에 들이지 않습니다.** `JSON.parse` 는 `{}` 도 통과시킵니다.
     그대로 들이면 id 없는 항목이 앉아, id 로 찾는 자리마다 엉뚱한 것을 집습니다.
     그런 파일이 둘이면 서로 겹칩니다.

  (2026-09-23 검토)
*/
const SOURCE = readFileSync(resolve(__dirname, "./localProjectStore.ts"), "utf-8");

describe("저장본을 지키는 문", () => {
  it("빈 저장 허용에 임자가 있습니다", () => {
    // 참/거짓 하나로 돌아가면 여기가 먼저 웁니다.
    expect(SOURCE).not.toContain("let emptySaveExpected");
    expect(SOURCE).toContain("let emptySaveFor: string | null");
    expect(SOURCE).toContain("emptySaveFor = lastStagedId");
  });

  it("허용은 그 작품의 저장에만 듭니다", () => {
    expect(SOURCE).toContain("emptySaveFor === lastStagedId && lastStagedId === id");
  });

  it("작품이 바뀌면 남은 허용을 버립니다", () => {
    // 옮겨 간 뒤 첫 저장이 남의 허용을 쓰지 않게.
    expect(SOURCE).toMatch(/if \(lastStagedId !== id\) \{\s*\n\s*emptySaveFor = null;/);
  });

  it("목록은 저장 폴더가 정해진 뒤에 읽습니다", () => {
    /*
      설치본과 개발 서버는 웹뷰 origin 이 달라 localStorage 가 갈립니다. 진짜 저장 폴더는
      거울 파일에 있고 읽어 오는 데 한 틱이 걸립니다. 기다리지 않으면 **옛 폴더에서 목록을
      읽고 그다음 저장은 새 폴더로** 나갑니다(2026-09-23 재현: 목록 D:/old, 저장 D:/new).

      기다리는 자리는 화면이 아니라 `loadProjects` 안이어야 합니다 — 부르는 쪽이 둘이라
      화면마다 적으면 한 곳을 빠뜨립니다.
    */
    const body = SOURCE.slice(SOURCE.indexOf("export async function loadProjects"));
    const head = body.slice(0, body.indexOf("readLocalStorage()"));
    expect(head, "폴더가 정해지기 전에 목록을 읽습니다").toContain("await whenAppSettingsReady()");
  });

  it("문법만 맞는 파일은 걸러집니다", () => {
    expect(SOURCE).toContain("function looksLikeProject");
    expect(SOURCE).toContain("if (!looksLikeProject(parsed))");
  });

  it("차례 매기기가 한 벌입니다 — 세 곳이 같은 줄을 적고 있었습니다", () => {
    expect(SOURCE).toContain("function byNewest");
    // 날것 `b.updatedAt.localeCompare(` 가 남아 있으면 그 자리에서 터집니다.
    expect(SOURCE).not.toMatch(/b\.updatedAt\.localeCompare/);
  });

  it("건너뛴 파일은 기록에 남습니다 — 조용히 사라지면 「작품이 없어졌다」 가 됩니다", () => {
    expect(SOURCE).toContain("brokenFiles.push");
    expect(SOURCE).toContain("export function brokenProjectFiles");
  });
});

/*
  `looksLikeProject` 는 모듈 안에 숨어 있습니다(바깥에서 부를 일이 없습니다).
  규칙 자체는 여기서 같은 모양으로 한 번 더 세어 둡니다 — 필수를 넓게 잡으면 옛
  저장본이 통째로 안 열리므로, **무엇을 필수로 보는가**가 바뀌면 여기가 걸립니다.
*/
describe("무엇을 프로젝트로 볼까", () => {
  const looksLikeProject = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const item = value as { id?: unknown; draft?: unknown };
    if (typeof item.id !== "string" || !item.id.trim()) return false;
    return Boolean(item.draft) && typeof item.draft === "object";
  };

  it("id 와 draft 가 있으면 프로젝트입니다", () => {
    expect(looksLikeProject({ id: "a", draft: {} })).toBe(true);
  });

  it("빈 객체·배열·빈 id 는 아닙니다", () => {
    for (const bad of [{}, [], null, "글자", { id: "a" }, { draft: {} }, { id: "  ", draft: {} }]) {
      expect(looksLikeProject(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("제목이나 폴더가 없어도 프로젝트입니다 — 필수를 넓게 잡으면 옛 저장본이 안 열립니다", () => {
    expect(looksLikeProject({ id: "a", draft: { scenes: [] } })).toBe(true);
  });
});

/*
  차례 매기기는 **이상한 항목이 섞여도 터지지 않아야** 합니다. 작품 하나가 이상해서
  나머지가 전부 안 보이는 모양이 가장 나쁩니다.
*/
describe("차례 매기기", () => {
  const byNewest = (a: { updatedAt?: string }, b: { updatedAt?: string }) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));

  it("나중 것이 앞입니다", () => {
    const list = [{ updatedAt: "2026-01-01" }, { updatedAt: "2026-09-01" }];
    expect([...list].sort(byNewest)[0].updatedAt).toBe("2026-09-01");
  });

  it("도장이 없는 항목이 섞여도 안 터집니다", () => {
    const list = [{ updatedAt: "2026-09-01" }, {}, { updatedAt: undefined }];
    expect(() => [...list].sort(byNewest)).not.toThrow();
    expect([...list].sort(byNewest)[0].updatedAt).toBe("2026-09-01");
  });
});
