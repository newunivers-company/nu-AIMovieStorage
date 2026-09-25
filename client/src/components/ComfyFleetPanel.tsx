import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  checkComfyFleet,
  checkComfyWorkflows,
  COMFY_MODEL_LABEL,
  COMFY_PREFERRED,
  COMFY_REMOTE_ENGINES,
  DEFAULT_COMFY_ENDPOINTS,
  saveComfyFleet,
  useComfyFleet,
  type ComfyEndpointCheck,
  type ComfyEndpointStatus,
} from "@/lib/comfyFleet";
import { LOCAL_ENGINE_IDS } from "@/lib/localEngines";
import { isDesktopApp } from "@/lib/llm";

/**
 * 설정 → «사내 ComfyUI» — 생성을 회사 서버로 보낼지, 어느 서버들로 보낼지.
 *
 * 켜 두면 카드의 «뽑기»·일괄 생성·BGM 이 이 컴퓨터 대신 사내 ComfyUI 에서 돕니다.
 * 서버는 가장 한가한 곳을 그때그때 고르므로 여기서는 주소만 적습니다.
 */
/**
 * 서버 한 대에서 내장 워크플로가 몇 개 도는가. 빠진 것이 있으면 무엇이 빠졌는지 적습니다 —
 * 서버의 모델 파일 이름이 바뀌면 생성을 누르기 전에 여기서 먼저 알 수 있습니다.
 */
function WorkflowReadiness({ check }: { check: ComfyEndpointCheck }) {
  if (check.error) return <span style={{ color: "oklch(0.7 0.12 25)" }}>· 워크플로 점검 실패: {check.error}</span>;
  const broken = check.workflows.filter((item) => item.missing.length > 0);
  const total = check.workflows.length;
  if (!broken.length)
    return <span style={{ color: "oklch(0.75 0.15 160)" }}>· 워크플로 {total}개 모두 준비됨</span>;
  return (
    <div className="w-full pl-4 text-[10.5px]" style={{ color: "oklch(0.75 0.14 60)" }}>
      워크플로 {total - broken.length}/{total} 준비됨 — 이 서버로는 아래가 거절되고 다른 서버로 넘어갑니다.
      {broken.map((item) => (
        <div key={item.workflow} className="font-mono">
          {item.workflow}: {item.missing.join(", ")}
        </div>
      ))}
    </div>
  );
}

