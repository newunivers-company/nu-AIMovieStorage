import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import HowToPanel, { SIX_FACES_HOWTO } from "@/components/HowToPanel";
import type { SpaceKind } from "@/lib/blueprint";
import { COMPOSITION_CUBE_FACES, type CompositionCubeFace } from "@/lib/composition";
import { FACE_KEYS, faceLabel } from "@/lib/faceSets";
import { loadImageForCanvas } from "@/lib/mediaLibrary";
import {
  DEFAULT_PANORAMA_FIX,
  asFullEquirect,
  buildEquirect,
  cubeFacesFromEquirect,
  enlargeCanvas,
  equirectWidthFor,
  guessVerticalFov,
  isFullEquirect,
  nativeFaceSize,
  type PanoramaFix,
} from "@/lib/panorama";
import { UPSCALE_ENGINE_CATALOG, defaultEngine, isUpscaleReady, needsUpscale, useUpscaleEngines } from "@/lib/upscale";

/** 여섯 면 한 장. `stem` 은 화면 이름(정면·하늘…)이고 파일 이름은 받는 쪽이 접두를 붙여 짓습니다. */
export interface PanoramaFaceFile {
  file: File;
  stem: string;
  face: CompositionCubeFace;
}

/**
 * 여섯 면을 어떻게 만들었는지 — 받는 쪽(SheetPanelCropper)이 저장 뒤 무엇을 더 해야 하는지 압니다.
 *
 * - `upscale` — 원래 해상도(`nativeSize`)로 잘라 넘겼으니 업스케일 엔진으로 `faceSize` 까지 키워 덮어쓸 것.
 * - `enlarged` — 엔진 없이 브라우저에서 그냥 키웠음. «진짜 업스케일이 아니다» 안내가 필요.
 * - `capped` — 그냥 키우기는 `BICUBIC_MAX` 까지라 고른 크기보다 작게 저장됨.
 */
export interface PanoramaFacePlan {
  faceSize: number;
  nativeSize: number;
  upscale: boolean;
  enlarged: boolean;
  capped: boolean;
}

/** 여섯 면 크기 선택지. 4K 위는 업스케일 엔진이 있어야 뜻이 있습니다(). */
const FACE_SIZE_OPTIONS: { size: number; label: string }[] = [
  { size: 1024, label: "1024 × 1024" },
  { size: 2048, label: "2048 × 2048" },
  { size: 4096, label: "4096 × 4096 (4K)" },
  { size: 6144, label: "6144 × 6144 (6K)" },
  { size: 8192, label: "8192 × 8192 (8K)" },
];

/**
 * 업스케일 엔진 없이 브라우저에서 키울 때의 상한.
 *
 * 저장은 png 바이트를 JSON 숫자 배열로 Rust 에 넘깁니다(`saveProjectMediaAsset`). 4096 면 png 가
 * 20MB 안팎 → 문자열 100MB 인데, 8192 는 그 네 배라 웹뷰가 버티지 못합니다. 엔진 길은 Rust 가
 * 결과를 직접 파일에 쓰므로 이 한계가 없습니다 — 6K·8K 는 그쪽으로만 갑니다.
 */
export const BICUBIC_MAX = 4096;

/**
 * 세로 모형에 맞는 세로 화각 어림값.
 *
 * `guessVerticalFov` 는 «가로가 넓으면 세로도 그만큼» 이라는 어림이라 원통에는 안 맞습니다.
 * 앱의 원통은 **탄젠트 모형**이라, 360° 를 한 바퀴 감은 띠에서는 비율이 곧 세로 화각입니다:
 * 세로 화각 = 2·atan(π / 비율). 21:9 → 약 107, 16:9 → 약 121, 3:1 → 약 93, 4:1 → 약 76.
 * (등장방형 산수 360/90 = 4 를 원통에 그대로 쓰면 «4:1 에 세로 90도» 가 되어 하늘이 처집니다.)
 */
