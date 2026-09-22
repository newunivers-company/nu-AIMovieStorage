import { describe, expect, it } from "vitest";
import {
  LLM_CONCURRENCY,
  effectiveLlmConcurrency,
  enqueueTasks,
  isRateLimited,
  pendingTasksOf,
  registerTaskRunner,
  setLlmConcurrency,
  type NewTask,
} from "@/lib/taskQueue";

/*
  「지금은 너무 느리다」.
  llm 줄은 설정한 수만큼 한꺼번에 돌고, 429 는 실패가 아니라 «쉬었다 다시» 입니다.
*/
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const job = (kind: string, projectId: string, label: string): NewTask => ({
  lane: "llm",
  kind,
  projectId,
  projectTitle: "시험 작품",
  label,
  payload: {},
});

describe("llm 줄의 동시 요청", () => {
  it("설정한 수만큼 한꺼번에 돌고, 하나가 끝나면 다음이 선다", async () => {
    setLlmConcurrency(3);
    const release: (() => void)[] = [];
    registerTaskRunner("slow", () => new Promise<void>((resolve) => release.push(resolve)));
    enqueueTasks(Array.from({ length: 5 }, (_, index) => job("slow", "p-동시", `일 ${index}`)));
    await tick();
    const running = () => pendingTasksOf("p-동시", "slow").filter((task) => task.status === "running").length;
    expect(running()).toBe(3);
    release.shift()!();
    await tick();
    // 하나가 끝나면 넷째가 바로 서서 여전히 셋이 돕니다.
    expect(running()).toBe(3);
    expect(pendingTasksOf("p-동시", "slow")).toHaveLength(4);
    // 남은 것도 풀어 줍니다 — 하나가 끝날 때마다 다음이 서므로 빌 때까지 되풀이합니다.
    for (let guard = 0; guard < 10 && pendingTasksOf("p-동시", "slow").length; guard += 1) {
      while (release.length) release.shift()!();
      await tick();
    }
    expect(pendingTasksOf("p-동시", "slow")).toHaveLength(0);
  });

  it("429 는 실패로 적지 않고 잠시 뒤 다시 서게 둔다", async () => {
    registerTaskRunner("burst", async () => {
      throw new Error("openai 오류 429 Too Many Requests: rate limit reached");
    });
    enqueueTasks([job("burst", "p-429", "몰림")]);
    await tick();
    const [task] = pendingTasksOf("p-429", "burst");
    expect(task.status).toBe("waiting");
    expect(task.retries).toBe(1);
    expect(task.notBefore ?? 0).toBeGreaterThan(Date.now());
    expect(task.step).toContain("다시");
  });

  it("isRateLimited 는 429·rate limit 만 잡는다", () => {
    expect(isRateLimited("openai 오류 429 Too Many Requests")).toBe(true);
    expect(isRateLimited("허깅페이스가 잠시 이용 제한(429)을 걸었습니다.")).toBe(true);
    expect(isRateLimited("openai 오류 400 Bad Request")).toBe(false);
    expect(isRateLimited("결과 파일이 만들어지지 않았습니다.")).toBe(false);
  });
});

describe("자동 동시 수 — 429 를 보며 스스로 찾기 ()", () => {
  it("429 전에는 셋마다 두 배, 429 를 맞으면 반으로, 그 뒤로는 셋마다 하나씩", async () => {
    setLlmConcurrency(LLM_CONCURRENCY.auto);
    const start = effectiveLlmConcurrency();
    registerTaskRunner("fine", async () => {});
    enqueueTasks(Array.from({ length: 3 }, (_, index) => job("fine", "p-자동", `잘 됨 ${index}`)));
    await tick();
    await tick();
    const doubled = start * 2; // 자동에는 상한이 없습니다
    expect(effectiveLlmConcurrency()).toBe(doubled);
    registerTaskRunner("limited", async () => {
      throw new Error("openai 오류 429 Too Many Requests");
    });
    enqueueTasks([job("limited", "p-자동", "몰림")]);
    await tick();
    const halved = Math.max(1, Math.floor(doubled / 2));
    expect(effectiveLlmConcurrency()).toBe(halved);
    enqueueTasks(Array.from({ length: 3 }, (_, index) => job("fine", "p-자동", `다시 잘 됨 ${index}`)));
    await tick();
    await tick();
    expect(effectiveLlmConcurrency()).toBe(halved + 1);
  });

  it("숫자를 못 박으면 자동 조절이 손대지 않는다", async () => {
    setLlmConcurrency(6);
    registerTaskRunner("fixed-ok", async () => {});
    enqueueTasks(Array.from({ length: 4 }, (_, index) => job("fixed-ok", "p-고정", `일 ${index}`)));
    await tick();
    await tick();
    expect(effectiveLlmConcurrency()).toBe(6);
  });
});
