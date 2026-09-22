import * as THREE from "three";
import type { CompositionState, MotionKey, MotionTrack, Vector3Value } from "@/lib/composition";
import { motionTracksOf } from "@/lib/compositionEdit";
import { EDITABLE_BONES } from "@/lib/rig";

/**
 * **모캡 키 다듬기** — 캐릭터에 들어간 촘촘한 키(초당 30장)에서 «너무 흔들리는 키» 를 찾아 자연스럽게 잇습니다.
 *
 * , 「보간 기능은 캐릭터마다 버튼이 있는 거야」.
 *
 * 분석 단계의 튐 보정(`motionRepair`)은 **좌표**를 봅니다. 여기는 이미 들어간 **키(회전·자리)** 를 봅니다 — 넣은 뒤에 사람이 손으로
 * 고친 키, 다른 영상에서 이어 넣은 경계, 리타깃에서 생긴 비틀림까지 여기서 잡힙니다.
 *
 * # 무엇을 «흔들림» 으로 보나
 *
 * 키 하나가 앞 키와 뒤 키를 이은 선(회전은 구면 보간)에서 얼마나 벗어났는지(편차)를 잽니다. 편차가 크다는 것만으로는 부족합니다 —
 * 춤의 «탁 끊는 동작» 도 편차가 큽니다. 그래서 둘 중 하나일 때만 걸립니다.
 *
 * - **지그재그** — 이웃한 키의 편차 방향이 서로 반대(앞으로 튀었다 뒤로 튐). 사람 몸은 1/30 초마다 방향을 뒤집지 못합니다.
 * - **외톨이 튐** — 편차가 기준의 2.5 배를 넘는데 양옆 키는 조용함.
 *
 * 기준은 그 관절의 **평소 편차(중앙값)** 에 비례합니다 — 원래 많이 움직이는 손목과 거의 안 움직이는 골반을 같은 숫자로 재면
 * 손목만 온통 걸립니다.
 */

export type CleanupSensitivity = "low" | "normal" | "high";

export interface CleanupIssue {
  /** 결정(AI 답)과 짝지을 이름표. */
  id: string;
  channel: "position" | "rotation" | "pose";
  /** 자세 트랙이면 관절 이름. */
  bone?: string;
  from: number;
  to: number;
  /** 걸린 키 수. */
  keys: number;
  /** 기준 대비 가장 큰 편차(1 = 기준과 같음). */
  severity: number;
  kind: "jitter" | "spike";
  /** 편차 최댓값 — 회전은 도, 자리는 cm. 사람·AI 에게 보이는 숫자. */
  peak: number;
  /** 그 구간 앞뒤 0.5 초의 가장 빠른 움직임 — 회전은 도/초, 자리는 cm/초. «원래 빠른 동작인가» 를 AI 가 가릴 재료. */
  speed: number;
}

export interface CleanupDecision {
  id: string;
  action: "smooth" | "keep";
  /** 0~1. 클수록 넓게·세게 잇습니다. */
  strength: number;
  reason?: string;
}

const SENSITIVITY: Record<CleanupSensitivity, { k: number; floor: number }> = {
  low: { k: 8, floor: 1.4 },
  normal: { k: 6, floor: 1 },
  high: { k: 4, floor: 0.7 },
};

/** 채널별 절대 최소 편차 — 이 밑의 흔들림은 화면에서 안 보입니다. */
const ABS_MIN = { pose: THREE.MathUtils.degToRad(6), rotation: THREE.MathUtils.degToRad(5), position: 0.025 };

const quatOf = (value: Vector3Value) => new THREE.Quaternion().setFromEuler(new THREE.Euler(value.x, value.y, value.z, "XYZ"));
const eulerOf = (q: THREE.Quaternion): Vector3Value => {
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  return { x: round4(e.x), y: round4(e.y), z: round4(e.z) };
};
const round4 = (value: number) => Math.round(value * 1e4) / 1e4;
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** 한 줄(관절 하나·자리·몸 방향)의 값들 — 회전은 쿼터니언, 자리는 벡터. */
type Series =
  | { kind: "quat"; times: number[]; values: THREE.Quaternion[] }
  | { kind: "vec"; times: number[]; values: THREE.Vector3[] };

