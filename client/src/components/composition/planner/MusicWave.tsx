import { useEffect, useRef, useState } from "react";
import { audioPeaks } from "@/lib/audioPeaks";

/**
 * **노래 파형** — 타임라인 줄 위에 그립니다.
 *
 *
 *
 * # 시간이 맞아야 뜻이 있습니다
 *
 * 파형은 «노래의 몇 초» 이고 줄은 «타임라인의 몇 초» 입니다. 둘이 어긋나면 파형이
 * 거짓말을 합니다 — 후렴이 시작되는 자리에 조용한 부분이 그려지는 식으로요.
 *
 * 그래서 `offset`(타임라인 0초에 울리는 노래의 지점)과 타임라인 길이를 함께 받아,
 * **화면에 보이는 구간만** 잘라 그립니다. 노래가 타임라인보다 짧으면 그만큼만 그리고
 * 나머지는 비웁니다 — 없는 소리를 늘려 그리면 있는 줄 압니다.
 */
export default function MusicWave({
  path,
  offset = 0,
  /** 이 줄이 덮는 타임라인 길이(초). */
  timelineSeconds,
  color = "oklch(0.72 0.18 300)",
}: {
  path: string;
  offset?: number;
  timelineSeconds: number;
  color?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setFailed("");

    const draw = async () => {
      const peaks = await audioPeaks(path);
      const canvas = canvasRef.current;
      const box = boxRef.current;
      if (!alive || !canvas || !box) return;

      /*
        **점 밀도를 맞춥니다.** 캔버스는 CSS 픽셀이 아니라 제 픽셀로 그려서, 고해상도
        화면에서 그냥 그리면 선이 흐릿해집니다.
      */
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(box.clientWidth));
      const height = Math.max(1, Math.round(box.clientHeight));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, width, height);

      const middle = height / 2;
      const seconds = Math.max(0.001, timelineSeconds);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;

      for (let x = 0; x < width; x += 1) {
        // 이 화소가 가리키는 **노래 안의 시각**.
        const at = offset + (x / width) * seconds;
        if (at < 0 || at > peaks.seconds) continue;
        const bucket = Math.min(
          peaks.max.length - 1,
          Math.floor((at / peaks.seconds) * peaks.max.length),
        );
        const high = peaks.max[bucket] * middle;
        const low = peaks.min[bucket] * middle;
        // 아주 조용한 데서도 선 한 줄은 남깁니다 — 아니면 «파일이 비었나» 로 보입니다.
        const top = middle - Math.max(0.5, high);
        const bottom = middle - Math.min(-0.5, low);
        ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
      }
      ctx.globalAlpha = 1;
      if (alive) setReady(true);
    };

    void draw().catch((error) => alive && setFailed(String(error)));
    /*
      상자 폭이 바뀌면(창 크기·확대) 다시 그립니다. 캔버스는 CSS 처럼 늘어나지 않고
      그린 화소가 뭉개지므로, 폭이 바뀐 것을 듣고 있어야 합니다.
    */
    const box = boxRef.current;
    const watcher =
      box && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => void draw().catch(() => {}))
        : null;
    if (box && watcher) watcher.observe(box);
    return () => {
      alive = false;
      watcher?.disconnect();
    };
  }, [path, offset, timelineSeconds, color]);

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" style={{ opacity: ready ? 1 : 0 }} />
      {!ready && (
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px]"
          style={{ color: failed ? "oklch(0.70 0.14 25)" : "oklch(0.50 0.01 265)" }}
        >
          {failed ? "파형을 읽지 못했습니다" : "파형을 읽는 중…"}
        </span>
      )}
    </div>
  );
}
