import * as THREE from "three";
import { toast } from "sonner";
import { foregroundLocalForWorld } from "@/lib/compositionEdit";
import { floorSizeOf } from "@/components/composition/viewport/sceneHelpers";
import type {
  CharacterComposition,
  CompositionState,
  Vector3Value,
} from "@/lib/composition";

/**
 * 구도잡기 3D 화면의 **바닥에 세우기** — 화면을 찍은 곳으로 인물을 옮깁니다.
 *
 * `CompositionViewport` 의 마운트 이펙트 안에 있던 것을 2026-09-14에 옮겼습니다
 * (`orbit.ts`·`keyboardMove.ts` 와 같은 뜻). **동작은 한 줄도 바꾸지 않았습니다.**
 * 이벤트 등록·해제는 여전히 부르는 쪽이 합니다 — 기즈모(TransformControls)가 먼저
 * 등록돼 있어야 «끌던 중인지» 를 여기서 알 수 있는데, 그 순서를 여기로 가져오면
 * 옮기는 김에 바뀝니다.
 */
export interface GroundPlacingDeps {
  camera: THREE.PerspectiveCamera;
  /** 캔버스. 화면 좌표 → 정규화 좌표로 바꾸는 데만 씁니다. */
  dom: HTMLElement;
  /** 기즈모. 잡고 있으면 «바닥 찍기» 가 아닙니다. */
  transform: { dragging: boolean; axis: string | null };
  /** 쓰는 것만 적습니다 — props 가 늘어도 여기가 안 흔들립니다. */
  handlers: {
    readonly current: {
      readonly composition: CompositionState;
      readonly selected: string;
      readonly characters: readonly { id: string; name: string }[];
      readonly groundPlacing?: boolean;
      readonly onCharacterTransform: (
        characterId: string,
        patch: {
          position: Vector3Value;
          rotation: CharacterComposition["rotation"];
          rotationY: number;
        },
      ) => void;
    };
  };
  previewing: { current: boolean };
  /** 전경 확대 배율. 월드 ↔ 전경 로컬을 오갈 때 씁니다. */
  zoom: { current: number };
}

