import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { toast } from "sonner";
import { orbitKeyboardSpeed, orbitSpeedOf } from "@/lib/compositionEdit";
import type { CompositionState } from "@/lib/composition";
import type { TransformConstraint } from "@/components/composition/CompositionViewport";

/**
 * 구도잡기 3D 화면의 **키보드** — 걷기(W/A/S/D/Q/E)와 한 글자 단축키(1·2·3 · F · G · M).
 *
 * `CompositionViewport` 의 마운트 이펙트 안에 있던 것을 2026-09-14에 옮겼습니다.
 * `orbit.ts` 와 같은 뜻입니다 — 그 이펙트가 1300줄이라 «어디까지가 키보드인지» 를 읽어
 * 내기가 어려웠습니다. **동작은 한 줄도 바꾸지 않았습니다.**
 *
 * 이벤트 등록·해제는 여전히 부르는 쪽이 합니다. 리스너가 붙는 순서가 조작감에 영향을
 * 주는데(기즈모가 먼저 붙어야 끌던 중인지 알 수 있습니다), 그 순서를 여기로 가져오면
 * 옮기는 김에 바뀌어 버립니다.
 *
 * # 왜 «누른 키의 집합» 인가 — keydown 한 번에 한 걸음이 아니라
 *
 * 키보드의 자동 반복은 OS 설정이라 사람마다 속도가 다르고, 처음 한 번과 다음 사이에
 * 0.5초쯤 쉽니다. 그대로 쓰면 누르자마자 멈칫했다가 갑자기 달립니다. 그래서 눌린
 * 키를 **집합으로 들고** 매 프레임 `advance()` 에서 경과 시간만큼 옮깁니다.
 */
export interface KeyboardMoveDeps {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** 오빗 쪽 F 키 동작. 여기서는 부르기만 합니다. */
  orbit: {
    focus: () => string | null;
    focusViewCenter: () => string | null;
    frameSelection: () => string | null;
  };
  /** 진행 중인 글라이드를 끊는 자리 — 걷기 시작하면 «인물에 붙여 둔 중심» 은 뜻을 잃습니다. */
  scene: {
    orbitGlide: {
      from: THREE.Vector3;
      to: THREE.Vector3;
      /** M 키처럼 **카메라 자리도** 함께 옮길 때만 있습니다. */
      camFrom?: THREE.Vector3;
      camTo?: THREE.Vector3;
      start: number;
      ms: number;
    } | null;
  };
  /**
   * 매 프레임 바뀌는 것들이라 ref 로 받습니다.
   *
   * `CompositionViewportProps` 전체가 아니라 **쓰는 것만** 적었습니다 — props 가 늘어도
   * 여기가 안 흔들리고, 무엇에 기대는지가 한눈에 보입니다.
   */
  handlers: {
    readonly current: {
      readonly composition: CompositionState;
      readonly onTransformMode?: (
        mode: "translate" | "rotate" | "scale",
      ) => void;
      readonly onTransformConstraint?: (limit: TransformConstraint) => void;
      readonly onPreviewInterrupt?: () => void;
    };
  };
  previewing: { current: boolean };
  /** 카메라 자리를 구도에 적어 두기. 키에서 손을 다 뗄 때 한 번만 부릅니다. */
  commitCameraPose: () => void;
  /** G 키 — 처음 자리(또는 활성 구도)로. 돌아간 구도 이름을 돌려줍니다. */
  goHome: () => string | null;
}

