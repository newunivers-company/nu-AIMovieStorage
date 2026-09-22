import { useSyncExternalStore } from "react";
import { abandonLlmResumes } from "@/lib/llmActivity";

/**
 * **작업 줄** — 무엇이 돌고, 무엇이 기다리고, 무엇이 끝났는가.
 *
 * 어느 작품의 어떤 일이 돌고 있고, 무엇이 순서를 기다리며, 얼마나 왔는지를 **한 곳에서**
 * 봅니다(옆에서 열고 닫는 서랍). 앱이 갑자기 꺼져도 하던 일을 이어서 합니다.
 *
 * # 왜 «시작한 곳» 이 들고 있으면 안 되는가
 *
 * 여태 일괄 생성은 창이, 한 번에 뽑기는 판이 각자 `for` 문을 돌렸습니다. 그래서
 *
 * - 그 화면을 벗어나면 진행이 안 보이고,
 * - 40분이 지나도 «어디까지 갔는지» 를 물을 데가 없고,
 * - 앱이 꺼지면 남은 일이 통째로 사라졌습니다.
 *
 * 줄을 한 곳에 두면 셋이 한꺼번에 풀립니다. 화면은 줄을 **보기만** 합니다.
 *
 * # 줄이 둘인 이유
 *
 * - `llm` — 글을 받는 일. 네트워크라 서로 다투지 않습니다.
 * - `media` — 그림·영상을 뽑는 일. GPU 는 하나고 마그니픽 창도 하나라, 둘을 같이
 * 돌리면 둘 다 죽거나 느려집니다.
 *
 * `media` 는 **한 번에 하나**입니다. `llm` 은 **여럿을 한꺼번에** 보냅니다(설정 「API 동시 요청 수」,
 * 기본 4). 4단계는 카드 123장에 요청 하나씩이라 하나씩 줄 세워 받으면 한 시간이 넘습니다. 답은 카드 id 로
 * 찾아가 함수형으로 써 넣으므로 동시에 받아도 섞이지 않습니다. 세 왕복(1/3→2/3→3/3)은 한 일이라
 * 그 안에서는 차례대로입니다.
 *
 * 몰아 보내면 429(요청 한도)를 맞을 수 있습니다 — 그 일은 실패로 적지 않고 잠시 뒤 다시 섭니다
 * (`notBefore`). 429 는 «지금 몰렸으니 쉬어라» 지 «틀렸다» 가 아닙니다.
 *
 * # 앱이 꺼졌다 켜지면
 *
 * 줄은 localStorage 에 있습니다. 돌던 일은 **다시 대기로** 돌려 이어서 합니다 — 답이
 * 오는 중이었다면 그 답은 이미 잃은 것이라, 다시 하는 수밖에 없습니다. 무엇이 왜 다시
 * 도는지는 작업에 적어 둡니다.
 */

export type TaskLane = "llm" | "media";
export type TaskStatus = "waiting" | "running" | "done" | "failed" | "stopped";

export interface QueueTask {
  id: string;
  lane: TaskLane;
  /** 어느 프로젝트의 일인가. 저장 전 프로젝트는 「새 프로젝트」. */
  projectId: string;
  /** 화면에 적을 작품 이름. id 만 있으면 사람이 못 알아봅니다. */
  projectTitle: string;
  /** 무슨 일인가 — 「컷 3 · 골목 그림」 처럼. */
  label: string;
  /** 어떤 러너가 할 일인가. `registerTaskRunner` 의 열쇠입니다. */
  kind: string;
  status: TaskStatus;
  /** 0~1. 여러 단계짜리 일만 채웁니다. */
  progress?: number;
  /** 지금 무엇을 하는 중인가 — 「2/3 상세와 장면」. */
  step?: string;
  /** **마지막으로 살아 있다고 알린 시각.** 멈춘 것과 도는 것을 여기서 가릅니다. */
  beatAt?: number;
  /** 이 시각 전에는 다시 세우지 않습니다 — 429 를 맞고 쉬는 중. */
  notBefore?: number;
  /** 429 로 다시 선 횟수. 다섯 번이면 그만두고 실패로 적습니다. */
  retries?: number;
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  /** 앱을 껐다 켜도 이어 갈 수 있게, 그 일에 필요한 재료를 통째로 들고 있습니다. */
  payload: unknown;
  /**
   * **이어 받을 답의 열쇠** — OpenAI 배경 모드의 응답 id.
   *
   * 여태는 앱을 다시 켜면 돌던 일을
   * «처음부터 다시» 보내, 끊긴 요청의 값과 시간을 통째로 버렸습니다. 답을 만드는 요청의 id 를 여기
   * 적어 두면 앱을 껐다 켜도 `llm_resume` 으로 그 답을 **묻기만** 하면 됩니다(`withResumableLlm`).
   * 끝나거나 실패하거나 멈추면 지웁니다 — 남겨 두면 «다시» 가 옛 답을 또 받습니다.
   */
  llmResponseId?: string;
  /** `llmResponseId` 가 이 일의 **어느 왕복** 것인가(«outline»·«details»·«prompt»…). 다른 왕복이 남의 답을 받으면 안 됩니다. */
  llmResumeStep?: string;
}

