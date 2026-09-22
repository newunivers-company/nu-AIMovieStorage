import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Film, FolderOpen, Music, Settings, Sparkles } from "lucide-react";
import LlmActivityPanel from "@/components/LlmActivityPanel";
import TaskQueuePanel from "@/components/TaskQueuePanel";
import TutorialMenu from "@/components/tutorial/TutorialMenu";
import { useT } from "@/lib/i18n";
import { getActiveProvider, getApiKeyStatus } from "@/lib/llm";

/**
 * 어느 화면에서나 위에 붙는 띠.
 *
 * 사고로 잃어 다시 만든 것입니다. 원본에서 확실한 것은 두 가지였습니다 —
 * 세 페이지가 모두 이걸 맨 위에 놓았다는 것, 그리고 «AI 최적화 준비됨» 표시
 * 왼쪽에 API 요청 기록 버튼이 붙어 있었다는 것.
 *
 * 그 자리에 둔 이유가 있습니다. 처음에는 화면 오른쪽 아래에 있었는데,
 * 거기가 알림이 뜨는 자리라 서로 가렸습니다. 위쪽 띠는 늘 보이면서
 * 아무것도 가리지 않는 유일한 자리입니다.
 *
 * 문구는 전부 `t()` 를 거칩니다 — 한국어 원문이 열쇠라 코드에는 한국어가 그대로 남고,
 * 설정에서 언어를 바꾸면 `useT` 가 다시 그립니다().
 */
export default function GlobalNav() {
  const t = useT();
  const [location, navigate] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      // 지금 고른 제공자의 키만 봅니다. 작업별 설정은 제공자마다 따로
      // 저장되지만, 실제로 부를 때 쓰는 것은 지금 고른 쪽 하나입니다.
      const provider = getActiveProvider();
      const saved = await getApiKeyStatus(provider)
        .then((status) => status.saved)
        .catch(() => false);
      if (alive) setReady(saved);
    };
    void check();
    return () => {
      alive = false;
    };
  }, [location]);

  // 이름은 한국어 원문 그대로 두고 그릴 때 `t()` 로 바꿉니다 — 모듈 상수에 `t()` 를 넣으면 언어를 바꿔도 안 따라옵니다.
  const items = [
    { path: "/", label: "프로젝트", icon: FolderOpen, anchor: undefined },
    { path: "/bgm", label: "BGM 프로젝트", icon: Music, anchor: undefined },
    { path: "/settings", label: "설정", icon: Settings, anchor: "nav-settings" },
  ];

  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-1 px-4 py-2"
      style={{
        background: "oklch(0.13 0.009 265 / 92%)",
        borderBottom: "1px solid oklch(1 0 0 / 8%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <button
        type="button"
        onClick={() => navigate("/")}
        className="mr-2 flex items-center gap-2 text-sm font-semibold text-white"
      >
        <Film className="h-4 w-4" style={{ color: "oklch(0.78 0.18 290)" }} />
        {t("AI 영상 스토리지")}
      </button>

      {items.map((item) => {
        const on = location === item.path;
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            data-tour={item.anchor}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: on ? "oklch(1 0 0 / 10%)" : "transparent",
              color: on ? "oklch(0.84 0.16 290)" : "oklch(0.55 0.01 265)",
            }}
          >
            <item.icon className="h-3.5 w-3.5" />
            {t(item.label)}
          </button>
        );
      })}

      {/* 요청 기록은 «준비됨» 표시 바로 왼쪽입니다. 둘이 한 덩어리로 읽힙니다. */}
      <div className="ml-auto flex items-center gap-2">
        {/*
          «튜토리얼» — 작업·요청 판 왼쪽입니다. 막혔을 때 여는 것이라 «지금 도는 일» 보다 급하지
          않지만, 오른쪽 끝 무리에 함께 있어야 «여기서 찾는다» 가 한눈에 읽힙니다.
          설정에서 튜토리얼을 끄면 이 단추는 스스로 사라집니다.
        */}
        <TutorialMenu />
        {/*
          «작업» 서랍. 요청 기록 왼쪽입니다 — 요청 기록이 «무엇을 불렀나» 라면 이쪽은
          «지금 무엇이 돌고 무엇이 기다리나» 라, 지금 일이 더 급합니다.
        */}
        <TaskQueuePanel />
        <LlmActivityPanel />
        <span
          data-tour="nav-ai-ready"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            background: ready ? "oklch(0.62 0.22 290 / 16%)" : "oklch(1 0 0 / 5%)",
            color: ready ? "oklch(0.84 0.16 290)" : "oklch(0.5 0.01 265)",
          }}
        >
          <Sparkles className="h-3 w-3" />
          {ready ? t("AI 최적화 준비됨") : t("AI 최적화 필요")}
        </span>

        {/*
          아바타. 누르면 설정으로 갑니다.
          이 앱은 로그인이 없어서 사람 이름을 띄울 데가 없습니다. 그래도 자리를
          비워 두면 오른쪽 끝이 허전하고, 설정으로 가는 길이 왼쪽 「설정」 하나뿐이라
          작업 중에 되돌아가기가 번거로웠습니다.
        */}
        <button
          type="button"
          onClick={() => navigate("/settings")}
          aria-label={t("설정 열기")}
          title={t("작업 환경")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: "oklch(0.62 0.22 290 / 22%)", color: "oklch(0.86 0.16 290)" }}
        >
          U
        </button>
      </div>
    </header>
  );
}
