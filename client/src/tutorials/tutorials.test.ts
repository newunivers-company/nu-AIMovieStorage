import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { missingKeys, placeholderNames } from "@/lib/i18n";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import chromeKeys from "@/locales/keys.chrome.json";
import zh from "@/locales/zh.json";
import {
  ALL_ANCHORS,
  FULL_TUTORIAL,
  PAGE_TUTORIALS,
  PLANNER_TUTORIALS,
  TUTORIALS,
  allSteps,
  stepAdvanceMode,
  tutorialsFor,
} from "./index";
import type { TutorialPage } from "./types";

/*
  튜토리얼 자료의 «모양» 을 지킵니다.

  걸음 이름이 겹치면 «어디까지 봤나» 가 엉뚱한 걸음을 가리키고, 앵커 이름이 표(ANCHORS.md)와
  어긋나면 화면에 `data-tour` 를 단 쪽과 자료가 서로 다른 이름을 부릅니다 — 읽어서는 못 찾는
  종류의 어긋남이라 여기서 셉니다.

  번역도 같은 종류입니다. 한국어 문장이 사전의 열쇠라, 걸음 하나를 고치고 세 사전 중 한 곳을
  빠뜨리면 그 언어에서 그 걸음만 한국어로 뜹니다(«여덟 곳은 맞고 한 곳만 틀리다»). 아래
  「튜토리얼 번역」 이 모든 문장에 세 언어 번역이 있는지, 세 사전의 열쇠가 같은지 셉니다.
*/

/** 화면에 나가는 문장 전부 — 제목 · 요약 · 걸음의 제목 · 본문 · 해 볼 것 · 까닭. 중복 없이. */
function tutorialTexts(): string[] {
  const texts = new Set<string>();
  for (const tutorial of TUTORIALS) {
    texts.add(tutorial.title);
    texts.add(tutorial.summary);
    for (const step of tutorial.steps) {
      texts.add(step.title);
      texts.add(step.body);
      if (step.action) texts.add(step.action);
      if (step.why) texts.add(step.why);
    }
  }
  return [...texts];
}

const ANCHOR_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PAGES: TutorialPage[] = ["projects", "basics", "characters", "scenes", "finish", "settings", "bgm", "planner"];

function documentedAnchors(): Set<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const text = readFileSync(join(here, "ANCHORS.md"), "utf8");
  const found = new Set<string>();
  // 표의 첫 칸 — `| \`anchor-id\` | …`
  for (const match of text.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)) found.add(match[1]);
  return found;
}

describe("튜토리얼 자료", () => {
  it("튜토리얼 id 와 걸음 id 가 전부 다릅니다", () => {
    const tutorialIds = TUTORIALS.map((tutorial) => tutorial.id);
    expect(new Set(tutorialIds).size).toBe(tutorialIds.length);

    const stepIds = allSteps().map((step) => step.id);
    const seen = new Set<string>();
    const dupes = stepIds.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dupes).toEqual([]);
  });

  it("걸음마다 제목과 본문이 있고, 걸음 id 는 튜토리얼 id 로 시작합니다", () => {
    for (const tutorial of TUTORIALS) {
      expect(tutorial.title.trim()).not.toBe("");
      expect(tutorial.summary.trim()).not.toBe("");
      expect(tutorial.steps.length).toBeGreaterThan(0);
      for (const step of tutorial.steps) {
        expect(step.title.trim(), step.id).not.toBe("");
        expect(step.body.trim(), step.id).not.toBe("");
        expect(step.id.startsWith(`${tutorial.id}-`), `${step.id} ← ${tutorial.id}`).toBe(true);
        if (step.action) expect(step.action.startsWith("해 볼 것: "), step.id).toBe(true);
      }
    }
  });

  it("앵커 이름은 kebab-case 이고 route 가 있으면 page 도 있습니다", () => {
    for (const step of allSteps()) {
      if (step.anchor) expect(step.anchor, step.id).toMatch(ANCHOR_ID);
      if (step.route) expect(step.page, step.id).toBeDefined();
    }
    for (const anchor of ALL_ANCHORS) expect(anchor).toMatch(ANCHOR_ID);
    expect(new Set(ALL_ANCHORS).size).toBe(ALL_ANCHORS.length);
    expect([...ALL_ANCHORS].sort()).toEqual(ALL_ANCHORS);
  });

  it("한 바퀴는 25걸음 이상이고 걸음마다 «해 볼 것» 이 있습니다", () => {
    expect(FULL_TUTORIAL.kind).toBe("full");
    expect(FULL_TUTORIAL.steps.length).toBeGreaterThanOrEqual(25);
    expect(FULL_TUTORIAL.steps.length).toBeLessThanOrEqual(40);
    for (const step of FULL_TUTORIAL.steps) expect(step.action, step.id).toBeDefined();
    // 설정 → 새 작품 → 캐릭터 → 씬(구도잡기) → 확인 순서를 지납니다.
    const order = FULL_TUTORIAL.steps.map((step) => step.page).filter(Boolean);
    const firstOf = (page: TutorialPage) => order.indexOf(page);
    expect(firstOf("settings")).toBeLessThan(firstOf("basics"));
    expect(firstOf("basics")).toBeLessThan(firstOf("characters"));
    expect(firstOf("characters")).toBeLessThan(firstOf("scenes"));
    expect(firstOf("scenes")).toBeLessThan(firstOf("planner"));
    expect(firstOf("planner")).toBeLessThan(firstOf("finish"));
  });

  it("페이지별 튜토리얼은 화면마다 하나, 구도잡기는 여러 갈래", () => {
    const pagesCovered = PAGE_TUTORIALS.map((tutorial) => tutorial.page);
    expect(new Set(pagesCovered).size).toBe(PAGE_TUTORIALS.length);
    for (const page of PAGES.filter((item) => item !== "planner")) {
      expect(tutorialsFor(page).length, page).toBeGreaterThanOrEqual(1);
    }
    expect(tutorialsFor("planner").length).toBeGreaterThanOrEqual(5);
    for (const tutorial of [...PAGE_TUTORIALS, ...PLANNER_TUTORIALS]) {
      expect(tutorial.steps.length, tutorial.id).toBeGreaterThanOrEqual(5);
      expect(tutorial.steps.length, tutorial.id).toBeLessThanOrEqual(14);
      expect(tutorial.page, tutorial.id).toBeDefined();
    }
    for (const tutorial of PLANNER_TUTORIALS) {
      expect(tutorial.kind).toBe("planner");
      expect(tutorial.page).toBe("planner");
    }
    // 한 바퀴는 «막혔을 때» 목록에 안 섞입니다.
    for (const page of PAGES) expect(tutorialsFor(page).some((tutorial) => tutorial.kind === "full")).toBe(false);
  });

  it("걸음이 부르는 앵커는 전부 ANCHORS.md 표에 있고, 표의 앵커는 전부 쓰입니다", () => {
    const documented = documentedAnchors();
    const used = new Set(ALL_ANCHORS);
    const missing = ALL_ANCHORS.filter((anchor) => !documented.has(anchor));
    const unused = [...documented].filter((anchor) => !used.has(anchor)).sort();
    expect(missing, "표에 없는 앵커").toEqual([]);
    expect(unused, "쓰이지 않는 앵커").toEqual([]);
  });
});

