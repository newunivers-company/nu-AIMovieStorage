import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpFromLine, ChevronDown, Loader2 } from "lucide-react";
import {
  UPSCALE_TARGET_OPTIONS,
  availableEngines,
  defaultEngine,
  getUpscaleSettings,
  isStretchedTarget,
  upscaleReachNote,
  useUpscaleEngines,
  type UpscaleEngineId,
  type UpscaleRunOptions,
  type UpscaleTarget,
} from "@/lib/upscale";
import { assetSrc } from "@/lib/mediaLibrary";

/**
 * «업스케일» 단추 + ▾ 메뉴 — 지금은 **6면 세트 카드(FaceSetCard)의 «세트 업스케일» 만** 씁니다.
 * 단추는 기본 엔진·기본 목표로 바로 돌리고, ▾ 는 설치된 엔진과 목표 크기를 고르게 합니다.
 *
 * 낱장 타일(ImageActions)에도 붙어 있었지만 2026-09-09 에 뗐습니다. — 낱장 키우기는 편집 창
 * (`SheetPanelCropper`)의 «업스케일해서 저장»·«지금 그림 업스케일» 한 곳으로 모았습니다.
 * 여섯 장을 한 번에 덮어쓰는 세트는 성격이 달라(편집이 아니라 묶음 작업) 카드에 남겼습니다.
 *
 * 메뉴는 **`document.body` 로 포털**해서 `position: fixed` 로 띄웁니다.
 *
 * `fixed` 만으로는 모자랍니다. `transform` 이 걸린 조상이 있으면 `fixed` 가 화면이 아니라 **그
 * 조상을 기준**으로 자리를 잡는데, 편집 창(Radix Dialog)이 `translate(-50%, -50%)` 를 씁니다.
 * 그래서 `getBoundingClientRect()`(화면 좌표)로 잰 값을 그대로 주면 메뉴가 창 밖 엉뚱한 데
 * 떴습니다 — (단추는 이름 줄에 있는데
 * 메뉴는 화면 위쪽에 뜬 그림). 몸통으로 내보내면 기준이 다시 화면이 됩니다.
 * 썸네일 상자의 `overflow-hidden` 에 잘리지 않는 것은 덤입니다.
 * 설치된 엔진이 하나도 없으면 아무것도 그리지 않습니다(부르는 쪽이 따로 숨길 필요 없음).
 */

export interface UpscaleButtonProps {
  /** 단추의 접근성 이름 — «냥이_001 업스케일» 처럼 대상이 들어가야 합니다. */
  label: string;
  /** 눌렀을 때. 메뉴에서 고르면 `options` 에 엔진·목표가 들어오고, 본 단추는 빈 객체입니다. */
  onRun: (options: UpscaleRunOptions) => void;
  /** 지금 도는 중이면 단추 대신 도는 표시(문구가 있으면 title 로). */
  busy?: boolean | string | null;
  /** 단추가 붙을 자리의 클래스(부모가 relative). 기본은 오른쪽 가운데. `inline` 이면 안 씁니다. */
  className?: string;
  /**
   * 그림 위에 겹치지 않고 **줄 안에 그대로** 섭니다(`position` 없음).
   *
   * 6면 세트 카드가 이걸 씁니다. 겹쳐 두면 3×2 격자의 칸을 가리는데, 세트 카드는 여섯 면을
   * 한눈에 보려고 있는 것이라 어디에 겹쳐도 틀립니다. 카드 밖 이름 줄에 «떠 있는 단추» 로
   * 두는 것도 어색해서() 아예
   * 흐름 안에 넣습니다.
   */
  inline?: boolean;
  /** 마우스를 올리지 않아도 보이게. */
  alwaysVisible?: boolean;
  /**
   * 원본 그림의 파일 경로. 주면 메뉴를 열 때 **진짜 크기**를 재서
   * «이 엔진으로 이 목표가 나오는가» 를 숫자로 말해 줍니다. 없으면 배율로만 안내합니다.
   */
  sourceFilePath?: string | null;
}

