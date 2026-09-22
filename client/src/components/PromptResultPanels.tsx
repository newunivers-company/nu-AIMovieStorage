import { useState } from "react";
import { Copy, Loader2, Send, Workflow } from "lucide-react";
import AutoTextarea from "@/components/AutoTextarea";
import { sendPromptToMagnific } from "@/lib/mediaLibrary";
import { rememberMagnificSend, type MagnificOwnerHint } from "@/lib/magnificBridge";
import { toast } from "sonner";
import { parseJsonResponse } from "@/lib/llm";

/** 네 칸을 한 번에 채웁니다. */
export interface PromptSet {
  ko: string;
  en: string;
  negativeKo: string;
  negativeEn: string;
}

/**
 * 붙여넣은 것이 LLM 이 통째로 돌려준 JSON 이면 갈라서 돌려줍니다.
 *
 * 요청문은 { "ko": …, "en": …, "negativeKo": …, "negativeEn": … } 하나로 받게 되어 있습니다.
 * 한 덩어리라 사람이 손으로 잘라 네 칸에 나눠 넣어야 했는데, 그 일을 여기서 대신합니다.
 * JSON 이 아니면 건드리지 않습니다. 그냥 프롬프트를 붙여넣은 경우입니다.
 */
function splitPastedJson(text: string): PromptSet | null {
  const trimmed = text.trim();
  if (!trimmed.includes('"ko"') && !trimmed.includes('"en"')) return null;

  try {
    const parsed = parseJsonResponse<{
      ko?: string;
      en?: string;
      negativeKo?: string;
      negativeEn?: string;
      /** 예전 형식. 한 덩어리로 오던 시절 답을 붙여넣어도 받아 줍니다. */
      negative?: string;
    }>(trimmed);

    if (typeof parsed?.ko !== "string" && typeof parsed?.en !== "string") return null;

    return {
      ko: parsed.ko?.trim() || "",
      en: parsed.en?.trim() || "",
      negativeKo: parsed.negativeKo?.trim() || "",
      negativeEn: parsed.negativeEn?.trim() || parsed.negative?.trim() || "",
    };
  } catch {
    return null;
  }
}

type Props = {
  /** 마그니픽 단추를 둘지(기본 켬). 음악처럼 마그니픽에서 안 만드는 것은 끕니다 — 사용자 2026-09-17. */
  magnific?: boolean;
  /** 칸 이름 — 음악은 «곡 스타일»·«가사» 처럼 다르게 부릅니다. */
  koLabel?: string;
  enLabel?: string;
  /** 마그니픽으로 보낼 때 «누구 프롬프트인지» 기억합니다. 돌아온 그림의 주인을 미리 고르려고요. */
  owner?: MagnificOwnerHint;
  /**
   * 주면 «구성» 단추가 생깁니다 — 레퍼런스 올리기 → 텍스트 노드(@칩) → 이미지 생성기까지.
   *
   * 두 번째 인자는 **어느 칸에서 눌렀는지**입니다. 보내는 쪽이 프롬프트 앞에 안내문을
   * 덧붙일 때, 그 안내문도 같은 말로 써야 합니다 — 한글 칸에서 눌렀는데 영어 안내문이
   * 앞에 붙으면 「한글로 눌렀는데 영문이 들어갔다」 가 됩니다.
   */
  onCompose?: (text: string, lang: "ko" | "en") => Promise<void>;
  /**
   * «구성» 단추의 이름과 설명. 영상 칸에서는 「영상으로」 라고 써야 합니다 —
   * 같은 자리에 같은 말이 붙어 있으면 그림을 뽑는 줄 알고 누릅니다.
   */
  composeLabel?: string;
  composeTitle?: string;
  korean: string;
  english: string;
  negativeKorean?: string;
  negativeEnglish?: string;
  compact?: boolean;
  /** 주면 그 칸을 직접 고칠 수 있습니다. LLM 답변을 여기 바로 붙여넣는 경우가 많습니다. */
  onKoreanChange?: (value: string) => void;
  onEnglishChange?: (value: string) => void;
  onNegativeKoreanChange?: (value: string) => void;
  onNegativeEnglishChange?: (value: string) => void;
  /**
   * 한 덩어리 JSON 을 붙여넣었을 때 네 칸을 한 번에 채웁니다.
   *
   * 칸마다 따로 부르면 안 됩니다. 뒤 호출이 앞 호출이 반영되기 전 상태를
   * 덮어써서 먼저 넣은 칸이 비어 버립니다.
   */
  onAllChange?: (next: PromptSet) => void;
  /** 튜토리얼 말풍선이 잡을 `data-tour` 이름 — 두 칸을 싸는 뿌리에 답니다(`tutorials/ANCHORS.md`). */
  tour?: string;
};