describe("튜토리얼 번역", () => {
  const dictionaries = { en, ja, zh } as Record<"en" | "ja" | "zh", Record<string, string>>;
  const locales = ["en", "ja", "zh"] as const;

  it("모든 문장에 세 언어 번역이 있습니다", () => {
    const texts = tutorialTexts();
    expect(texts.length).toBeGreaterThan(400);
    for (const locale of locales) {
      expect(missingKeys(locale, texts), locale).toEqual([]);
    }
  });

  it("세 사전의 열쇠가 같습니다", () => {
    const enKeys = Object.keys(en).sort();
    expect(Object.keys(ja).sort(), "ja").toEqual(enKeys);
    expect(Object.keys(zh).sort(), "zh").toEqual(enKeys);
  });

  it("사전의 열쇠는 전부 쓰입니다 — 튜토리얼 문장이거나 크롬 키(keys.chrome.json)", () => {
    // 고친 뒤 옛 문장을 사전에서 안 지우면 여기서 걸립니다. 화면 문구를 새로 감싸면 크롬 키 목록에 더하세요.
    const used = new Set<string>([...tutorialTexts(), ...chromeKeys]);
    const orphans = Object.keys(en).filter((key) => !used.has(key));
    expect(orphans).toEqual([]);
  });

  it("번역은 원문의 자리표시자를 빠뜨리지 않습니다", () => {
    // 튜토리얼 문장은 vars 없이 부르니 «원문의 자리 ⊆ 번역의 자리» 면 됩니다. 번역이 설명용으로
    // `{scene}` 같은 이름을 더 쓰는 것은 그대로 화면에 보일 뿐 해가 없습니다. 크롬 키의
    // 엄격한 «같은 이름» 검사는 i18n.test.ts 에 있습니다.
    for (const locale of locales) {
      const dictionary = dictionaries[locale];
      for (const key of tutorialTexts()) {
        const wanted = placeholderNames(key);
        if (!wanted.length) continue;
        const got = placeholderNames(dictionary[key] ?? "");
        for (const name of wanted) expect(got, `${locale}: ${key}`).toContain(name);
      }
    }
  });
});

/*
   읽고 «다음» 만 누르는 걸음이
  대부분이면 튜토리얼이 아니라 설명서입니다 — 「해 볼 것」 이 적힌 걸음은 실제로 행동해야 넘어가야 합니다.
*/
describe("걸음을 무엇으로 넘기는가", () => {
  it("「누르세요」 는 누르기로, 「적으세요」 는 적기로 넘어간다", () => {
    expect(
      stepAdvanceMode({ id: "a", title: "t", body: "b", anchor: "nav-settings", action: "위 띠의 «설정» 을 누르세요." }),
    ).toBe("click");
    expect(
      stepAdvanceMode({ id: "b", title: "t", body: "b", anchor: "basics-title", action: "작품 제목을 적으세요." }),
    ).toBe("input");
  });

  it("가리킬 자리가 없으면 설명 걸음이다", () => {
    expect(stepAdvanceMode({ id: "c", title: "t", body: "b", action: "눈으로 확인하세요." })).toBe("manual");
  });

  it("적어 둔 것이 짐작을 이긴다", () => {
    expect(
      stepAdvanceMode({ id: "d", title: "t", body: "b", anchor: "x", action: "누르세요", advanceOn: "manual" }),
    ).toBe("manual");
  });

  it("한 바퀴의 걸음 절반 이상이 행동으로 넘어간다", () => {
    const acting = FULL_TUTORIAL.steps.filter((step) => stepAdvanceMode(step) !== "manual").length;
    expect(acting).toBeGreaterThan(FULL_TUTORIAL.steps.length / 2);
  });
});
