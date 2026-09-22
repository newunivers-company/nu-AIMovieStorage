import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MODEL_URLS, modelTemplates } from "@/components/composition/viewport/sceneHelpers";
import { mannequinBody } from "@/lib/rig";
import { createRetargetRig, retargetPerson } from "@/lib/motionRetarget";
import type { CapturePoint, CaptureSample } from "@/lib/motionCapture";
import type { Vector3Value } from "@/lib/composition";

/**
 * **그림 한 장에서 포즈를 읽어 인형에 얹습니다.**
 *
 * 사용자 2026-09-21: Sketch2Pose(그리스펜슬 막대 인간 → 리깅 캐릭터)를 보고 「우리 앱에
 * 적용할 수 있는지 살펴봐」 → 「실측해봐」 → 「순서대로 다 만들어」.
 *
 * # 왜 새로 만들 것이 거의 없나
 *
 * 모캡이 **영상**으로 하던 일을 **한 장**으로 하는 것뿐입니다. 검출기는 이미 한 장 모드
 * (`runningMode: "IMAGE"`)이고, 한 장에서 **3D 좌표**(`worldLandmarks`)까지 나옵니다.
 * 관절 → 본 회전을 푸는 `retargetPerson` 도 **프레임 단위**라 한 장 = 한 프레임입니다.
 *
 * # 실측으로 알아낸 것 (2026-09-21, `scripts/runSketchPoseBench.mjs`)
 *
 * | 그림 | 잡히는가 | 관절 |
 * | --- | --- | --- |
 * | 가는 선 막대 인간 | **못 잡음** | — |
 * | 관절 점 찍은 막대 인간 | **못 잡음** | — |
 * | 살찌움 40px · 몸통 빈 채 | 잡힘 | 24/33 |
 * | 살찌움 40px · 몸통 채움 | 잡힘 | 31/33 |
 * | 만화풍 인물 | 잡힘 | **33/33** |
 * | 실사 사진 | 잡힘 | 28/33 |
 *
 * 그래서 **막대 그림은 이 길로 안 옵니다.** 그쪽은 관절을 손으로 끌게 하는 것이 맞습니다
 * (검출이 필요 없으니 틀릴 일도 없습니다). 사진·만화·실루엣은 잘 잡힙니다.
 *
 * # 움직임이 아니라 «자세» 입니다
 *
 * 받은 것을 타임라인 트랙이 아니라 **캐릭터의 `bonePose`** 로 넣습니다. 한 장에는 시간이
 * 없어서 트랙을 만들 수가 없고, 사람이 원하는 것도 「이 포즈로 세워 줘」 이지 「움직여 줘」
 * 가 아닙니다. 넣은 뒤에 K 로 자세 키를 찍으면 그때부터 움직임이 됩니다.
 */

/** 이 길로 읽은 한 장의 결과. */
export interface PoseFromImage {
  /** 관절마다의 회전 — `CharacterComposition.bonePose` 와 같은 모양. */
  bones: Record<string, Vector3Value>;
  /** 33점 중 **또렷하게 보인** 관절 수. 낮으면 사람이 결과를 못 믿어도 됩니다. */
  seen: number;
  /** 잰 키(m). 0.9~2.1 을 벗어나면 뼈대를 잘못 읽은 것입니다. */
  heightM: number;
}

/** 사람이 결과를 믿어도 되는 최소선. 실측에서 «반쪽만 본» 경우가 15/33 이었습니다. */
const MIN_SEEN = 20;

async function loadTemplate(gender?: string): Promise<THREE.Object3D> {
  const url = MODEL_URLS[mannequinBody(gender)];
  const cached = modelTemplates.get(url);
  if (cached) return cached;
  const gltf = await new GLTFLoader().loadAsync(url);
  modelTemplates.set(url, gltf.scene);
  return gltf.scene;
}

const toPoints = (list: { x: number; y: number; z: number; visibility?: number }[]): CapturePoint[] =>
  list.map((p) => ({ x: p.x, y: p.y, z: p.z, v: p.visibility ?? 1 }));

