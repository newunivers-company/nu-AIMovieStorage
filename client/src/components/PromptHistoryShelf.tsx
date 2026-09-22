import { useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import type { SavedPromptEntry } from "@/lib/promptHistory";

/**
 * 받아 둔 것들의 선반 — 프롬프트도, 분석도 이 하나로 보여 줍니다.
 *
 * # 왜 쌓아 두는가
 *
 * 프롬프트를 두 번 돌렸다는 것은 무언가를 바꿔서 돌렸다는 뜻입니다. 새것이
 * 앞의 것을 덮어쓰면 되돌릴 방법이 없어요. 그래서 **API 로 받은 것마다**
 * 순서대로 쌓고, 어느 판이든 되돌릴 수 있게 합니다.
 *
 * # 왜 하나로 만들었는가
 *
 * 분석도 같은 일을 겪었습니다 — 재분석·붙여넣기가 앞의 분석을 덮어써
 * 사라졌습니다. 선반을 하나 더 복사해 두면 «접기» 나 «이름 칸» 규칙을 고칠
 * 때 한쪽을 빠뜨립니다(규칙 1). 그래서 제목·빈 문구·미리보기만 밖에서 받고
 * 나머지는 같이 씁니다. 안 주면 예전 그대로 «받아 둔 프롬프트» 입니다.
 *
 * # 행 하나의 구조
 *
 * 시각 [이 판의 이름 ______] [↺ 되돌리기] [🗑]
 * 실외 · 칸 4개 · 분석 없음 · nbpro · magnific ← 무슨 조건으로 뽑았는지
 * 본문 미리보기 두 줄…
 *
 * 조건 줄이 핵심입니다. 같은 글이 쌓여 보여도 조건이 다르면 다른
 * 판이에요. 이름은 비워 둬도 되고, 적어 두면 나중에 찾기 쉽습니다.
 *
 * # 되돌리기는 칸만 바꿉니다
 *
 * 되돌리기는 목록에 쌓지 않습니다. 되돌릴 때마다 한 줄씩 늘면 같은 것이
 * 두 번 세 번 쌓여 무엇이 달랐는지 찾기 어려워집니다. 되돌리기 직전의
 * 것은 API 로 받았을 때 이미 목록에 들어 있으니 잃지 않습니다.
 */
export default function PromptHistoryShelf<
  E extends { id: string; createdAt: number; note?: string; label?: string } = SavedPromptEntry,
>({
  history,
  onRestore,
  onRename,
  onRemove,
  title = "받아 둔 프롬프트",
  emptyText = "받아 둔 프롬프트가 아직 없습니다. API 로 받을 때마다 여기 쌓이고, 어느 판이든 되돌릴 수 있습니다.",
  preview,
  tour,
}: {
  history: E[];
  onRestore: (entry: E) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  /** 선반 제목. 분석 선반은 «받아 둔 분석». */
  title?: string;
  /** 비어 있을 때 보여 줄 한 줄. 비어 있어도 자리를 보여 주는 이유는 아래 주석에. */
  emptyText?: string;
  /** 행 아래 미리보기 두 줄에 무엇을 보일지. 안 주면 프롬프트의 한국어(없으면 영어). */
  preview?: (entry: E) => string;
  /** 튜토리얼 말풍선이 잡을 `data-tour` 이름(`tutorials/ANCHORS.md`). 비어 있는 선반에도 답니다. */
  tour?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const previewOf = (entry: E) =>
    preview ? preview(entry) : previewPrompt(entry as Partial<SavedPromptEntry>);

  /*
    비어 있어도 자리를 보여 줍니다.

    예전에는 통째로 감췄습니다. 그러니 «받아 둔 프롬프트가 쌓인다» 는 것을
    알 방법이 없어서, 프롬프트를 다시 뽑기 전에 아까 것을 손으로 복사해
    두는 일이 생겼습니다. 한 줄이라도 있으면 「여기 쌓인다」 가 보입니다.
  */
  if (!history.length) {
    return (
      <section
        data-tour={tour}
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
      >
        <History className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(0.40 0.01 265)" }} />
        <p className="text-[11px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          {emptyText}
        </p>
      </section>
    );
  }


  return (
    <section
      data-tour={tour}
      className="rounded-lg p-3"
      style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
    >
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(0.62 0.01 265)" }} />
        <p className="shrink-0 text-xs font-semibold text-white">
          {title} ({history.length})
        </p>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 text-[10px]"
          style={{ color: "oklch(0.55 0.01 265)" }}
        >
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="mt-2 space-y-2">
            {history.map((entry) => (
              <article
                key={entry.id}
                className="rounded-md p-2.5"
                style={{ background: "oklch(0.145 0.01 265)", border: "1px solid oklch(1 0 0 / 7%)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {/* 「가장 최근 / N번째 전」 배지는 뺐습니다.  (지시 341) */}
                  <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "oklch(0.50 0.01 265)" }}>
                    {new Date(entry.createdAt).toLocaleString("ko-KR", { hour12: false })}
                  </span>
                  <input
                    // 이름 칸에 **어떤 조건으로 받았는지**를 미리 채웁니다. 손으로 고칠 수 있습니다.
                    // 「이 판의 이름에 어떤 조건으로 받은 프롬프트인지 기록을 해줘(수정도 할 수 있게)」 (지시 341)
                    value={entry.label ?? entry.note ?? ""}
                    onChange={(event) => onRename(entry.id, event.target.value)}
                    placeholder="이 판의 이름"
                    className="min-w-[120px] flex-1 rounded px-2 py-1 text-[10px] outline-none"
                    style={{
                      background: "oklch(0.18 0.012 265)",
                      border: "1px solid oklch(1 0 0 / 9%)",
                      color: "white",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onRestore(entry)}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                    style={{
                      background: "oklch(0.55 0.15 200 / 16%)",
                      border: "1px solid oklch(0.55 0.15 200 / 38%)",
                      color: "oklch(0.78 0.14 200)",
                    }}
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> 되돌리기
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    aria-label="이 기록 지우기"
                    className="shrink-0 rounded p-1 hover:bg-white/10"
                    style={{ color: "oklch(0.58 0.14 25)" }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* 무슨 조건으로 뽑았는지. 이게 없으면 같은 글이 왜 두 개인지 알 수 없습니다. */}
                {entry.note && (
                  <p className="mt-1 truncate text-[9px]" style={{ color: "oklch(0.55 0.10 290)" }}>
                    {entry.note}
                  </p>
                )}
                <p
                  className="mt-1 text-[10px] leading-relaxed"
                  style={{
                    color: "oklch(0.58 0.01 265)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {previewOf(entry)}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** 프롬프트 판의 미리보기 — 예전부터 한국어, 없으면 영어였습니다. `preview` 를 안 준 곳이 그대로 이걸 씁니다. */
function previewPrompt(entry: Partial<SavedPromptEntry>) {
  return entry.ko || entry.en || "";
}
