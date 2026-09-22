/**
 * **막대 그림에서 관절이 잡히는가** — 실측 시험대(헤드리스 크롬에서 돕니다).
 *
 * 사용자 2026-09-21: Sketch2Pose(그리스펜슬 막대 인간 → 리깅 캐릭터) 를 보고
 * 「우리 앱에 적용할 수 있는지 살펴봐」.
 *
 * 우리는 이미 MediaPipe 관절 검출기를 **한 장 모드**(`runningMode: "IMAGE"`)로 들고 있고,
 * 한 장에서 **3D 좌표**(`worldLandmarks`)까지 나옵니다. 그러니 「그림 한 장 → 포즈」 는
 * 새 알고리즘이 아니라 **잇는 일**입니다 — 단, **막대 그림을 사람으로 봐 주느냐**가 걸립니다.
 * 이 모델은 «사람 사진» 으로 배웠기 때문입니다.
 *
 * 그래서 코드를 고치기 전에 먼저 잽니다. 그림을 점점 사람에 가깝게 그려 가며
 * **어디서부터 잡히는지** 를 봅니다.
 *
 * node scripts/runSketchPoseBench.mjs
 */
import { FilesetResolver, ObjectDetector, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LM, type PoseDetector } from "@/lib/motionCapture";

/**
 * **앱 안 검출기와 같은 설정**으로 만듭니다.
 *
 * 앱의 `lib/poseLandmarker.ts` 는 Vite 의 `?url` 로 wasm 을 들여오는데, 이 시험대는 esbuild 로
 * 묶어서 그 길을 못 씁니다(기존 `__retargetBench.ts` 와 같은 사정). 그래서 **같은 파일**을
 * 정적 서버에서 읽어 **같은 모델·같은 문턱값**으로 만듭니다 — 여기서 잡히면 앱에서도 잡힙니다.
 */
async function createPoseDetector(): Promise<PoseDetector> {
  const fileset = await FilesetResolver.forVisionTasks("/mpwasm");
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/pose_landmarker_full.task", delegate: "CPU" },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence: 0.3,
  });
  const people = await ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/efficientdet_lite0.tflite", delegate: "CPU" },
    runningMode: "IMAGE",
    categoryAllowlist: ["person"],
    scoreThreshold: 0.3,
    maxResults: 10,
  });
  return {
    people: (frame: HTMLCanvasElement) =>
      people.detect(frame).detections.flatMap((d) =>
        d.boundingBox
          ? [{
              x: d.boundingBox.originX,
              y: d.boundingBox.originY,
              width: d.boundingBox.width,
              height: d.boundingBox.height,
              score: d.categories[0]?.score ?? 0,
            }]
          : [],
      ),
    pose: (crop: HTMLCanvasElement) => landmarker.detect(crop),
  } as PoseDetector;
}

const W = 512;
const H = 768;

/** 그림 한 장 = 캔버스 하나. 흰 바탕에 검게 그립니다. */
function sheet(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return ctx;
}

/** 서 있는 사람의 관절 자리(화면 좌표). 그림마다 이 뼈대를 공유합니다. */
const J = {
  head: [256, 120],
  neck: [256, 200],
  hipC: [256, 400],
  shL: [196, 220], shR: [316, 220],
  elL: [150, 320], elR: [362, 320],
  wrL: [120, 420], wrR: [392, 420],
  hipL: [222, 400], hipR: [290, 400],
  knL: [212, 560], knR: [300, 560],
  ankL: [206, 700], ankR: [306, 700],
} as const;

function line(ctx: CanvasRenderingContext2D, a: readonly number[], b: readonly number[], width: number) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

const LIMBS: [readonly number[], readonly number[]][] = [
  [J.neck, J.shL], [J.neck, J.shR],
  [J.shL, J.elL], [J.elL, J.wrL],
  [J.shR, J.elR], [J.elR, J.wrR],
  [J.neck, J.hipC],
  [J.hipC, J.hipL], [J.hipC, J.hipR],
  [J.hipL, J.knL], [J.knL, J.ankL],
  [J.hipR, J.knR], [J.knR, J.ankR],
];

/** ① 가장 단순한 막대 인간 — 동그란 머리 + 가는 선. */
function stickThin() {
  const ctx = sheet();
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1], 44, 0, Math.PI * 2);
  ctx.stroke();
  for (const [a, b] of LIMBS) line(ctx, a, b, 4);
  return ctx.canvas;
}

/** ② 굵은 선 막대 인간 — 사람 두께에 가깝게. */
function stickThick() {
  const ctx = sheet();
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1], 46, 0, Math.PI * 2);
  ctx.fill();
  for (const [a, b] of LIMBS) line(ctx, a, b, 26);
  return ctx.canvas;
}

