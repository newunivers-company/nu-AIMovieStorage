import { useRef, useState } from "react";
import { toast } from "sonner";
import type { VideoFrameRenderer } from "@/components/composition/CompositionViewport";
import { SHOT_PRESETS, type CameraMove } from "@/lib/cameraMoves";
import {
  isReferenceVideoSupported,
  renderReferenceVideo,
  splitParts,
} from "@/lib/referenceVideo";
import { saveProjectMediaAsset } from "@/lib/mediaLibrary";
import type { CompositionTimeline } from "@/lib/composition";

/**
 * 레퍼런스 영상(MP4) 만들기.
 *
 * 렌더 상태는 `CompositionPlanner` 가 부르는 이 훅에 있습니다. 타임라인 탭이
 * 들고 있으면 렌더 도중 다른 탭으로 갔다 올 때 진행 표시와 취소 단추가
 * 사라져 버립니다.
 */
export function useReferenceVideo({
  captureFormat,
  timeline,
  cameraMove,
  projectName,
  sceneTitle,
  cutOrder,
  onVideoSaved,
  onRendered,
  setPlaying,
  setPreviewing,
}: {
  captureFormat: { width: number; height: number };
  timeline: CompositionTimeline;
  cameraMove: CameraMove | null;
  projectName?: string;
  sceneTitle?: string;
  cutOrder?: number;
  /**
   * 영상을 저장하면 **컷에 경로와 길이를 적어 둡니다.**
   *
   * 예전에는 만들어 폴더에 넣고 끝이라, 컷은 그 영상이 있는지도
   * 몰랐습니다. 적어 두면 「이 컷을 영상으로」 가 그대로 집어 올립니다.
   */
  onVideoSaved?: (path: string, seconds: number) => void;
  /**
   * 뽑은 영상을 **구도의 목록**에 담습니다().
   * 조각으로 나눠 뽑아도 조각마다 한 줄씩 담깁니다 — 컷에 적히는 것은 통째로 뽑은 한 편뿐이지만, 조각도 쓸 자리가 있습니다.
   */
  onRendered?: (render: { path: string; seconds: number; part?: string }) => void;
  setPlaying: (value: boolean) => void;
  setPreviewing: (value: boolean) => void;
}) {
  const videoRendererRef = useRef<VideoFrameRenderer | null>(null);
  const renderAbortRef = useRef<AbortController | null>(null);
  // 진행률은 상태로 두지 않습니다.
  // 프레임마다 setState 를 하면 그때마다 이 컴포넌트가 리렌더되고,
  // 3D 씬 이펙트가 다시 돌면서 GLB 믹서가 정리됩니다.
  // 렌더링 시작/종료만 상태로 두고 숫자는 DOM 에 직접 씁니다.
  const [videoRendering, setVideoRendering] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  const paintProgress = (done: number, total: number) => {
    if (progressBarRef.current)
      progressBarRef.current.style.width = `${(done / Math.max(1, total)) * 100}%`;
    if (progressTextRef.current)
      progressTextRef.current.textContent = `${done} / ${total} 프레임`;
  };

  /**
   * `splitSeconds` 를 주면 **그 길이로 정확히 잘라** 여러 파일로 뽑습니다(마지막 조각만 남은 길이).
   *
   *
   *
   * 조각의 경계는 **프레임 번호**로 나눕니다(초를 더해 가면 부동소수 오차로 조각마다 한 프레임씩 밀리거나 겹칩니다). 조각 k 의
   * i 번째 프레임 = 전체의 k×조각프레임+i 번째 — 이어 붙이면 통째로 뽑은 것과 프레임 하나 틀리지 않습니다.
   */
  const renderReference = async (
    /** 조각 길이(초) 또는 **자를 시각들**(초, 노래 구간 경계). null 이면 통째로. */
    splitSeconds: number | number[] | null = null,
  ) => {
    const frameRenderer = videoRendererRef.current;
    if (!frameRenderer) {
      toast.error("3D 화면이 준비되지 않았습니다.");
      return;
    }
    if (!isReferenceVideoSupported()) {
      toast.error("이 환경에서는 영상 인코딩을 쓸 수 없습니다.");
      return;
    }

    // 미리보기 루프가 같은 캔버스를 만지면 프레임이 섞입니다.
    setPlaying(false);
    setPreviewing(false);

    const controller = new AbortController();
    renderAbortRef.current = controller;
    setVideoRendering(true);

    const fps = Math.max(1, Math.round(timeline.fps));
    const totalFrames = Math.max(1, Math.round(timeline.duration * fps));
    /*
      조각을 **프레임 번호의 구간**으로 미리 정합니다. 길이로 나누든(5초씩) 노래 구간으로 나누든 뒤 코드가 같아집니다.
      초를 더해 가며 자르면 조각마다 한 프레임씩 밀립니다(부동소수 오차).
    */
    const parts = splitParts(splitSeconds, totalFrames, fps);
    const partCount = parts.length;
    const saved: string[] = [];

    try {
      frameRenderer.begin(captureFormat.width, captureFormat.height);
      for (let part = 0; part < partCount; part += 1) {
        const { firstFrame, frames } = parts[part];
        const { blob, frameCount } = await renderReferenceVideo({
          width: captureFormat.width,
          height: captureFormat.height,
          fps,
          duration: frames / fps,
          signal: controller.signal,
          drawFrame: (_time, index) => {
            // 렌더 도중에 3D 씬이 다시 만들어지면 지금 그리는 캔버스는 이미 버려진 것입니다.
            // 조용히 깨진 영상을 만드는 대신 바로 멈춥니다.
            if (videoRendererRef.current !== frameRenderer) {
              throw new Error(
                "렌더 도중 3D 화면이 다시 만들어졌습니다. 다시 시도해 주세요.",
              );
            }
            frameRenderer.drawAt((firstFrame + index) / fps);
            return frameRenderer.canvas;
          },
          // 진행 표시는 전체 기준 — 조각마다 0 으로 돌아가면 얼마나 남았는지 모릅니다.
          onProgress: (done) => paintProgress(firstFrame + done, totalFrames),
        });

        const shot = cameraMove
          ? SHOT_PRESETS.find((preset) => preset.id === cameraMove.shotId)
              ?.label
          : null;
        const fileName =
          [
            sceneTitle || "Scene",
            `cut${String(cutOrder ?? 1).padStart(2, "0")}`,
            shot || "reference",
            // 조각 이름에 번호와 구간(초)을 적어 둡니다 — 생성기에 넣을 때 순서·자리를 파일 이름만 보고 압니다.
            ...(partCount > 1
              ? [
                  `part${String(part + 1).padStart(2, "0")}`,
                  `${formatSeconds(firstFrame / fps)}-${formatSeconds((firstFrame + frames) / fps)}`,
                ]
              : []),
          ]
            .join("_")
            .replace(/\s+/g, "") + ".mp4";
        const file = new File([blob], fileName, { type: "video/mp4" });

        let savedPath: string | null = null;
        if (projectName?.trim()) {
          const saved = await saveProjectMediaAsset(file, {
            projectName,
            assetType: "composition-video",
            ownerName: sceneTitle || "Reference",
          });
          savedPath = saved?.path ?? null;
        }

        if (savedPath) {
          saved.push(savedPath);
          onRendered?.({
            path: savedPath,
            seconds: frameCount / fps,
            part: partCount > 1 ? `${part + 1}/${partCount}` : undefined,
          });
          /*
          컷에 적는 영상은 **통째로 뽑았을 때만**입니다 — 컷 하나에 영상 경로는 하나라, 조각 중 하나를 적으면 «이 컷을 영상으로» 가
          앞 14 초만 집어 갑니다. 조각은 폴더에 남기고 이름으로 고릅니다.
        */
          if (partCount === 1) {
            // 길이는 프레임 수 ÷ fps — 생성기에 넣을 러닝타임이 됩니다.
            onVideoSaved?.(savedPath, frameCount / fps);
            toast.success(
              `레퍼런스 영상을 저장했습니다 · ${frameCount}프레임`,
              {
                description: savedPath,
              },
            );
          }
        } else {
          // 프로젝트 폴더가 없으면 브라우저 다운로드로 내려받습니다.
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          if (partCount === 1)
            toast.success(`레퍼런스 영상을 만들었습니다 · ${frameCount}프레임`);
        }
      }
      if (partCount > 1)
        toast.success(
          `레퍼런스 영상 ${partCount}조각을 만들었습니다 · ${formatSeconds(parts[0].frames / fps)}~${formatSeconds(parts[partCount - 1].frames / fps)}`,
          {
            description: saved.length
              ? saved[0].replace(/[^\/]+$/, "")
              : undefined,
          },
        );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        toast.info("영상 만들기를 취소했습니다.");
      else
        toast.error(
          `영상을 만들지 못했습니다. ${error instanceof Error ? error.message : String(error)}`,
        );
    } finally {
      frameRenderer.end();
      renderAbortRef.current = null;
      setVideoRendering(false);
    }
  };

  return {
    videoRendererRef,
    renderAbortRef,
    videoRendering,
    progressBarRef,
    progressTextRef,
    renderReference,
  };
}

/** 파일 이름용 초 — «14»·«1m30» 처럼 짧게(소수는 한 자리). */
function formatSeconds(seconds: number) {
  const rounded = Math.round(seconds * 10) / 10;
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const rest = Math.round((rounded - minutes * 60) * 10) / 10;
  return rest ? `${minutes}m${rest}s` : `${minutes}m`;
}

export type PlannerVideoRender = ReturnType<typeof useReferenceVideo>;
