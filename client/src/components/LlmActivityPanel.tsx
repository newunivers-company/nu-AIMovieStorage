import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Loader2, Radio, Trash2, X } from "lucide-react";
import { LLM_TASK_LABELS } from "@/lib/llm";
import {
  clearFinishedLlmJobs,
  llmUsageTotals,
  useLlmActivity,
  type LlmJob,
} from "@/lib/llmActivity";
import { formatLlmCost, llmCostOf } from "@/lib/llm";

/**
 * 지금 API 에 무엇을 부탁해 놓았는지 보는 자리.
 *
 * 요청 하나에 몇 십 초가 걸립니다. 그동안 기다리지 않고 다른 카드를 열어 다음
 * 요청을 거는 것이 정상적인 사용법인데, 그러면 곧 알 수 없어집니다 — 아까 그
 * 요청이 아직 도는지, 답이 왔는지, 실패했는지.
 *
 * 토스트는 지나가면 끝이라 이 물음에 답하지 못합니다. 특히 실패 메시지는
 * 다른 창을 보는 사이에 떴다 사라지면 무엇이 잘못됐는지 영영 모릅니다.
 *
 * 버튼은 화면 오른쪽 아래에 고정합니다. 요청이 도는 동안에는 숫자가 붙고,
 * 다 끝나면 조용해집니다.
 */