function guessFovFor(vertical: PanoramaFix["vertical"], image: HTMLImageElement | null): number {
  const width = image ? image.naturalWidth || image.width : 0;
  const height = image ? image.naturalHeight || image.height : 0;
  if (!width || !height) return DEFAULT_PANORAMA_FIX.verticalFov;
  if (vertical !== "cylindrical") return guessVerticalFov(width, height);
  const guess = (2 * Math.atan(Math.PI / (width / height)) * 180) / Math.PI;
  return Math.max(30, Math.min(180, Math.round(guess)));
}

/**
 * 넓은 그림을 진짜 파노라마로 펴고, 거기서 여섯 면을 뽑는 자리.
 *
 * ## 이 화면이 있는 이유
 *
 * 생성기에 «360도 등장방형 파노라마» 를 시켜도 대개는 그냥 가로로 넓은 풍경이
 * 나옵니다. 2:1 비율은 맞는데 위아래 왜곡이 없습니다. 그걸 구도잡기에 넣으면
 * 맨 윗줄이 머리 위 한 점으로 모이면서, 하늘에 있던 달이 극점을 향해 방사형으로
 * 뭉개집니다.
 *
 * 여기서 «원본이 담고 있는 세로 화각» 을 알려 주면 그 띠를 제자리에 놓고 위아래를
 * 채웁니다. 그 값은 그림 안에 적혀 있지 않아서 자동으로 알아낼 수 없고, 눈으로
 * 맞추는 수밖에 없습니다. 그래서 여섯 면 미리보기를 함께 둡니다 —
 * **위·아래 두 장만 보면** 맞았는지 틀렸는지 바로 보입니다.
 *
 * ## 크기와 업스케일
 *
 * 90° 한 면의 원래 해상도는 파노라마 가로의 1/4 입니다. 그보다 큰 면을 고르면 «없는
 * 픽셀» 을 만들어야 하는데, 브라우저 리샘플은 흐리게 늘릴 뿐입니다. 설정의 **기본 업스케일
 * 엔진**이 설치돼 있으면 원래 해상도로 자른 여섯 장을 넘기고, 받는 쪽이 차례로 업스케일해
 * **같은 파일을 덮어씁니다** (이름이 바뀌면 세트가 깨집니다).
 */
