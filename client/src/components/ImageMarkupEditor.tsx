import { SURFACE_BOX, SURFACE_MEDIA } from "@/lib/imageSurface";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadImageForCanvas } from "@/lib/mediaLibrary";
import { drawImageMarks, markColor } from "@/lib/imageMarkDraw";
import {
  Camera,
  Circle as CircleIcon,
  MapPin,
  PenLine,
  Save,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";

/**
 * 전경 이미지에 표시를 그려 6면 배경을 뽑아내는 도구.
 *
 * 배경은 방향이 여섯인데, 여섯 장을 따로따로 만들면 같은 장소로 안 보입니다.
 * 먼저 그 공간의 전경 한 장을 만들고, 그 안에서 "이 부분이 정면", "저 부분이 좌측"
 * 처럼 자리를 짚어 준 뒤 각 자리를 클로즈업으로 뽑으면 여섯 면이 한 공간이 됩니다.
 *
 * 좌표는 0~1 비율로 저장합니다. 원본 크기가 달라져도 표시가 제자리에 남습니다.
 */

/**
 * 표시의 종류.
 *
 * anchor 만 성격이 다릅니다. 나머지 셋은 «이 영역» 을 가리키지만, anchor 는
 * **카메라가 서는 한 지점**입니다. 여섯 면도 파노라마도 결국 «어디에 서서
 * 어느 쪽을 보는가» 로 정해지는데, 사각형으로는 그 지점을 못 짚습니다.
 *
 * 특히 위에서 내려다본 배치도에서는 영역 표시가 아무 뜻도 없습니다.
 * 지도 위의 네모는 «저 구역» 이지 «저기 서라» 가 아니니까요.
 */
export type MarkShape = "rect" | "ellipse" | "free" | "anchor";

export interface ImageMark {
  id: string;
  shape: MarkShape;
  /**
   * 이 표시가 무엇인지 사람이 적는 말.
   *
   * 정해진 목록(정면·후면·좌·우…)으로 두었더니 담기지 않는 것이 많았습니다.
   * 앵커는 지점이고, 자유선은 동선이고, 사각형은 구역입니다. 그리고 대개는
   * «①번에서 ⑤번까지 강을 따라 이동» 처럼 문장으로 써야 뜻이 통합니다.
   */
  note: string;
  /** rect·ellipse 는 두 점, free 는 지나간 점들. 모두 0~1 비율입니다. */
  points: { x: number; y: number }[];
}

const SHAPE_LABELS: Record<MarkShape, string> = {
  rect: "사각형",
  ellipse: "원",
  free: "자유선",
  anchor: "앵커 지점",
};

// 색과 그리기는 `lib/imageMarkDraw.ts` 한 곳에 — 화면·저장본·구도잡기 안내가 같은 것을 씁니다.
export { markColor };

export default function ImageMarkupEditor({
  imageSrc,
  marks,
  onChange,
  onSave,
}: {
  imageSrc: string;
  marks: ImageMark[];
  onChange: (marks: ImageMark[]) => void;
  /**
   * 표시를 그려 넣은 그림을 **파일로** 넘깁니다.
   *
   * 예전에는 클립보드에 복사만 했습니다. 그러면 앵커를 옮겨 가며 여러 공간을
   * 만들 때 남는 것이 없습니다. 창을 닫으면 표시가 사라지니 다음 공간을
   * 만들려면 처음부터 다시 찍어야 했어요.
   *
   * 파일로 남기면 원본은 깨끗한 채로 「앵커 A판」 「앵커 B판」 이 폴더에 쌓입니다.
   */
  onSave?: (file: File, stem: string, marks: ImageMark[]) => Promise<void> | void;
}) {
  const [saveName, setSaveName] = useState("표시");
  const [saving, setSaving] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  /** 표시 덮개 캔버스. 저장본과 같은 함수로 그립니다 */
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState<MarkShape>("rect");
  const [drawing, setDrawing] = useState<ImageMark | null>(null);

  /** 화면 좌표를 0~1 비율로 바꿉니다. */
  const toRatio = (event: React.PointerEvent) => {
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1),
    };
  };

  const startDraw = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toRatio(event);
    setDrawing({
      id: Math.random().toString(36).slice(2),
      shape,
      note: "",
      points: [point, point],
    });
  };

  const moveDraw = (event: React.PointerEvent) => {
    if (!drawing) return;
    const point = toRatio(event);
    setDrawing(current => {
      if (!current) return current;
      // 자유선은 지나간 자리를 모두 담고, 나머지는 시작점과 지금 점만 있으면 됩니다.
      if (current.shape === "free") return { ...current, points: [...current.points, point] };
      return { ...current, points: [current.points[0], point] };
    });
  };

  const endDraw = () => {
    if (!drawing) return;
    // 앵커는 «지점» 이라 클릭 한 번으로도 성립합니다. 끌면 그 방향이 정면입니다.
    if (drawing.shape === "anchor") {
      onChange([...marks, drawing]);
      setDrawing(null);
      return;
    }
    const [first, last] = [drawing.points[0], drawing.points[drawing.points.length - 1]];
    const tooSmall =
      drawing.shape !== "free" &&
      Math.abs(last.x - first.x) < 0.01 &&
      Math.abs(last.y - first.y) < 0.01;

    // 손이 미끄러져 생긴 점 하나짜리 표시는 버립니다.
    if (!tooSmall && drawing.points.length > 1) onChange([...marks, drawing]);
    setDrawing(null);
  };

  // 그리는 도중 창을 벗어나도 붓이 계속 붙어 있지 않게 합니다.
  useEffect(() => {
    const stop = () => setDrawing(null);
    window.addEventListener("blur", stop);
    return () => window.removeEventListener("blur", stop);
  }, []);

  // Ctrl+Z (규칙 4). 단추만 있고 키가 없어서 다른 편집 창과 달랐습니다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      onChange(marks.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marks, onChange]);

  const update = (id: string, patch: Partial<ImageMark>) =>
    onChange(marks.map(mark => (mark.id === id ? { ...mark, ...patch } : mark)));

  const remove = (id: string) => onChange(marks.filter(mark => mark.id !== id));

  /**
   * 표시를 그려 넣은 그림을 원본 크기 그대로 만듭니다.
   *
   * 화면을 캡처하면 잘리거나 배율이 달라집니다. 원본 픽셀 위에 도형과 번호를
   * 얹어야 생성기가 «①번 지점» 을 알아봅니다.
   */
  /** 표시를 원본 해상도로 구워 PNG Blob 을 만듭니다. 저장과 복사가 같이 씁니다. */
  const renderMarkedBlob = async (): Promise<Blob | null> => {
    {
      // asset:// 주소를 그대로 그리면 캔버스가 오염되어 내보낼 수 없습니다.
      const image = await loadImageForCanvas(imageSrc);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) return null;

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      // 화면 덮개와 **같은 함수** — 저장한 파일이 화면과 다르게 나오지 않게(`imageMarkDraw.ts`).
      drawImageMarks(context, marks, canvas.width, canvas.height);

      return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    }
  };

  const save = async () => {
    if (!saveName.trim() || !onSave) return;
    setSaving(true);
    try {
      const blob = await renderMarkedBlob();
      if (!blob) return;
      const stem = saveName.trim();
      await onSave(new File([blob], `${stem}.png`, { type: "image/png" }), stem, marks);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 표시한 그림을 클립보드로.
   *
   * 파일로 저장하지 않고 곧장 프리픽·claude.ai 에 붙여넣을 때 씁니다.
   * 번호·화살표가 구워진 판이 넘어가야 LLM 이 «1번 지점» 을 알아듣습니다.
   */
  const copyMarked = async () => {
    try {
      const blob = await renderMarkedBlob();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("표시한 그림을 복사했습니다. 바로 붙여넣으세요.");
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  };

  const visible = drawing ? [...marks, drawing] : marks;

  // 표시가 바뀌거나 그림 크기가 바뀔 때마다 덮개를 다시 그립니다(그림이 늦게 뜨면 ResizeObserver 가 잡음).
  useEffect(() => {
    const canvas = overlayRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;
    const draw = () => {
      const rect = surface.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawImageMarks(context, visible, width, height);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div className="space-y-3">
      {/*
        저장 줄(이름 칸 · «표시한 그림 저장»)은 표시를 하나라도 찍어야 생깁니다. 튜토리얼이 그것을
        가리키면 아직 아무것도 안 그린 사람에게는 영영 안 보이므로, **늘 있는 이 도구줄**이 두 이름을
        같이 받습니다 — 튜토리얼이 가리킬 자리는 늘 화면에 있거나, 아니면 대신 눌러 줘야 합니다.
      */}
      <div className="flex flex-wrap items-center gap-2" data-tour="cropper-mark-shapes">
        {(["anchor", "rect", "ellipse", "free"] as MarkShape[]).map(item => {
          const Icon =
            item === "anchor" ? MapPin : item === "rect" ? Square : item === "ellipse" ? CircleIcon : PenLine;
          const active = shape === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setShape(item)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold"
              style={{
                background: active ? "oklch(0.62 0.22 290 / 20%)" : "oklch(1 0 0 / 5%)",
                border: `1px solid ${active ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 10%)"}`,
                color: active ? "oklch(0.84 0.19 290)" : "oklch(0.62 0.01 265)",
              }}
            >
              <Icon className="h-3.5 w-3.5" /> {SHAPE_LABELS[item]}
            </button>
          );
        })}

        <span className="text-[11px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          {shape === "anchor"
            ? "카메라가 설 지점을 누르고, 정면으로 볼 쪽으로 끌어 놓으세요"
            : "이미지 위에서 끌어 표시합니다"}
        </span>

        {marks.length > 0 && onSave && (
          <div className="ml-auto flex items-center gap-1.5" data-tour="cropper-mark-made">
            <input
              value={saveName}
              onChange={event => setSaveName(event.target.value)}
              placeholder="앵커 A"
              title="저장될 파일 이름에 들어갈 말입니다"
              className="w-24 rounded-md px-2 py-1.5 text-[11px] outline-none"
              style={{ background: "oklch(0.18 0.012 265)", border: "1px solid oklch(1 0 0 / 10%)", color: "white" }}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              title="표시를 그려 넣은 그림을 프로젝트 폴더에 저장합니다"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
              style={{ background: "oklch(0.55 0.15 200 / 16%)", color: "oklch(0.78 0.14 200)" }}
            >
              <Save className="h-3 w-3" /> {saving ? "저장 중…" : "표시한 그림 저장"}
            </button>
          </div>
        )}

        {marks.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => void copyMarked()}
              title="번호·화살표가 구워진 그림을 클립보드로 — 바로 붙여넣기"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]"
              style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.72 0.14 200)" }}
            >
              <Camera className="h-3 w-3" /> 표시한 그림 복사
            </button>
            <button
              type="button"
              onClick={() => onChange(marks.slice(0, -1))}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]"
              style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.62 0.01 265)" }}
            >
              <Undo2 className="h-3 w-3" /> 마지막 표시 취소
            </button>
          </>
        )}
      </div>

      <div
        ref={surfaceRef}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        className={`${SURFACE_BOX} overflow-hidden rounded-lg`}
        style={{ background: "oklch(0.10 0.008 265)", border: "1px solid oklch(1 0 0 / 10%)", cursor: "crosshair" }}
      >
        <img src={imageSrc} alt="전경" className={`pointer-events-none ${SURFACE_MEDIA}`} draggable={false} />

        {/*
          표시 덮개 — 저장본과 **같은 함수**(drawImageMarks)로 CSS px 크기에 그립니다.
          예전 SVG(viewBox 0~100 을 늘려 그림)는 가로로 긴 그림에서 앵커 원이 타원이 되고
          번호표가 DOM 배지라, 화면에서 보던 모양과 저장한 파일의 모양이 서로 달랐습니다.
        */}
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      {marks.length === 0 ? (
        <p className="text-xs" style={{ color: "oklch(0.45 0.01 265)" }}>
          아직 표시가 없습니다. 전경에서 각 면이 될 자리를 짚어 주세요.
        </p>
      ) : (
        <div className="space-y-2">
          {marks.map((mark, index) => (
            <div
              key={mark.id}
              className="flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2"
              style={{ background: "oklch(0.14 0.009 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                style={{ background: markColor(index) }}
              >
                {index + 1}
              </span>
              <span className="shrink-0 text-[11px]" style={{ color: "oklch(0.50 0.01 265)" }}>
                {SHAPE_LABELS[mark.shape]}
              </span>

              <input
                value={mark.note}
                onChange={event => update(mark.id, { note: event.target.value })}
                placeholder={
                  mark.shape === "anchor"
                    ? "이 지점이 어디인지 (예: 관측소 입구 앞, 화살표 쪽이 북쪽)"
                    : mark.shape === "free"
                      ? "동선이나 흐름 (예: ①번에서 ⑤번까지 강을 따라 이동)"
                      : "이 구역이 무엇인지 (예: 야영지, 여기만 불빛이 있음)"
                }
                className="min-w-0 flex-1 rounded-md px-2 py-1 text-[11px] outline-none"
                style={{ background: "oklch(0.18 0.012 265)", border: "1px solid oklch(1 0 0 / 10%)", color: "white" }}
              />

              <button
                type="button"
                onClick={() => remove(mark.id)}
                title="이 표시 지우기"
                className="shrink-0 rounded p-1 hover:bg-white/10"
              >
                <Trash2 className="h-3.5 w-3.5" style={{ color: "oklch(0.62 0.14 25)" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
