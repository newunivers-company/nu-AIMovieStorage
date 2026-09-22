import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CompositionState } from "@/lib/composition";
import { motionTracksOf, type UpdateComposition } from "@/lib/compositionEdit";
import { callLlmText, isDesktopApp, parseJsonResponse } from "@/lib/llm";
import {
  analyzeMotion,
  autoDecisions,
  cleanupCharacterIn,
  CLEANUP_SYSTEM,
  cleanupPrompt,
  issueLabel,
  type CleanupDecision,
  type CleanupSensitivity,
} from "@/lib/motionCleanup";

/**
 * **캐릭터 한 명의 모캡 키 다듬기** — 배치 탭의 인물 칸에 섭니다.
 *
 * 단추가 둘인 까닭 — 앱이 셈해서 바로 고치는 길과, 키 값을 LLM 에 보내 무엇이 이상한지 짚어 받는 길이 다릅니다.
 * 패널이 **인물마다** 서는 까닭 — 모캡은 캐릭터에 따로 붙으므로 다듬기도 한 명씩 해야 합니다.
 *
 * 촘촘한 키(모캡)가 있는 캐릭터에만 보입니다. 손으로 찍은 성긴 키는 건드리지 않습니다(`motionCleanup.seriesOf`).
 * 두 단추 모두 결과를 **한 번의 상태 변경**으로 넣어 Ctrl+Z 한 번에 되돌아갑니다.
 */