/** 키마다 «앞뒤를 이은 선에서 벗어난 양» 과 그 방향(3D). 첫·끝 키와 틈(0.25 초 넘음) 옆은 0. */
function deviations(series: Series) {
  const count = series.times.length;
  const size = new Array<number>(count).fill(0);
  const dir: THREE.Vector3[] = Array.from({ length: count }, () => new THREE.Vector3());
  for (let i = 1; i < count - 1; i += 1) {
    const t0 = series.times[i - 1];
    const t1 = series.times[i];
    const t2 = series.times[i + 1];
    if (t2 - t0 > 0.25 || t2 - t0 <= 1e-6) continue;
    const t = (t1 - t0) / (t2 - t0);
    if (series.kind === "quat") {
      const expected = series.values[i - 1].clone().slerp(series.values[i + 1], t);
      const delta = expected.clone().invert().multiply(series.values[i]);
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
      const angle = 2 * Math.acos(Math.min(1, delta.w));
      size[i] = angle;
      const s = Math.sqrt(Math.max(0, 1 - delta.w * delta.w));
      if (s > 1e-6) dir[i].set(delta.x / s, delta.y / s, delta.z / s).multiplyScalar(angle);
    } else {
      const expected = series.values[i - 1].clone().lerp(series.values[i + 1], t);
      dir[i] = series.values[i].clone().sub(expected);
      size[i] = dir[i].length();
    }
  }
  return { size, dir };
}

/** 그 시각 앞뒤 0.5 초 안의 가장 빠른 변화(초당). */
function peakSpeed(series: Series, from: number, to: number) {
  let best = 0;
  for (let i = 1; i < series.times.length; i += 1) {
    const t = series.times[i];
    if (t < from - 0.5 || t > to + 0.5) continue;
    const dt = t - series.times[i - 1];
    if (dt <= 0 || dt > 0.25) continue;
    const change =
      series.kind === "quat" ? series.values[i - 1].angleTo(series.values[i]) : series.values[i - 1].distanceTo(series.values[i]);
    best = Math.max(best, change / dt);
  }
  return best;
}

/** 캐릭터 한 명의 줄들을 풉니다. 촘촘한(평균 0.1 초 이하 간격, 8 키 이상) 줄만 — 손으로 찍은 성긴 키는 건드리지 않습니다. */
function seriesOf(tracks: MotionTrack[]) {
  const out: { channel: CleanupIssue["channel"]; bone?: string; series: Series }[] = [];
  const dense = (keys: MotionKey[]) =>
    keys.length >= 8 && (keys[keys.length - 1].time - keys[0].time) / (keys.length - 1) <= 0.105;
  for (const track of tracks) {
    if (track.muted) continue;
    const keys = [...track.keys].sort((a, b) => a.time - b.time);
    if (!dense(keys)) continue;
    const times = keys.map((key) => key.time);
    if (track.channel === "pose") {
      const bones = new Set(keys.flatMap((key) => Object.keys(key.bones ?? {})));
      for (const bone of bones) {
        const zero = { x: 0, y: 0, z: 0 };
        const values = keys.map((key) => quatOf(key.bones?.[bone] ?? zero));
        // 이웃끼리 같은 반구로 맞춥니다(q 와 −q 는 같은 회전) — 안 맞추면 편차가 헛 커집니다.
        for (let i = 1; i < values.length; i += 1) if (values[i].dot(values[i - 1]) < 0) values[i].set(-values[i].x, -values[i].y, -values[i].z, -values[i].w);
        out.push({ channel: "pose", bone, series: { kind: "quat", times, values } });
      }
    } else if (track.channel === "position" || track.channel === "rotation") {
      out.push({
        channel: track.channel,
        series: { kind: "vec", times, values: keys.map((key) => new THREE.Vector3(key.value.x, key.value.y, key.value.z)) },
      });
    }
  }
  return out;
}

