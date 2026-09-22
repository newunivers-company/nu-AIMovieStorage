import { ArrowUpFromLine } from "lucide-react";
import { safeFileName } from "@/lib/mediaLibrary";
import {
  UPSCALE_TARGET_OPTIONS,
  availableEngines,
  isStretchedTarget,
  type UpscaleEngineId,
  type UpscaleTarget,
} from "@/lib/upscale";
import type { useUpscaleActions } from "@/components/project/useUpscaleActions";

/**
 * **업스케일 판** — 저장할 때 함께 키울지, 그리고 «지금 그림만» 키우는 길.
 *
 * 2026-09-18 에 `SheetPanelCropper.tsx` 에서 떼어 냈습니다. 자르기와는 별개의 일이라
 * (자르지 않고 원본만 키울 수도 있습니다) 목록 판과 섞여 있으면 「저장을 누르면 무엇이
 * 생기는가」 가 흐려집니다.
 */
export default function CropperSavePanel({
  activeEngine,
  engineChoice,
  setEngineChoice,
  installedEngines,
  targetSize,
  setTargetSize,
  upscaleOn,
  setUpscaleOn,
  noteLongEdge,
  reachNote,
  saving,
  sourceSize,
  sourcePath,
  upscaleSourceNow,
  upscaler,
  prefix,
}: {
  /** 지금 쓸 엔진. 하나도 안 깔려 있으면 null 이고 판이 안내문만 냅니다. */
  activeEngine: UpscaleEngineId | null;
  engineChoice: UpscaleEngineId | "";
  setEngineChoice: (next: UpscaleEngineId | "") => void;
  installedEngines: ReturnType<typeof availableEngines>;
  targetSize: UpscaleTarget;
  setTargetSize: (next: UpscaleTarget) => void;
  upscaleOn: boolean;
  setUpscaleOn: (next: boolean) => void;
  /** 지금 설정으로 나올 긴 변(px). 없으면 아직 원본 크기를 못 읽은 것입니다. */
  noteLongEdge: number | null;
  reachNote: string | null;
  saving: boolean;
  sourceSize: { width: number; height: number } | null;
  /** 원본 파일 경로. 없으면 «지금 그림만 키우기» 가 안 보입니다. */
  sourcePath?: string;
  upscaleSourceNow: () => Promise<void>;
  upscaler: ReturnType<typeof useUpscaleActions>;
  prefix: string;
}) {
  return (
      <div
        className="space-y-2 pt-2"
        style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}
        data-tour="cropper-upscale"
      >
        <p
          className="flex items-center gap-1.5 text-[10px] font-semibold"
          style={{ color: "oklch(0.62 0.01 265)" }}
        >
          <ArrowUpFromLine className="h-3 w-3" /> 업스케일
        </p>

        {installedEngines.length === 0 ? (
          <p
            className="text-[10px] leading-relaxed"
            style={{ color: "oklch(0.50 0.01 265)" }}
          >
            설치된 업스케일 엔진이 없습니다. <b>설정 → 업스케일 엔진</b>{" "}
            에서 하나를 설치하면 여기서 자른 칸을 그 자리에서 키워
            저장할 수 있습니다.
          </p>
        ) : (
          <>
            <label
              className="flex items-start gap-2 text-[11px] leading-snug"
              style={{ color: "oklch(0.78 0.01 265)" }}
            >
              <input
                type="checkbox"
                checked={upscaleOn}
                onChange={(event) => setUpscaleOn(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              <span>
                <b>업스케일해서 저장</b>
                <span
                  className="block text-[10px]"
                  style={{ color: "oklch(0.50 0.01 265)" }}
                >
                  저장한 파일을 그 자리에서 키웁니다(같은 이름에
                  덮어쓰기). 취소할 수 없습니다.
                </span>
              </span>
            </label>

            <label
              className="flex items-center gap-2 text-[10px]"
              style={{ color: "oklch(0.55 0.01 265)" }}
            >
              엔진
              <select
                value={engineChoice}
                onChange={(event) =>
                  setEngineChoice(
                    event.target.value as UpscaleEngineId | "",
                  )
                }
                className="min-w-0 flex-1 rounded px-1.5 py-1 text-[10px] outline-none"
                style={{
                  background: "oklch(0.18 0.012 265)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  color: "oklch(0.85 0.005 265)",
                }}
              >
                <option value="">설정의 기본 엔진</option>
                {installedEngines.map((engine) => (
                  <option key={engine.id} value={engine.id}>
                    {engine.name}
                    {engine.experimental ? " (실험)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-4 gap-1">
              {UPSCALE_TARGET_OPTIONS.map((option) => {
                // 고른 엔진이 이 크기를 «진짜로» 만들 수 있는지. 못 하면 별표 — 그 위는 그냥 늘린 그림입니다.
                const stretched = activeEngine
                  ? isStretchedTarget(
                      activeEngine,
                      option.id,
                      noteLongEdge,
                    )
                  : false;
                const on = targetSize === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTargetSize(option.id)}
                    title={
                      stretched
                        ? "이 엔진에서는 여기까지 진짜로 못 키웁니다 — 늘린 그림이 됩니다"
                        : undefined
                    }
                    className="rounded px-1 py-1 text-[10px] font-semibold"
                    style={
                      on
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
                className="text-[10px] leading-snug"
                style={{ color: "oklch(0.72 0.14 60)" }}
              >
                {reachNote}
              </p>
            )}

            {/*
            편집 없이 그림만 키우기. 결과는 원본 옆에 «…_업스케일_NNN» 새 파일이고 원본은 남습니다 —
            덮어쓰는 «업스케일해서 저장» 과 성격이 달라 이름도 갈립니다(위 eraseStem/cropStem 주석).
          */}
            <button
              type="button"
              onClick={() => void upscaleSourceNow()}
              disabled={!sourcePath || Boolean(upscaler.busy) || saving}
              data-tour="cropper-upscale-now"
              title={
                sourcePath
                  ? "지금 보고 있는 그림을 그대로 키워 원본 옆에 새 파일로 둡니다. 취소할 수 없습니다."
                  : "폴더에 저장된 그림만 키울 수 있습니다."
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold disabled:opacity-35"
              style={{
                background: "oklch(1 0 0 / 6%)",
                color: "oklch(0.80 0.14 200)",
              }}
            >
              <ArrowUpFromLine className="h-3 w-3" />
              {upscaler.busy
                ? upscaler.busy.message
                : "지금 그림 업스케일 — 새 파일로"}
            </button>
            <p
              className="text-[10px] leading-snug"
              style={{ color: "oklch(0.45 0.01 265)" }}
            >
              편집하지 않고 이 그림만 키웁니다. 원본은 그대로 두고 «
              {safeFileName(prefix)}_…_업스케일_NNN» 이 옆에 생깁니다
              {sourceSize
                ? ` (지금 ${sourceSize.width}×${sourceSize.height})`
                : ""}
              .
            </p>
          </>
        )}
      </div>
  );
}