function elapsed(job: LlmJob, now: number) {
  const end = job.finishedAt ?? now;
  const seconds = Math.max(0, Math.round((end - job.startedAt) / 1000));
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

const TONE: Record<LlmJob["status"], { color: string; background: string; label: string }> = {
  running: { color: "oklch(0.80 0.14 250)", background: "oklch(0.55 0.15 250 / 15%)", label: "요청 중" },
  // 앱이 닫힐 때 답을 기다리던 요청 — 서버가 답을 들고 있어 줄이 다시 돌면 이어 받습니다.
  resuming: { color: "oklch(0.80 0.12 80)", background: "oklch(0.60 0.14 80 / 15%)", label: "이어 받는 중" },
  done: { color: "oklch(0.80 0.14 150)", background: "oklch(0.55 0.15 150 / 15%)", label: "받음" },
  failed: { color: "oklch(0.75 0.17 25)", background: "oklch(0.60 0.18 25 / 15%)", label: "실패" },
};

/** 상태 표의 글자. 이어 받은 답은 「받음 (이어 받음)」 — 값을 새로 낸 요청과 구분되어야 합니다. */
const statusLabel = (job: LlmJob) => (job.status === "done" && job.resumed ? "받음 (이어 받음)" : TONE[job.status].label);

/** 돌고 있다고 볼 것 — 이어 받을 것도 아직 답을 기다리는 중입니다. */
const isLive = (job: LlmJob) => job.status === "running" || job.status === "resuming";

export default function LlmActivityPanel() {
  const jobs = useLlmActivity();
  const [open, setOpen] = useState(false);

  // 도는 동안 «몇 초째» 를 세어 보여 줍니다. 멈춰 있는 숫자는 멈춘 것처럼 보입니다.
  const [now, setNow] = useState(() => Date.now());
  const running = jobs.filter(isLive).length;
  const totals = llmUsageTotals(jobs);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const failed = jobs.filter((job) => job.status === "failed").length;

  if (typeof document === "undefined") return null;

  /*
   * body 로 내보냅니다.
   *
   * 이 컴포넌트는 상단 바 안에 놓여 있는데, 그 상단 바에 backdrop-filter 가
   * 걸려 있습니다. **필터가 걸린 요소는 fixed 자식의 기준이 됩니다.** 그래서
   * "화면 오른쪽 아래" 로 둔 것이 높이 56px 짜리 상단 바 안쪽 오른쪽 아래로
   * 잡혀, 엉뚱한 자리에서 뒤를 가리고 눌리지도 않았습니다.
   *
   * 자리를 옮기는 대신 부모 밖으로 내보냅니다. 상단 바의 사정이 바뀌어도
   * 여기가 다시 틀어지지 않습니다.
   */
  return (
    <>
      {/* 버튼은 상단 바 안에 그대로 둡니다 — 「AI 최적화」 표시 바로 왼쪽입니다. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="API 요청 진행 상황"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
        style={{
          background: running
            ? "oklch(0.55 0.15 250 / 30%)"
            : failed
              ? "oklch(0.50 0.16 25 / 30%)"
              : "oklch(1 0 0 / 5%)",
          color: running || failed ? "white" : "oklch(0.55 0.01 265)",
        }}
      >
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}
        {running ? `요청 ${running}건` : failed ? `실패 ${failed}건` : "API 기록"}
      </button>

      {/* 펼친 패널만 body 로 내보냅니다 — 위 주석의 backdrop-filter 문제 때문입니다. */}
      {open && createPortal(
        <aside
          className="fixed right-4 top-14 z-[60] flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col rounded-xl shadow-2xl"
          style={{ background: "oklch(0.14 0.01 265)", border: "1px solid oklch(1 0 0 / 12%)" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">API 요청 진행 상황</p>
              {/*
                남아 있는 기록의 합계. 「이 작품에 얼마 썼나」 를 보는 유일한 자리라
                **«끝난 것 비우기» 를 누르면 이 값도 같이 줄어듭니다** — 그 편이 맞습니다.
                비운 뒤의 합계는 「비운 뒤로 얼마 썼나」 가 되니까요.
              */}
              {totals.cost > 0 && (
                <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: "oklch(0.55 0.01 265)" }}>
                  입력 {totals.input.toLocaleString("ko-KR")} · 출력 {totals.output.toLocaleString("ko-KR")}
                  {totals.cacheRead > 0 && ` · 캐시 읽기 ${totals.cacheRead.toLocaleString("ko-KR")}`}
                  {totals.cacheWrite > 0 && ` · 씀 ${totals.cacheWrite.toLocaleString("ko-KR")}`}
                  {" · 추정 "}
                  <span style={{ color: "oklch(0.76 0.12 80)" }}>{formatLlmCost(totals.cost)}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearFinishedLlmJobs}
              title="끝난 기록만 지웁니다. 도는 중인 요청은 그대로 갑니다"
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold hover:bg-white/10"
              style={{ color: "oklch(0.58 0.01 265)" }}
            >
              <Trash2 className="h-3 w-3" /> 끝난 것 비우기
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="rounded p-1 hover:bg-white/10"
              style={{ color: "oklch(0.58 0.01 265)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
            {jobs.map((job) => {
              const tone = TONE[job.status];
              return (
                <div
                  key={job.id}
                  className="rounded-lg px-2.5 py-2"
                  style={{ background: "oklch(0.11 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: tone.background, color: tone.color }}
                    >
                      {isLive(job) && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      {job.status === "done" && <Check className="h-2.5 w-2.5" />}
                      {job.status === "failed" && <AlertCircle className="h-2.5 w-2.5" />}
                      {statusLabel(job)}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[11px] font-semibold" style={{ color: "oklch(0.86 0.005 265)" }}>
                      {job.label}
                    </p>
                    <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "oklch(0.45 0.01 265)" }}>
                      {elapsed(job, now)}
                    </span>
                  </div>

                  {/*
                    언제 무엇을 보냈고 언제 받았는지.
                    «몇 초 걸렸는지» 만으로는 순서를 못 맞춥니다. 두 개를 잇달아
                    돌렸을 때 어느 것이 먼저 나갔는지 시각이 있어야 압니다.
                  */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
                    <span>{LLM_TASK_LABELS[job.task] ?? job.task}</span>
                    <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                    <span className="tabular-nums">보냄 {clock(job.startedAt)}</span>
                    {job.finishedAt && (
                      <>
                        <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                        <span className="tabular-nums">
                          {job.status === "failed" ? "끊김" : "받음"} {clock(job.finishedAt)}
                        </span>
                      </>
                    )}
                  </div>

                  {/*
                    **쓴 양.** 토큰은 제공사가 준 사실이라 먼저 보여 주고, 금액은 곁들입니다
                    (요금표는 언제든 바뀌므로 «추정» 입니다 — `LLM_PRICES`).
                    캐시 읽기는 0.1배라 따로 적습니다. 이 숫자가 0 이면 캐시가 안 먹는 것입니다.
                  */}
                  {job.usage && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] tabular-nums" style={{ color: "oklch(0.52 0.01 265)" }}>
                      <span>입력 {job.usage.inputTokens.toLocaleString("ko-KR")}</span>
                      <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                      <span>출력 {job.usage.outputTokens.toLocaleString("ko-KR")}</span>
                      {/*
                        **읽기와 쓰기를 둘 다 보여 줍니다.**

                        읽기만 보여 주었더니 첫 요청이 «아무 일도 안 한 것» 처럼 보였습니다
                        . 캐시는 첫 요청이 **써 두어야**(1.25배)
                        다음 요청이 읽습니다(0.1배). 쓰기가 안 보이면 「왜 첫 요청이 이 값이지」
                        를 설명할 수가 없고, 캐시가 붙는 중인지 안 붙는지도 못 가립니다.
                      */}
                      {job.usage.cacheReadTokens > 0 && (
                        <>
                          <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                          <span style={{ color: "oklch(0.70 0.13 150)" }}>
                            캐시 읽기 {job.usage.cacheReadTokens.toLocaleString("ko-KR")}
                          </span>
                        </>
                      )}
                      {job.usage.cacheWriteTokens > 0 && (
                        <>
                          <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                          <span style={{ color: "oklch(0.72 0.12 250)" }}>
                            캐시 씀 {job.usage.cacheWriteTokens.toLocaleString("ko-KR")}
                          </span>
                        </>
                      )}
                      {/* 어느 모델로 갔는지. 요금이 단마다 다섯 배씩 갈려서 이게 없으면 값을 못 읽습니다. */}
                      <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                      <span style={{ color: "oklch(0.42 0.01 265)" }}>{job.usage.model}</span>
                      <span style={{ color: "oklch(0.34 0.01 265)" }}>·</span>
                      <span style={{ color: "oklch(0.72 0.10 80)" }}>{formatLlmCost(llmCostOf(job.usage))}</span>
                    </div>
                  )}

                  {/* 답이 화면 밖으로 들어갔을 때 어디로 갔는지. 이게 없으면 찾을 수가 없습니다. */}
                  {job.delivered && (
                    <p className="mt-1 text-[10px]" style={{ color: "oklch(0.72 0.12 150)" }}>
                      → {job.delivered}
                    </p>
                  )}

                  {job.status === "done" && !job.delivered && (
                    <p className="mt-1 text-[10px]" style={{ color: "oklch(0.50 0.01 265)" }}>
                      → 요청을 건 화면에 넣었습니다
                    </p>
                  )}

                  {/* 앱이 닫혀 끊겼지만 잃은 것은 아닙니다 — 서버가 답을 들고 있고, 작업 줄이 차례가 오면 묻습니다. */}
                  {job.status === "resuming" && (
                    <p className="mt-1 text-[10px]" style={{ color: "oklch(0.72 0.10 80)" }}>
                      앱이 닫혀 — 작업 줄이 다시 돌면 처음부터 보내지 않고 그 답을 이어 받습니다
                    </p>
                  )}

                  {job.error && (
                    <p className="mt-1 break-words text-[10px] leading-relaxed" style={{ color: "oklch(0.70 0.15 25)" }}>
                      {job.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p
            className="px-4 py-2.5 text-[10px] leading-relaxed"
            style={{ borderTop: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.42 0.01 265)" }}
          >
            창을 닫아도 요청은 계속 갑니다. 받은 값은 요청을 건 카드에 들어갑니다 —
            그 사이 다른 카드를 보고 있었다면 위의 <b>→</b> 표시가 어디로 갔는지 알려 줍니다.
          </p>
        </aside>,
        // 상단 바에 backdrop-filter 가 걸려 있어서, 그 안의 fixed 는 화면이 아니라
        // 상단 바를 기준으로 잡힙니다. 몸통 바로 밑으로 내보내야 제자리에 섭니다.
        document.body,
      )}
    </>
  );
}

/** 시:분:초. 날짜는 뺍니다 — 대개 오늘 안에 일어난 일이라 줄만 길어집니다. */
function clock(at?: number) {
  if (!at) return "";
  return new Date(at).toLocaleTimeString("ko-KR", { hour12: false });
}
