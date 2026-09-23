import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CLAUDE_MODEL_OPTIONS, OPENAI_MODEL_OPTIONS } from "@/lib/llm";

/*
  **모델 목록을 제공자에게 물어보는 길**과, 그 길에서 되풀이하기 쉬운 사고를 셉니다.

   실제로 앱에는
  `gpt-5.6-*` 이 박혀 있는데 계정에는 이미 `gpt-6-*` 이 있었습니다.

  여기서 세는 사고 두 가지:

  ① **칸 이름이 두 벌이면 값이 조용히 빕니다.** Rust 가 `hint` 로 보내는데 TS 가
     `lastFour` 로 받고 있어서, 「저장됨 ···abcd」 가 한 번도 안 떴습니다. 잇는 코드를
     어디에도 안 두었으니 타입 검사도 못 잡습니다 — 화면을 눈으로 봐야 압니다.

  ② **목록이 비면 아무것도 못 고릅니다.** 키가 없거나 네트워크가 막혔을 때 드롭다운이
     통째로 비면, 설정을 열어도 왜 비었는지 모릅니다. 박아 둔 목록은 «옛 목록» 이 아니라
     **바닥**이라 없애면 안 됩니다.
*/
const RUST = readFileSync(
  resolve(__dirname, "../../../src-tauri/src/llm.rs"),
  "utf-8",
);
const TS = readFileSync(resolve(__dirname, "./llm.ts"), "utf-8");
const CATALOG = readFileSync(resolve(__dirname, "./modelCatalog.ts"), "utf-8");

describe("키 상태의 칸 이름", () => {
  it("보내는 쪽과 받는 쪽이 같은 이름을 씁니다", () => {
    // Rust 의 `ApiKeyStatus` 가 무엇을 보내는지 그대로 읽습니다.
    const block = RUST.slice(RUST.indexOf("struct ApiKeyStatus"));
    const fields = block.slice(0, block.indexOf("}"));
    expect(fields, "Rust 가 hint 를 안 보냅니다").toContain("hint");
    expect(TS, "TS 가 다른 이름으로 받고 있습니다 — 값이 늘 빕니다").toContain("hint?: string | null");
    expect(TS).not.toContain("lastFour: string");
  });
});

describe("모델 목록", () => {
  it("박아 둔 목록이 남아 있습니다 — 키가 없을 때의 바닥입니다", () => {
    expect(CLAUDE_MODEL_OPTIONS.length).toBeGreaterThan(0);
    expect(OPENAI_MODEL_OPTIONS.length).toBeGreaterThan(0);
    expect(CATALOG).toContain("function fallbackFor");
  });

  it("받아 온 목록이 비면 박아 둔 것으로 물러섭니다", () => {
    // 「받았는데 0개」 도 «못 받은 것» 과 같이 다뤄야 합니다.
    expect(CATALOG).toContain("if (!got?.length) return base");
  });

  it("이름표 사전을 두 벌 적지 않습니다", () => {
    // 아는 id 의 사람 이름은 박아 둔 목록에서 읽습니다.
    expect(CATALOG).toContain("fallbackFor(provider).map((item) => [item.id, item.label])");
  });

  it("글이 아닌 모델을 거르되 «모르는 것은 남깁니다»", () => {
    /*
      OpenAI 목록에는 임베딩·TTS·음성 인식·그림·검열기가 섞여 옵니다(실측 132개 중 60개).
      「무엇을 남길까」 로 적으면 **우리가 모르는 새 모델이 빠집니다** — 목록을 받아 오는
      까닭이 「새 모델을 쓰려고」 인데 정반대가 됩니다. 그래서 「무엇을 뺄까」 로 적습니다.
    */
    expect(RUST).toContain("const NOT_TEXT");
    expect(RUST).toContain("!NOT_TEXT.iter().any(|mark| id.contains(mark))");
  });

  it("이미 문 닫은 모델은 뺍니다", () => {
    /*
      OpenAI 는 항목마다 `shutdown_date` 를 줍니다(실측 132개 중 54개에 값이 있었고 13개는
      이미 지났습니다). 그대로 보여 주면 고를 수 있는데 부르면 실패합니다 — 사람은
      「우리 앱이 고장 났다」 로 읽습니다.
    */
    expect(RUST).toContain("shutdown_date");
    expect(RUST).toContain("gone.as_str() >= now.as_str()");
  });

  it("Anthropic 쪽은 거르지 않습니다 — 글 모델만 옵니다", () => {
    const block = RUST.slice(RUST.indexOf("async fn list_claude_models"));
    const body = block.slice(0, block.indexOf("\n}\n"));
    expect(body).not.toContain("is_text_model");
    // 사람이 읽을 이름을 주므로 그것을 씁니다.
    expect(body).toContain("display_name");
  });

  it("Anthropic 페이징이 끝없이 돌지 않습니다", () => {
    const block = RUST.slice(RUST.indexOf("async fn list_claude_models"));
    expect(block.slice(0, 2000), "has_more 만 믿으면 앱이 그 자리에 갇힙니다").toContain("for _ in 0..10");
  });

  it("새것부터 보여 줍니다 — 이름순이면 옛 모델이 맨 위입니다", () => {
    expect(RUST).toContain("b.created");
  });
});

/*
  거르개 자체를 실제 응답으로 세어 둡니다. Rust 를 못 돌리므로 같은 규칙을 여기 적어
  견주는 것이 아니라, **무엇이 빠지고 무엇이 남아야 하는지**를 글로 못 박습니다.
*/
describe("무엇을 거를까", () => {
  const NOT_TEXT = [
    "embed", "tts", "whisper", "audio", "transcribe", "realtime", "live", "image", "dall-e",
    "sora", "moderation", "rerank", "similarity", "davinci", "babbage",
  ];
  const keeps = (id: string) => !NOT_TEXT.some((mark) => id.toLowerCase().includes(mark));

  it("글 모델은 남습니다 — 우리가 모르는 새것도", () => {
    for (const id of ["gpt-6-astra", "gpt-5.6-terra", "o4-mini", "claude-opus-5", "아직-없는-모델"]) {
      expect(keeps(id), id).toBe(true);
    }
  });

  it("코딩 모델도 글 모델입니다 — 한때 여섯 개를 통째로 숨겼습니다", () => {
    /*
      거르개에 `codex` 를 넣었더니 `gpt-5-codex`·`gpt-5.1-codex`·`gpt-5.1-codex-mini`·
      `gpt-5.1-codex-max`·`gpt-5.2-codex`·`gpt-5.3-codex` 여섯 개가 목록에서 사라졌습니다
      (2026-09-23 실측). 거르개는 **좁게** 잡아야 합니다 — 넓게 잡으면 쓸 수 있는 것까지
      숨기고, 숨긴 줄도 모릅니다.
    */
    for (const id of ["gpt-5.3-codex", "gpt-5.1-codex-max", "gpt-4o-search-preview"]) {
      expect(keeps(id), id).toBe(true);
    }
  });

  it("글이 아닌 것은 빠집니다", () => {
    for (const id of [
      "text-embedding-3-large",
      "whisper-1",
      "gpt-4o-realtime-preview",
      "dall-e-3",
      "sora-2-pro",
      "omni-moderation-latest",
      "gpt-live-1",
      "gpt-4o-audio-preview",
    ]) {
      expect(keeps(id), id).toBe(false);
    }
  });
});