export default function ComfyFleetPanel() {
  const settings = useComfyFleet();
  const [draft, setDraft] = useState(() => settings.endpoints.join("\n"));
  const [checking, setChecking] = useState(false);
  const [statuses, setStatuses] = useState<ComfyEndpointStatus[] | null>(null);
  /** 서버마다 내장 워크플로가 도는가(빠진 노드·모델). 상태 확인과 함께 받습니다. */
  const [checks, setChecks] = useState<Record<string, ComfyEndpointCheck>>({});
  const desktop = isDesktopApp();

  const endpointsOf = (text: string) =>
    text
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const saveEndpoints = () => {
    saveComfyFleet({ ...settings, endpoints: endpointsOf(draft) });
    toast.success("사내 ComfyUI 주소를 저장했습니다.");
  };

  const check = async () => {
    setChecking(true);
    try {
      const list = endpointsOf(draft);
      const [result, workflowChecks] = await Promise.all([
        checkComfyFleet(list),
        checkComfyWorkflows(list).catch(() => [] as ComfyEndpointCheck[]),
      ]);
      setStatuses(result);
      setChecks(Object.fromEntries(workflowChecks.map((item) => [item.url, item])));
      const alive = result.filter((item) => item.ok).length;
      if (alive) toast.success(`${result.length}대 중 ${alive}대가 응답합니다.`);
      else toast.error("응답하는 서버가 없습니다. 주소와 사내망 연결을 확인하세요.");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setChecking(false);
    }
  };

  const engines = COMFY_REMOTE_ENGINES.filter((id) => LOCAL_ENGINE_IDS.includes(id));
  const muted = { color: "oklch(0.55 0.01 265)" };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed" style={muted}>
        켜 두면 그림·영상·음악을 <b>이 컴퓨터 대신 사내 ComfyUI 서버</b>에서 뽑습니다. 엔진을 설치하지
        않아도 되고, 결과는 로컬로 뽑을 때와 같은 자리(프로젝트 폴더)에 놓입니다. 매번 대기열이 가장
        짧은 서버를 골라 보냅니다. 그림은 <b>{COMFY_MODEL_LABEL[COMFY_PREFERRED.image!]}</b>, 영상은{" "}
        <b>{COMFY_MODEL_LABEL[COMFY_PREFERRED.video!]}</b> 가 기본입니다.
      </p>

      <label className="flex items-center gap-2 text-[12px] text-white">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => saveComfyFleet({ ...settings, enabled: event.target.checked })}
        />
        사내 ComfyUI 로 생성하기
      </label>

      <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: "oklch(0.8 0.01 265)" }}>
        <span className="font-semibold">MiniMax H3 영상</span>
        {(
          [
            ["fast", "빠르게 — 8스텝, 약 2배 빠름"],
            ["high", "고품질 — 20스텝"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-1">
            <input
              type="radio"
              name="comfy-speed"
              checked={settings.speed === value}
              onChange={() => saveComfyFleet({ ...settings, speed: value })}
            />
            {label}
          </label>
        ))}
        <span style={muted}>(레퍼런스로 뽑는 영상은 늘 고품질)</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
          서버 주소 (한 줄에 하나)
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full rounded-md p-2 font-mono text-[11px] outline-none"
          style={{
            background: "oklch(0.11 0.008 265)",
            border: "1px solid oklch(1 0 0 / 8%)",
            color: "oklch(0.85 0.01 265)",
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={saveEndpoints}
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "oklch(1 0 0 / 8%)", color: "oklch(0.85 0.01 265)" }}
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => void check()}
            disabled={checking || !desktop}
            title={desktop ? "각 서버의 상태와 대기열을 봅니다" : "데스크톱 앱에서만 확인할 수 있습니다"}
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
            style={{ background: "oklch(1 0 0 / 8%)", color: "oklch(0.85 0.01 265)" }}
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            연결 확인
          </button>
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_COMFY_ENDPOINTS.join("\n"))}
            className="rounded-md px-2.5 py-1 text-[11px]"
            style={{ color: "oklch(0.6 0.01 265)" }}
          >
            기본 주소로
          </button>
        </div>
      </div>

      {statuses && (
        <div className="space-y-1">
          {statuses.map((item) => (
            <div
              key={item.url}
              className="flex flex-wrap items-center gap-x-2 rounded-md px-2 py-1 text-[11px]"
              style={{ background: "oklch(0.11 0.008 265)" }}
            >
              <span style={{ color: item.ok ? "oklch(0.75 0.15 160)" : "oklch(0.7 0.18 25)" }}>●</span>
              <span className="font-mono text-white">{item.url.replace(/^https?:\/\//, "")}</span>
              {item.ok ? (
                <span style={muted}>
                  {item.device.replace(/^cuda:\d+\s*/, "").replace(/\s*:\s*cudaMallocAsync$/, "")} · VRAM{" "}
                  {item.vramFreeGb.toFixed(1)}/{item.vramTotalGb.toFixed(0)} GB 여유 · 실행 {item.running} · 대기{" "}
                  {item.pending}
                  {item.reserved ? ` · 이 앱이 보낸 것 ${item.reserved}` : ""} · {item.latencyMs}ms
                  {item.loadedModels?.length
                    ? ` · 올라가 있는 모델: ${item.loadedModels.map((m) => m.split("/").pop()?.replace(/\.safetensors$/, "")).join(", ")}`
                    : ""}
                </span>
              ) : (
                <span style={{ color: "oklch(0.7 0.12 25)" }}>{item.error}</span>
              )}
              {item.ok && checks[item.url] && <WorkflowReadiness check={checks[item.url]} />}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed" style={muted}>
        사내 서버로 뽑을 수 있는 모델: {engines.map((id) => COMFY_MODEL_LABEL[id]).join(" · ")}. 모션
        캡처는 이 컴퓨터에서만 돕니다. 사내 서버에서는 움직임 마스크·포즈 조건을 아직 싣지 않고, 로라는
        서버에 같은 파일 이름이 있을 때만 겁니다 — 못 실은 것은 결과 알림에 적습니다.
      </p>
    </div>
  );
}