export function createGroundPlacing(deps: GroundPlacingDeps) {
  const { camera, dom, transform, handlers, previewing, zoom } = deps;

  /*
    ── 바닥에 세우기 ─────────────────────────────────────────────────

    켜 두면 화면을 찍은 곳으로 인물을 옮깁니다. 기즈모로 x·z 를 끄는 것보다
    «저 잔디밭 저쯤» 을 훨씬 빨리 짚을 수 있어서, 배경과 축척을 맞출 때
    인물을 이리저리 옮겨 보는 일이 쉬워집니다.

    수학은 한 줄입니다 — 눈에서 커서 방향으로 쏜 광선과 바닥면(y=0)의 교점.
    지평선은 늘 눈높이에 있으므로, 지평선 **위**를 찍으면 광선이 바닥과
    카메라 뒤쪽에서나 만나고 `intersectPlane` 이 null 을 돌려줍니다. 그때는
    옮기지 않고 이유를 알려 줍니다(엉뚱한 곳에 순간이동하면 더 나쁩니다).
  */
  const groundRaycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** 클릭을 시작한 화면 좌표. 화면을 «돌린 것» 과 «찍은 것» 을 가르려고 기억합니다. */
  let groundPointerStart: { x: number; y: number } | null = null;

  const placeSelectedOnGround = (event: PointerEvent) => {
    const now = handlers.current;
    const visible = now.composition.characters.filter((item) => !item.hidden);
    if (!visible.length) {
      toast.error("세울 인물이 없습니다. 배치 탭에서 인물을 먼저 넣어 주세요.");
      return;
    }
    // 고른 인물이 있으면 그 인물, 없으면 첫 인물.
    const pickedId = now.selected.startsWith("character:")
      ? now.selected.slice(10)
      : null;
    const placement =
      visible.find((item) => item.characterId === pickedId) ?? visible[0];

    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    groundRaycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = groundRaycaster.ray.intersectPlane(
      groundPlane,
      new THREE.Vector3(),
    );
    if (!hit) {
      toast.error("지평선 아래 바닥을 찍어 주세요.", {
        description: "지평선 위나 카메라 뒤쪽에는 바닥이 없습니다.",
      });
      return;
    }

    /*
      인물 좌표는 전경 그룹 안의 값입니다. 전경 확대(foregroundZoom)가 1 이
      아니면 그룹에 배율·오프셋이 걸려 있어 월드 좌표를 그대로 넣으면 엉뚱한
      곳에 섭니다. 그래서 월드 → 전경 로컬로 되돌린 뒤 저장하고, 거리도 같은
      공간에서 재야 «미터» 가 맞습니다.

      **지금 행렬로 되돌리면 안 됩니다.** 확대의 피벗이 «놓인 것들의 평균» 이라,
      방금 옮긴 인물이 그 평균을 바꿉니다. 저장하자마자 확대 이펙트가 다시
      돌며 전경이 통째로 밀려, 인물이 클릭한 자리에서 최대 2.4 m 벗어났습니다
      (확대 20배 실측). 그래서 «옮긴 뒤의 평균» 까지 넣고 푼 값을 저장합니다
      (`foregroundLocalForWorld`).
    */
    const scale = zoom.current || 1;
    const solved = foregroundLocalForWorld(
      now.composition,
      placement.characterId,
      { x: hit.x, z: hit.z },
      scale,
    );
    const local = new THREE.Vector3(solved.x, 0, solved.z);
    // 거리는 격자와 같은 «로컬 미터» 로 잽니다 — 전경이 균일 배율이라 월드 거리 ÷ 확대.
    const forward =
      Math.hypot(hit.x - camera.position.x, hit.z - camera.position.z) / scale;

    /*
      지평선에 **너무 가까운** 곳은 거부합니다.

      d = h / tan θ 라 θ 가 0 에 다가가면 d 가 발산합니다. 실측으로 눈높이
      1.6m 에서 지평선 1px 아래(θ = 0.01°)를 찍으면 9167 m 가 나옵니다
      (scratchpad/cube-check/verify-all.mjs). 그대로 옮기면 인물이 격자
      밖 수 km 지점으로 사라져 화면에서 찾을 수가 없습니다 — 「지평선 위는
      막았으니 됐다」 로는 부족합니다.

      한계는 바닥 격자의 반쪽입니다. 격자가 곧 «우리 바닥» 이고, 그 밖은 세울
      자리가 아니라 배경 그림입니다. «방» 에서는 그 격자가 방의 밑면이라
      (`floorSizeOf`) 사정거리도 **방 안**으로 좁혀집니다 — 방 밖에 세우면
      벽 그림 뒤에 서게 되어 인물이 어디 있는지 알 수 없습니다.
    */
    const limit = floorSizeOf(now.composition) / 2;
    if (Math.abs(local.x) > limit || Math.abs(local.z) > limit) {
      toast.error("바닥 격자 밖입니다. 조금 더 아래를 찍어 주세요.", {
        // 방이 작으면 한계가 1.6 m 처럼 소수라 반올림해서 «0 m» 로 적히면 안 됩니다.
        description: `지평선에 가까울수록 멀어집니다 — 찍은 곳은 ${forward.toFixed(0)} m 앞이고, 격자는 ${limit.toFixed(limit < 10 ? 1 : 0)} m 까지입니다.`,
      });
      return;
    }

    const moved = Math.hypot(
      local.x - placement.position.x,
      local.z - placement.position.z,
    );

    // 소수점 6자리. 3자리로 자르면 확대 20배에서 월드로 1 cm 어긋나
    // 「클릭한 자리에 정확히」 라는 이 모드의 약속이 깨집니다.
    const round = (value: number) => Number(value.toFixed(6));
    const rotation = placement.rotation ?? {
      x: 0,
      y: placement.rotationY ?? 0,
      z: 0,
    };
    now.onCharacterTransform(placement.characterId, {
      // y=0 — 발을 바닥에. 「클릭한 자리에 발이 오게」 가 이 모드의 전부입니다.
      position: { x: round(local.x), y: 0, z: round(local.z) },
      rotation,
      rotationY: rotation.y,
    });

    const name =
      now.characters.find((item) => item.id === placement.characterId)?.name ||
      "인물";
    toast.success(
      `${name} · 카메라에서 ${forward.toFixed(1)} m 앞에 세웠습니다`,
      {
        description: `${moved.toFixed(1)} m 옮겼습니다 · Ctrl+Z 로 되돌립니다`,
      },
    );
  };

  const onGroundPointerDown = (event: PointerEvent) => {
    if (!handlers.current.groundPlacing || event.button !== 0) return;
    // 기즈모를 잡고 있으면 «바닥 찍기» 가 아닙니다. TransformControls 가 먼저
    // 등록돼 있어 이 시점에는 dragging·axis 가 이미 정해져 있습니다.
    if (transform.dragging || transform.axis) {
      groundPointerStart = null;
      return;
    }
    groundPointerStart = { x: event.clientX, y: event.clientY };
  };
  const onGroundPointerUp = (event: PointerEvent) => {
    const start = groundPointerStart;
    groundPointerStart = null;
    if (!start || !handlers.current.groundPlacing) return;
    // 4px 넘게 끌었으면 화면을 돌린 것이므로 세우지 않습니다.
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4)
      return;
    if (previewing.current) return;
    placeSelectedOnGround(event);
  };

  return { onPointerDown: onGroundPointerDown, onPointerUp: onGroundPointerUp };
}
