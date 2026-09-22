import { useEffect, useRef, useState } from "react";
import { openExternal } from "@/lib/openExternal";
import { Check, ExternalLink, Link2, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  checkMagnific,
  logoutMagnific,
  pollMagnificLogin,
  refreshMagnificStatus,
  startMagnificLogin,
  useMagnificStatus,
  type DeviceLogin,
} from "@/lib/magnificMcp";

/**
 * **마그니픽 연결** — 설정에 붙는 칸.
 *
 *
 *
 * # 왜 브라우저에서 코드를 넣는가
 *
 * 디바이스 코드 플로우입니다. 앱이 여섯 자리 코드를 보여 주고, 사람은 브라우저에서 그
 * 코드를 넣어 허락합니다. **앱은 비밀번호를 보지 않습니다** — 볼 일도, 볼 이유도 없습니다.
 * 한 번 허락하면 리프레시 토큰으로 계속 갑니다.
 *
 * # 연결해도 여태 길은 그대로입니다
 *
 * 마그니픽 **창**에 차려 놓는 길(«무제한» 이 적용되는 쪽)은 그대로 남습니다. 연결은
 * «끝까지 뽑기» 라는 **선택지를 하나 더** 여는 것이고, 어느 쪽으로 뽑을지는 작품마다
 * 「한 번에 뽑기」 에서 고릅니다.
 */
export default function MagnificConnectPanel() {
  const status = useMagnificStatus();
  const [login, setLogin] = useState<DeviceLogin | null>(null);
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<number | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    void refreshMagnificStatus();
    return () => {
      stop.current = true;
    };
  }, []);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    stop.current = false;
    try {
      const started = await startMagnificLogin();
      setLogin(started);
      /*
        코드가 박힌 주소가 오면 그걸 엽니다 — 사람이 여섯 자리를 옮겨 적지 않아도 됩니다.
        브라우저는 OS 가 엽니다(앱 안에서 열면 로그인 쿠키가 따로 놀아 매번 다시 로그인).
      */
      const open = started.verificationUriComplete || started.verificationUri;
      if (open) await openExternal(open).catch(() => {});

      // 사람이 브라우저에서 누를 때까지 조용히 물어봅니다.
      for (let turn = 0; turn < 180 && !stop.current; turn += 1) {
        await new Promise((done) => setTimeout(done, Math.max(2, started.interval) * 1000));
        const reply = await pollMagnificLogin(started.deviceCode);
        if (reply.connected) {
          setLogin(null);
          toast.success("마그니픽에 연결했습니다.", {
            description: "이제 「한 번에 뽑기」 에서 «마그니픽 — 끝까지 뽑기» 를 고를 수 있습니다.",
          });
          return;
        }
      }
      toast.error("연결을 마치지 못했습니다.", { description: "다시 «연결» 을 눌러 주세요." });
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(false);
      setLogin(null);
    }
  };

  const check = async () => {
    try {
      const count = await checkMagnific();
      setTools(count);
      toast.success(`연결이 살아 있습니다 — 도구 ${count}개가 보입니다.`);
    } catch (error) {
      setTools(null);
      toast.error(String(error));
    }
  };

  return (
    <div
      className="space-y-2 rounded-lg px-3 py-3"
      style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="shrink-0 text-[12px] font-semibold" style={{ color: "oklch(0.86 0.01 265)" }}>
          마그니픽 연결
        </p>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            background: status.connected ? "oklch(0.74 0.14 160 / 16%)" : "oklch(1 0 0 / 6%)",
            color: status.connected ? "oklch(0.80 0.14 160)" : "oklch(0.55 0.01 265)",
          }}
        >
          {status.connected ? "연결됨" : "연결 안 됨"}
        </span>
        <span className="min-w-0 flex-1" />
        {status.connected ? (
          <>
            <button
              type="button"
              onClick={() => void check()}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
              style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.74 0.13 200)" }}
            >
              <Check className="h-3 w-3" /> 연결 확인
            </button>
            <button
              type="button"
              onClick={() => void logoutMagnific()}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
              style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.74 0.14 25)" }}
            >
              <LogOut className="h-3 w-3" /> 연결 끊기
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-semibold text-white gradient-primary disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
            연결
          </button>
        )}
      </div>

      {login && (
        <div
          className="space-y-1 rounded-md px-3 py-2"
          style={{ background: "oklch(0.62 0.22 290 / 12%)", border: "1px solid oklch(0.62 0.22 290 / 35%)" }}
        >
          <p className="text-[11px]" style={{ color: "oklch(0.86 0.16 290)" }}>
            브라우저에서 이 코드를 넣어 주세요
          </p>
          <p className="text-lg font-bold tracking-widest" style={{ color: "oklch(0.92 0.06 290)" }}>
            {login.userCode}
          </p>
          <button
            type="button"
            onClick={() =>
              void openExternal(login.verificationUriComplete || login.verificationUri).catch((error) =>
                toast.error(String(error)),
              )
            }
            className="flex items-center gap-1 text-[10px] underline"
            style={{ color: "oklch(0.70 0.10 265)" }}
          >
            <ExternalLink className="h-3 w-3" /> 창이 안 열렸으면 여기를 누르세요
          </button>
        </div>
      )}

      {tools !== null && (
        <p className="text-[10px]" style={{ color: "oklch(0.60 0.12 160)" }}>
          도구 {tools}개가 보입니다.
        </p>
      )}

      <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.44 0.01 265)" }}>
        연결하면 「한 번에 뽑기」 에 <b>«마그니픽 — 끝까지 뽑기»</b> 가 생깁니다 — 사람 손 없이
        인물 시트부터 씬 영상까지 돕니다. 다만 <b>건당 과금</b>입니다. 여태 쓰던
        <b> «마그니픽 — 생성기를 차려 놓기»</b>(창에서 직접 뽑는 «무제한» 길)는 그대로 남으니,
        손으로 골라 가며 작업할 때는 그쪽을 고르세요.
      </p>
    </div>
  );
}
