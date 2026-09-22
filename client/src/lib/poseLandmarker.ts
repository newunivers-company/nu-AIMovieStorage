import { ObjectDetector, PoseLandmarker } from "@mediapipe/tasks-vision";
import wasmLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import type { PoseDetector } from "@/lib/motionCapture";

/**
 * 검출기 만들기 — 모션 캡처 창에서 분석을 누를 때만 불러옵니다(`import()`). wasm 이 12 MB 라 구도잡기 첫 화면을 느리게 하면
 * 안 됩니다.
 *
 * wasm·모델은 **앱 안에** 들어 있습니다(인터넷에서 받지 않음). 설치본이 오프라인에서도 돌아야 하고, 구글 CDN 판이 바뀌면 어느 날
 * 갑자기 좌표가 달라질 수 있어서입니다. 모델은 `client/public/models/` 의 `pose_landmarker_full.task`(관절)와
 * `efficientdet_lite0.tflite`(사람 찾기). 둘을 쓰는 까닭은 `PoseDetector` 주석.
 *
 * GPU 로 먼저 만들고, 안 되는 환경(오래된 그래픽 드라이버 등)이면 CPU 로 한 번 더 시도합니다.
 */
export async function createPoseDetector(): Promise<PoseDetector & { close: () => void }> {
  const fileset = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl };
  const build = async (delegate: "GPU" | "CPU") => {
    const landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/pose_landmarker_full.task", delegate },
      runningMode: "IMAGE",
      numPoses: 1,
      // 잘라 낸 한 사람 그림이라 문턱을 낮춰도 엉뚱한 것을 사람으로 보는 일이 적습니다. 반쯤 가려진 사람도 잡게.
      minPoseDetectionConfidence: 0.3,
      minPosePresenceConfidence: 0.3,
    });
    const people = await ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/efficientdet_lite0.tflite", delegate },
      runningMode: "IMAGE",
      categoryAllowlist: ["person"],
      scoreThreshold: 0.3,
      maxResults: 10,
    });
    return {
      people: (frame: HTMLCanvasElement) =>
        people.detect(frame).detections.flatMap((detection) =>
          detection.boundingBox
            ? [
                {
                  x: detection.boundingBox.originX,
                  y: detection.boundingBox.originY,
                  width: detection.boundingBox.width,
                  height: detection.boundingBox.height,
                  score: detection.categories[0]?.score ?? 0,
                },
              ]
            : [],
        ),
      pose: (crop: HTMLCanvasElement) => landmarker.detect(crop),
      close: () => {
        landmarker.close();
        people.close();
      },
    };
  };
  try {
    return await build("GPU");
  } catch (error) {
    console.warn("[모션 캡처] GPU 검출기를 못 만들어 CPU 로 합니다.", error);
    return await build("CPU");
  }
}
