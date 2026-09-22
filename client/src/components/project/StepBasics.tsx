import ProjectCoverPanel from "@/components/project/ProjectCoverPanel";
import { useState } from "react";
import { Plus, Sparkles, Wand2 } from "lucide-react";
import AutoTextarea from "@/components/AutoTextarea";
import { EraRangeRow } from "@/components/EraRangeRow";
import ProjectBootstrapDialog from "@/components/project/ProjectBootstrapDialog";
import { fieldStyle } from "@/components/project/fieldStyle";
import { useApiReady } from "@/lib/useApiReady";
import {
  ERA_GROUPS,
  GENRE_OPTIONS,
  hasEraRange,
  STYLE_OPTIONS,
  projectContextOf,
  type EraRange,
} from "@/lib/projectContext";
import { uid, type ProjectDraft } from "@/lib/projectTypes";

/**
 * 1단계 — 작품이 어떤 것인지.
 *
 * 여기서 고른 것이 **이후 모든 프롬프트의 머리말**이 됩니다. 캐릭터를
 * 뽑든 배경을 뽑든 «판타지 · 실사 · 중세» 가 앞에 붙어요. 그래서 여기가
 * 비어 있으면 모델이 매번 자기 마음대로 시대와 화풍을 고릅니다.
 *
 * **장르와 스타일을 따로 두는 이유**가 있습니다. 장르는 «무엇이 나오는가»
 * (판타지·SF·시대극) 이고 스타일은 «어떻게 그려지는가» (실사·애니·유화)
 * 입니다. 이 둘을 한 칸에 뭉뚱그렸더니, 판타지 이야기를 실사로 찍으려는데
 * 게임 배경 같은 그림이 나왔습니다.
 *
 * **공용 에셋은 여기 두지 않습니다.** 이 단계는 «작품이 어떤 것인가» 를 정하는
 * 자리고, 공용 에셋은 소품입니다. 실제로 꺼내 쓰는 곳은 캐릭터·배경 단계라
 * 거기에만 둡니다. 세 단계에 다 놓았더니 첫 화면부터 «지금 뭘 해야 하나» 가
 * 흐려졌습니다.
 */
