import { useState } from "react";
import { toast } from "sonner";
import { editedStem, fileStem } from "@/lib/mediaLibrary";
import { faceSetImages, faceLabel, faceOf, parseFaceStem, type FaceLike, type FaceSet } from "@/lib/faceSets";
import {
  UPSCALE_ENGINE_CATALOG,
  defaultEngine,
  isUpscaleReady,
  isUpscaleRunning,
  type UpscaleRunOptions,
  upscaleEngineTag,
  upscaleFileToNew,
  upscaleFilesInPlace,
  useUpscaleEngines,
} from "@/lib/upscale";
import type { SpaceKind } from "@/lib/blueprint";

/**
 * 업스케일 단추의 실제 일 — 편집 창(SheetPanelCropper)과 6면 세트 카드가 같이 씁니다(규칙 1).
 *
 * 두 갈래입니다.
 *
 * 낱장 → **새 파일** `<원본>_업스케일_NNN` 을 같은 폴더에. 원본은 그대로 둡니다 —
 * 결과가 마음에 안 들면 지우면 그만이고, 원본을 잃는 일이 없습니다.
 * 편집 창의 «지금 그림 업스케일»(편집 없이 그림만 키우기)이 이것입니다.
 * 세트 → **덮어쓰기**. 여섯 면은 이름이 곧 세트라(`<접두>_<면>_<NNN>`) 새 이름을 주면
 * 세트가 깨집니다. Rust 가 임시 파일에 받은 뒤 바꿔치기하므로 받다가 끊겨도 원본은 남습니다.
 *
 * 편집 창의 «업스케일해서 저장»(자른 뒤 그 자리에서 키우기)은 여기를 거치지 않고
 * `upscaleFilesInPlace` 를 바로 씁니다 — 방금 저장한 파일을 같은 이름에 덮어쓰는 일이라
 * 새 이름을 짓는 이 훅과 규칙이 다릅니다(이유는 SheetPanelCropper 의 `cropStem` 주석).
 *
 * 엔진은 `options.engine`(고른 것) 이 있으면 그것, 없으면 설정의 기본 엔진입니다.
 * 취소는 못 합니다 — 워커에 들어간 일을 되돌리지 않습니다. 단추를 눌렀으면 끝까지.
 */
