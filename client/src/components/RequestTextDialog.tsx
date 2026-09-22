import { useEffect, useState } from "react";
import { useEscapeClose } from "@/components/useEscapeClose";
import {
  MODAL_BACKDROP,
  MODAL_BACKDROP_STYLE,
  MODAL_CARD_STYLE,
  modalCard,
} from "@/components/modalShell";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { parseJsonResponse } from "@/lib/llm";

/** 프롬프트 네 칸. 화면의 칸 수와 같아야 합니다 — 세 칸만 받으면 하나가 빈 채로 남습니다. */
export interface PromptQuad {
  ko: string;
  en: string;
  negativeKo: string;
  negativeEn: string;
  /**
   * **가사** — 곡 요청(`bgm-prompt`)만 씁니다.
   *
   * 음악 모델은 네거티브를 안 받고 «스타일 + 가사» 를 받습니다. 그런데 이 창은 네 칸이
   * 늘 «프롬프트 둘 + 네거티브 둘» 이라, 모델이 가사를 보내와도 갈라내는 자리가 없어
   * 통째로 버려졌습니다().
   */
  lyricsKo?: string;
  lyricsEn?: string;
}

/**
 * 뒤 두 칸이 **네거티브**인지 **가사**인지.
 *
 * 카드마다 칸 이름이 달라지는 것이 아니라, 받는 것 자체가 다릅니다. 그림은 «빼고 싶은 것»,
 * 곡은 «부를 말» 입니다. 창을 둘로 나누지 않고 뒤 두 칸의 쓰임만 바꿉니다(공통 규칙 1).
 */
export type PromptTailShape = "네거티브" | "가사";

/**
 * LLM 요청문을 만들어 주고, 받아온 답을 다시 앱에 넣는 창.
 *
 * 두 단계가 한 창에 있는 이유는 이게 한 번의 왕복이기 때문입니다.
 * 요청문만 주고 끝내면 결과는 사용자가 손으로 한글·영문을 갈라 붙여야 합니다.
 *
 * # 돌려받는 길이 두 갈래인 이유
 *
 * 프롬프트 요청은 **네 칸**으로 갈라 넣어야 하고, 분석·특징·스토리보드 요청은
 * 글 한 덩어리를 **그대로** 넣어야 합니다. 한 가지로 묶으려다 분석 결과가
 * 「한글 프롬프트」 칸에 들어가는 일이 있었습니다. 그래서 받는 쪽을 나눕니다.
 */
