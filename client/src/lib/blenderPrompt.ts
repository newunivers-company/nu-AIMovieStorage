import type { CompositionState, Vector3Value } from "@/lib/composition";
import { describeCameraMoves, SHOT_PRESETS } from "@/lib/cameraMoves";

/**
 * 구도잡기 씬 → 블렌더 작업 지시문.
 *
 * 지금은 사람이 텍스트를 복사해 LLM 에 붙여넣습니다(a안).
 * 나중에 앱이 LLM 을 직접 호출하는 b안으로 넘어갈 때를 대비해,
 * 사람이 읽는 문장과 기계가 읽는 명세를 함께 돌려줍니다.
 * b안에서는 buildBlenderPrompt().spec 만 JSON 으로 넘기면 됩니다.
 */

export interface BlenderCharacterSpec {
  name: string;
  gender?: string;
  heightCm: number;
  position: Vector3Value;
  rotationDegrees: Vector3Value;
  /** 포즈를 안 고른 인물도 있습니다. */
  pose?: string;
}

export interface BlenderObjectSpec {
  name: string;
  kind: string;
  position: Vector3Value;
  rotationDegrees: Vector3Value;
  scale: Vector3Value;
}

export interface BlenderCameraSpec {
  position: Vector3Value;
  target: Vector3Value;
  fovDegrees: number;
  move: { preset: string; description: string; durationSeconds: number } | null;
}

export interface BlenderSceneSpec {
  /** 블렌더와 맞추는 규약. 미터 단위, Z-업, 마지막에 GLB 로 내보낼 때만 Y-업 */
  units: "meters";
  upAxis: "Z";
  fps: number;
  durationSeconds: number;
  floor: boolean;
  camera: BlenderCameraSpec;
  characters: BlenderCharacterSpec[];
  objects: BlenderObjectSpec[];
}

export interface BlenderPromptResult {
  /** 사람이 읽고 LLM 에 붙여넣는 지시문 */
  text: string;
  /** b안에서 그대로 넘길 구조화된 명세 */
  spec: BlenderSceneSpec;
}

const toDegrees = (radians: number) => Number(((radians * 180) / Math.PI).toFixed(1));
const round = (value: number) => Number(value.toFixed(3));

function vectorText(value: Vector3Value) {
  return `(${round(value.x)}, ${round(value.y)}, ${round(value.z)})`;
}

/**
 * 구도잡기는 three.js 좌표계(Y-업)를 씁니다. 블렌더는 Z-업입니다.
 * 지시문에는 블렌더 좌표로 옮겨 적어야 사람이 값을 그대로 쓸 수 있습니다.
 * three (x, y, z) → blender (x, -z, y)
 */
function toBlenderVector(value: Vector3Value): Vector3Value {
  return { x: round(value.x), y: round(-value.z), z: round(value.y) };
}