export function MotionCleanupPanel({
  state,
  setState,
  characterId,
  name,
}: {
  state: CompositionState;
  setState: UpdateComposition;
  characterId: string;
  name: string;
}) {
  const [sensitivity, setSensitivity] = useState<CleanupSensitivity>("normal");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ decisions: CleanupDecision[]; labels: Record<string, string>; changed: number; fromLlm: boolean } | null>(
    null,
  );
  const tracks = useMemo(() => motionTracksOf(state).filter((track) => track.targetId === characterId), [state, characterId]);
  const denseKeys = tracks.reduce((sum, track) => sum + (track.keys.length >= 8 ? track.keys.length : 0), 0);
  const issues = useMemo(() => (denseKeys ? analyzeMotion(tracks, sensitivity) : []), [tracks, sensitivity, denseKeys]);
  if (!denseKeys) return null;

  const apply = (decisions: CleanupDecision[], fromLlm: boolean) => {
    /*
      바뀐 키 수는 **지금 보이는 상태로 미리** 셉니다. 상태 갱신 함수 안에서 세면 React 가 그 함수를 나중에 돌려, 알림에는 늘 0 이
      찍혔습니다(실제로 그렇게 나왔습니다). 실제 반영은 갱신 함수 안에서 — 그새 상태가 바뀌었으면 그 상태로 다시 분석해 id 가 맞는 것만 씁니다.
    */
    const { changed } = cleanupCharacterIn(state, characterId, issues, decisions);
    setState((current) => {
      const now = analyzeMotion(
        motionTracksOf(current).filter((track) => track.targetId === characterId),
        sensitivity,
      );
      const result = cleanupCharacterIn(current, characterId, now, decisions);
      return result.changed ? result.state : current;
    });
    const smoothed = decisions.filter((item) => item.action === "smooth").length;
    setLast({
      decisions,
      labels: Object.fromEntries(issues.map((issue) => [issue.id, issueLabel(issue)])),
      changed,
      fromLlm,
    });
    toast.success(`${name} · 흔들림 ${smoothed}곳을 이었습니다${fromLlm ? " (AI 판단)" : ""} · 키 ${changed}개`, {
      description: `${decisions.length - smoothed}곳은 의도한 동작으로 두었습니다 · Ctrl+Z 로 되돌리기`,
    });
  };

  const runAuto = () => {
    if (!issues.length) {
      toast.info("흔들리는 구간을 찾지 못했습니다.");
      return;
    }
    apply(autoDecisions(issues), false);
  };

  const runAi = async () => {
    if (!issues.length) {
      toast.info("흔들리는 구간을 찾지 못했습니다.");
      return;
    }
    if (!isDesktopApp()) {
      toast.error("AI 분석은 데스크톱 앱에서만 됩니다.");
      return;
    }
    setBusy(true);
    try {
      const times = tracks.flatMap((track) => track.keys.map((key) => key.time));
      const duration = Math.max(...times) - Math.min(...times);
      const fps = Math.round(Math.max(...tracks.map((track) => track.keys.length)) / Math.max(0.1, duration));
      const text = await callLlmText({
        task: "motionCleanup",
        system: CLEANUP_SYSTEM,
        prompt: cleanupPrompt(issues, { name, duration, fps }),
        maxTokens: 8192,
        timeoutSecs: 300,
      });
      const parsed = parseJsonResponse<{ decisions?: CleanupDecision[] }>(text);
      const known = new Set(issues.map((issue) => issue.id));
      const decisions = (parsed.decisions ?? [])
        .filter((item) => item && known.has(item.id) && (item.action === "smooth" || item.action === "keep"))
        .map((item) => ({ ...item, strength: Math.min(1, Math.max(0, Number(item.strength) || 0.3)) }));
      /*
        AI 가 답에서 빠뜨린 구간은 규칙으로 채웁니다. 400 개가 넘으면 표를 잘라 보내고, 모델도 가끔 몇 줄을 건너뜁니다 —
        빠진 곳을 그대로 두면 사람은 «AI 로 다 봤다» 고 믿는데 흔들림이 남습니다.
      */
      const answered = new Set(decisions.map((item) => item.id));
      const filled = [...decisions, ...autoDecisions(issues.filter((issue) => !answered.has(issue.id)))];
      apply(filled, true);
    } catch (error) {
      toast.error(`AI 분석을 못 했습니다 — 규칙으로 다듬으려면 «자동 다듬기» 를 누르세요. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-tour="layout-mocap-cleanup" className="mt-3 rounded-md px-2 py-2" style={{ background: "oklch(1 0 0 / 3%)", border: "1px solid oklch(1 0 0 / 7%)" }}>
      <div className="flex items-center justify-between text-[10px]" style={{ color: "oklch(0.70 0.01 265)" }}>
        <span className="font-semibold">모캡 키 다듬기</span>
        <span className="flex gap-1">
          {(
            [
              ["low", "둔하게", "크게 튄 곳만"],
              ["normal", "보통", "권장"],
              ["high", "예민하게", "작은 떨림까지 — 빠른 동작 끝이 무뎌질 수 있음"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              title={hint}
              onClick={() => setSensitivity(value)}
              className="rounded px-1.5 py-0.5 text-[9px]"
              style={{
                background: sensitivity === value ? "oklch(0.62 0.22 290 / 22%)" : "oklch(1 0 0 / 5%)",
                color: sensitivity === value ? "oklch(0.84 0.19 290)" : "oklch(0.62 0.01 265)",
              }}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      <p className="mt-1 text-[9px] leading-relaxed" style={{ color: "oklch(0.50 0.01 265)" }}>
        촘촘한 키 {denseKeys.toLocaleString()}개 · 흔들림 후보 {issues.length}곳
        {issues.length > 0 && ` (지그재그 ${issues.filter((issue) => issue.kind === "jitter").length} · 튐 ${issues.filter((issue) => issue.kind === "spike").length})`}
      </p>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          disabled={busy || !issues.length}
          onClick={runAuto}
          className="flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold disabled:opacity-40"
          style={{ background: "oklch(0.55 0.15 200 / 16%)", border: "1px solid oklch(0.55 0.15 200 / 40%)", color: "oklch(0.82 0.10 200)" }}
          title="규칙으로 계산해 바로 잇습니다 — 지그재그·외톨이 튐은 모두 잇고, 편차가 클수록 넓게"
        >
          자동 다듬기
        </button>
        <button
          type="button"
          disabled={busy || !issues.length}
          onClick={() => void runAi()}
          className="flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold disabled:opacity-40"
          style={{ background: "oklch(0.62 0.22 290 / 16%)", border: "1px solid oklch(0.62 0.22 290 / 40%)", color: "oklch(0.84 0.18 290)" }}
          title="구간마다 숫자표를 AI 에 보내 «인식 오류 / 의도한 빠른 동작» 을 가려 오류만 잇습니다(설정의 «모캡 키 다듬기 분석» 모델)"
        >
          {busy ? "AI 분석 중…" : "AI 분석 다듬기"}
        </button>
      </div>
      {last && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[9px]" style={{ color: "oklch(0.55 0.01 265)" }}>
            지난 다듬기 — {last.fromLlm ? "AI" : "자동"} · 키 {last.changed}개 바뀜
          </summary>
          <ul className="composition-scroll mt-1 max-h-32 space-y-0.5 overflow-y-auto text-[9px]" style={{ color: "oklch(0.60 0.01 265)" }}>
            {last.decisions.slice(0, 80).map((item) => (
              <li key={item.id}>
                {item.action === "smooth" ? "이음" : "둠"} · {last.labels[item.id] ?? item.id}
                {item.reason ? ` — ${item.reason}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
