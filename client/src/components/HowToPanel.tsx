import { useState, type ReactNode } from "react";
import { BookOpen, ChevronUp } from "lucide-react";

/**
 * «사용 방법» 토글 — 접힌 단추 하나, 펼치면 번호 목록.
 *
 * 사용 방법은 **보면서 따라 하는 글**입니다. 문서(docs/복원/10)를 열어 두고 앱을 오가면
 * 손이 끊기므로 그 자리에서 읽게 합니다. 캐릭터·배경·에셋 어디에나 붙일 수 있는
 * 공용 부품이라 내용은 밖에서 받습니다.
 *
 * 열림 상태는 이 컴퓨터의 localStorage(`frameforge.howto.<id>`)에만 둡니다 — 보기 상태이지
 * 작품 내용이 아니라서, 초안에 넣으면 펼칠 때마다 자동 저장과 Ctrl+Z 기록에 끼어듭니다
 * (`collapsedCards.ts` 와 같은 이유). 기본은 접힘 — 한 번 읽은 뒤에는 자리를 차지하면 안 됩니다.
 *
 * 뿌리는 `display: contents` 입니다. 그룹 머리 같은 `flex-wrap` 줄 안에 두면 단추는 그 줄에
 * «옆으로» 붙고 목록은 `w-full` 이라 다음 줄로 내려옵니다. 그 줄의 **마지막 자식으로** 두세요 —
 * 뒤에 형제가 있으면 펼친 목록이 줄을 통째로 차지해 그 형제가 목록 아래로 떨어집니다(«전체» 단추가
 * 셋째 줄로 밀린 적이 있음). 세로 쌓임(block) 안에서는 단추 아래 목록이 그냥 쌓입니다.
 * flex-wrap 이 아닌 가로 flex 안에는 두지 마세요 — 목록이 옆으로 눌립니다.
 */
export interface HowToPanelProps {
  /** 열림 상태를 기억하는 열쇠. 같은 id 를 쓰는 곳은 함께 열리고 닫힙니다. */
  id: string;
  title: string;
  /** 번호 목록의 한 줄씩. 문자열이면 그대로, 강조가 필요하면 노드로. */
  steps: ReactNode[];
}

const STORAGE_PREFIX = "frameforge.howto.";

function loadOpen(id: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === "1";
  } catch {
    // localStorage 가 없거나 막혀 있음 — 기본(접힘)으로.
    return false;
  }
}

function saveOpen(id: string, open: boolean) {
  try {
    if (open) localStorage.setItem(STORAGE_PREFIX + id, "1");
    else localStorage.removeItem(STORAGE_PREFIX + id);
  } catch {
    // 못 써도 화면은 이미 바뀌었으니 이 세션만 기억합니다.
  }
}

export default function HowToPanel({ id, title, steps }: HowToPanelProps) {
  const [open, setOpen] = useState(() => loadOpen(id));
  const toggle = () => {
    // 저장은 갱신 함수 밖에서 — StrictMode 가 갱신 함수를 두 번 돌려도 기록은 한 번이면 됩니다.
    const next = !open;
    saveOpen(id, next);
    setOpen(next);
  };

  return (
    <div className="contents">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={title}
        className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
        style={{
          background: open ? "oklch(0.62 0.22 290 / 18%)" : "oklch(1 0 0 / 5%)",
          color: open ? "oklch(0.84 0.16 290)" : "oklch(0.52 0.01 265)",
        }}
      >
        {open ? <ChevronUp className="h-2.5 w-2.5" /> : <BookOpen className="h-2.5 w-2.5" />}
        {open ? "접기" : "사용 방법 보기"}
      </button>

      {open && (
        <div
          className="w-full rounded-md px-3 py-2"
          style={{ background: "oklch(0.11 0.009 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <p className="text-[11px] font-semibold text-white">{title}</p>
          <ol className="mt-1 space-y-1 text-[10px] leading-relaxed" style={{ color: "oklch(0.72 0.01 265)" }}>
            {steps.map((step, index) => (
              <li key={index} className="flex gap-1.5">
                <span className="shrink-0 font-bold" style={{ color: "oklch(0.72 0.16 290)" }}>
                  {index + 1}
                </span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * «6면 배경 만드는 법» — docs/복원/10_배경_6면_제작_방법.md §2 를 여섯 단계로.
 *
 * 변형 창의 «2차 · 앵커에서 보기» 그룹 머리 옆과 파노라마 탭 오른쪽 설정 위, 두 곳이
 * 같은 내용을 씁니다. 한 곳에서 고치면 둘이 같이 바뀌게 여기 한 벌만 둡니다.
 */
export const SIX_FACES_HOWTO: HowToPanelProps = {
  id: "six-faces",
  title: "6면 배경 만드는 법",
  steps: [
    <>
      <b>«2차 · 배경 뽑기» 에서 등장방형 칩 하나 고르기</b> — 트인 곳은 «등장방형 · 실외», 방은 «실내 안쪽면», 같은 방의 외벽은
      «실내 바깥쪽면». 방이면 가로·깊이·층고(안쪽·바깥쪽이 같이 씀), 실외면 정육면체 한 변을 넣습니다.
    </>,
    <>
      <b>«프롬프트 작성» 또는 «규칙 조립»</b> — 그 크기의 회색 칸 «전개도 틀» 그림이 레퍼런스에 자동으로 들어갑니다.
    </>,
    <>
      <b>마그니픽 «구성» 으로</b> — 틀 그림이 함께 올라갑니다. 실외(정사각 칸)는 나노 바나나로 되고, 층고가 낮은 방은
      칸을 무시하고 방 사진을 내놓을 수 있어 그때만 GPT 2.5(유료)로(문서 16 §10). 비율은 틀 그림과 같게.
    </>,
    <>
      <b>채택하면 여섯 면이 자동으로</b> — 카드에 들어오는 순간 칸을 원본 해상도에서 맞춰 잘라 «6면/» 에 한 세트로.
      바깥쪽은 «장소_외벽» 세트. 틀어지면 가위 → 전개도 탭에서 확대·방향키로 1 px 씩 맞춥니다.
    </>,
    <>
      <b>구도잡기 환경 탭에서 «6면 세트» 걸기</b> — «…외벽» 세트는 바깥 껍질로, 나머지는 안쪽으로 들어갑니다.
    </>,
  ],
};