export default function UpscaleButton({
  label,
  onRun,
  busy,
  className,
  alwaysVisible,
  inline,
  sourceFilePath,
}: UpscaleButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [target, setTarget] = useState<UpscaleTarget>(
    () => getUpscaleSettings().defaultTarget,
  );
  // 원본 긴 변(px). 메뉴를 열 때만 잽니다 — 타일 수백 개가 미리 재면 그만큼 파일을 읽습니다.
  const [sourceLongEdge, setSourceLongEdge] = useState<number | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 설치 상태를 구독해야 설정 화면에서 엔진을 깔고 돌아왔을 때 단추가 바로 보입니다.
  const { engines } = useUpscaleEngines();
  const installed = availableEngines();
  const fallback = defaultEngine();
  const visibility =
    inline || alwaysVisible || open
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100";
  const position = inline
    ? "relative"
    : `absolute ${className ?? "right-1 top-1/2 -translate-y-1/2"}`;

  // 메뉴가 열려 있는 동안만 원본 크기를 잽니다. 창을 닫는 사이에 도착한 답은 버립니다
  // (닫힌 메뉴에 setState 하면 다음에 열 때 남의 그림 크기가 보입니다).
  useEffect(() => {
    // 그림이 바뀌면 먼저 지웁니다 — 새 크기가 도착할 때까지 «앞 그림의 숫자» 를 보여 주느니
    // 잠깐 배율만 말하는 쪽(«4배까지»)이 맞습니다.
    setSourceLongEdge(null);
  }, [sourceFilePath]);

  useEffect(() => {
    if (!open || !sourceFilePath) return;
    const src = assetSrc(sourceFilePath);
    if (!src) return;
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (alive)
        setSourceLongEdge(
          Math.max(image.naturalWidth, image.naturalHeight) || null,
        );
    };
    image.onerror = () => {
      if (alive) setSourceLongEdge(null);
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [open, sourceFilePath]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (anchorRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // 편집 창의 Escape 까지 같이 먹지 않게 여기서 끊습니다.
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (busy) {
    return (
      <span
        className={`${position} z-10 rounded-full p-1 opacity-100`}
        style={{
          background: "oklch(0 0 0 / 72%)",
          color: "oklch(0.82 0.14 60)",
        }}
        title={
          typeof busy === "string" ? busy : "업스케일 중 — 취소할 수 없습니다"
        }
      >
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (!fallback || !installed.length) return null;

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      // 화면 오른쪽 끝에 닿으면 왼쪽으로 붙입니다(메뉴 폭 190).
      const left = Math.min(rect.left, window.innerWidth - 200);
      /*
        아래로 열되 **화면 밖으로는 안 나갑니다.** 세트 카드가 오른쪽 패널 맨 아래에 있으면
        `rect.bottom + 4` 가 화면 밖이라 메뉴가 안 보입니다. 메뉴 높이는
        고를 수 있는 엔진 수에 따라 다르므로 넉넉히 190 으로 잡고 위로 밀어 올립니다.
      */
      const top = Math.min(rect.bottom + 4, window.innerHeight - 190);
      setAnchor({ top: Math.max(4, top), left: Math.max(4, left) });
    }
    setTarget(getUpscaleSettings().defaultTarget);
    setOpen(true);
  };

  const run = (engine?: UpscaleEngineId) => {
    setOpen(false);
    onRun(engine ? { engine, target } : {});
  };

  const fallbackName =
    engines.find((engine) => engine.id === fallback)?.name ?? fallback;
  const reachNote = upscaleReachNote(fallback, sourceLongEdge);

  return (
    <div
      ref={anchorRef}
      className={`${position} z-10 flex shrink-0 items-center gap-px transition-opacity ${visibility}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          run();
        }}
        aria-label={label}
        title={`${label} — ${fallbackName} · ${getUpscaleSettings().defaultTarget}. 취소할 수 없습니다`}
        className="rounded-l-full p-1"
        style={{ background: "oklch(0 0 0 / 72%)", color: "white" }}
      >
        <ArrowUpFromLine className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu();
        }}
        aria-label={`${label} — 엔진·목표 크기 고르기`}
        title="엔진·목표 크기 고르기"
        className="rounded-r-full py-1 pr-1"
        style={{
          background: "oklch(0 0 0 / 72%)",
          color: "oklch(0.72 0.01 265)",
        }}
      >
        <ChevronDown className="h-3 w-3" />
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(event) => event.stopPropagation()}
            className="fixed w-[190px] space-y-1 rounded-md p-1.5 text-[10px] shadow-xl"
            style={{
              top: anchor.top,
              left: anchor.left,
              // 편집 창(Radix Dialog)보다 위. 몸통에 붙으므로 창의 z-index 와 겨룹니다.
              zIndex: 120,
              background: "oklch(0.16 0.01 265)",
              border: "1px solid oklch(1 0 0 / 12%)",
              color: "oklch(0.82 0.01 265)",
            }}
          >
            <p
              className="px-1 text-[9px] font-semibold"
              style={{ color: "oklch(0.55 0.01 265)" }}
            >
              목표 크기
            </p>
            <div className="grid grid-cols-4 gap-0.5">
              {UPSCALE_TARGET_OPTIONS.map((option) => {
                // 기본 엔진 기준으로 «여기부터는 늘리기» 를 표시합니다. 다른 엔진을 고르면
                // 아래 엔진 줄의 «늘리기» 딱지가 그 엔진 기준으로 다시 말해 줍니다.
                const stretched = isStretchedTarget(
                  fallback,
                  option.id,
                  sourceLongEdge,
                );
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTarget(option.id)}
                    title={
                      stretched
                        ? "이 엔진에서는 여기까지 진짜로 못 키웁니다 — 늘린 그림이 됩니다"
                        : undefined
                    }
                    className="rounded px-1 py-0.5 font-semibold"
                    style={
                      target === option.id
                        ? {
                            background: "oklch(0.62 0.22 290 / 30%)",
                            color: "oklch(0.88 0.14 290)",
                          }
                        : {
                            background: "oklch(1 0 0 / 5%)",
                            color: stretched
                              ? "oklch(0.52 0.01 265)"
                              : "oklch(0.70 0.01 265)",
                          }
                    }
                  >
                    {option.label.split(" ")[0]}
                    {stretched && "*"}
                  </button>
                );
              })}
            </div>
            {reachNote && (
              <p
                className="px-1 pt-0.5 text-[9px] leading-snug"
                style={{ color: "oklch(0.72 0.14 60)" }}
              >
                {reachNote}
              </p>
            )}
            <p
              className="px-1 pt-1 text-[9px] font-semibold"
              style={{ color: "oklch(0.55 0.01 265)" }}
            >
              엔진 — 누르면 바로 돌립니다
            </p>
            {installed.map((engine) => {
              const stretched = isStretchedTarget(
                engine.id,
                target,
                sourceLongEdge,
              );
              return (
                <button
                  key={engine.id}
                  type="button"
                  role="menuitem"
                  onClick={() => run(engine.id)}
                  className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left hover:bg-white/10"
                  style={{
                    color:
                      engine.id === fallback
                        ? "oklch(0.86 0.16 290)"
                        : "oklch(0.82 0.01 265)",
                  }}
                  title={[
                    engine.purpose,
                    upscaleReachNote(engine.id, sourceLongEdge),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <span className="min-w-0 flex-1 truncate">{engine.name}</span>
                  {stretched && (
                    <span
                      className="shrink-0 rounded px-1 text-[8px]"
                      style={{
                        background: "oklch(0.72 0.14 60 / 18%)",
                        color: "oklch(0.82 0.12 60)",
                      }}
                    >
                      늘리기
                    </span>
                  )}
                  {engine.id === fallback && (
                    <span
                      className="shrink-0 text-[8px]"
                      style={{ color: "oklch(0.60 0.01 265)" }}
                    >
                      기본
                    </span>
                  )}
                  {engine.experimental && (
                    <span
                      className="shrink-0 rounded px-1 text-[8px]"
                      style={{
                        background: "oklch(0.70 0.14 60 / 20%)",
                        color: "oklch(0.84 0.12 60)",
                      }}
                    >
                      실험
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