export function createKeyboardMove(deps: KeyboardMoveDeps) {
  const {
    camera,
    controls,
    orbit,
    scene,
    handlers,
    previewing,
    commitCameraPose,
    goHome,
  } = deps;

  // ── 키보드 카메라 이동 (W/A/S/D + Q/E) ────────────────────────────
  // 마우스 오빗은 «타깃 주위를 도는» 이동이라 방을 가로질러 걷듯 움직이기
  // 어렵습니다. WASD 는 카메라와 타깃을 함께 밀어서 시선 방향을 유지한 채
  // 평행 이동합니다. Q/E 는 아래/위.
  const KEY_CODES = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"] as const;
  const heldKeys = new Set<string>();
  /** Shift = 정밀, Alt = 성큼. 키를 누를 때마다 최신 값으로 갈아 둡니다. */
  const orbitModifier = { slow: false, fast: false };
  const onKeyDown = (event: KeyboardEvent) => {
    // 입력 칸에 숫자를 치는 중이면 카메라가 움직이면 안 됩니다.
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    )
      return;
    orbitModifier.slow = event.shiftKey;
    orbitModifier.fast = event.altKey;
    /*
      1·2·3 = 이동·회전·크기.

      언리얼은 W/E/R, 블렌더는 G/R/S 인데 우리는 W·A·S·D·Q·E 가 카메라 걷기라 글자를 쓸
      자리가 없습니다().
      숫자 줄 위쪽(Digit)만 봅니다 — 숫자패드는 다른 데서 쓸 여지를 남깁니다.
    */
    if (!event.altKey) {
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+1·2·3 = 자유·바닥·높이(끌 때 어디로 갈지).
        const limits = {
          Digit1: "free",
          Digit2: "ground",
          Digit3: "height",
        } as const;
        const limit = limits[event.code as keyof typeof limits];
        if (limit) {
          event.preventDefault();
          handlers.current.onTransformConstraint?.(limit);
          return;
        }
      } else {
        const modes = {
          Digit1: "translate",
          Digit2: "rotate",
          Digit3: "scale",
        } as const;
        const mode = modes[event.code as keyof typeof modes];
        if (mode) {
          event.preventDefault();
          handlers.current.onTransformMode?.(mode);
          return;
        }
      }
    }
    /*
      F = 고른 인물로 중심 옮기기, **Ctrl+F = 화면 한가운데 바닥으로 되돌리기**.

       인물을 고른 채로는 F 가 늘 그 인물을
      잡으므로, 선택을 풀지 않고 되돌릴 길이 따로 있어야 합니다. Alt+F 는 안 건드립니다.
    */
    if (event.code === "KeyF" && !event.altKey) {
      event.preventDefault();
      if (previewing.current) handlers.current.onPreviewInterrupt?.();
      const toCenter = event.ctrlKey || event.metaKey;
      const said = toCenter ? orbit.focusViewCenter() : orbit.focus();
      toast.success(
        said ?? "하늘을 보고 있어 바닥에 중심을 잡을 곳이 없습니다",
        {
          description: said
            ? "마우스 드래그는 이 점을 돌고, 이동·줌 속도도 여기까지 거리로 정해집니다" +
              (toCenter ? "" : " · Ctrl+F 면 화면 한가운데로 되돌립니다")
            : "조금 아래를 보거나 인물을 고른 뒤 F 를 눌러 주세요",
        },
      );
      return;
    }
    /*
      M = 고른 것 **앞으로 카메라를 옮기기**.

      
      F 는 회전 중심만 옮기고 카메라는 제자리라, 멀리 있는 소품은 F 를 눌러도 여전히 손톱만
      합니다. M 은 지금 보는 방향 그대로 다가가(또는 물러나) 그것이 화면에 꽉 차게 섭니다.
      Ctrl·Alt 가 붙은 M 은 안 건드립니다.
    */
    if (event.code === "KeyM" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (previewing.current) handlers.current.onPreviewInterrupt?.();
      const said = orbit.frameSelection();
      if (said) toast.success(said, { description: "보던 방향 그대로 다가갔습니다 · G 면 처음 자리로" });
      else
        toast.info("카메라를 옮길 대상을 먼저 고르세요", {
          description: "3D 화면이나 타임라인 레이어에서 인물·소품을 고른 뒤 M.",
        });
      return;
    }
    // G = 처음 자리로. Ctrl+G(찾기 다음)·Alt+G 는 안 건드립니다.
    if (
      event.code === "KeyG" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (previewing.current) handlers.current.onPreviewInterrupt?.();
      const shotName = goHome();
      toast.success(
        shotName
          ? `«${shotName}» 구도로 돌아왔습니다`
          : "카메라를 처음 자리로 되돌렸습니다",
        {
          description: shotName
            ? "저장한 카메라를 바꾸면 G 도 그쪽으로 갑니다"
            : "구도잡기를 열었을 때 보던 그림입니다 · 구도를 저장해 두면 G 는 그쪽으로",
        },
      );
      return;
    }
    if (!(KEY_CODES as readonly string[]).includes(event.code)) return;
    if (previewing.current) handlers.current.onPreviewInterrupt?.();
    heldKeys.add(event.code);
    event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    orbitModifier.slow = event.shiftKey;
    orbitModifier.fast = event.altKey;
    if (!heldKeys.delete(event.code)) return;
    // 손을 다 떼면 옮겨 놓은 카메라를 구도에 저장합니다.
    if (heldKeys.size === 0 && !previewing.current) commitCameraPose();
  };
  /*
    창 밖으로 초점이 나가면 누르고 있던 키를 놓습니다.
    Alt+Tab 으로 나가면 keyup 이 안 와서, 돌아왔을 때 카메라가 혼자 계속
    걸어갑니다 — 창을 다시 눌러 키를 한 번 더 눌렀다 떼기 전에는 안 멈춥니다.
  */
  const onWindowBlur = () => {
    if (!heldKeys.size) return;
    heldKeys.clear();
    orbitModifier.slow = false;
    orbitModifier.fast = false;
    if (!previewing.current) commitCameraPose();
  };
  let keyboardTick = performance.now();
  const applyKeyboardMove = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - keyboardTick) / 1000);
    keyboardTick = now;
    if (!heldKeys.size || previewing.current) return;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const rightward = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();
    const delta = new THREE.Vector3();
    if (heldKeys.has("KeyW")) delta.add(forward);
    if (heldKeys.has("KeyS")) delta.sub(forward);
    if (heldKeys.has("KeyD")) delta.add(rightward);
    if (heldKeys.has("KeyA")) delta.sub(rightward);
    if (heldKeys.has("KeyE")) delta.y += 1;
    if (heldKeys.has("KeyQ")) delta.y -= 1;
    if (!delta.lengthSq()) return;
    /*
      걸음 속도도 **시선점까지 거리에 비례**합니다.

      예전에는 초속 3m 로 못 박혀 있었습니다. 눈높이 1.6m 짜리 방(S=3.2m)에서는
      한 번 눌렀다 떼는 사이에 방을 가로질러 벽을 뚫고 나갔고, 100m 벌판에서는
      한참을 눌러도 제자리처럼 보였습니다. 거리에 비례하면 「화면에서 보이는
      만큼」 걷습니다. Shift 는 0.3배(정밀), Alt 는 3배(성큼).
    */
    const speed =
      orbitKeyboardSpeed(
        camera.position.distanceTo(controls.target),
        orbitModifier,
      ) * orbitSpeedOf(handlers.current.composition);
    delta.normalize().multiplyScalar(speed * dt);
    camera.position.add(delta);
    controls.target.add(delta);
    // 걷는 동안 «인물에게 붙여 둔 중심» 은 뜻을 잃습니다. 옮기던 것을 멈춥니다.
    scene.orbitGlide = null;
  };

  return { onKeyDown, onKeyUp, onWindowBlur, advance: applyKeyboardMove };
}