/** 캐릭터의 트랙들에서 흔들림 구간을 찾습니다. */
export function analyzeMotion(tracks: MotionTrack[], sensitivity: CleanupSensitivity = "normal"): CleanupIssue[] {
  const rule = SENSITIVITY[sensitivity];
  const issues: CleanupIssue[] = [];
  for (const { channel, bone, series } of seriesOf(tracks)) {
    const { size, dir } = deviations(series);
    const scale = median(size.filter((value) => value > 0));
    const threshold = Math.max(scale * rule.k, ABS_MIN[channel] * rule.floor);
    const flagged: { index: number; kind: CleanupIssue["kind"] }[] = [];
    for (let i = 1; i < size.length - 1; i += 1) {
      if (size[i] <= threshold) continue;
      const zigzag = [i - 1, i + 1].some(
        (j) => size[j] > threshold * 0.5 && dir[i].dot(dir[j]) < -0.3 * size[i] * size[j],
      );
      const lone = size[i] > threshold * 2.5 && size[i - 1] < threshold && size[i + 1] < threshold;
      if (zigzag) flagged.push({ index: i, kind: "jitter" });
      else if (lone) flagged.push({ index: i, kind: "spike" });
    }
    // 가까운 것끼리(3 키 안) 한 구간으로.
    let group: typeof flagged = [];
    const close = () => {
      if (!group.length) return;
      const first = group[0].index;
      const last = group[group.length - 1].index;
      const peak = Math.max(...group.map((item) => size[item.index]));
      const from = series.times[first];
      const to = series.times[last];
      issues.push({
        id: `${channel}${bone ? `:${bone}` : ""}@${from.toFixed(2)}`,
        channel,
        bone,
        from,
        to,
        keys: group.length,
        severity: round4(peak / threshold),
        kind: group.some((item) => item.kind === "jitter") ? "jitter" : "spike",
        peak: round4(channel === "position" ? peak * 100 : THREE.MathUtils.radToDeg(peak)),
        speed: round4(
          channel === "position" ? peakSpeed(series, from, to) * 100 : THREE.MathUtils.radToDeg(peakSpeed(series, from, to)),
        ),
      });
      group = [];
    };
    for (const item of flagged) {
      if (group.length && item.index - group[group.length - 1].index > 3) close();
      group.push(item);
    }
    close();
  }
  return issues.sort((a, b) => a.from - b.from);
}

/**
 * 결정대로 잇습니다. 구간의 키(앞뒤 한 키씩 넓혀)를 **걸리지 않은 이웃 키들의 가우스 가중 평균**으로 바꿉니다.
 *
 * 선을 곧게 긋지(선형 보간) 않는 까닭: 춤 도중의 흔들림 구간을 곧은 선으로 이으면 그 동안만 로봇처럼 멈칫합니다. 이웃들의 평균은
 * 앞뒤 움직임의 흐름(곡선)을 이어 줍니다. 세기(0~1)가 클수록 더 멀리까지 이웃을 봅니다.
 */