/** 끝난 것을 몇 개까지 남길까. 「뭐가 끝났더라」 를 볼 만큼만. */
const KEEP_DONE = 60;
const STORAGE_KEY = "frameforge.taskQueue";

/**
 * 이만큼 소식이 없으면 «멈춘 것 같다» 고 적습니다.
 *
 * 40분째 도는 일이 멈춘 것인지 가는 중인지 화면만 봐서는 가릴 수 없었습니다.
 * 도는 일은 `beat()` 로 살아 있다고 알립니다. 영상 한 편이 20분 걸리는 일도 있어서
 * **끊지는 않고**, 화면에 「소식 없음」 이라고만 적습니다 — 끊는 것은 사람이 정합니다.
 */
export const STALL_MS = 5 * 60 * 1000;

let tasks: QueueTask[] = [];
const listeners = new Set<() => void>();
let loaded = false;

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as QueueTask[]) : [];
    /*
      돌던 일은 **다시 대기로.** 「진행 중」 으로 되살리면 영영 끝나지 않는 줄이 됩니다. 왜 다시
      도는지는 적어 둡니다 — 이어 받을 열쇠(`llmResponseId`)가 있으면 답을 잃은 것이 아니라
      서버가 아직 들고 있는 것이라, 러너가 처음부터 보내지 않고 그 답을 묻습니다.
    */
    tasks = (Array.isArray(saved) ? saved : []).map((task) =>
      task.status === "running"
        ? {
            ...task,
            status: "waiting" as const,
            step: task.llmResponseId ? "앱이 닫혀 — 이어 받는 중" : "앱이 닫혀 처음부터 다시 합니다",
            startedAt: undefined,
            beatAt: undefined,
          }
        : task,
    );
  } catch {
    tasks = [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // 저장이 막혀도(용량) 이번 세션 동안은 그대로 돕니다.
  }
}

function publish(next: QueueTask[]) {
  /*
    끝난 것만 잘라 냅니다. 대기·진행은 **몇 개든 남깁니다** — 줄에서 잘라 내면 그 일은
    영영 안 돕니다.
  */
  const live = next.filter((task) => task.status === "waiting" || task.status === "running");
  const over = next.filter((task) => task.status !== "waiting" && task.status !== "running");
  /*
    **새 것을 남깁니다**(`slice(-N)`). 처음에 `slice(0, N)` 으로 적었는데, 목록은 뒤에
    붙이므로 그건 «오래된 것» 을 남기고 방금 끝난 것을 버리는 셈이었습니다.
  */
  tasks = [...live, ...over.slice(-KEEP_DONE)];
  save();
  listeners.forEach((listener) => listener());
  reconcileResumes();
}

function patch(id: string, change: Partial<QueueTask>) {
  publish(tasks.map((task) => (task.id === id ? { ...task, ...change } : task)));
}