export function buildBlenderPrompt(
  composition: CompositionState,
  characterNames: Record<string, { name: string; gender?: string; heightCm?: number }>,
): BlenderPromptResult {
  const timeline = composition.timeline ?? { duration: 5, fps: 24 };
  // 이어 붙인 클립 전부를 적습니다. 프리셋 이름은 첫 클립 기준(블렌더 쪽이 하나만 받습니다).
  const moves = composition.cameraMoves ?? [];
  const move = moves[0] ?? null;
  const preset = move ? SHOT_PRESETS.find(item => item.id === move.shotId) : null;
  const described = describeCameraMoves(moves);

  const characters: BlenderCharacterSpec[] = composition.characters
    .filter(entry => !entry.hidden)
    .map(entry => {
      const source = characterNames[entry.characterId];
      return {
        name: source?.name || "캐릭터",
        gender: source?.gender,
        heightCm: source?.heightCm ?? 170,
        position: toBlenderVector(entry.position),
        rotationDegrees: {
          x: toDegrees(entry.rotation.x),
          y: toDegrees(entry.rotation.z),
          z: toDegrees(entry.rotation.y),
        },
        pose: entry.pose,
      };
    });

  const objects: BlenderObjectSpec[] = composition.objects
    .filter(object => object.visible)
    .map(object => ({
      name: object.label,
      kind: object.kind,
      position: toBlenderVector(object.position),
      rotationDegrees: {
        x: toDegrees(object.rotation.x),
        y: toDegrees(object.rotation.z),
        z: toDegrees(object.rotation.y),
      },
      scale: { x: round(object.scale.x), y: round(object.scale.z), z: round(object.scale.y) },
    }));

  const spec: BlenderSceneSpec = {
    units: "meters",
    upAxis: "Z",
    fps: timeline.fps,
    durationSeconds: timeline.duration,
    floor: composition.showFloor,
    camera: {
      position: toBlenderVector(composition.camera.position),
      target: toBlenderVector(composition.camera.target),
      fovDegrees: 42,
      move: move && preset
        ? { preset: preset.label, description: described?.ko ?? preset.hint, durationSeconds: move.duration }
        : null,
    },
    characters,
    objects,
  };

  const frameCount = Math.round(timeline.duration * timeline.fps);

  const lines: string[] = [];
  lines.push("블렌더에서 아래 장면을 만들고 GLB 로 내보내 주세요.");
  lines.push("");
  lines.push("## 규약");
  lines.push("- 단위는 미터, 좌표는 블렌더 기준(Z-업)으로 이미 변환해 두었습니다. 그대로 입력하세요.");
  lines.push(`- 프레임레이트 ${timeline.fps}fps, 길이 ${timeline.duration}초 (1 ~ ${frameCount}프레임).`);
  lines.push("- 인물은 실제 키에 맞춰 스케일을 조정하세요. 발바닥이 Z=0 바닥에 닿아야 합니다.");
  lines.push(`- 바닥면: ${composition.showFloor ? "있음" : "없음(투명 배경)"}`);
  lines.push("");

  lines.push("## 카메라");
  lines.push(`- 위치 ${vectorText(spec.camera.position)}, 바라보는 지점 ${vectorText(spec.camera.target)}`);
  lines.push(`- 세로 화각 ${spec.camera.fovDegrees}도`);
  if (spec.camera.move) {
    lines.push(`- 무빙: ${spec.camera.move.description}`);
    lines.push(`- 무빙 길이 ${spec.camera.move.durationSeconds}초. 시작·끝 두 키프레임으로 만들고 그래프 에디터에서 속도를 맞추세요.`);
  } else {
    lines.push("- 무빙 없음. 고정 카메라입니다.");
  }
  lines.push("");

  if (characters.length) {
    lines.push("## 인물");
    characters.forEach((character, index) => {
      lines.push(
        `${index + 1}. ${character.name} — 키 ${character.heightCm}cm${character.gender ? `, ${character.gender === "male" ? "남성" : "여성"}` : ""}`,
      );
      lines.push(`   위치 ${vectorText(character.position)}, Z축 회전 ${character.rotationDegrees.z}도, 자세 "${character.pose}"`);
    });
    lines.push("");
    lines.push("인물 애니메이션은 이 자세를 시작점으로 삼고, 아래 연출 의도에 맞게 움직이게 해 주세요.");
    lines.push("<!-- 여기에 원하는 동작을 적으세요. 예: 민호가 3초에 걸쳐 주안 쪽으로 두 걸음 걸어간다 -->");
    lines.push("");
  }

  if (objects.length) {
    lines.push("## 오브젝트");
    objects.forEach(object => {
      lines.push(`- ${object.name} (${object.kind}) — 위치 ${vectorText(object.position)}, 스케일 ${vectorText(object.scale)}`);
    });
    lines.push("");
  }

  lines.push("## 내보내기");
  lines.push("- 포맷: glTF Binary (.glb)");
  lines.push("- +Y Up 켜기 (구도잡기가 Y-업이라 이걸 꺼내면 장면이 눕습니다)");
  lines.push("- 애니메이션 포함, 샘플링 켜기, 항상 샘플 애니메이션 켜기");
  lines.push("- 카메라는 내보내지 마세요. 카메라 무빙은 구도잡기에서 따로 겁니다.");
  lines.push("- 내보낸 GLB 를 구도잡기의 타임라인 탭 > GLB 애니메이션에 끌어다 놓으면 됩니다.");

  return { text: lines.join("\n"), spec };
}
