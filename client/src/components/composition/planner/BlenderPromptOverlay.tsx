import { X } from "lucide-react";
import { modalCard } from "@/components/modalShell";
import { toast } from "sonner";

/**
 * 생성기에 붙여 넣을 **지시문 창**. 블렌더 지시문과 6면 전개도 프롬프트가 같이 씁니다.
 *
 * 창을 하나로 쓰는 까닭: 둘 다 «앱이 지은 글을 사람이 손보고 복사한다» 로 똑같습니다.
 * 따로 만들면 복사 단추·스크롤·글꼴 규칙이 두 벌이 되어 한쪽만 고치는 일이 생깁니다.
 */
export function BlenderPromptOverlay({
  text,
  title = "블렌더 작업 지시문",
  hint = "LLM 에 붙여넣고 블렌더 MCP 로 실행하세요",
  note = "인물 동작은 앱이 알 수 없습니다. 주석 자리에 원하는 움직임을 적어 주세요.",
  onChange,
  onClose,
}: {
  text: string;
  title?: string;
  hint?: string;
  note?: string;
  onChange: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-8"
      style={{ background: "oklch(0 0 0 / 72%)" }}
    >
      <div
        className={modalCard("medium")}
        style={{
          background: "oklch(0.15 0.01 265)",
          border: "1px solid oklch(1 0 0 / 10%)",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "oklch(0.88 0.01 265)" }}
            >
              {title}
            </p>
            <p
              className="text-[10px]"
              style={{ color: "oklch(0.52 0.01 265)" }}
            >
              {hint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10"
            style={{ color: "oklch(0.62 0.01 265)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="composition-scroll min-h-0 flex-1 resize-none px-4 py-3 font-mono text-[11px] leading-relaxed outline-none"
          style={{ background: "transparent", color: "oklch(0.82 0.01 265)" }}
        />
        <div
          className="flex shrink-0 items-center justify-between gap-2 px-4 py-3"
          style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <p className="text-[10px]" style={{ color: "oklch(0.48 0.01 265)" }}>
            {note}
          </p>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              toast.success("지시문을 복사했습니다.");
              onClose();
            }}
            className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white gradient-primary"
          >
            복사
          </button>
        </div>
      </div>
    </div>
  );
}