/**
 * API 기록의 «이어 받는 중» 줄과 이 줄을 맞춥니다 — **줄이 진실입니다.**
 *
 * 앱을 켜면 API 기록은 응답 id 가 있는 도중 줄을 «이어 받는 중» 으로 되살립니다(`llmActivity.restore`).
 * 그런데 그 답을 받을 일이 줄에 없으면(사람이 시작 전에 뺐거나, 끝난 뒤 지워졌거나) 그 줄은 영영
 * 빙글빙글 돕니다. 살아 있는 일이 들고 있는 id 만 남기고 나머지는 끊김으로 적습니다.
 */
function reconcileResumes() {
  const keep = new Set<string>();
  tasks.forEach((task) => {
    if ((task.status === "waiting" || task.status === "running") && task.llmResponseId) keep.add(task.llmResponseId);
  });
  abandonLlmResumes(keep);
}

// ── 러너 ────────────────────────────────────────────────────────────────────

/** 한 작업을 실제로 하는 함수. 진행을 알리려면 `report` 를 부릅니다. */
export type TaskRunner = (
  payload: unknown,
  report: (change: { progress?: number; step?: string }) => void,
  task: QueueTask,
) => Promise<void>;

const runners = new Map<string, TaskRunner>();

/**
 * 어떤 일을 할 줄 아는 함수를 등록합니다.
 *
 * **앱을 켤 때 러너가 먼저 등록되어야** 앞서 하던 일을 이어받습니다. 그래서 등록하는
 * 모듈들은 `main.tsx` 가 곧바로 불러옵니다 — 화면을 열어야 등록되면, 그 화면에 가기
 * 전까지 줄이 멈춰 있습니다.
 */
export function registerTaskRunner(kind: string, runner: TaskRunner) {
  runners.set(kind, runner);
  pump();
}

/** 이어 받을 열쇠를 지우는 조각. 끝·실패·멈춤·다시 — 일이 «도는 중» 을 벗어나는 자리마다 같은 것을 씁니다. */
const NO_RESUME = { llmResponseId: undefined, llmResumeStep: undefined } as const;

/**
 * **LLM 왕복 하나를 이어 받을 수 있게** 돌립니다 — 이 줄에 서는 LLM 일은 전부 이걸로 부릅니다(한 벌, 규칙 1).
 *
 * 답 하나에 몇 분이 걸리므로, 그 사이에 앱이 닫혀도 다시 켜서 이어 받을 수 있어야 합니다.
 *
 * - 요청이 서버에 닿아 응답 id 가 생기면(`onResponseId`) 그 일에 적어 둡니다 — 답을 기다리는 몇 분 사이에
 * 앱이 닫혀도 줄(localStorage)에는 남습니다.
 * - 앱을 다시 켜 이 일이 다시 돌면, **같은 왕복**(`step`)의 id 가 있을 때만 `resumeId` 로 건넵니다 —
 * 보내지 않고 묻기만 합니다(`llm_resume`). 다른 왕복의 id 를 건네면 남의 답을 제 것으로 읽습니다.
 * - 왕복이 끝나면 지웁니다 — 남겨 두면 사람이 누른 «다시» 가 새 답 대신 옛 답을 또 받습니다. 다만
 * **몰려서 튕긴 것(429)은 지우지 않습니다.** 줄이 잠시 뒤 같은 자리에 다시 세우는데 그때 열쇠가 없으면
 * 처음부터 다시 보내 값을 두 번 냅니다 — 서버는 이미 그 답을 만들고 있을 수 있습니다.
 */
export async function withResumableLlm<T>(
  taskId: string,
  step: string,
  run: (llm: { resumeId?: string; onResponseId: (responseId: string) => void }) => Promise<T>,
): Promise<T> {
  load();
  const task = tasks.find((item) => item.id === taskId);
  const resumeId = task?.llmResumeStep === step ? task.llmResponseId : undefined;
  try {
    const value = await run({
      resumeId,
      onResponseId: (responseId) => patch(taskId, { llmResponseId: responseId, llmResumeStep: step }),
    });
    patch(taskId, { ...NO_RESUME });
    return value;
  } catch (error) {
    // 한도에 튕긴 것은 «끝난 것» 이 아닙니다 — 줄이 다시 세울 때 이어 받도록 열쇠를 남깁니다.
    if (!isRateLimited(String(error instanceof Error ? error.message : error))) {
      patch(taskId, { ...NO_RESUME });
    }
    throw error;
  }
}

