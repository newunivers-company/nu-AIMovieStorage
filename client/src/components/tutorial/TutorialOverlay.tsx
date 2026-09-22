import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { BookOpen, ChevronDown, ChevronUp, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { isTypingTarget } from "@/lib/isTypingTarget";
import { listLocalProjects } from "@/lib/localProjectStore";
import {
  PROJECT_STEP_PAGES,
  autoStartTutorial,
  closeTutorial,
  nextStep,
  prevStep,
  requestTutorialPage,
  routeMatches,
  useTutorial,
} from "@/lib/tutorialStore";
import {
  stepAdvanceMode,
  tutorialById,
  type Tutorial,
  type TutorialRoute,
  type TutorialStep,
} from "@/tutorials";

/**
 * **안내 창** — 지금 걸음의 자리를 화면에서 찾아 그 둘레만 밝히고, 옆에 카드를 붙입니다.
 *
 * 앱 뿌리(`App`)에 하나만 둡니다. 걸음이 다른 화면에 있으면 먼저 그 주소로 가고, 프로젝트 껍데기의
 * 단계(주제 설정·캐릭터·씬 구성·확인)면 껍데기에 그 단계를 열어 달라고 부탁합니다.
 *
 * # 어둡게 덮되 막지 않습니다
 *
 * 걸음마다 「해 볼 것: «설정» 을 누르세요」 처럼 **직접 눌러 보라** 고 시킵니다. 덮개가 클릭을 삼키면
 * 시키는 대로 할 수가 없습니다. 그래서 어두운 층은 `pointer-events: none` 이고, 밝은 구멍은 자리
 * 요소 위에 얹은 상자의 그림자(`box-shadow` 9999px)로 만듭니다 — 판 네 장으로 두르는 것보다 요소가
 * 움직일 때 따라가기가 쉽습니다.
 *
 * # 자리를 못 찾으면
 *
 * 구도잡기 창이 안 열려 있거나 목록이 비어 있으면 `data-tour` 요소가 없습니다. 그때는 가운데 카드로
 * 물러나 «그 화면을 열면 표시됩니다» 라고 적고 «다음» 은 그대로 둡니다 — 여기서 막히면 튜토리얼을
 * 끝까지 못 갑니다. 요소는 계속 다시 찾습니다(DOM 바뀜 · 크기 바뀜 · 스크롤 · 0.4초마다) —
 * 사람이 안내대로 창을 열면 그 순간 카드가 그리로 옮겨 갑니다.
 */
export default function TutorialOverlay() {
  const { enabled, active } = useTutorial();

  // 앱을 켠 뒤 한 번 — 한 바퀴를 본 적이 없으면 저절로 시작합니다.
  useEffect(() => {
    autoStartTutorial();
  }, []);

  const tutorial = active ? tutorialById(active.tutorialId) : undefined;
  const step = tutorial && active ? tutorial.steps[active.stepIndex] : undefined;
  if (!enabled || !tutorial || !step || !active) return null;

  // 걸음이 바뀌면 카드 상태(«왜?» 펼침 · 스크롤 여부)를 새로 — 그래서 key 입니다.
  return <ActiveStep key={step.id} tutorial={tutorial} step={step} index={active.stepIndex} />;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * 걸음의 주소로 갈 실제 주소.
 *
 * `/project/:id` 는 어느 프로젝트인지 없습니다. 프로젝트 화면 밖에서 그 걸음에 이르면 **가장 최근에
 * 고친 프로젝트**를 엽니다 — 페이지 튜토리얼(캐릭터·씬)은 카드가 실제로 있어야 자리를 찾습니다.
 * 하나도 없으면 «새 프로젝트» 로 갑니다(제목을 적기 전에는 아무것도 저장하지 않으니 해가 없습니다).
 */
function targetFor(route: TutorialRoute): string {
  if (route !== "/project/:id") return route;
  const latest = listLocalProjects()[0];
  return latest ? `/project/${latest.id}` : "/new-project";
}

function ActiveStep({ tutorial, step, index }: { tutorial: Tutorial; step: TutorialStep; index: number }) {
  const t = useT();
  const [location, navigate] = useLocation();
  const [rect, setRect] = useState<Box | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState({ w: 384, h: 240 });
  /** 자리를 처음 찾았을 때 한 번만 화면 안으로 끌어옵니다. 매번 끌면 사람이 스크롤을 못 합니다. */
  const scrolled = useRef(false);

  // ── 1. 다른 화면의 걸음이면 그 주소로 — 걸음이 켜질 때 **한 번만** ─────────
  // 주소가 바뀔 때마다 다시 보내면 안 됩니다. 「해 볼 것: «설정» 을 누르세요」 걸음은 프로젝트 보드에
  // 서 있는데, 사람이 시키는 대로 «설정» 을 누르는 순간 도로 보드로 끌려와 시키는 것을 할 수 없습니다.
  useEffect(() => {
    if (!step.route || routeMatches(step.route, location)) return;
    navigate(targetFor(step.route));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. 프로젝트 껍데기의 단계면 그 단계를 열어 달라고 ─────────────────────
  // 주소가 바뀐 뒤에도 다시 부탁합니다 — 껍데기가 새로 그려지면 앞의 부탁은 아무도 못 들었습니다.
  useEffect(() => {
    if (!step.page || !PROJECT_STEP_PAGES.includes(step.page)) return;
    if (!routeMatches("/project/:id", location)) return;
    requestTutorialPage(step.page);
  }, [step.page, location]);

  /*
    ── 시킨 것을 **실제로 해야** 넘어갑니다 ──────────────────────────────────
    「이건 그냥 설명이잖아」.

    밝혀 둔 자리를 진짜로 누르거나(누르기 걸음), 그 칸에 글자가 들어가면(적기 걸음) 저절로 다음으로
    갑니다. 듣는 자리는 **문서 전체**이고 그 안에 앵커가 들어 있는지만 봅니다 — 단추가 다시 그려지거나
    안쪽 아이콘을 눌러도 놓치지 않으려는 것입니다. 잡는 단계(capture)에서 듣되 **막지는 않습니다**:
    눌린 것은 그대로 제 일을 해야 튜토리얼이 «따라하기» 가 됩니다.

    막히면 못 빠져나오는 일이 없게 «건너뛰고 다음» 은 늘 함께 둡니다.
  */
  const advance = stepAdvanceMode(step);
  useEffect(() => {
    if (!step.anchor || advance === "manual") return;
    const selector = `[data-tour="${step.anchor}"]`;
    const inAnchor = (target: EventTarget | null) =>
      target instanceof Node && Boolean((target as Element).closest?.(selector) ?? null);
    const onClick = (event: MouseEvent) => {
      if (advance !== "click" || !inAnchor(event.target)) return;
      // 누른 것이 제 일을 마친 뒤에 넘깁니다 — 화면이 바뀌는 중에 걸음을 바꾸면 다음 자리를 못 찾습니다.
      window.setTimeout(() => nextStep(), 220);
    };
    const onInput = (event: Event) => {
      if (advance !== "input" || !inAnchor(event.target)) return;
      const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value ?? "";
      if (value.trim().length >= 2) window.setTimeout(() => nextStep(), 400);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
    };
  }, [step.anchor, advance, nextStep]);

  // ── 3. 자리 찾기 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!step.anchor) {
      setRect(null);
      return;
    }
    const selector = `[data-tour="${step.anchor}"]`;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      // 있어도 숨겨져 있으면(접힌 판) 크기가 0 — 없는 것과 같습니다.
      if (!element || !box || (box.width === 0 && box.height === 0)) {
        setRect((current) => (current ? null : current));
        return;
      }
      if (!scrolled.current) {
        scrolled.current = true;
        element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
      const next = { top: box.top, left: box.left, width: box.width, height: box.height };
      // 같은 자리면 같은 객체를 돌려줘 다시 그리지 않습니다 — 0.4초마다 재는데 매번 그리면 헛돕니다.
      setRect((current) => (current && sameBox(current, next) ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    // 펼침 애니메이션처럼 DOM 은 그대로인데 자리만 옮겨 가는 것을 받치는 그물입니다.
    const timer = window.setInterval(schedule, 400);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.clearInterval(timer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [step.anchor]);

  // ── 4. 카드 크기 — 어느 쪽에 붙일지 정하려면 알아야 합니다 ─────────────────
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const update = () => {
      const box = element.getBoundingClientRect();
      setCard((current) =>
        Math.abs(current.w - box.width) < 1 && Math.abs(current.h - box.height) < 1
          ? current
          : { w: box.width, h: box.height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ── 5. 키 — → / Enter 다음, ← 이전, Esc 닫기. 입력란 안에서는 물러납니다 ──
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const target = event.target instanceof Element ? event.target : null;
      // 단추에 초점이 있을 때의 Enter 는 그 단추의 것입니다 — 가로채면 두 번 넘어가거나 단추가 안 눌립니다.
      const onControl = Boolean(target?.closest("button, a, [role='button'], [role='menuitem'], summary"));
      if (event.key === "Escape") {
        // 잡기(capture)에서 멈춥니다 — 구도잡기 창도 Esc 로 닫히는데, 안내를 닫으려다 창까지 닫히면 자리를 잃습니다.
        event.preventDefault();
        event.stopPropagation();
        closeTutorial();
      } else if (event.key === "ArrowRight" || (event.key === "Enter" && !onControl)) {
        event.preventDefault();
        event.stopPropagation();
        nextStep();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        prevStep();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (typeof document === "undefined") return null;

  // ── 카드 자리 — 아래 → 위 → 옆 순으로, 자리 요소를 가리지 않게 ─────────────
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const GAP = 12;
  const MARGIN = 12;
  let top: number;
  let left: number;
  if (rect) {
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - card.h;
    left = clamp(rect.left, MARGIN, Math.max(MARGIN, viewportWidth - card.w - MARGIN));
    if (below + card.h <= viewportHeight - MARGIN) {
      top = below;
    } else if (above >= MARGIN) {
      top = above;
    } else {
      // 위아래 다 안 들어가는 큰 요소(카드 그리드·3D 화면) — 옆에 붙이고, 그것도 안 되면 겹칩니다.
      top = clamp(rect.top, MARGIN, Math.max(MARGIN, viewportHeight - card.h - MARGIN));
      const right = rect.left + rect.width + GAP;
      const leftSide = rect.left - GAP - card.w;
      if (right + card.w <= viewportWidth - MARGIN) left = right;
      else if (leftSide >= MARGIN) left = leftSide;
    }
  } else {
    top = Math.max(MARGIN, (viewportHeight - card.h) / 2);
    left = Math.max(MARGIN, (viewportWidth - card.w) / 2);
  }

  const total = tutorial.steps.length;
  const last = index >= total - 1;
  const missing = Boolean(step.anchor) && !rect;
  // 자리가 화면에 보일 때만 «누르면 갑니다» 라고 합니다 — 없는 자리를 누르라고 하면 갇힙니다.
  const waiting = advance !== "manual" && !missing;

  return createPortal(
    <>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[1000] rounded-xl"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px oklch(0 0 0 / 55%), 0 0 0 2px oklch(0.78 0.18 290)",
            transition: "top 0.2s, left 0.2s, width 0.2s, height 0.2s",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1000]"
          style={{ background: "oklch(0 0 0 / 30%)" }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-label={t(tutorial.title)}
        className="fixed z-[1001] w-[min(24rem,calc(100vw-1.5rem))] space-y-2.5 rounded-xl p-4 shadow-2xl"
        style={{
          top,
          left,
          background: "oklch(0.15 0.01 265)",
          border: "1px solid oklch(0.62 0.22 290 / 45%)",
          transition: "top 0.2s, left 0.2s",
        }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(0.78 0.18 290)" }} />
          <span className="min-w-0 flex-1 truncate text-[10px] font-bold tracking-wider" style={{ color: "oklch(0.62 0.15 290)" }}>
            {t(tutorial.title)}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "oklch(0.55 0.01 265)" }}>
            {t("단계 {n}/{total}", { n: index + 1, total })}
          </span>
          <button
            type="button"
            onClick={closeTutorial}
            aria-label={t("튜토리얼 닫기")}
            className="shrink-0 rounded-md p-1 hover:bg-white/10"
            style={{ color: "oklch(0.62 0.01 265)" }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-sm font-semibold text-white">{t(step.title)}</p>
        <p className="text-xs leading-relaxed" style={{ color: "oklch(0.74 0.01 265)" }}>
          {t(step.body)}
        </p>

        {step.action && (
          <p
            className="rounded-lg px-3 py-2 text-xs leading-relaxed"
            style={{
              background: "oklch(0.62 0.22 290 / 12%)",
              border: "1px solid oklch(0.62 0.22 290 / 30%)",
              color: "oklch(0.88 0.08 290)",
            }}
          >
            {t(step.action)}
          </p>
        )}

        {step.why && (
          <div>
            <button
              type="button"
              onClick={() => setShowWhy((value) => !value)}
              aria-expanded={showWhy}
              className="flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: "oklch(0.70 0.14 200)" }}
            >
              {showWhy ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {t("왜?")}
            </button>
            {showWhy && (
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "oklch(0.58 0.01 265)" }}>
                {t(step.why)}
              </p>
            )}
          </div>
        )}

        {missing && (
          <p className="text-[11px] leading-relaxed" style={{ color: "oklch(0.78 0.14 60)" }}>
            {t("이 단계의 자리가 지금 화면에 없습니다 — 안내대로 그 화면을 열면 표시됩니다")}
          </p>
        )}

        {/* 무엇을 해야 넘어가는지 한 줄로 — 이것이 «읽는 안내문» 과 «따라하기» 를 가릅니다. */}
        {waiting && (
          <p
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold"
            style={{ background: "oklch(0.62 0.22 290 / 14%)", color: "oklch(0.84 0.16 290)" }}
          >
            <span className="tutorial-pulse h-2 w-2 shrink-0 rounded-full" style={{ background: "oklch(0.78 0.18 290)" }} />
            {advance === "input" ? t("여기에 적으면 다음으로 갑니다") : t("여기를 누르면 다음으로 갑니다")}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={closeTutorial}
            className="rounded-md px-2.5 py-1.5 text-[11px]"
            style={{ color: "oklch(0.55 0.01 265)" }}
          >
            {t("건너뛰기")}
          </button>
          <button
            type="button"
            onClick={prevStep}
            disabled={index === 0}
            className="ml-auto rounded-md px-3 py-1.5 text-[11px] font-semibold disabled:opacity-35"
            style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.72 0.01 265)" }}
          >
            {t("이전")}
          </button>
          <button
            type="button"
            onClick={nextStep}
            className={
              waiting
                ? "rounded-md px-3 py-1.5 text-[11px] font-semibold"
                : "rounded-md px-3.5 py-1.5 text-[11px] font-semibold text-white gradient-primary"
            }
            style={waiting ? { background: "oklch(1 0 0 / 6%)", color: "oklch(0.60 0.01 265)" } : undefined}
          >
            {last ? t("끝") : waiting ? t("건너뛰고 다음") : t("다음")}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
