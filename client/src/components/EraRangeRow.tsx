import { Trash2 } from "lucide-react";
import {
  eraPointNeedsHelp,
  eraPointText,
  formatRange,
  type EraRange,
} from "@/lib/projectContext";

/**
 * 연대 구간 한 줄.
 *
 * # 슬라이더를 걷어낸 이유
 *
 * 예전에는 1000~2200 사이를 손잡이 두 개로 잡았습니다. 그런데 이 앱이
 * 다루는 시대는 그 안에 다 안 들어갑니다 — 고조선도 쓰고 3000년 뒤 우주도
 * 씁니다. 최솟값·최댓값을 정해 둘 이유가 없었어요.
 *
 * 게다가 슬라이더로는 **딱 짚을 수가 없습니다.** 손잡이 하나가 수십 년을
 * 건너뛰어서 「1392년」을 맞추려면 한참 실랑이해야 했습니다.
 *
 * 그래서 글로 받습니다. 「1392년」처럼 그 해를 짚어도 되고, 「1900년대」처럼
 * 뭉뚱그려도 됩니다. 적은 그대로 프롬프트에 실립니다.
 */
export function EraRangeRow({
  range,
  onChange,
  onRemove,
}: {
  range: EraRange;
  onChange: (next: EraRange) => void;
  onRemove: () => void;
}) {
  const preview = formatRange(range);
  const stuck = [range.from, range.to].filter(eraPointNeedsHelp).map(eraPointText);

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "oklch(0.16 0.01 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: "oklch(0.84 0.16 290)" }}>
          {preview || "아직 안 적었습니다"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          title="이 구간 지우기"
          aria-label="이 구간 지우기"
          className="ml-auto rounded p-1 hover:bg-white/10"
        >
          <Trash2 className="h-3 w-3" style={{ color: "oklch(0.60 0.14 25)" }} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          value={eraPointText(range.from)}
          onChange={event => onChange({ ...range, from: event.target.value })}
          placeholder="1900년대"
          aria-label="시작"
          className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
          style={FIELD}
        />
        <span className="shrink-0 text-[11px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          ~
        </span>
        <input
          value={eraPointText(range.to)}
          onChange={event => onChange({ ...range, to: event.target.value })}
          placeholder="2000년대"
          aria-label="끝"
          className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
          style={FIELD}
        />
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: "oklch(0.42 0.01 265)" }}>
        「1392년」 「1900년대」 「19세기」 「기원전 300년」 「1900년대 후반」 다 됩니다.
        한쪽만 적으면 그 하나로 나갑니다.
      </p>

      {/*
        영어로 못 옮기는 말을 적었을 때 귀띔합니다.
        말없이 빼면 영문 프롬프트에서만 시대가 사라진 것을 눈치채기 어렵고,
        그렇다고 한글을 그대로 실으면 모델이 그 부분을 엉뚱하게 읽습니다.
      */}
      {stuck.length > 0 && (
        <p
          className="mt-1.5 rounded-md px-2 py-1.5 text-[10px] leading-relaxed"
          style={{
            background: "oklch(0.70 0.14 60 / 12%)",
            border: "1px solid oklch(0.70 0.14 60 / 30%)",
            color: "oklch(0.84 0.12 60)",
          }}
        >
          「{stuck.join("」 「")}」 는 영문 프롬프트에 못 싣습니다. 숫자로 적거나
          위의 연대 단추에서 고르세요.
        </p>
      )}
    </div>
  );
}

const FIELD = {
  background: "oklch(0.11 0.008 265)",
  border: "1px solid oklch(1 0 0 / 10%)",
  color: "white",
} as const;