/**
 * 이 일이 앱이 닫힐 때 **어느 왕복**을 가고 있었는가. 여러 왕복짜리 일(일괄 생성의 세 왕복)이 앞 왕복을
 * 다시 보낼지 말지를 이걸로 가립니다 — 앞 왕복의 답은 이미 값을 치르고 살림에 적어 둔 것입니다.
 */
export function llmResumeStepOf(taskId: string): string | undefined {
  load();
  return tasks.find((item) => item.id === taskId)?.llmResumeStep;
}

// ── 넣기·빼기 ───────────────────────────────────────────────────────────────

export interface NewTask {
  lane: TaskLane;
  projectId: string;
  projectTitle: string;
  label: string;
  kind: string;
  payload: unknown;
  /** 같은 일을 두 번 넣지 않으려는 열쇠. 이미 대기·진행 중이면 넣지 않습니다. */
  dedupe?: string;
}

export function enqueueTask(next: NewTask): string | null {
  load();
  if (next.dedupe) {
    const already = tasks.find(
      (task) =>
        (task.payload as { dedupe?: string })?.dedupe === next.dedupe &&
        (task.status === "waiting" || task.status === "running"),
    );
    if (already) return null;
  }
  const task: QueueTask = {
    id: makeId(),
    status: "waiting",
    queuedAt: Date.now(),
    ...next,
    payload: next.dedupe
      ? { ...(next.payload as Record<string, unknown>), dedupe: next.dedupe }
      : next.payload,
  };
  publish([...tasks, task]);
  pump();
  return task.id;
}

/** 여럿을 한 번에 — 하나씩 넣으면 넣을 때마다 줄이 움직여 순서가 흔들립니다. */
export function enqueueTasks(list: NewTask[]): number {
  load();
  const made = list
    .filter(
      (next) =>
        !next.dedupe ||
        !tasks.some(
          (task) =>
            (task.payload as { dedupe?: string })?.dedupe === next.dedupe &&
            (task.status === "waiting" || task.status === "running"),
        ),
    )
    .map<QueueTask>((next) => ({
      id: makeId(),
      status: "waiting",
      queuedAt: Date.now(),
      ...next,
      payload: next.dedupe
        ? { ...(next.payload as Record<string, unknown>), dedupe: next.dedupe }
        : next.payload,
    }));
  if (made.length) {
    publish([...tasks, ...made]);
    pump();
  }
  return made.length;
}

/**
 * 멈춥니다. 대기 중이면 그냥 빠지고, 도는 중이면 **끊어 달라고 부탁**합니다.
 *
 * 도는 일을 밖에서 억지로 끊을 수는 없습니다(LLM 왕복도, 로컬 생성도 제 나름의 끊는
 * 길이 있습니다). 러너가 `isStopping` 을 들여다보고 제 자리에서 그만둡니다.
 */
export function stopTask(id: string) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  if (task.status === "waiting") {
    patch(id, { status: "stopped", finishedAt: Date.now(), step: "시작 전에 뺐습니다", ...NO_RESUME });
    return;
  }
  if (task.status === "running") {
    stopping.add(id);
    patch(id, { step: "멈추는 중… 지금 것까지만 마칩니다" });
  }
}

const stopping = new Set<string>();
export function isStopping(id: string): boolean {
  return stopping.has(id);
}

/**
 * 그 프로젝트의 **아직 안 끝난**(대기·진행) 일 가운데 이 갈래인 것.
 *
 * 일괄 생성 4단계가 «내가 마지막인가» 를 여기서 셉니다 — 세는 값을 살림에 따로 두면 앱을 껐다 켰을 때
 * 줄은 남고 셈만 사라져 마지막 일이 끝나도 끝났다는 표시가 안 납니다. 줄이 곧 진실입니다.
 */
export function pendingTasksOf(projectId: string, kind: string): QueueTask[] {
  load();
  return tasks.filter(
    (task) => task.projectId === projectId && task.kind === kind && (task.status === "waiting" || task.status === "running"),
  );
}

