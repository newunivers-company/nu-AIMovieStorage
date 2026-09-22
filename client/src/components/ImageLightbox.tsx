import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { assetSrc } from "@/lib/mediaLibrary";

export interface LightboxImage {
  name?: string;
  label?: string;
  thumb?: string;
  filePath?: string;
}

/**
 * 그림 한 장을 화면 가득 띄웁니다.
 *
 * 썸네일은 80px 남짓이라 "이 그림이 맞나" 를 확인할 수 없습니다. 폴더를 열어
 * 눈으로 보고 오는 수밖에 없었는데, 확인 한 번에 앱 밖으로 나갔다 오는 일이
 * 반복됩니다.
 *
 * 다른 창(Radix Dialog) 위에 떠야 해서 #root 에 직접 붙입니다. body 로 보내면
 * React 이벤트가 닿지 않고, 열려 있는 창이 body 의 pointer-events 를 꺼 둡니다.
 * 아래 창이 "밖을 눌렀다" 고 판단해 같이 닫히지 않도록 pointerdown 도 막습니다.
 *
 * `images` 를 주면 여러 장을 ←/→ 로 넘겨 봅니다 — 6면 세트는 여섯 면을 하나씩 열지 않고
 * 세트 카드 한 번 클릭으로 정면부터 차례로 봅니다. `image` 하나만 주면 예전처럼 한 장.
 */
export default function ImageLightbox({
  image,
  images,
  index = 0,
  onClose,
}: {
  image?: LightboxImage | null;
  /** 넘겨 볼 목록. 주면 `image` 대신 이걸 씁니다. */
  images?: LightboxImage[];
  /** `images` 에서 처음 보여 줄 자리 */
  index?: number;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const list = images && images.length ? images : image ? [image] : [];
  const [current, setCurrent] = useState(index);
  // 다른 세트를 열면 자리를 다시 잡습니다 — 앞 세트의 4번째 면에서 시작하면 어리둥절합니다.
  useEffect(() => setCurrent(index), [index, images]);
  const at = Math.min(Math.max(current, 0), Math.max(list.length - 1, 0));
  const shown = list[at] ?? null;
  const many = list.length > 1;
  const prev = () => setCurrent((value) => (value - 1 + list.length) % list.length);
  const next = () => setCurrent((value) => (value + 1) % list.length);

  /*
    지금 보는 그림의 실제 픽셀 크기.

     업스케일을 쓰기 시작하면서 «이건 4K 인가 원본인가» 를 눈으로는 못 가립니다.
    `naturalWidth` 는 다 읽은 뒤에야 값이 차므로 onLoad 에서 받습니다(캐시된 그림은 즉시 옵니다).
    그림을 넘길 때마다 비워야 앞 장의 크기가 잠깐 남아 잘못 읽히지 않습니다.
  */
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => setSize(null), [at, images, image]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (!many) return;
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, many, onClose, list.length]);

  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const stop = (event: Event) => event.stopPropagation();
    for (const type of ["pointerdown", "touchstart", "focusin"]) node.addEventListener(type, stop);
    return () => { for (const type of ["pointerdown", "touchstart", "focusin"]) node.removeEventListener(type, stop); };
  }, [shown]);

  if (!shown) return null;

  const source = assetSrc(shown.filePath) || shown.thumb || "";
  const name = shown.name || shown.label || "이미지";
  const host = document.getElementById("root") ?? document.body;
  const arrowStyle = { background: "oklch(0 0 0 / 55%)", color: "white" };

  return createPortal(
    <div
      ref={overlayRef}
      onClick={onClose}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-3 p-6"
      style={{ background: "oklch(0 0 0 / 88%)", pointerEvents: "auto" }}
    >
      <img
        key={at}
        src={source}
        alt={name}
        onClick={event => event.stopPropagation()}
        onLoad={(event) => {
          const target = event.currentTarget;
          if (target.naturalWidth) setSize({ width: target.naturalWidth, height: target.naturalHeight });
        }}
        className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
        style={{ boxShadow: "0 20px 60px oklch(0 0 0 / 60%)" }}
      />
      {many && (
        <>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); prev(); }}
            aria-label="이전 (←)"
            title="이전 (←)"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-white/15"
            style={arrowStyle}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); next(); }}
            aria-label="다음 (→)"
            title="다음 (→)"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-white/15"
            style={arrowStyle}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: "oklch(0.72 0.01 265)" }}>
          {name}
          {/* 크기는 이름 바로 옆에 — 「이게 4K 인가」 를 여기서 바로 봅니다. 아직 못 읽었으면 자리만 비웁니다. */}
          {size && (
            <span className="ml-2 tabular-nums" style={{ color: "oklch(0.70 0.13 200)" }}>
              {size.width} × {size.height}
              {Math.max(size.width, size.height) >= 1024 && (
                <span className="ml-1" style={{ color: "oklch(0.50 0.01 265)" }}>
                  ({(Math.max(size.width, size.height) / 1024).toFixed(1)}K)
                </span>
              )}
            </span>
          )}
          {many && (
            <span className="ml-2 tabular-nums" style={{ color: "oklch(0.55 0.01 265)" }}>
              {at + 1} / {list.length} · ← →
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "oklch(1 0 0 / 10%)", color: "white" }}
        >
          <X className="h-3 w-3" /> 닫기 (Esc)
        </button>
      </div>
    </div>,
    host,
  );
}
