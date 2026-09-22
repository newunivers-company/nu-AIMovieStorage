import { describe, expect, it } from "vitest";
import { llmInvocationOf, type LlmCallOptions } from "@/lib/llm";

/*
  «보낼까, 물을까» — 앱을 껐다 켜도 기다리던 답을 이어받게 하는 갈림길입니다.
  응답 id 가 있으면 보내지 않고 `llm_resume` 으로 묻기만 해야 하고, 없으면 예전처럼 `call_llm` 으로 보내야 합니다.
  여기가 틀리면 값을 두 번 내거나(늘 보냄), 새 요청을 영영 못 보냅니다(늘 물음).
*/
const base: LlmCallOptions = {
  task: "cutPrompt",
  system: "지시",
  prompt: "요청문",
  fixedPrompt: "늘 같은 앞부분",
  requestId: "job-1",
  timeoutSecs: 300,
  maxTokens: 2048,
  images: [{ mediaType: "image/png", data: "AAAA" }],
};
const choice = { model: "gpt-5.6-luna", effort: "low" as const };

describe("llmInvocationOf", () => {
  it("응답 id 가 없으면 call_llm 으로 요청문·그림을 그대로 보낸다", () => {
    const { command, request } = llmInvocationOf(base, "openai", choice);
    expect(command).toBe("call_llm");
    expect(request).toMatchObject({
      provider: "openai",
      model: "gpt-5.6-luna",
      effort: "low",
      system: "지시",
      prompt: "요청문",
      fixedPrompt: "늘 같은 앞부분",
      maxTokens: 2048,
      timeoutSecs: 300,
      requestId: "job-1",
      images: [{ mediaType: "image/png", data: "AAAA" }],
    });
  });

  it("응답 id 가 있으면 llm_resume 으로 묻기만 한다 — 요청문·그림은 싣지 않고, 모델·시간·요청 id 는 그대로", () => {
    const { command, request } = llmInvocationOf({ ...base, resumeId: "resp_abc" }, "openai", choice);
    expect(command).toBe("llm_resume");
    expect(request).toEqual({
      provider: "openai",
      responseId: "resp_abc",
      model: "gpt-5.6-luna",
      timeoutSecs: 300,
      requestId: "job-1",
    });
    expect(request).not.toHaveProperty("prompt");
    expect(request).not.toHaveProperty("images");
  });

  it("maxTokens 를 안 주면 4096 으로 보낸다(예전과 같은 기본값)", () => {
    const { request } = llmInvocationOf({ ...base, maxTokens: undefined }, "claude", choice);
    expect(request.maxTokens).toBe(4096);
    expect(request.provider).toBe("claude");
  });
});