export default function StepBasics({
  draft,
  onChange,
  projectKey,
}: {
  draft: ProjectDraft;
  /** 일괄 생성 살림의 열쇠(프로젝트 id). 창이 아니라 살림이 진행과 답을 들고 있습니다. */
  projectKey: string;
  /**
   * 초안을 고칩니다. **지금 값을 받아 다음 값을 만드는 함수** 여야 합니다.
   *
   * 값으로 덮어쓰면, LLM 요청이 도는 사이에 카드를 더하거나 지웠을 때
   * 나중에 도착한 갱신이 그 사이 변경을 통째로 지웁니다.
   */
  onChange: (updater: (current: ProjectDraft) => Partial<ProjectDraft>) => void;
}) {
  const summary = projectContextOf(draft);
  /** 연도를 직접 적었으면 위의 시대 단추는 흐려지고 프롬프트에도 안 실립니다. */
  const yearsWin = hasEraRange(draft);

  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const apiReady = useApiReady();
  /**
   * 아직 아무것도 없는 프로젝트인가.
   *
   * 비어 있을 때는 「AI 로 일괄 생성」 이 **가장 먼저 누를 단추**라 크게 보여 줍니다.
   * 채워 넣은 뒤에도 같은 크기로 남아 있으면, 이미 적어 둔 것 위에 다시 부으라고
   * 권하는 꼴이 됩니다. 그때는 줄 하나로 접습니다.
   *
   * **카드만 봅니다.** 제목·로그라인을 함께 보았더니, 바로 아래 «제목» 칸에 첫 글자를
   * 치는 순간 180px 짜리 안내가 40px 줄로 접히며 타이핑 중인 칸이 화면 위로 튀었습니다.
   * 제목은 저장 폴더 때문에 사실상 가장 먼저 적는 칸이라 거의 매번 그랬습니다.
   * 게다가 제목·로그라인은 일괄 생성이 **채워 줄 값**이지 «이미 채웠다» 는 신호가 아닙니다.
   */
  const empty = !draft.characters.length && !draft.backgrounds.length && !draft.scenes.length;

  /**
   * 고른 것을 켜고 끕니다.
   *
   * `genre`·`style` 문자열도 같이 맞춰 둡니다. 목록 화면과 저장 파일이
   * 예전부터 문자열 하나를 읽고 있어서, 배열만 고치면 목록에 옛 값이 남습니다.
   */
  const toggle = (key: "genres" | "styles" | "eras", value: string) => {
    const current = draft[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    if (key === "genres") onChange(() => ({ genres: next, genre: next.join(", ") }));
    else if (key === "styles") onChange(() => ({ styles: next, style: next.join(", ") }));
    else onChange(() => ({ eras: next }));
  };

  // 빈 칸으로 시작합니다. 숫자를 미리 넣어 두면 그게 정답인 줄 알고 그대로 둡니다.
  const addRange = () =>
    onChange((current) => ({
      eraRanges: [...current.eraRanges, { id: uid(), from: "", to: "" }],
    }));

  const patchRange = (next: EraRange) =>
    onChange((current) => ({
      eraRanges: current.eraRanges.map((range) => (range.id === next.id ? next : range)),
    }));

  const removeRange = (id: string) =>
    onChange((current) => ({ eraRanges: current.eraRanges.filter((range) => range.id !== id) }));

  return (
    <div className="space-y-4">
      {/*
        「AI 로 일괄 생성」. 

        새 프로젝트에서 가장 먼저 누를 단추라 맨 위에 둡니다. 비어 있을 때는 안내와
        함께 크게, 이미 뭔가 적어 두었으면 줄 하나로 접습니다.
      */}
      {empty ? (
        <section
          data-tour="basics-bootstrap"
          className="flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center"
          style={{ border: "2px dashed oklch(0.62 0.22 290 / 35%)", background: "oklch(0.62 0.22 290 / 6%)" }}
        >
          <Wand2 className="h-7 w-7" style={{ color: "oklch(0.70 0.18 290)" }} />
          <p className="text-sm font-semibold text-white">시나리오가 이미 있나요?</p>
          <p className="text-[11px] leading-relaxed" style={{ color: "oklch(0.60 0.01 265)" }}>
            줄거리나 설정을 붙여넣으면 작품 정보 · 캐릭터 · 배경 · 장면 초안을 한 번에 만듭니다.
            <br />
            만든 뒤에 검토하면서 고치면 됩니다.
          </p>
          <button
            type="button"
            onClick={() => setBootstrapOpen(true)}
            disabled={!apiReady}
            title={apiReady ? undefined : "설정에서 API 키를 먼저 넣어 주세요"}
            // 창 안의 자리들은 창이 떠야 생깁니다 — 튜토리얼이 이 단추를 가리켜 «먼저 누르세요» 합니다.
            data-tour-open="bootstrap-scenario bootstrap-mode bootstrap-run"
            className="mt-1 flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-white gradient-primary"
            style={{ opacity: apiReady ? 1 : 0.4 }}
          >
            <Wand2 className="h-3.5 w-3.5" /> AI 로 일괄 생성
          </button>
          {!apiReady && (
            <p className="text-[10px]" style={{ color: "oklch(0.72 0.13 60)" }}>
              설정에서 API 키를 먼저 넣어 주세요
            </p>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setBootstrapOpen(true)}
          disabled={!apiReady}
          title={apiReady ? undefined : "설정에서 API 키를 먼저 넣어 주세요"}
          data-tour="basics-bootstrap"
          data-tour-open="bootstrap-scenario bootstrap-mode bootstrap-run"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{
            background: "oklch(0.62 0.22 290 / 14%)",
            border: "1px solid oklch(0.62 0.22 290 / 35%)",
            color: "oklch(0.86 0.16 290)",
            opacity: apiReady ? 1 : 0.4,
          }}
        >
          <Wand2 className="h-3.5 w-3.5" /> AI 로 일괄 생성
        </button>
      )}

      <ProjectBootstrapDialog
        open={bootstrapOpen}
        draft={draft}
        projectKey={projectKey}
        onChange={onChange}
        onClose={() => setBootstrapOpen(false)}
      />

      <Panel title="작품 정보" tour="basics-info">
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
            제목
          </span>
          <input
            value={draft.title}
            onChange={(event) => onChange(() => ({ title: event.target.value }))}
            placeholder="수화의 숲"
            data-tour="basics-title"
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: "oklch(0.18 0.012 265)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "white",
            }}
          />
          <span className="block text-[10px]" style={{ color: "oklch(0.42 0.01 265)" }}>
            저장 폴더 안에 이 이름으로 폴더가 생깁니다. 나중에 제목을 바꿔도
            폴더는 그대로 둡니다 — 폴더가 따라 움직이면 이미지 경로가 전부 끊깁니다.
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
            한 줄 줄거리
          </span>
          <AutoTextarea
            value={draft.logline || ""}
            onChange={(event) => onChange(() => ({ logline: event.target.value }))}
            placeholder="두 개의 달이 뜨는 숲에서 길을 잃은 소녀가…"
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: "oklch(0.18 0.012 265)",
              border: "1px solid oklch(1 0 0 / 10%)",
              color: "white",
            }}
          />
        </label>

        {/* 줄거리는 한 줄 줄거리와 따로 둡니다. 한 칸에 몰면 목록 화면의
            한 줄 자리에 문단이 들어가 카드가 무너집니다. */}
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
            줄거리
          </span>
          <AutoTextarea
            value={draft.synopsis || ""}
            onChange={(event) => onChange(() => ({ synopsis: event.target.value }))}
            placeholder="이야기가 어떻게 시작해서 어떻게 끝나는지"
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={fieldStyle}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
              톤 · 분위기
            </span>
            <input
              value={draft.tone || ""}
              onChange={(event) => onChange(() => ({ tone: event.target.value }))}
              placeholder="차분하고 서늘한"
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
              분량
            </span>
            <input
              value={draft.runtime || ""}
              onChange={(event) => onChange(() => ({ runtime: event.target.value }))}
              placeholder="3분 단편"
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
          </label>
        </div>
      </Panel>

      <Panel
        title="장르"
        tour="basics-genre"
        hint="무엇이 나오는가. 소재입니다"
        count={draft.genres.length}
      >
        <Chips options={GENRE_OPTIONS} selected={draft.genres} onToggle={(id) => toggle("genres", id)} />
      </Panel>

      <Panel
        title="비주얼 스타일"
        tour="basics-style"
        hint="어떻게 그려지는가. 화풍입니다"
        count={draft.styles.length}
      >
        <Chips options={STYLE_OPTIONS} selected={draft.styles} onToggle={(id) => toggle("styles", id)} />
      </Panel>

      <Panel title="시대 배경" tour="basics-era" count={draft.eras.length + draft.eraRanges.length}>
        {/*
          «특정하지 않음» 을 비워 두기로 대신하지 않는 이유.
          비워 두면 모델이 자기 마음대로 현대나 중세를 고릅니다. 켜면
          «어느 시대에도 묶이지 않음» 이라고 프롬프트에 분명히 적습니다.
        */}
        <label
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[11px]"
          style={{ background: "oklch(0.16 0.01 265)", color: "oklch(0.72 0.01 265)" }}
        >
          <input
            type="checkbox"
            checked={draft.eraUnspecified}
            onChange={(event) => onChange(() => ({ eraUnspecified: event.target.checked }))}
          />
          시대를 특정하지 않음
          <span className="text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
            켜면 아래 설정은 프롬프트에 안 나갑니다
          </span>
        </label>

        <div className={draft.eraUnspecified ? "pointer-events-none opacity-40" : ""}>
          {/*
            연도를 직접 적으면 이 단추들은 흐려집니다.

            두 곳에서 시대를 정하면 반드시 어긋납니다 — 「조선 후기」를 눌러
            놓고 「1900년대」를 적으면 프롬프트에 둘 다 나가고, 모델은 그중
            하나를 골라 그립니다. 더 좁게 짚은 쪽(직접 적은 연도)이 이깁니다.

            고른 것을 지우지는 않습니다. 구간을 비우면 그대로 돌아옵니다.
          */}
          <div className={yearsWin ? "pointer-events-none opacity-35" : ""}>
            {ERA_GROUPS.map((group) => (
              <div key={group.label} className="mt-2">
                <p className="mb-1 text-[10px]" style={{ color: "oklch(0.48 0.01 265)" }}>
                  {group.label}
                </p>
                <Chips
                  options={group.items.map((item) => ({ id: item.id, label: item.label, hint: item.hint }))}
                  selected={draft.eras}
                  onToggle={(id) => toggle("eras", id)}
                />
              </div>
            ))}
          </div>

          {yearsWin && (
            <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "oklch(0.72 0.13 60)" }}>
              연도를 직접 적어서 위 시대 단추는 프롬프트에 안 나갑니다.
              단추로 돌아가려면 아래 구간을 비우거나 지우세요.
            </p>
          )}

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
                연도로 직접 잡기
              </p>
              <button
                type="button"
                onClick={addRange}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.72 0.14 200)" }}
              >
                <Plus className="h-3 w-3" /> 구간 추가
              </button>

            </div>
            {draft.eraRanges.map((range) => (
              <EraRangeRow
                key={range.id}
                range={range}
                onChange={patchRange}
                onRemove={() => removeRange(range.id)}
              />
            ))}
          </div>
        </div>
      </Panel>

      {/*
        **작품 대표 그림** — 보드 카드에 뜨는 한 장. 정하지 않으면 작품 안의 그림에서
        저절로 고릅니다().
      */}
      <Panel title="대표 그림" tour="basics-cover">
        <ProjectCoverPanel draft={draft} onChange={onChange} />
      </Panel>

      {/* 고른 것이 프롬프트에 어떻게 들어가는지 그 자리에서 보여 줍니다.
          «판타지» 를 골랐을 때 영어로 뭐라고 나가는지 모르면 결과를 못 고칩니다. */}
      {summary && (
        <Panel title="프롬프트에 이렇게 들어갑니다" tour="basics-preview">
          <p className="text-[11px] leading-relaxed" style={{ color: "oklch(0.78 0.01 265)" }}>
            {summary.ko}
          </p>
          <p
            className="rounded-md px-2.5 py-2 font-mono text-[10px] leading-relaxed"
            style={{ background: "oklch(0.10 0.006 265)", color: "oklch(0.66 0.10 200)" }}
          >
            {summary.en}
          </p>
        </Panel>
      )}

    </div>
  );
}