export function applyCleanup(tracks: MotionTrack[], issues: CleanupIssue[], decisions: CleanupDecision[]) {
  const decided = new Map(decisions.map((item) => [item.id, item]));
  let changed = 0;
  const next = tracks.map((track) => {
    if (track.muted) return track;
    const mine = issues.filter((issue) => {
      const decision = decided.get(issue.id);
      if (!decision || decision.action !== "smooth") return false;
      return track.channel === "pose" ? issue.channel === "pose" : issue.channel === track.channel;
    });
    if (!mine.length) return track;
    const keys = [...track.keys].sort((a, b) => a.time - b.time).map((key) => ({ ...key, bones: key.bones ? { ...key.bones } : key.bones }));
    const times = keys.map((key) => key.time);
    const indexOf = (time: number) => times.findIndex((t) => Math.abs(t - time) < 1e-6);

    const smoothRange = (
      issue: CleanupIssue,
      read: (key: MotionKey) => THREE.Quaternion | THREE.Vector3,
      write: (key: MotionKey, value: THREE.Quaternion | THREE.Vector3) => void,
    ) => {
      const decision = decided.get(issue.id)!;
      const strength = Math.min(1, Math.max(0, decision.strength));
      const a = Math.max(0, indexOf(issue.from) - 1);
      const b = Math.min(keys.length - 1, indexOf(issue.to) + 1);
      if (indexOf(issue.from) < 0 || indexOf(issue.to) < 0) return;
      const sigma = 1 + strength * 3;
      const reach = Math.ceil(sigma * 3);
      const originals = keys.map(read);
      for (let i = a; i <= b; i += 1) {
        let weight = 0;
        let quat: THREE.Quaternion | null = null;
        let vec: THREE.Vector3 | null = null;
        for (let j = i - reach - (b - a); j <= i + reach + (b - a); j += 1) {
          if (j < 0 || j >= keys.length || Math.abs(times[j] - times[i]) > 1) continue;
          // 걸린 구간 안의 키는 평균에 넣지 않습니다(흔들림이 평균을 끌어당기지 않게). 구간 밖 이웃만.
          if (j >= a + 1 && j <= b - 1) continue;
          const distance = Math.abs(j - i);
          const w = Math.exp(-(distance * distance) / (2 * sigma * sigma));
          const value = originals[j];
          if (value instanceof THREE.Quaternion) {
            const aligned = value.clone();
            if (quat && aligned.dot(quat) < 0) aligned.set(-aligned.x, -aligned.y, -aligned.z, -aligned.w);
            quat = quat ? quat.set(quat.x + aligned.x * w, quat.y + aligned.y * w, quat.z + aligned.z * w, quat.w + aligned.w * w) : new THREE.Quaternion(aligned.x * w, aligned.y * w, aligned.z * w, aligned.w * w);
          } else {
            vec = vec ? vec.addScaledVector(value as THREE.Vector3, w) : (value as THREE.Vector3).clone().multiplyScalar(w);
          }
          weight += w;
        }
        if (weight <= 0) continue;
        // 구간 양 끝(원래 멀쩡한 키)은 반만 섞어 경계가 꺾이지 않게.
        const edge = i === a || i === b ? 0.5 : 1;
        if (quat) {
          const target = quat.normalize();
          const result = (originals[i] as THREE.Quaternion).clone().slerp(target, edge);
          write(keys[i], result);
        } else if (vec) {
          const target = vec.multiplyScalar(1 / weight);
          write(keys[i], (originals[i] as THREE.Vector3).clone().lerp(target, edge));
        }
        changed += 1;
      }
    };

    for (const issue of mine) {
      if (track.channel === "pose" && issue.bone) {
        const bone = issue.bone;
        smoothRange(
          issue,
          (key) => quatOf(key.bones?.[bone] ?? { x: 0, y: 0, z: 0 }),
          (key, value) => {
            key.bones = { ...(key.bones ?? {}), [bone]: eulerOf(value as THREE.Quaternion) };
          },
        );
      } else if (track.channel !== "pose") {
        smoothRange(
          issue,
          (key) => new THREE.Vector3(key.value.x, key.value.y, key.value.z),
          (key, value) => {
            const v = value as THREE.Vector3;
            key.value = { x: round4(v.x), y: round4(v.y), z: round4(v.z) };
          },
        );
      }
    }
    return { ...track, keys };
  });
  return { tracks: next, changed };
}

/** 규칙만으로 정하는 결정 — «자동 다듬기» 와 AI 가 답을 못 줄 때. 외톨이 튐은 세게, 지그재그는 편차만큼. */
export function autoDecisions(issues: CleanupIssue[]): CleanupDecision[] {
  return issues.map((issue) => ({
    id: issue.id,
    action: "smooth",
    strength: issue.kind === "spike" ? 0.3 : Math.min(1, 0.3 + (issue.severity - 1) * 0.2 + issue.keys * 0.05),
  }));
}