export function RequestTextDialog({ open, title, text, onClose, onApplyPrompt, onApplyText, applyTextLabel, tail = "네거티브" }: {
  open: boolean;
  title: string;
  text: string;
  onClose: () => void;
  /** 뒤 두 칸의 쓰임. 곡 카드는 "가사" 입니다. */
  tail?: PromptTailShape;
  /** 있으면 "② 결과 넣기" 가 생깁니다. 네 칸으로 갈라 넣습니다. */
  onApplyPrompt?: (result: PromptQuad) => void;
  /** 있으면 "② 결과 넣기" 가 생깁니다. 받은 글을 그대로 넘깁니다. */
  onApplyText?: (raw: string) => void;
  /** 그대로 넣기일 때 칸 이름. 예: "분석 결과" */
  applyTextLabel?: string;
}) {
  const [draft, setDraft] = useState(text);
  const [step, setStep] = useState<"request" | "result">("request");
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<PromptQuad>(EMPTY);

  const canApply = Boolean(onApplyPrompt || onApplyText);

  useEffect(() => {
    if (!open) return;
    // 창을 다시 열면 처음 상태로 돌립니다. 이전 왕복의 잔재가 남으면 헷갈립니다.
    setDraft(text);
    setStep("request");
    setRaw("");
    setParsed(EMPTY);
  }, [open, text]);

  // Esc 로도 닫습니다 — 창마다 따로 적으면 새 창에서 또 빠집니다(규칙 1).
  useEscapeClose(open, onClose);

  if (!open) return null;

  /**
   * 답변에서 네 칸을 갈라냅니다.
   * JSON 으로 오는 게 정상이지만, 사람이 답변 일부만 복사해 오는 경우도 흔해서
   * 실패하면 라벨을 찾아 나누는 쪽으로 물러섭니다.
   */
  const split = () => {
    if (!raw.trim()) { toast.error("받은 답변을 붙여넣어 주세요."); return; }
    try {
      const value = parseJsonResponse<
        Partial<PromptQuad> & { negative?: string; lyrics?: string; style?: string }
      >(raw);
      if (typeof value.ko === "string" || typeof value.en === "string" || typeof value.style === "string") {
        setParsed({
          ko: value.ko ?? "",
          en: value.en ?? value.style ?? "",
          negativeKo: value.negativeKo ?? "",
          // 예전 요청문은 negative 하나만 받았습니다. 그건 영문 쪽입니다.
          negativeEn: value.negativeEn ?? value.negative ?? "",
          lyricsKo: value.lyricsKo ?? "",
          // 곡 요청에서 한 칸만 보내오면 그건 생성기에 넣는 영문 쪽입니다.
          lyricsEn: value.lyricsEn ?? value.lyrics ?? "",
        });
        toast.success("네 칸으로 나눴습니다. 확인하고 적용하세요.");
        return;
      }
    } catch {
      // 아래 라벨 방식으로 넘어갑니다.
    }

    // "한글 프롬프트:" / "English:" 같은 라벨을 찾습니다.
    const koMatch = raw.match(/(?:한글|한국어|ko)\s*(?:프롬프트)?\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:영문|영어|English|en)\s*(?:프롬프트)?\s*[:：]|$)/i);
    const enMatch = raw.match(/(?:영문|영어|English|en)\s*(?:프롬프트)?\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:negative|네거티브|제외)\s*[\s\S]{0,12}?[:：]|$)/i);
    const negKoMatch = raw.match(/(?:한글\s*네거티브|negativeKo)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:English\s*Negative|negativeEn|영문\s*네거티브)\s*[:：]|$)/i);
    const negEnMatch = raw.match(/(?:English\s*Negative|negativeEn|영문\s*네거티브|negative|제외)\s*[:：]\s*([\s\S]*)$/i);

    if (koMatch || enMatch) {
      setParsed({
        ko: koMatch?.[1].trim() ?? "",
        en: enMatch?.[1].trim() ?? "",
        negativeKo: negKoMatch?.[1].trim() ?? "",
        negativeEn: negEnMatch?.[1].trim() ?? "",
      });
      toast.success("라벨을 찾아 나눴습니다. 확인하고 적용하세요.");
      return;
    }

    toast.error("한글·영문을 구분하지 못했습니다. 아래 칸에 직접 나눠 넣어 주세요.");
    setParsed({ ...EMPTY, ko: raw.trim() });
  };

  const field = (label: string, value: string, onChange: (value: string) => void, mono = false) => (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold" style={{ color: "oklch(0.55 0.01 265)" }}>{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        spellCheck={false}
        rows={3}
        className={`w-full resize-y rounded-md px-2.5 py-2 text-[11px] leading-relaxed outline-none ${mono ? "font-mono" : ""}`}
        style={{ background: "oklch(0.11 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.82 0.01 265)" }}
      />
    </label>
  );

  const apply = () => {
    if (onApplyPrompt) {
      if (!parsed.ko.trim() && !parsed.en.trim()) { toast.error("적용할 내용이 없습니다."); return; }
      onApplyPrompt(parsed);
      toast.success("프롬프트를 적용했습니다.");
      onClose();
      return;
    }
    if (!raw.trim()) { toast.error("적용할 내용이 없습니다."); return; }
    onApplyText?.(raw.trim());
    toast.success(`${applyTextLabel || "결과"}를 넣었습니다.`);
    onClose();
  };

  return (
    <div className={`${MODAL_BACKDROP} z-50`} style={MODAL_BACKDROP_STYLE}>
      <div className={modalCard("medium")} style={MODAL_CARD_STYLE}>
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
          <p className="min-w-0 truncate text-sm font-semibold" style={{ color: "oklch(0.88 0.01 265)" }}>{title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {canApply && (["request", "result"] as const).map((id, index) => (
              <button
                key={id}
                onClick={() => setStep(id)}
                className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: step === id ? "oklch(0.62 0.22 290 / 20%)" : "oklch(1 0 0 / 4%)",
                  color: step === id ? "oklch(0.84 0.19 290)" : "oklch(0.55 0.01 265)",
                }}
              >
                {index === 0 ? "① 요청문" : "② 결과 넣기"}
              </button>
            ))}
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-white/10" style={{ color: "oklch(0.62 0.01 265)" }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {step === "request" ? (
          <>
            <p className="shrink-0 px-4 pt-2 text-[10px]" style={{ color: "oklch(0.50 0.01 265)" }}>
              복사해서 claude.ai 나 ChatGPT 에 붙여넣으세요. 답을 받으면 {canApply ? "② 결과 넣기" : "직접"} 로 옮깁니다.
            </p>
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              spellCheck={false}
              className="composition-scroll min-h-[22rem] flex-1 resize-none px-4 py-3 font-mono text-[11px] leading-relaxed outline-none"
              style={{ background: "transparent", color: "oklch(0.82 0.01 265)" }}
            />
            <div className="flex shrink-0 items-center justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}>
              {/*
                「md 저장」 을 뺐습니다. (지시 127·144)

                사용자가 두 번 「필요 없어」 라고 했습니다. 게다가 동작하지도
                않았습니다 — Blob 링크를 만들어 click() 하는 방식은 타우리
                웹뷰에서 조용히 아무 일도 안 합니다. 요청문은 복사해서
                LLM 창에 붙여넣는 것이고, 문서로 남길 것은 설정의 프롬프트
                문구 쪽에서 폴더로 관리합니다.
              */}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(draft);
                  toast.success("요청문을 복사했습니다.");
                  if (canApply) setStep("result");
                  else onClose();
                }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white gradient-primary"
              >
                <Copy className="h-3.5 w-3.5" /> 복사
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="composition-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold" style={{ color: "oklch(0.55 0.01 265)" }}>
                  받은 답변을 그대로 붙여넣으세요
                </span>
                <textarea
                  value={raw}
                  onChange={event => setRaw(event.target.value)}
                  spellCheck={false}
                  rows={onApplyPrompt ? 6 : 14}
                  placeholder={
                    onApplyPrompt
                      ? tail === "가사"
                        ? `{ "ko": "…", "en": "…", "lyricsKo": "…", "lyricsEn": "…" }`
                        : `{ "ko": "…", "en": "…", "negativeKo": "…", "negativeEn": "…" }`
                      : "받은 답을 그대로 붙여넣으세요"
                  }
                  className="w-full resize-y rounded-md px-2.5 py-2 font-mono text-[11px] leading-relaxed outline-none"
                  style={{ background: "oklch(0.11 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.82 0.01 265)" }}
                />
              </label>

              {onApplyPrompt && (
                <>
                  <button onClick={split} className="w-full rounded-md px-3 py-2 text-[11px] font-semibold" style={{ background: "oklch(0.55 0.15 200 / 18%)", color: "oklch(0.80 0.14 200)" }}>
                    네 칸으로 나누기
                  </button>
                  {field(
                    tail === "가사" ? "곡 스타일 (한글)" : "한글 프롬프트",
                    parsed.ko,
                    value => setParsed(current => ({ ...current, ko: value })),
                  )}
                  {field(
                    tail === "가사" ? "Style (생성기에 넣는 칸)" : "English Prompt",
                    parsed.en,
                    value => setParsed(current => ({ ...current, en: value })),
                    true,
                  )}
                  {tail === "가사" ? (
                    <>
                      {field("가사 (한글)", parsed.lyricsKo ?? "", value => setParsed(current => ({ ...current, lyricsKo: value })))}
                      {field("Lyrics (생성기에 넣는 칸)", parsed.lyricsEn ?? "", value => setParsed(current => ({ ...current, lyricsEn: value })), true)}
                    </>
                  ) : (
                    <>
                      {field("한글 네거티브", parsed.negativeKo, value => setParsed(current => ({ ...current, negativeKo: value })))}
                      {field("English Negative", parsed.negativeEn, value => setParsed(current => ({ ...current, negativeEn: value })), true)}
                    </>
                  )}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3" style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}>
              <p className="text-[10px]" style={{ color: "oklch(0.48 0.01 265)" }}>
                {onApplyPrompt
                  ? "적용하면 이 항목의 네 칸으로 저장되고, 받아 둔 프롬프트에도 한 줄 남습니다."
                  : `적용하면 ${applyTextLabel || "결과"} 칸에 그대로 들어갑니다.`}
              </p>
              <button
                onClick={apply}
                className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white gradient-primary"
              >
                적용
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const EMPTY: PromptQuad = { ko: "", en: "", negativeKo: "", negativeEn: "", lyricsKo: "", lyricsEn: "" };