/** ③ 관절에 점을 찍은 막대 인간 — Sketch2Pose 가 기대하는 모양. */
function stickJoints() {
  const canvas = stickThin();
  const ctx = canvas.getContext("2d")!;
  for (const p of Object.values(J)) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 9, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** ④ 채운 실루엣 — 팔다리가 몸에 이어진 한 덩어리. */
function silhouette() {
  const ctx = sheet();
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1], 48, 0, Math.PI * 2);
  ctx.fill();
  for (const [a, b] of LIMBS) line(ctx, a, b, 52);
  // 몸통을 사각으로 채웁니다.
  ctx.fillRect(J.shL[0], J.neck[1], J.shR[0] - J.shL[0], J.hipC[1] - J.neck[1]);
  return ctx.canvas;
}

/** ⑤ 만화풍 — 실루엣에 옷·얼굴 톤을 얹어 «사람 사진» 쪽으로 한 걸음. */
function cartoon() {
  const ctx = sheet();
  ctx.fillStyle = "#e8b48c";                       // 살빛 머리
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1], 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b33";                       // 머리카락
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1] - 12, 48, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#e8b48c";                     // 팔·다리(맨살)
  for (const [a, b] of [[J.elL, J.wrL], [J.elR, J.wrR], [J.knL, J.ankL], [J.knR, J.ankR]] as const)
    line(ctx, a, b, 30);
  ctx.strokeStyle = "#3a5a8c";                     // 옷 (상체·허벅지)
  for (const [a, b] of [[J.shL, J.elL], [J.shR, J.elR], [J.hipL, J.knL], [J.hipR, J.knR]] as const)
    line(ctx, a, b, 40);
  ctx.fillStyle = "#3a5a8c";
  ctx.fillRect(J.shL[0] - 10, J.neck[1], J.shR[0] - J.shL[0] + 20, J.hipC[1] - J.neck[1]);
  // 눈 — 얼굴이라는 신호.
  ctx.fillStyle = "#000000";
  ctx.beginPath(); ctx.arc(238, 128, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(274, 128, 5, 0, Math.PI * 2); ctx.fill();
  return ctx.canvas;
}

/** ⑥ 대조군 — 사용자가 받아 둔 댄스 영상의 한 프레임(진짜 사람 사진). */
async function videoFrame(name: string, at = 3): Promise<HTMLCanvasElement | null> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.src = `/videos/${encodeURIComponent(name)}`;
  const ready = new Promise<boolean>((resolve) => {
    video.onloadeddata = () => resolve(true);
    video.onerror = () => resolve(false);
    setTimeout(() => resolve(false), 20000);
  });
  if (!(await ready)) return null;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = Math.min(at, Math.max(0, video.duration - 0.1));
    setTimeout(resolve, 8000);
  });
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || W;
  canvas.height = video.videoHeight || H;
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** 검출 결과를 사람이 읽을 한 줄로. */
function score(detection: { landmarks: unknown[][]; worldLandmarks: { x: number; y: number; z: number; visibility?: number }[][] }) {
  const world = detection.worldLandmarks?.[0];
  const flat = detection.landmarks?.[0] as { visibility?: number }[] | undefined;
  if (!world?.length || !flat?.length) return null;
  const seen = flat.filter((p) => (p.visibility ?? 0) > 0.5).length;
  // 3D 가 진짜 3D 인가 — z 폭이 0 에 가까우면 납작한 답입니다.
  const zs = world.map((p) => p.z);
  const zSpan = Math.max(...zs) - Math.min(...zs);
  // 키(머리~발목)로 뼈대가 사람 비율인지 봅니다.
  const head = world[LM.nose];
  const ankle = world[LM.leftAnkle];
  const height = head && ankle ? Math.abs(head.y - ankle.y) : 0;
  return { points: world.length, seen, zSpan: +zSpan.toFixed(3), heightM: +height.toFixed(2) };
}