function Panel({
  title,
  hint,
  count,
  tour,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  /** 튜토리얼 말풍선이 잡을 `data-tour` 이름 — 상자 뿌리에 답니다(`tutorials/ANCHORS.md`). */
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-tour={tour}
      className="space-y-2 rounded-xl p-4"
      style={{ background: "oklch(0.14 0.009 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        {hint && (
          <p className="min-w-0 flex-1 truncate text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
            {hint}
          </p>
        )}
        {count !== undefined && count > 0 && (
          <span className="ml-auto shrink-0 text-[10px]" style={{ color: "oklch(0.55 0.14 290)" }}>
            {count}개 선택
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

type ChipOption = string | { id: string; label: string; hint?: string };

/**
 * 장르·스타일은 문자열 목록이고 연대는 id·label 이 따로 있는 목록입니다.
 * 칩을 두 벌 만드느니 여기서 둘 다 받습니다.
 */
function Chips({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((raw) => {
        const option = typeof raw === "string" ? { id: raw, label: raw, hint: undefined } : raw;
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            title={option.hint}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors"
            style={{
              background: on ? "oklch(0.62 0.22 290 / 20%)" : "oklch(1 0 0 / 5%)",
              border: `1px solid ${on ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 8%)"}`,
              color: on ? "oklch(0.86 0.16 290)" : "oklch(0.60 0.01 265)",
            }}
          >
            {on && <Sparkles className="h-2.5 w-2.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