/**
 * 프로젝트 **열쇠가 바뀌었을 때** 그 프로젝트의 아직 안 끝난(대기·진행) 일을 새 열쇠로 고쳐 씁니다 —
 * `projectId` 와, 재료 안의 `project`·`projectId`·`dedupe` 까지. 옮긴 수를 돌려줍니다.
 *
 * 저장 전 프로젝트는 «새 프로젝트» 라는 열쇠로 줄에 섭니다. 첫 자동 저장이 id 를 만들면 살림은
 * `adoptBootstrapRun` 으로 제 것을 옮겼는데 **줄은 그대로 두었습니다.** 그러면 일괄 생성
 * 4단계의 남은 카드가 전부 「아직 저장 전인 프로젝트」 로 실패하고, 4단계가 영영 안 닫혀 «넣고 바로 뽑기» 도
 * 안 났습니다. 줄이 진실이니 줄을 고쳐 씁니다 — 재료의 열쇠도 같이 고쳐야 앱을 껐다 켜서 다시 도는 일이
 * 새 열쇠로 읽습니다. dedupe 도 새 열쇠로 — 안 그러면 같은 카드를 새 열쇠로 한 번 더 세울 수 있습니다.
 *
 * **돌고 있는 일도 옮깁니다.** 러너가 손에 든 `task`·`payload` 는 시작할 때의 사본이라 옛 열쇠를 들고 있으니,
 * 러너는 읽고 쓸 때마다 `projectIdOfTask` 로 지금 열쇠를 다시 봐야 합니다.
 */
export function retargetTasks(from: string, to: string): number {
  load();
  if (from === to) return 0;
  let moved = 0;
  const next = tasks.map((task) => {
    if (task.projectId !== from || (task.status !== "waiting" && task.status !== "running")) return task;
    moved += 1;
    const record = task.payload && typeof task.payload === "object" ? { ...(task.payload as Record<string, unknown>) } : null;
    if (record) {
      if (record.project === from) record.project = to;
      if (record.projectId === from) record.projectId = to;
      if (typeof record.dedupe === "string" && record.dedupe.startsWith(`${from}:`))
        record.dedupe = `${to}:${record.dedupe.slice(from.length + 1)}`;
    }
    return { ...task, projectId: to, payload: record ?? task.payload };
  });
  if (moved) publish(next);
  return moved;
}

/** 이 일의 **지금** 프로젝트 열쇠. `retargetTasks` 뒤에는 러너가 시작할 때 받은 `task.projectId` 가 옛 것입니다. */
export function projectIdOfTask(id: string): string | undefined {
  load();
  return tasks.find((task) => task.id === id)?.projectId;
}

/** 그 프로젝트의 대기·진행을 모두 멈춥니다. */
export function stopProjectTasks(projectId: string) {
  tasks
    .filter((task) => task.projectId === projectId && (task.status === "waiting" || task.status === "running"))
    .forEach((task) => stopTask(task.id));
}

/**
 * 아직 안 끝난 일을 **전부** 멈춥니다.
 *
 * 일괄 생성 하나가 카드 수만큼 일을 세워 백 개가 넘는 일이 예사입니다. 하나씩 누르면
 * 그 자체가 일이 되어, 목록을 보는 사람은 멈출 길이 없는 것과 같습니다.
 */
export function stopAllTasks() {
  tasks
    .filter((task) => task.status === "waiting" || task.status === "running")
    .forEach((task) => stopTask(task.id));
}

/** 실패하거나 멈춘 일을 다시 줄에 세웁니다. 이어 받을 열쇠는 없습니다 — «다시» 는 처음부터 보내는 것입니다. */
export function retryTask(id: string) {
  patch(id, {
    status: "waiting",
    error: undefined,
    step: undefined,
    progress: undefined,
    startedAt: undefined,
    finishedAt: undefined,
    beatAt: undefined,
    ...NO_RESUME,
  });
  pump();
}

/** 끝난 것만 지웁니다 — 대기·진행은 남습니다. */
export function clearFinishedTasks() {
  publish(tasks.filter((task) => task.status === "waiting" || task.status === "running"));
}