/**
 * 그림(또는 캔버스) 하나를 읽습니다.
 *
 * 검출기는 **부를 때 받습니다**(`import()`) — wasm 이 12 MB 라 구도잡기 첫 화면을
 * 느리게 하면 안 됩니다. 모캡이 쓰는 그 검출기와 **같은 것**이라, 여기서 잡히면
 * 거기서도 잡힙니다.
 */
export async function poseFromImage(
  source: HTMLCanvasElement | HTMLImageElement,
  gender?: string,
): Promise<PoseFromImage> {
  const canvas =
    source instanceof HTMLCanvasElement ? source : drawToCanvas(source);

  const { createPoseDetector } = await import("@/lib/poseLandmarker");
  const detector = await createPoseDetector();
  try {
    /*
      **그림 전체를 먼저 봅니다.**

      모캡은 영상에 사람이 여럿이라 «사람 찾기 → 잘라서 관절» 로 갑니다. 한 장짜리는
      대개 사람 하나가 화면을 채우므로 통째로 보는 편이 낫습니다 — 실측에서 만화풍 그림은
      사람 찾기가 **0개**를 돌려주는데도 관절은 33/33 으로 잡혔습니다. 잘라 넣었으면
      통째로 놓쳤을 것입니다.

      통째로 못 잡았을 때만 사람 상자로 잘라 한 번 더 봅니다(멀리 선 사람 대비).
    */
    let detection = detector.pose(canvas);
    if (!detection.worldLandmarks?.[0]?.length) {
      const box = detector.people(canvas)[0];
      if (box) detection = detector.pose(cropTo(canvas, box));
    }
    const world = detection.worldLandmarks?.[0];
    const image = detection.landmarks?.[0];
    if (!world?.length || !image?.length) {
      throw new Error(
        "이 그림에서 사람을 찾지 못했습니다. 막대 인간은 못 읽습니다 — 몸에 두께가 있는 그림이나 사진을 넣거나, 관절을 손으로 잡아 주세요.",
      );
    }

    const seen = image.filter((p) => (p.visibility ?? 0) > 0.5).length;
    const sample: CaptureSample = {
      time: 0,
      image: toPoints(image),
      world: toPoints(world),
    };
    const rig = createRetargetRig(await loadTemplate(gender));
    /*
      **가장 약하게 다듬습니다.** 한 장뿐이라 이웃한 프레임이 없어 어차피 섞일 것이 없고,
      센 값을 주면 그 한 장을 «자기 자신과» 섞어 결과만 흐려집니다. 발 고정도 같은 까닭으로 끕니다.
    */
    const frames = retargetPerson(rig, { number: 1, samples: [sample] }, {
      width: canvas.width,
      height: canvas.height,
    }, { smoothing: "light", footPlant: false });

    const frame = frames[0];
    if (!frame) throw new Error("관절은 찾았는데 뼈대로 풀지 못했습니다.");

    const head = world[0];
    const ankle = world[27];
    const heightM = head && ankle ? Math.abs(head.y - ankle.y) : 0;
    if (seen < MIN_SEEN) {
      throw new Error(
        `사람은 찾았지만 관절이 ${seen}/33 밖에 안 보입니다. 온몸이 다 나오고 팔다리가 겹치지 않은 그림이라야 합니다.`,
      );
    }
    return { bones: frame.bones, seen, heightM: +heightM.toFixed(2) };
  } finally {
    detector.close?.();
  }
}

function drawToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("그림을 읽을 자리를 만들지 못했습니다.");
  /*
    **흰 바탕을 먼저 깝니다.** 투명한 PNG(사람이 배경을 지운 그림)를 그대로 넣으면 검은
    바탕이 되어 몸과 구분이 안 갑니다 — 실측에서 검은 실루엣이 검은 바탕에 묻혔습니다.
  */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropTo(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  // 상자에 딱 맞춰 자르면 손발이 잘립니다. 조금 넉넉히 뗍니다.
  const pad = Math.max(box.width, box.height) * 0.12;
  const out = document.createElement("canvas");
  out.width = 320;
  out.height = 320;
  out.getContext("2d")!.drawImage(
    canvas,
    box.x - pad,
    box.y - pad,
    box.width + pad * 2,
    box.height + pad * 2,
    0,
    0,
    320,
    320,
  );
  return out;
}