async function main() {
  const out = document.getElementById("out")!;
  const say = (line: string) => {
    out.textContent += line + "\n";
  };
  say("막대 그림에서 관절이 잡히는가 — 실측\n");

  const detector = await createPoseDetector();
  const rows: Record<string, unknown>[] = [];

  /**
   * **막대 그림을 살찌워 봅니다.**
   *
   * 1차 실측에서 가는 선(4px)·굵은 선(26px)·관절 점은 전부 «사람 아님» 이었고, 채운
   * 실루엣(52px + 몸통)과 만화풍만 잡혔습니다. 그러면 「얼마나 굵게 해야 잡히는가」 와
   * 「몸통을 채워야 하는가」 가 갈림길입니다. 그 둘을 훑습니다 — 앱이 사람의 막대 그림을
   * **자동으로 살찌워서** 검출기에 넣을 수 있으면 막대 그림도 되는 셈이니까요.
   */
  const fatten = (limb: number, torso: boolean) => () => {
    const ctx = sheet();
    ctx.beginPath();
    ctx.arc(J.head[0], J.head[1], 48, 0, Math.PI * 2);
    ctx.fill();
    for (const [a, b] of LIMBS) line(ctx, a, b, limb);
    if (torso) ctx.fillRect(J.shL[0], J.neck[1], J.shR[0] - J.shL[0], J.hipC[1] - J.neck[1]);
    return ctx.canvas;
  };

  const cases: [string, () => HTMLCanvasElement | Promise<HTMLCanvasElement | null>][] = [
    ["① 가는 선 4px", stickThin],
    ["③ 관절 점", stickJoints],
    ["살찌움 20px 몸통X", fatten(20, false)],
    ["살찌움 30px 몸통X", fatten(30, false)],
    ["살찌움 40px 몸통X", fatten(40, false)],
    ["살찌움 52px 몸통X", fatten(52, false)],
    ["살찌움 30px 몸통O", fatten(30, true)],
    ["살찌움 40px 몸통O", fatten(40, true)],
    ["살찌움 52px 몸통O", fatten(52, true)],
    ["⑤ 만화풍 인물", cartoon],
  ];

  let clip = "";
  try {
    const list = (await (await fetch("/videos/index.json")).json()) as string[];
    clip = list[0] ?? "";
  } catch {
    /* 영상이 없으면 대조군만 건너뜁니다. */
  }
  if (clip) cases.push([`⑥ 실사 프레임 (${clip.slice(0, 22)}…)`, () => videoFrame(clip)]);

  for (const [label, make] of cases) {
    let note = "";
    let result: ReturnType<typeof score> = null;
    try {
      const canvas = await make();
      if (!canvas) {
        note = "그림을 못 만들었습니다";
      } else {
        /*
          앱과 **같은 길**로 갑니다 — 먼저 사람을 찾고(`people`), 잘라서 관절을 봅니다(`pose`).
          사람을 못 찾으면 그림 전체를 그대로 넣어 한 번 더 봅니다. 「사람 찾기가 막는 것인지
          관절 보기가 막는 것인지」 를 갈라야 고칠 자리를 압니다.
        */
        const boxes = detector.people(canvas);
        note = `사람상자 ${boxes.length}`;
        result = score(detector.pose(canvas) as never);
        if (!result && boxes.length) {
          const box = boxes[0];
          const crop = document.createElement("canvas");
          crop.width = 320;
          crop.height = 320;
          crop.getContext("2d")!.drawImage(
            canvas,
            box.x, box.y, box.width, box.height,
            0, 0, 320, 320,
          );
          result = score(detector.pose(crop) as never);
          if (result) note += " · 잘라서 다시 보니 잡힘";
        }
      }
    } catch (error) {
      note = `오류: ${error instanceof Error ? error.message : String(error)}`;
    }
    rows.push({ label, note, ...(result ?? {}) });
    say(
      result
        ? `  ${label.padEnd(26)} 잡힘 ✔  보이는 관절 ${result.seen}/33 · z폭 ${result.zSpan}m · 키 ${result.heightM}m · ${note}`
        : `  ${label.padEnd(26)} 못 잡음 ✘  ${note}`,
    );
  }

  say("\n끝");
  /*
    ── 끝까지 — 그림에서 **본 회전**이 나오는가 ─────────────────────────
    관절이 잡히는 것과 뼈대로 풀리는 것은 다른 이야기입니다. 앱이 실제로 부르는
    `poseFromImage` 를 그대로 불러, 0 이 아닌 진짜 포즈가 나오는지 봅니다.
  */
  say("");
  say("[끝까지 — 그림 → 본 회전]");
  const { poseFromImage } = await import("@/lib/poseFromImage");
  for (const [label, make] of cases.slice(-3)) {
    try {
      const canvas = await make();
      if (!canvas) {
        say(`  ${label} — 그림 없음`);
        continue;
      }
      const pose = await poseFromImage(canvas);
      const names = Object.keys(pose.bones);
      const moved = names.filter((n) => {
        const r = pose.bones[n];
        return Math.abs(r.x) + Math.abs(r.y) + Math.abs(r.z) > 0.02;
      });
      say(`  ${label} → 본 ${names.length}개 · 돌아간 본 ${moved.length}개 · 관절 ${pose.seen}/33 · 키 ${pose.heightM}m`);
      rows.push({ label: `본:${label}`, bones: names.length, moved: moved.length, seen: pose.seen });
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      say(`  ${label} → 실패: ${why}`);
      rows.push({ label: `본:${label}`, note: why });
    }
  }

  await fetch("/done", { method: "POST", body: JSON.stringify(rows) });
}

void main().catch(async (error) => {
  document.getElementById("out")!.textContent += `\n죽었습니다: ${String(error)}`;
  await fetch("/done", { method: "POST", body: JSON.stringify([{ fatal: String(error) }]) });
});