// ── 돌리기 ──────────────────────────────────────────────────────────────────

/** 줄마다 지금 도는 수. */
const running = new Map<TaskLane, number>();

const CONCURRENCY_KEY = "ai-video-storage.llm-concurrency.v1";
/**
 * «API 동시 요청 수» — 설정 칸과 줄이 같은 숫자를 봅니다. `auto`(0) 는 **자동**입니다.
 *
 * **자동에는 상한이 없습니다.** 진짜 한계는 계정의
 * 분당 한도이고 그건 429 가 알려 주니, 우리가 숫자를 미리 정할 이유가 없습니다. 줄에 선 일보다 더 세울 수는
 * 없으니 그게 자연스러운 천장입니다.
 *
 * 자동은 그 한도를 **스스로 찾습니다.** 한도는 계정마다
 * 달라 미리 알 수 없으니 TCP 처럼 갑니다 — 429 를 한 번도 안 만났으면 세 번 잇달아 잘 받을 때마다 **두 배**
 * (느린 시작), 한 번 만난 뒤로는 하나씩, 429 를 맞으면 반으로. 찾은 값은 저장해 두어 다음에 켤 때 그 자리에서
 * 다시 시작합니다. `max` 는 **손으로 고르는 숫자**의 상한일 뿐입니다.
 */
export const LLM_CONCURRENCY = { auto: 0, min: 1, max: 64, fallback: 0, autoStart: 4 } as const;
/** 설정 칸에 보이는 고정값 후보 — 64개를 다 늘어놓지 않으려고. */
export const LLM_CONCURRENCY_CHOICES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64] as const;

/** 이번 판의 값. 저장소가 없는 자리(시험·막힌 웹뷰)에서도 바꾼 값이 살아 있게 메모리에 먼저 둡니다. */
let concurrency: number | null = null;

/** 설정값 — 0 이면 자동. 실제로 세우는 수는 `effectiveLlmConcurrency`. */
export function getLlmConcurrency(): number {
  if (concurrency !== null) return concurrency;
  try {
    const raw = Number(localStorage.getItem(CONCURRENCY_KEY));
    if (Number.isFinite(raw) && raw >= LLM_CONCURRENCY.auto && raw <= LLM_CONCURRENCY.max) {
      concurrency = Math.round(raw);
      return concurrency;
    }
  } catch {
    /* 저장소가 없으면 기본값 */
  }
  concurrency = LLM_CONCURRENCY.fallback;
  return concurrency;
}

/** 바꾸는 즉시 줄이 그 수만큼 더 세웁니다 — 돌던 것은 끝까지 두고 새로 세우는 수만 달라집니다. 0 은 자동. */
export function setLlmConcurrency(next: number) {
  const value = Math.min(LLM_CONCURRENCY.max, Math.max(LLM_CONCURRENCY.auto, Math.round(next)));
  concurrency = value;
  try {
    localStorage.setItem(CONCURRENCY_KEY, String(value));
  } catch {
    /* 못 적어도 이번 판은 돕니다 */
  }
  refreshConcurrencyInfo();
  pump();
}

// ── 자동 — 429 를 보며 스스로 찾는 동시 수 ──────────────────────────────────

const AUTO_KEY = "ai-video-storage.llm-concurrency-auto.v1";
let autoLimit: number | null = null;
/** 잇달아 잘 받은 수. 셋이 되면 늘립니다. */
let autoStreak = 0;
/** 이번 판에 429 를 만난 적이 있는가 — 만나기 전에는 두 배씩, 만난 뒤로는 하나씩(한도 언저리를 조심스럽게). */
let autoHitLimit = false;
const AUTO_GROW_AFTER = 3;

function autoConcurrency(): number {
  if (autoLimit !== null) return autoLimit;
  try {
    const raw = Number(localStorage.getItem(AUTO_KEY));
    if (Number.isFinite(raw) && raw >= LLM_CONCURRENCY.min) {
      autoLimit = Math.round(raw);
      return autoLimit;
    }
  } catch {
    /* 저장소가 없으면 시작값 */
  }
  autoLimit = LLM_CONCURRENCY.autoStart;
  return autoLimit;
}