export function useUpscaleActions({ ownerName, prefix }: { ownerName: string; prefix?: string }) {
  /** 지금 도는 것. 낱장은 파일 경로, 세트는 세트 id 가 열쇠입니다. */
  const [busy, setBusy] = useState<{ key: string; message: string } | null>(null);
  // 엔진 설치 상태를 구독합니다 — 설정 화면에서 엔진을 깔고 돌아오면 바로 단추가 보여야 합니다.
  useUpscaleEngines();
  const enabled = isUpscaleReady();

  const engineName = (options?: UpscaleRunOptions) => {
    const id = options?.engine ?? defaultEngine();
    return id ? UPSCALE_ENGINE_CATALOG[id].name.split(" — ")[0] : "";
  };

  /**
   * 낱장 하나를 새 파일로. 성공하면 `{ path, name }`, 실패하면 null(안내는 여기서 띄웁니다).
   * ref/ 폴더의 `ref_…` 는 결과도 `ref_` 로 시작해야 폴더 읽기가 레퍼런스로 봅니다.
   */
  const upscaleToNew = async (
    image: { filePath?: string; name?: string },
    options: UpscaleRunOptions = {},
  ): Promise<{ path: string; name: string } | null> => {
    if (!image.filePath) {
      toast.error("폴더에 저장된 그림만 업스케일할 수 있습니다.");
      return null;
    }
    // `busy` 는 이 훅(창) 것이라 **다른 창의 작업이 안 보입니다.** 엔진은 앱에 하나뿐이라
    // 겹쳐 돌면 VRAM 을 다투다 죽어서, 앱 전체를 보는 `isUpscaleRunning` 도 함께 봅니다.
    if (busy || isUpscaleRunning()) {
      toast.info("먼저 돌던 업스케일이 끝나면 다시 누르세요.");
      return null;
    }
    const sourceStem = fileStem(image.filePath);
    /*
      이름에 어느 엔진으로 키웠는지 남깁니다 — «냥이_전신_업스케일_SeedVR2_001».
      엔진마다 결과가 달라 나중에 견주려면 파일 이름에 있어야 합니다. 고른 엔진이 없으면 지금 기본 엔진을 씁니다.
    */
    const stem = editedStem({
      prefix: prefix || ownerName,
      sourcePath: image.filePath,
      ownerName,
      action: "업스케일",
      detail: upscaleEngineTag(options.engine ?? defaultEngine()),
    });
    const finalStem = sourceStem.startsWith("ref_") ? `ref_${stem}` : stem;
    const label = image.name || sourceStem;
    const toastId = `upscale:${image.filePath}`;
    const engine = engineName(options);
    setBusy({ key: image.filePath, message: "업스케일 중" });
    toast.loading(`${label} 업스케일 중 (${engine}) — 취소할 수 없습니다`, { id: toastId });
    try {
      const result = await upscaleFileToNew(image.filePath, finalStem, {
        engine: options.engine,
        targetSize: options.target,
        onProgress: (message, percent) => {
          const line = typeof percent === "number" && percent > 0 && percent < 100 ? `${message} ${Math.round(percent)}%` : message;
          setBusy({ key: image.filePath!, message: line });
          toast.loading(`${label} — ${line}`, { id: toastId });
        },
      });
      const name = fileStem(result.path);
      const size = result.width && result.height ? ` ${result.width}×${result.height}` : "";
      const took = result.seconds > 0 ? ` · ${result.seconds < 10 ? result.seconds.toFixed(1) : Math.round(result.seconds)}초` : "";
      toast.success(
        result.engine === "comfy" && result.seedvr2Resolution === null
          ? `${name} 저장 — 워크플로를 그대로 돌렸습니다(SeedVR2 목표 크기는 안 넣음).`
          : `${name} 저장했습니다.${size}${took}`,
        { id: toastId },
      );
      return { path: result.path, name };
    } catch (error) {
      toast.error(`업스케일 실패 — 원본은 그대로입니다. ${String(error)}`, { id: toastId });
      return null;
    } finally {
      setBusy(null);
    }
  };

  /** 세트의 여섯 장을 차례로 덮어씁니다. 하나라도 끝났으면 true(캐시를 깨서 다시 읽게). */
  const upscaleSetInPlace = async <T extends FaceLike>(
    set: FaceSet<T>,
    spaceKind?: SpaceKind | null,
    options: UpscaleRunOptions = {},
  ): Promise<boolean> => {
    if (busy || isUpscaleRunning()) {
      toast.info("먼저 돌던 업스케일이 끝나면 다시 누르세요.");
      return false;
    }
    // 면 이름은 파일에 적힌 토큰(«천장»·«하늘»)이 먼저 — 부르는 쪽이 spaceKind 를 안 넘겨도
    // 세트 카드·파일 이름과 같은 말이 진행 문구에 뜹니다. 토큰이 없을 때만 spaceKind 로 짓습니다.
    const items = faceSetImages(set)
      .filter((image) => image.filePath)
      .map((image) => ({
        path: image.filePath!,
        label: parseFaceStem(fileStem(image.filePath!))?.token ?? faceLabel(faceOf(image) || "front", spaceKind),
      }));
    if (!items.length) {
      toast.error("폴더에 저장된 면이 없습니다.");
      return false;
    }
    const toastId = `upscale:${set.id}`;
    let done = 0;
    setBusy({ key: set.id, message: `업스케일 중 0/${items.length}` });
    toast.loading(`${set.label} 업스케일 시작 (${engineName(options)}) — 취소할 수 없습니다`, { id: toastId });
    try {
      await upscaleFilesInPlace(
        items,
        (message, index) => {
          done = index;
          setBusy({ key: set.id, message });
          // `message` 에 이미 «정면 업스케일 중 1/6 (37%)» 처럼 진행이 들어 있습니다(upscale.ts). 여기서 또 붙이면 두 번 찍힙니다.
          toast.loading(message, { id: toastId });
        },
        { engine: options.engine, targetSize: options.target },
      );
      done = items.length;
      toast.success(`${set.label} — ${items.length}면을 덮어썼습니다.`, { id: toastId });
      return true;
    } catch (error) {
      // 앞서 끝난 면은 이미 덮여 있고, 실패한 면부터는 원본 그대로입니다.
      toast.error(`${done}/${items.length}면까지 덮어쓰고 멈췄습니다. ${String(error)}`, { id: toastId });
      return done > 0;
    } finally {
      setBusy(null);
    }
  };

  return { enabled, busy, upscaleToNew, upscaleSetInPlace };
}