/** 캐릭터 하나의 트랙들을 다듬은 상태. `setState` 안에서 부릅니다. */
export function cleanupCharacterIn(
  current: CompositionState,
  characterId: string,
  issues: CleanupIssue[],
  decisions: CleanupDecision[],
): { state: CompositionState; changed: number } {
  const all = motionTracksOf(current);
  const mine = all.filter((track) => track.targetId === characterId);
  const { tracks, changed } = applyCleanup(mine, issues, decisions);
  const byId = new Map(tracks.map((track) => [track.id, track]));
  return {
    state: { ...current, motionTracks: all.map((track) => byId.get(track.id) ?? track) },
    changed,
  };
}

const BONE_LABEL = new Map(EDITABLE_BONES.map((bone) => [bone.id, bone.label]));

/** 사람이 읽는 구간 이름 — «오른 팔꿈치 3.20~3.40초». */
export function issueLabel(issue: CleanupIssue) {
  const what =
    issue.channel === "pose"
      ? BONE_LABEL.get(issue.bone ?? "") ?? (issue.bone === "Spine1" ? "등" : issue.bone ?? "관절")
      : issue.channel === "position"
        ? "이동"
        : "몸 방향";
  return `${what} ${issue.from.toFixed(2)}~${issue.to.toFixed(2)}초`;
}

/**
 * AI 에게 보낼 글 — 구간마다 숫자만(키 값 전체를 보내면 3 분짜리 곡 하나에 수십만 토큰입니다).
 *
 * 편차(얼마나 튀었나)와 앞뒤의 가장 빠른 움직임(원래 빠른 동작인가)을 같이 줍니다. 춤의 «히트» 는 앞뒤도 빠르고 한쪽으로만 꺾이며,
 * 인식 오류는 앞뒤는 느린데 한두 키만 튀거나 지그재그입니다.
 */
export function cleanupPrompt(issues: CleanupIssue[], context: { name: string; duration: number; fps: number; purpose?: string }) {
  const rows = issues
    .slice(0, 400)
    .map(
      (issue) =>
        `${issue.id} | ${issueLabel(issue)} | ${issue.kind === "spike" ? "외톨이 튐" : "지그재그"} | 키 ${issue.keys} | 편차 ${issue.peak}${issue.channel === "position" ? "cm" : "°"} (기준의 ${issue.severity}배) | 앞뒤 최고 속도 ${issue.speed}${issue.channel === "position" ? "cm/s" : "°/s"}`,
    )
    .join("\n");
  return [
    `캐릭터 «${context.name}» 에 영상 모션 캡처로 넣은 키(약 초당 ${context.fps}장, ${context.duration.toFixed(1)}초)에서 흔들림 후보 구간 ${issues.length}개를 찾았습니다.${issues.length > 400 ? " (앞 400개만 적었습니다)" : ""}`,
    context.purpose ? `쓰임: ${context.purpose}` : "",
    "",
    "id | 구간 | 모양 | 걸린 키 수 | 편차 | 앞뒤 최고 속도",
    rows,
    "",
    "각 구간을 판단하세요.",
    "- 인식 오류(한두 키만 튐, 앞뒤는 느린데 지그재그, 사람 관절로 불가능한 순간 꺾임) → smooth, strength 0.3~1 (넓게 흔들릴수록 크게)",
    "- 의도한 빠른 동작(춤의 히트·킥·손털기처럼 앞뒤 속도도 빠르고 한 방향으로 꺾임) → keep",
    "- 애매하면 약하게 smooth(strength 0.2~0.3) — 흐름은 살리고 튐만 누릅니다.",
    "",
    'JSON 만 답하세요: {"decisions":[{"id":"…","action":"smooth"|"keep","strength":0~1,"reason":"짧게"}]}',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export const CLEANUP_SYSTEM =
  "당신은 모션 캡처 데이터를 다듬는 애니메이터입니다. 영상에서 뽑은 키프레임의 인식 오류(떨림·튐)와 의도한 빠른 동작을 가려, 오류만 자연스럽게 잇도록 결정합니다. 반드시 요청한 JSON 형식으로만 답합니다.";