function setAutoConcurrency(next: number) {
  // 위로는 안 막습니다 — 상한은 429 가 정합니다.
  autoLimit = Math.max(LLM_CONCURRENCY.min, Math.round(next));
  try {
    localStorage.setItem(AUTO_KEY, String(autoLimit));
  } catch {
    /* 못 적어도 이번 판은 돕니다 */
  }
  refreshConcurrencyInfo();
}

/** 지금 실제로 세우는 수 — 자동이면 찾은 값, 아니면 설정값. */
export function effectiveLlmConcurrency(): number {
  const set = getLlmConcurrency();
  return set === LLM_CONCURRENCY.auto ? autoConcurrency() : set;
}

/**
 * 글 요청 하나의 결말을 자동 조절에 알립니다. 자동이 아니면 아무 일도 안 합니다.
 * 429 는 «지금 몰렸다» 는 뜻이라 반으로, 잇달아 세 번 잘 받으면 하나 늘립니다 — 한도를 넘나들며 그 언저리에 머뭅니다.
 */
function noteLlmOutcome(outcome: "ok" | "limited") {
  if (getLlmConcurrency() !== LLM_CONCURRENCY.auto) return;
  if (outcome === "limited") {
    autoStreak = 0;
    autoHitLimit = true;
    setAutoConcurrency(Math.floor(autoConcurrency() / 2));
    return;
  }
  autoStreak += 1;
  if (autoStreak >= AUTO_GROW_AFTER) {
    autoStreak = 0;
    setAutoConcurrency(autoHitLimit ? autoConcurrency() + 1 : autoConcurrency() * 2);
  }
}

/** 설정 화면이 보는 것 — 설정값과 지금 실제 수. 바뀔 때만 새 객체라 `useSyncExternalStore` 가 다시 그립니다. */
export interface LlmConcurrencyInfo {
  setting: number;
  effective: number;
}
const infoListeners = new Set<() => void>();
let concurrencyInfo: LlmConcurrencyInfo | null = null;
function currentConcurrencyInfo(): LlmConcurrencyInfo {
  if (!concurrencyInfo) concurrencyInfo = { setting: getLlmConcurrency(), effective: effectiveLlmConcurrency() };
  return concurrencyInfo;
}
function refreshConcurrencyInfo() {
  const next = { setting: getLlmConcurrency(), effective: effectiveLlmConcurrency() };
  const now = currentConcurrencyInfo();
  if (next.setting === now.setting && next.effective === now.effective) return;
  concurrencyInfo = next;
  infoListeners.forEach((listener) => listener());
}
export function useLlmConcurrency(): LlmConcurrencyInfo {
  return useSyncExternalStore(
    (listener) => {
      infoListeners.add(listener);
      return () => infoListeners.delete(listener);
    },
    currentConcurrencyInfo,
    currentConcurrencyInfo,
  );
}

const laneLimit = (lane: TaskLane) => (lane === "llm" ? effectiveLlmConcurrency() : 1);

/** 429·잠시 쉬라는 답인가. 이런 실패는 그 일의 잘못이 아니라 몰린 탓입니다. */
export function isRateLimited(message: string): boolean {
  return /\b429\b|too many requests|rate.?limit|잠시 뒤|이용 제한/i.test(message);
}

const MAX_RETRIES = 5;
/** 429 뒤 쉬는 시간 — 15초·30초·60초·120초·120초. */
const backoffMs = (retries: number) => Math.min(120_000, 15_000 * 2 ** Math.max(0, retries - 1));

let wakeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 줄을 움직입니다 — 줄마다 한도(`laneLimit`)까지 세웁니다.
 *
 * 넣을 때도, 끝날 때도, 러너가 등록될 때도 부릅니다. 여러 번 불려도 안전합니다 — `run` 이
 * 첫 줄에서 상태를 «진행» 으로 적어, 같은 일을 두 번 집지 않습니다.
 */