export default function PanoramaWorkbench({
  imageSrc,
  spaceKind,
  progress,
  onSaveEquirect,
  onSaveFaces,
}: {
  imageSrc: string;
  /** 실내면 위 면이 «천장», 아니면 «하늘». 파일 이름 토큰도 같습니다. */
  spaceKind?: SpaceKind | null;
  /** 받는 쪽의 저장·업스케일 진행 문구(«정면 업스케일 중 1/6»). 있으면 단추에 보입니다. */
  progress?: string | null;
  /** 보정한 파노라마 한 장을 넘깁니다. */
  onSaveEquirect?: (file: File, stem: string) => Promise<void> | void;
  /** 여섯 면을 한꺼번에 넘깁니다. 업스케일 여부는 `plan` 에. */
  onSaveFaces?: (files: PanoramaFaceFile[], plan: PanoramaFacePlan) => Promise<void> | void;
}) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  /*
    기본값이 «등장방형 180» 입니다. (2026-09-09)

    이 앱은 이제 등장방형 프롬프트(P1)로 파노라마를 뽑습니다. 그렇게 뽑은 그림은 손댈 것이
    없는데, 원통 70° 로 시작하면 멀쩡한 파노라마를 가운데 띠로 눌러 놓고 사람이 다시
    180 으로 올려야 했습니다. 원통은 «그렇게 나왔을 때» 고르는 쪽으로 뒤집습니다.
  */
  const [fix, setFix] = useState<PanoramaFix>(asFullEquirect(DEFAULT_PANORAMA_FIX));
  const [faceSize, setFaceSize] = useState(1024);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * «이미 등장방형» — 세로 180·등장방형으로 고정하고 어림값을 쓰지 않습니다.
   * 켜 둔 채 다른 그림을 열어도 유지되도록 ref 로도 들고 있습니다(로드 효과가 읽음).
   */
  const [alreadyEquirect, setAlreadyEquirect] = useState(true);
  const alreadyRef = useRef(alreadyEquirect);
  alreadyRef.current = alreadyEquirect;
  /**
   * 쓸 수 있는 업스케일 엔진이 있는가 — 엔진 상태를 구독해서 봅니다. 예전에는 창을 열 때 한 번만
   * ComfyUI 설정을 읽었는데, 설정 화면에서 엔진을 깔고 돌아와도 체크가 안 보였습니다.
   * 체크는 엔진이 있을 때만 보이고 기본은 켬.
   */
  useUpscaleEngines();
  const engineReady = isUpscaleReady();
  const engineId = defaultEngine();
  const engineName = engineId ? UPSCALE_ENGINE_CATALOG[engineId].name.split(" — ")[0] : "";
  const [useEngine, setUseEngine] = useState(true);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const faceRefs = useRef<Partial<Record<CompositionCubeFace, HTMLCanvasElement | null>>>({});

  useEffect(() => {
    let alive = true;
    loadImageForCanvas(imageSrc)
      .then(image => {
        if (!alive) return;
        setSource(image);
        // 처음 잡아 줄 값. 정답이 아니라 출발점입니다. «이미 등장방형»(기본) 이면 어림값 대신 180 고정.
        setFix(current =>
          alreadyRef.current
            ? asFullEquirect(current)
            : { ...current, verticalFov: guessFovFor(current.vertical, image) },
        );
      })
      .catch(() => toast.error("이미지를 읽지 못했습니다."));
    return () => { alive = false; };
  }, [imageSrc]);

  /**
   * «이미 등장방형» 체크 — 세로 180·등장방형으로 **고정**(잠금)하거나 풉니다.
   *
   * 끌 때 모형까지 원통으로 바꾸지 않습니다. 예전에는 체크와 모형 단추를 한 몸으로 묶어
   * «끄면 무조건 원통» 이었는데, 그러면 **«등장방형인데 세로 화각이 180이 아닌» 상태로 갈
   * 길이 없었습니다.** 등장방형 칩의 안내가 바로 그 상태를 시킵니다 — 「생성기가 2:1 을
   * 못 내면 21:9 로 받고, «이미 등장방형» 을 끈 뒤 세로 화각을 약 154 로 두세요」.
   * 그대로 따라 하면 모형이 원통으로 바뀌고 화각도 107로 덮여 위아래가 다시 틀어졌습니다.
   */
  const setAlreadyFull = (locked: boolean) => {
    setAlreadyEquirect(locked);
    if (locked) setFix(current => asFullEquirect(current));
  };

  /**
   * 세로 모형 단추. 누르면 잠금을 풀고 그 모형으로 갑니다.
   *
   * - «원통» — 모형을 바꾸고 비율에서 세로 화각을 어림잡습니다.
   * - «등장방형» — 모형만 되돌리고 **화각은 손대지 않습니다**(21:9 등장방형 154도가 여기 있습니다).
   *
   * 잠겨 있어도 단추는 살려 둡니다 — 누르는 것이 곧 잠금을 푸는 일입니다. 예전처럼
   * disabled 로 막으면 체크를 먼저 찾아 끄지 않는 한 모형을 바꿀 길이 없었습니다.
   */
  const setVertical = (vertical: PanoramaFix["vertical"]) => {
    setAlreadyEquirect(false);
    setFix(current =>
      vertical === "cylindrical"
        ? { ...current, vertical, verticalFov: guessFovFor("cylindrical", source) }
        : { ...current, vertical },
    );
  };

  /**
   * 미리보기는 작게 만듭니다.
   *
   * 저장할 때는 원본 가로 그대로 가지만, 손잡이를 움직일 때마다 큰 판을 다시 만들면
   * 손이 걸립니다. 보기에는 1024 면 충분하고, 계산식이 같아서 여기서 맞으면
   * 저장본도 맞습니다.
   */
  useEffect(() => {
    if (!source) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      if (!alive) return;
      setBusy(true);
      // 다음 프레임으로 미뤄야 «만드는 중» 표시가 실제로 그려집니다.
      window.requestAnimationFrame(() => {
        if (!alive) return;
        try {
          const equirect = buildEquirect(source, fix, 1024);
          const preview = previewRef.current;
          if (preview) {
            preview.width = equirect.width;
            preview.height = equirect.height;
            preview.getContext("2d")?.drawImage(equirect, 0, 0);
          }
          // 여섯 면은 더 작게. 맞는지 틀리는지만 보면 됩니다.
          const faces = cubeFacesFromEquirect(equirect, 128);
          COMPOSITION_CUBE_FACES.forEach(face => {
            const target = faceRefs.current[face];
            if (!target) return;
            target.width = 128;
            target.height = 128;
            target.getContext("2d")?.drawImage(faces[face], 0, 0);
          });
        } finally {
          if (alive) setBusy(false);
        }
      });
    }, 180);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [source, fix]);

  const toFile = (canvas: HTMLCanvasElement, stem: string) =>
    new Promise<File | null>(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], `${stem}.png`, { type: "image/png" }) : null);
      }, "image/png");
    });

  const sourceWidth = source ? source.naturalWidth || source.width : 0;
  /** 원본 가로 그대로 펴서 해상도를 잃지 않게. 예전 4096 고정은 8K 원본도 1024 면으로 깎았습니다. */
  const equirectWidth = equirectWidthFor(sourceWidth);
  const nativeSize = nativeFaceSize(sourceWidth);
  const needs = needsUpscale(nativeSize, faceSize);
  const viaEngine = needs && engineReady && useEngine;

  const saveEquirect = async () => {
    if (!source || !onSaveEquirect) return;
    setSaving(true);
    try {
      const file = await toFile(buildEquirect(source, fix, equirectWidth), "파노라마");
      if (!file) { toast.error("이미지를 만들지 못했습니다."); return; }
      await onSaveEquirect(file, "파노라마");
    } finally {
      setSaving(false);
    }
  };

  /**
   * 여섯 면을 만듭니다.
   *
   * 자르는 크기는 항상 «원래 해상도 이하» 입니다. 그 위는 어차피 없는 픽셀이라, 브라우저에서
   * 키울 때는 `enlargeCanvas`, 진짜 업스케일은 업스케일 엔진이 합니다(원래 해상도 그대로 넘김 —
   * 미리 키운 판을 보내면 엔진이 흐린 그림을 «복원» 하는 꼴이 됩니다).
   */
  const saveFaces = async () => {
    if (!source || !onSaveFaces) return;
    setSaving(true);
    try {
      const cutSize = needs ? Math.min(nativeSize, faceSize) : faceSize;
      const faces = cubeFacesFromEquirect(buildEquirect(source, fix, equirectWidth), cutSize);
      const enlargeTo = needs && !viaEngine ? Math.min(faceSize, BICUBIC_MAX) : cutSize;
      const files: PanoramaFaceFile[] = [];
      for (const face of FACE_KEYS) {
        const stem = faceLabel(face, spaceKind);
        const file = await toFile(enlargeCanvas(faces[face], enlargeTo), stem);
        if (file) files.push({ file, stem, face });
      }
      if (!files.length) { toast.error("이미지를 만들지 못했습니다."); return; }
      await onSaveFaces(files, {
        faceSize,
        nativeSize: cutSize,
        upscale: viaEngine,
        enlarged: needs && !viaEngine,
        capped: needs && !viaEngine && faceSize > BICUBIC_MAX,
      });
    } finally {
      setSaving(false);
    }
  };

  const ready = Boolean(source);
  const locked = alreadyEquirect;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-2">
          <div
            className="relative overflow-hidden rounded-lg"
            style={{ background: "oklch(0.10 0.006 265)", border: "1px solid oklch(1 0 0 / 10%)" }}
          >
            <canvas ref={previewRef} className="block w-full" />
            {/* 지평선이 정확히 한가운데 와야 합니다. 어긋나면 여섯 면이 전부 기울어집니다. */}
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2"
              style={{ borderTop: "1px dashed oklch(0.78 0.14 200 / 60%)" }}
            />
            {busy && (
              <span
                className="absolute right-2 top-2 rounded px-2 py-1 text-[10px] font-semibold"
                style={{ background: "oklch(0 0 0 / 70%)", color: "white" }}
              >
                맞추는 중…
              </span>
            )}
          </div>

          <FacePreview refs={faceRefs} spaceKind={spaceKind} />
        </div>

        <div className="space-y-3">
          {/* 사용 방법. 세로 쌓임이라 단추 아래 목록이 그냥 쌓입니다. */}
          <div className="space-y-2">
            <HowToPanel {...SIX_FACES_HOWTO} />
          </div>

          <label className="flex items-center gap-2 text-[11px]" style={{ color: "oklch(0.72 0.01 265)" }}>
            <input
              type="checkbox"
              checked={alreadyEquirect}
              onChange={(event) => setAlreadyFull(event.target.checked)}
            />
            이미 등장방형 파노라마 (세로 180도 — 손대지 않음)
          </label>

          <Slider
            label="세로 화각"
            hint={locked ? "«이미 등장방형» 을 끄거나 «원통» 을 고르면 다시 맞출 수 있습니다" : "원본이 담고 있는 위아래 범위입니다. 180이면 손대지 않습니다"}
            value={fix.verticalFov}
            min={30}
            max={180}
            step={1}
            suffix="도"
            disabled={locked}
            onChange={(verticalFov) => setFix(current => ({ ...current, verticalFov }))}
          />

          <div className="space-y-1">
            <p className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>세로 모형</p>
            {/* 잠겨 있어도 단추는 살려 둡니다 — 누르는 것이 곧 «이미 등장방형» 을 끄는 일입니다(setVertical). */}
            <div className="flex rounded-md p-0.5" style={{ background: "oklch(1 0 0 / 5%)" }}>
              {([
                { id: "cylindrical" as const, label: "원통" },
                { id: "equirect" as const, label: "등장방형" },
              ]).map(item => {
                const on = fix.vertical === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVertical(item.id)}
                    className="flex-1 rounded px-2 py-1.5 text-[11px] font-semibold"
                    style={{
                      background: on ? "oklch(1 0 0 / 10%)" : "transparent",
                      color: on ? "oklch(0.84 0.16 290)" : "oklch(0.52 0.01 265)",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.42 0.01 265)" }}>
              <b>등장방형</b>(2:1, 위 끝이 천정)이 기본입니다. 4:1 처럼 납작하거나 위아래 왜곡이 없으면
              <b> 원통</b>으로 바꾸세요 — 세로 화각을 비율에서 어림잡아 넣습니다.
              21:9 로 받은 등장방형이면 <b>등장방형</b>인 채로 세로 화각만 약 154 로 내리세요.
            </p>
          </div>

          <Slider
            label="지평선 위치"
            hint="원본에서 지평선이 있는 높이입니다"
            value={Math.round(fix.horizon * 100)}
            min={0}
            max={100}
            step={1}
            suffix="%"
            disabled={locked}
            onChange={(value) => setFix(current => ({ ...current, horizon: value / 100 }))}
          />

          <Slider
            label="이음매 잇기"
            hint="왼쪽 끝과 오른쪽 끝을 섞는 폭입니다"
            value={Math.round(fix.seam * 100)}
            min={0}
            max={30}
            step={1}
            suffix="%"
            onChange={(value) => setFix(current => ({ ...current, seam: value / 100 }))}
          />

          <label className="flex items-center gap-2 text-[11px]" style={{ color: "oklch(0.72 0.01 265)" }}>
            <input
              type="checkbox"
              checked={fix.fillPoles}
              disabled={isFullEquirect(fix)}
              onChange={(event) => setFix(current => ({ ...current, fillPoles: event.target.checked }))}
            />
            {faceLabel("top", spaceKind)}·바닥 채우기
          </label>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>여섯 면 크기</p>
            <select
              value={faceSize}
              onChange={(event) => setFaceSize(Number(event.target.value))}
              className="w-full rounded-md px-2 py-1.5 text-[11px] outline-none"
              style={{ background: "oklch(0.18 0.012 265)", border: "1px solid oklch(1 0 0 / 10%)", color: "white" }}
            >
              {FACE_SIZE_OPTIONS.map(option => (
                <option key={option.size} value={option.size}>{option.label}</option>
              ))}
            </select>
            {ready && (
              <p className="text-[10px] leading-relaxed" style={{ color: needs ? "oklch(0.80 0.14 80)" : "oklch(0.42 0.01 265)" }}>
                이 파노라마의 한 면 원래 해상도 ≈ <b>{nativeSize}</b>
                {needs
                  ? viaEngine
                    ? ` → ${faceSize} 은 ${engineName} 으로 업스케일합니다`
                    : ` → ${faceSize} 은 늘리는 것뿐입니다${faceSize > BICUBIC_MAX ? ` (엔진 없이는 ${BICUBIC_MAX} 까지)` : ""}`
                  : " — 원본으로 충분합니다"}
              </p>
            )}
            {engineReady ? (
              <label className="flex items-center gap-2 text-[11px]" style={{ color: "oklch(0.72 0.01 265)" }}>
                <input
                  type="checkbox"
                  checked={useEngine}
                  onChange={(event) => setUseEngine(event.target.checked)}
                />
                작으면 업스케일 ({engineName})
              </label>
            ) : (
              <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.42 0.01 265)" }}>
                설정 → 업스케일 엔진에서 엔진을 하나 설치하면 진짜 업스케일합니다.
              </p>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              disabled={!ready || saving}
              onClick={() => void saveEquirect()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
              style={{ background: "oklch(0.55 0.15 200 / 16%)", color: "oklch(0.78 0.14 200)" }}
            >
              <Save className="h-3.5 w-3.5" /> 보정한 파노라마 저장
            </button>
            <button
              type="button"
              disabled={!ready || saving}
              onClick={() => void saveFaces()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white gradient-primary disabled:opacity-40"
            >
              <Box className="h-3.5 w-3.5" /> {saving ? progress || "만드는 중…" : "여섯 면 만들기"}
            </button>
            {saving && viaEngine && (
              <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.52 0.01 265)" }}>
                업스케일은 되돌릴 수 없어 취소가 안 됩니다. 창을 닫지 말고 기다려 주세요.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
        <Wand2 className="mr-1 inline h-3 w-3" />
        <b>{faceLabel("top", spaceKind)}과 바닥 두 장만 보면</b> 맞았는지 압니다. 하늘이 위쪽 면에 제대로 담기지 않고
        옆면 위로 밀려 있으면 세로 화각이 <b>너무 작은</b> 것이고, 위쪽 면이 밋밋한 색 뚜껑만
        되면 <b>너무 큰</b> 것입니다. 다만 원본에 없는 각도는 만들어 낼 수 없어서, 세로 60도짜리
        그림이라면 나머지 120도는 가장자리 색을 늘여 덮는 것 말고 방법이 없습니다.
        똑바로 올려다보는 컷이 필요하면 처음부터 제대로 된 파노라마를 뽑아야 합니다.
      </p>
    </div>
  );
}

function FacePreview({
  refs,
  spaceKind,
}: {
  refs: React.MutableRefObject<Partial<Record<CompositionCubeFace, HTMLCanvasElement | null>>>;
  spaceKind?: SpaceKind | null;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {FACE_KEYS.map(face => (
        <div key={face} className="space-y-1">
          <canvas
            ref={(element) => { refs.current[face] = element; }}
            className="block w-full rounded"
            style={{ background: "oklch(0.10 0.006 265)", border: "1px solid oklch(1 0 0 / 10%)" }}
          />
          <p className="text-center text-[10px]" style={{ color: "oklch(0.52 0.01 265)" }}>
            {faceLabel(face, spaceKind)}
          </p>
        </div>
      ))}
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  // 손잡이만 있으면 «68 도» 처럼 정확한 값을 다시 맞추기 어렵습니다. 숫자도 함께 둡니다.
  const id = useMemo(() => `slider-${Math.random().toString(36).slice(2)}`, []);
  return (
    <div className="space-y-1" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-14 rounded px-1.5 py-0.5 text-right text-[11px] outline-none"
            style={{ background: "oklch(0.18 0.012 265)", border: "1px solid oklch(1 0 0 / 10%)", color: "white" }}
          />
          <span className="text-[10px]" style={{ color: "oklch(0.52 0.01 265)" }}>{suffix}</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
      <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.42 0.01 265)" }}>{hint}</p>
    </div>
  );
}