function PromptPanel({ label, copyLabel, value, lang, mono, muted, magnific, onChange, onPaste, owner, onCompose, composeLabel, composeTitle }: {
  label: string;
  copyLabel: string;
  value: string;
  /** 이 칸의 말. «구성» 을 누를 때 보내는 쪽에 알려 줍니다. */
  lang: "ko" | "en";
  owner?: MagnificOwnerHint;
  onCompose?: (text: string, lang: "ko" | "en") => Promise<void>;
  composeLabel?: string;
  composeTitle?: string;
  mono?: boolean;
  /** 마그니픽 단추를 둘지. 음악처럼 그쪽에서 안 만드는 것은 끕니다. */
  magnific?: boolean;
  /** 네거티브처럼 보조 역할인 칸. 조금 작고 흐리게 그립니다. */
  muted?: boolean;
  onChange?: (value: string) => void;
  onPaste?: (text: string) => boolean;
}) {
  const copy = () => {
    if (!value.trim()) { toast.error("복사할 내용이 없습니다."); return; }
    void navigator.clipboard.writeText(value).then(() => toast.success(`${copyLabel}을 복사했습니다.`));
  };

  // 마그니픽 데스크톱으로. 클립보드에 넣고 창을 앞으로 가져와 붙여넣습니다.
  // 캔버스를 눌러 두었으면 텍스트 노드로 들어갑니다.
  // 마그니픽이 꺼져 있으면 켜기 확인에 최대 20초가 걸립니다 — 그동안 아무 표시가 없으면 다시 누르게
  // 되므로 «구성» 과 같이 바쁨을 보이고 잠급니다(규칙 1, 2026-09-22 검토). 두 번 눌러도 Rust 쪽
  // 자물쇠(SEND_LOCK)가 한 번에 하나로 묶지만, 사람이 기다리는 줄은 알아야 합니다.
  const [sending, setSending] = useState(false);
  const sendToMagnific = () => {
    if (!value.trim()) { toast.error("보낼 내용이 없습니다."); return; }
    if (owner) rememberMagnificSend(owner, value);
    setSending(true);
    void sendPromptToMagnific(value)
      .then((message) => toast.success(message))
      .catch((error) => toast.error(String(error)))
      .finally(() => setSending(false));
  };

  // 레퍼런스 → 텍스트 노드(@칩) → 이미지 생성기까지 한 번에. 중간에 마그니픽에서 Ctrl+C 한 번이 필요합니다.
  const [composing, setComposing] = useState(false);
  const compose = () => {
    if (!onCompose) return;
    if (!value.trim()) { toast.error("보낼 내용이 없습니다."); return; }
    setComposing(true);
    void onCompose(value, lang)
      .catch((error) => toast.error(String(error)))
      .finally(() => setComposing(false));
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-md" style={{ border: "1px solid oklch(1 0 0 / 8%)" }}>
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "oklch(0.13 0.009 265)", borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: muted ? "oklch(0.55 0.10 25)" : "oklch(0.60 0.01 265)" }}
        >
          {label}
        </span>
        <div className="flex items-center gap-2">
          {onChange && value && (
            <button type="button" onClick={() => onChange("")} className="text-[11px]" style={{ color: "oklch(0.55 0.12 25)" }}>
              지우기
            </button>
          )}
          {onCompose && (
            <button
              type="button"
              onClick={compose}
              data-tour="card-compose"
              disabled={composing}
              title={composeTitle || "레퍼런스 그림을 올리고, 프롬프트(@칩 연결)가 든 이미지 생성기를 이어 붙입니다. 마그니픽 데스크톱을 이 앱에서 켜 두면 사람 손 없이 끝납니다."}
              className="flex items-center gap-1 text-[11px] disabled:opacity-50"
              style={{ color: "oklch(0.78 0.14 150)" }}
            >
              {composing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Workflow className="h-3 w-3" />} {composeLabel || "구성"}
            </button>
          )}
          {/*
            마그니픽은 **그림을 뽑는 곳**입니다. 음악처럼 그쪽에서 만들지 않는 것은 이 단추를 끕니다
            ().
          */}
          {magnific !== false && (
            <button
              type="button"
              onClick={sendToMagnific}
              disabled={sending}
              title="복사하고 마그니픽 창을 앞으로 가져와 텍스트 노드로 붙여넣습니다. @태그는 칩으로 이어집니다."
              className="flex items-center gap-1 text-[11px] disabled:opacity-50"
              style={{ color: "oklch(0.72 0.14 200)" }}
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} 마그니픽
            </button>
          )}
          <button type="button" onClick={copy} className="flex items-center gap-1 text-[11px]" style={{ color: "oklch(0.62 0.01 265)" }}>
            <Copy className="h-3 w-3" /> 복사
          </button>
        </div>
      </div>
      {onChange ? (
        <AutoTextarea
          value={value}
          onChange={event => onChange(event.target.value)}
          onPaste={event => {
            // 통째로 붙여넣은 JSON 이면 여기서 갈라 넣고, 기본 붙여넣기는 막습니다.
            const text = event.clipboardData.getData("text");
            if (onPaste?.(text)) event.preventDefault();
          }}
          spellCheck={false}
          placeholder={`${label}을 붙여넣거나 직접 쓰세요`}
          // 글 길이만큼 늘어나 안쪽 스크롤이 생기지 않습니다. 프롬프트는 한눈에 다 보여야 합니다.
          //
          className={`w-full min-w-0 resize-none overflow-hidden bg-transparent px-3 py-3 text-xs leading-relaxed outline-none ${mono ? "font-mono" : ""} ${muted ? "min-h-[4rem]" : "min-h-[7rem]"}`}
          style={{ color: "oklch(0.80 0.005 265)" }}
        />
      ) : (
        <p
          className={`min-w-0 break-words px-3 py-3 text-xs leading-relaxed whitespace-pre-wrap ${mono ? "font-mono" : ""}`}
          style={{ color: "oklch(0.80 0.005 265)" }}
        >
          {value}
        </p>
      )}
    </div>
  );
}

