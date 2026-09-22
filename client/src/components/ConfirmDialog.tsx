import { useEffect, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

/**
 * 앱 디자인에 맞춘 확인 창.
 *
 * window.confirm 은 주소창 도메인("127.0.0.1:3000의 메시지")이 그대로 뜨고
 * 줄바꿈도 마음대로 잘립니다. 파일을 지우는 것처럼 되돌릴 수 없는 순간에
 * 시스템 대화상자가 튀어나오면 앱 밖의 일처럼 보입니다.
 *
 * 쓰는 쪽은 window.confirm 과 거의 같습니다. 다만 답을 기다려야 해서 await 가 붙습니다.
 *
 * if (!(await confirmDialog({ title: "지울까요?" }))) return;
 */

export interface ConfirmOptions {
  title: string;
  /** 제목 아래 설명. 왜 되돌릴 수 없는지 같은 것을 적습니다. */
  description?: string;
  /** 파일 이름처럼 길고 잘리면 안 되는 값. 따로 감싸서 보여줍니다. */
  subject?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger 면 확인 버튼이 빨간색이 됩니다. 지우기·되돌리기처럼 잃는 일에 씁니다. */
  tone?: "danger" | "default";
}

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

let notify: ((pending: Pending | null) => void) | null = null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // 창이 아직 화면에 없으면(테스트 등) 막지 말고 통과시킵니다.
  if (!notify) return Promise.resolve(window.confirm(options.title));

  return new Promise<boolean>(resolve => {
    notify?.({ ...options, resolve });
  });
}

/** App 안에 한 번만 놓습니다. 어디서 confirmDialog 를 불러도 여기로 뜹니다. */
export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    notify = setPending;
    return () => { notify = null; };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Enter") return;
      /*
        **여기서 키를 끊습니다.**

        확인 창이 떠 있는데 Escape 를 누르면 뒤에 있는 편집 창도 같이
        받습니다. 그러면 확인만 닫으려던 것이 편집 창까지 닫아 버려서
        카드 목록으로 튕겼습니다. 잡는 단계(capture)에서 멈춥니다.
      */
      event.preventDefault();
      event.stopPropagation();
      answer(event.key === "Enter");
    };
    // capture 로 답니다 — Radix 가 document 에서 먼저 받아 가기 전에 끊어야 합니다.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const answer = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  if (!pending) return null;

  const danger = pending.tone === "danger";
  const accent = danger ? "oklch(0.65 0.19 25)" : "oklch(0.62 0.22 290)";
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <div
      // 튜토리얼 안내 카드(z-1001)보다 위여야 합니다 — 「정말 끝낼까요?」 가 그 뒤에 숨으면
      // 무엇을 누르라는 것인지 알 수 없습니다 — 튜토리얼을 닫겠냐는 물음이 안내 카드 뒤에 깔린 적이 있습니다.
      data-tutorial-layer=""
      className="fixed inset-0 z-[1100] flex items-center justify-center p-6"
      style={{
        background: "oklch(0 0 0 / 68%)",
        backdropFilter: "blur(3px)",
        /*
          이 한 줄이 없으면 **단추가 안 눌립니다.**

          편집 창(Radix Dialog)이 열려 있는 동안 body 에 `pointer-events: none`
          이 걸립니다. 창 안쪽만 다시 켜 주는 방식이라, 창 밖(App 바로 밑)에
          그리는 이 확인 창은 클릭을 못 받습니다. 화면에는 멀쩡히 보이는데
          「지우기」 를 눌러도 아무 일이 없었던 이유입니다.
        */
        pointerEvents: "auto",
      }}
      /*
        **이 창에서 일어난 눌림은 여기서 끝냅니다.**

        확인 창은 편집 창(Radix Dialog) 바깥, 페이지 뿌리에 그려집니다.
        Radix 는 「콘텐츠 밖에서 눌렸다」 를 «창을 닫으라» 로 읽습니다.
        그래서 확인 창의 「취소」 를 누르면 그 눌림이 편집 창에도 닿아
        **편집 창까지 함께 닫히고 카드 목록으로 튕겼습니다.**

        Escape 도 같습니다 — 확인 창을 닫으려고 눌렀는데 편집 창도 같이
        받아 버립니다. 그래서 키도 여기서 멈춥니다.
      */
      onPointerDownCapture={event => event.stopPropagation()}
      onMouseDownCapture={event => event.stopPropagation()}
      onKeyDownCapture={event => event.stopPropagation()}
      // 바깥을 눌러도 닫습니다. 취소와 같은 뜻입니다.
      onMouseDown={event => { if (event.target === event.currentTarget) answer(false); }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl"
        style={{
          background: "oklch(0.15 0.01 265)",
          border: `1px solid ${accent}40`,
          boxShadow: "0 24px 60px oklch(0 0 0 / 55%)",
        }}
      >
        <div className="flex gap-3 px-5 pt-5">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${accent}1f`, border: `1px solid ${accent}45` }}
          >
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-white">{pending.title}</p>
            {pending.description && (
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "oklch(0.60 0.01 265)" }}>
                {pending.description}
              </p>
            )}
          </div>
        </div>

        {/* 파일 이름은 길어서 본문에 섞으면 읽기 어렵습니다. 따로 감쌉니다. */}
        {pending.subject && (
          <div
            className="mx-5 mt-3 break-all rounded-md px-3 py-2 font-mono text-[11px] leading-relaxed"
            style={{ background: "oklch(0.11 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.74 0.01 265)" }}
          >
            {pending.subject}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid oklch(1 0 0 / 7%)" }}>
          <button
            type="button"
            onClick={() => answer(false)}
            className="rounded-lg px-4 py-2 text-xs font-medium transition-colors hover:bg-white/10"
            style={{ color: "oklch(0.62 0.01 265)", border: "1px solid oklch(1 0 0 / 12%)" }}
          >
            {pending.cancelLabel || "취소"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            className={
              danger
                ? "rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                : "rounded-lg px-4 py-2 text-xs font-semibold text-white gradient-primary transition-opacity hover:opacity-90"
            }
            style={danger ? { background: "oklch(0.52 0.20 25)" } : undefined}
          >
            {pending.confirmLabel || "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