function pump() {
  load();
  const now = Date.now();
  let soonest = Infinity;
  (["llm", "media"] as TaskLane[]).forEach((lane) => {
    for (;;) {
      const used = running.get(lane) ?? 0;
      if (used >= laneLimit(lane)) return;
      const next = tasks.find((task) => {
        if (task.lane !== lane || task.status !== "waiting") return false;
        if (task.notBefore && task.notBefore > now) {
          soonest = Math.min(soonest, task.notBefore);
          return false;
        }
        return true;
      });
      if (!next) return;
      const runner = runners.get(next.kind);
      /*
        할 줄 아는 함수가 아직 없으면 **그냥 둡니다.** 실패로 적으면, 앱이 켜지는 순서
        때문에 러너가 조금 늦게 등록된 것만으로 일이 통째로 죽습니다.
      */
      if (!runner) return;
      running.set(lane, used + 1);
      void run(next, runner).finally(() => {
        running.set(lane, Math.max(0, (running.get(lane) ?? 1) - 1));
        pump();
      });
    }
  });
  // 쉬는 일이 있으면 그 시각에 한 번 더 — 아무도 안 부르면 영영 안 섭니다.
  if (soonest !== Infinity) {
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      pump();
    }, Math.max(250, soonest - now));
  }
}

async function run(task: QueueTask, runner: TaskRunner) {
  patch(task.id, {
    status: "running",
    startedAt: Date.now(),
    beatAt: Date.now(),
    step: undefined,
    error: undefined,
  });
  const report = (change: { progress?: number; step?: string }) =>
    patch(task.id, { ...change, beatAt: Date.now() });
  try {
    await runner(task.payload, report, task);
    patch(task.id, {
      status: stopping.has(task.id) ? "stopped" : "done",
      progress: 1,
      finishedAt: Date.now(),
      step: undefined,
      ...NO_RESUME,
    });
    if (task.lane === "llm" && !stopping.has(task.id)) noteLlmOutcome("ok");
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    const retries = (task.retries ?? 0) + 1;
    if (task.lane === "llm" && isRateLimited(message)) noteLlmOutcome("limited");
    if (!stopping.has(task.id) && isRateLimited(message) && retries <= MAX_RETRIES) {
      // 몰려서 튕긴 것은 실패가 아닙니다 — 쉬었다 같은 자리에 다시 섭니다.
      const wait = backoffMs(retries);
      patch(task.id, {
        status: "waiting",
        retries,
        notBefore: Date.now() + wait,
        startedAt: undefined,
        beatAt: undefined,
        step: `요청이 몰려 ${Math.round(wait / 1000)}초 뒤 다시 (${retries}/${MAX_RETRIES})`,
        error: undefined,
      });
      return;
    }
    patch(task.id, {
      status: stopping.has(task.id) ? "stopped" : "failed",
      finishedAt: Date.now(),
      step: undefined,
      error: message,
      ...NO_RESUME,
    });
  } finally {
    stopping.delete(task.id);
  }
}

/** 앱이 켜질 때 한 번 — 앞서 하던 일을 이어받습니다. */
export function resumeTaskQueue() {
  load();
  // 줄이 비어 아무 일도 안 움직여도, API 기록의 «이어 받는 중» 줄은 여기서 한 번 맞춥니다.
  reconcileResumes();
  pump();
}

// ── 화면이 보는 것 ──────────────────────────────────────────────────────────

const EMPTY: QueueTask[] = [];

export function useTaskQueue(): QueueTask[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => {
      load();
      return tasks;
    },
    () => EMPTY,
  );
}

export interface QueueCounts {
  running: number;
  waiting: number;
  failed: number;
  /** 소식이 끊긴 지 오래된 일이 있는가. 화면이 눈에 띄게 적어 줍니다. */
  stalled: number;
}

export function countTasks(list: QueueTask[], now: number): QueueCounts {
  return {
    running: list.filter((task) => task.status === "running").length,
    waiting: list.filter((task) => task.status === "waiting").length,
    failed: list.filter((task) => task.status === "failed").length,
    stalled: list.filter(
      (task) => task.status === "running" && now - (task.beatAt ?? task.startedAt ?? now) > STALL_MS,
    ).length,
  };
}