/*
 * 네 칸에 안쪽 스크롤을 두지 않습니다. (지시 246·248)
 *
 * 「프롬프트랑 분석들 한 눈에 읽을 수 있게 스크롤 생기지 않고 영역이 자동으로
 * 늘어나게 해줘」 — 예전에는 max-h 로 잘라 안에서 스크롤이 돌았습니다. 긴
 * 프롬프트는 늘 잘려 보였고, 어디까지 읽었는지 놓쳤습니다. 내용만큼 늘어납니다.
 */
export default function PromptResultPanels({
  magnific,
  koLabel,
  enLabel,
  owner,
  onCompose,
  composeLabel,
  composeTitle,
  korean,
  english,
  negativeKorean = "",
  negativeEnglish = "",
  compact = false,
  onKoreanChange,
  onEnglishChange,
  onNegativeKoreanChange,
  onNegativeEnglishChange,
  onAllChange,
  tour,
}: Props) {
  // 편집 가능한 경우에는 비어 있어도 칸을 보여줘야 붙여넣을 자리가 생깁니다.
  const editable = Boolean(onKoreanChange || onEnglishChange);

  /** 어느 칸에 붙여넣든 JSON 이면 네 칸을 함께 채웁니다. */
  const handlePaste = (text: string) => {
    const split = splitPastedJson(text);
    if (!split) return false;

    if (onAllChange) {
      onAllChange(split);
    } else {
      // 한 번에 넣을 방법이 없으면 어쩔 수 없이 나눠 부릅니다.
      onKoreanChange?.(split.ko);
      onEnglishChange?.(split.en);
      onNegativeKoreanChange?.(split.negativeKo);
      onNegativeEnglishChange?.(split.negativeEn);
    }

    toast.success("받은 답을 프롬프트·네거티브 칸으로 나눠 넣었습니다.");
    return true;
  };

  /*
    네거티브 칸은 **그 생성기가 받을 때만** 둡니다.

    아닙니다. 음악 쪽은 어디에도 네거티브가 없습니다. Suno 는 *Style·Lyrics* 와 «제외할 스타일»,
    MiniMax-Music3 는 `prompt`·`lyrics`·`seconds`, ACE-Step v1 은 태그·가사·steps·guidance 뿐입니다.
    그래서 고칠 손잡이(`onNegative…Change`)를 안 준 자리에서는 칸 자체를 세우지 않습니다 —
    빈 칸이 남아 있으면 «여기에도 뭘 적어야 하나» 가 됩니다.
  */
  const negativeUsed = Boolean(onNegativeKoreanChange || onNegativeEnglishChange);
  const showNegative =
    (negativeUsed && editable) || Boolean(negativeKorean) || Boolean(negativeEnglish);
  const grid = `grid min-w-0 grid-cols-1 gap-3 ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"}`;

  if (!korean && !english && !editable) return null;

  return (
    <div className="min-w-0 space-y-3" data-tour={tour}>
      <div className={grid}>
        <PromptPanel magnific={magnific} owner={owner} onCompose={onCompose} composeLabel={composeLabel} composeTitle={composeTitle} lang="ko" label={koLabel ?? "한글 프롬프트"} copyLabel={koLabel ?? "한글 프롬프트"} value={korean} onChange={onKoreanChange} onPaste={handlePaste} />
        <PromptPanel magnific={magnific} owner={owner} onCompose={onCompose} composeLabel={composeLabel} composeTitle={composeTitle} lang="en" label={enLabel ?? "English Prompt"} copyLabel={enLabel ?? "영문 프롬프트"} value={english} mono onChange={onEnglishChange} onPaste={handlePaste} />
      </div>

      {/* 네거티브는 생성 도구의 별도 칸에 넣는 값입니다.
          본문과 나란히 두되 조금 낮춰서, 실수로 본문에 섞이지 않게 구분합니다. */}
      {showNegative && (
        <div className={grid}>
          <PromptPanel
          owner={owner}
            lang="ko"
            label="한글 네거티브"
            copyLabel="한글 네거티브"
            value={negativeKorean}
            muted
            onChange={onNegativeKoreanChange}
            onPaste={handlePaste}
          />
          <PromptPanel
          owner={owner}
            lang="en"
            label="English Negative"
            copyLabel="영문 네거티브"
            value={negativeEnglish}
            mono
            muted
            onChange={onNegativeEnglishChange}
            onPaste={handlePaste}
          />
        </div>
      )}
    </div>
  );
}
