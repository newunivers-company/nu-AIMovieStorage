import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ORBIT_MAX_RADIUS,
  ORBIT_MIN_RADIUS,
  orbitChestHeight,
  orbitEase,
  orbitGlideMs,
  orbitGroundAhead,
  orbitRotateSpeed,
  orbitSpeedOf,
} from "@/lib/compositionEdit";
import type { CompositionState } from "@/lib/composition";

/**
 * 구도잡기 3D 화면의 **돌리기·집기** — 회전 중심을 어떻게 잡고 무엇을 고를 것인가.
 *
 * `CompositionViewport` 의 마운트 이펙트 안에 함수 열세 개로 흩어져 있던 것을 2026-09-14에
 * 한 덩어리로 옮겼습니다. 그 이펙트가 1300줄이라 «어디까지가 오빗인지» 를 읽어 내기가
 * 어려웠습니다. 여기 있는 것끼리만 서로를 부르고, 밖으로는 아래 다섯 개만 내보냅니다.
 *
 * **동작은 한 줄도 바꾸지 않았습니다.** 이벤트 등록·해제는 여전히 부르는 쪽이 합니다 —
 * 리스너가 붙는 순서가 조작감에 영향을 주는데, 그 순서를 여기로 가져오면 옮기는 김에
 * 바뀌어 버립니다.
 *
 * # 회전 중심을 잡는 세 가지 길
 *
 * 1. **돌리기를 시작할 때**(`onPointerDown`) — 화면 한가운데에 있는 것으로 조용히 다시
 * 잡습니다. 그림은 한 픽셀도 안 움직입니다(시선 축을 따라 앞뒤로만 옮기므로).
 * 2. **더블클릭** — 커서 밑의 점으로 부드럽게 옮깁니다.
 * 3. **F 키**(`focus`) — 고른 인물의 가슴 높이로, 없으면 화면 한가운데 바닥으로.
 *
 * M 키(`frameSelection`)는 중심만이 아니라 **카메라도** 고른 것 앞으로 옮깁니다.
 */
export interface OrbitDeps {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** 캔버스. 화면 좌표 → 정규화 좌표로 바꾸는 데만 씁니다. */
  dom: HTMLElement;
  /** 전경(인물·소품·GLB)과 뿌리 표, 그리고 진행 중인 글라이드. */
  scene: {
    foreground: THREE.Object3D;
    characterRoots: Map<string, THREE.Group>;
    objectRoots: Map<string, THREE.Object3D>;
    glbRoots: Map<string, THREE.Group>;
    /** 방 껍질 — Shift 로 방을 집을 때만 봅니다. */
    background: {
      rooms: {
        id: string;
        inner: THREE.Object3D;
        outer: THREE.Object3D | null;
      }[];
    };
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
   * 지금 고른 것·인물 목록·바닥 배치 중인지 — 매 프레임 바뀌므로 ref 로 받습니다.
   *
   * `CompositionViewportProps` 전체를 받지 않고 **쓰는 것만** 적었습니다. 그래야 props 가
   * 늘어도 여기가 안 흔들리고, 무엇에 기대는지가 한눈에 보입니다.
   */
  handlers: {
    readonly current: {
      readonly selected: string;
      readonly characters: readonly { id: string; name: string }[];
      /** 없을 수도 있습니다 — 바닥 배치 모드가 꺼져 있으면 `undefined` 입니다. */
      readonly groundPlacing?: boolean;
      readonly composition: CompositionState;
      readonly onSelect: (value: string) => void;
    };
  };
  previewing: { current: boolean };
  /** 기즈모. 끌고 있는 동안에는 돌리기도 집기도 하지 않습니다. */
  transform: { dragging: boolean; axis: string | null };
  /** 카메라 자리를 상태에 적어 두기. 글라이드가 끝날 때 한 번만 부릅니다. */
  commitCameraPose: () => void;
}

export function createOrbit(deps: OrbitDeps) {
  const { camera, controls, dom, scene, handlers, previewing, transform } =
    deps;

  /*
    레이캐스터와 바닥면은 여기서 따로 듭니다. 상태가 없는 도구라 공유할 이유가 없고,
    공유하면 «어디서 setFromCamera 했는지» 를 따라다녀야 합니다.
  */
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  /** 화면 좌표 → 정규화 좌표(−1~1). 캔버스가 아직 안 그려졌으면 null. */
  const ndc = (event: MouseEvent) => {
    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };

  /** 광선에 맞은 것 중 «보이고 헬퍼가 아닌» 첫 개. 배경막은 전경이 아니라 후보가 아닙니다. */
  const firstSolid = () =>
    raycaster
      .intersectObject(scene.foreground, true)
      .find((hit) => hit.object.visible && !hit.object.userData.helper) ?? null;

  /** 헬퍼(이름표·선택 링)를 뺀 «몸» 의 월드 범위. 이름표까지 넣으면 중심이 머리 위로 뜹니다. */
  const bodyBox = (root: THREE.Object3D) => {
    const box = new THREE.Box3();
    const corner = new THREE.Vector3();
    root.updateWorldMatrix(true, true);
    const walk = (node: THREE.Object3D) => {
      if (node.userData.helper) return;
      const mesh = node as THREE.Mesh;
      if (
        (mesh.isMesh || (node as THREE.SkinnedMesh).isSkinnedMesh) &&
        mesh.geometry
      ) {
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const local = geometry.boundingBox;
        if (local) {
          for (let i = 0; i < 8; i += 1) {
            corner.set(
              i & 1 ? local.max.x : local.min.x,
              i & 2 ? local.max.y : local.min.y,
              i & 4 ? local.max.z : local.min.z,
            );
            box.expandByPoint(corner.applyMatrix4(node.matrixWorld));
          }
        }
      }
      node.children.forEach(walk);
    };
    walk(root);
    return box;
  };

  /** 지금 고른 인물·소품·GLB 의 뿌리. 없으면 null. */
  const selectedRoot = () => {
    const picked = handlers.current.selected;
    return (
      (picked.startsWith("character:") &&
        scene.characterRoots.get(picked.slice(10))) ||
      (picked.startsWith("object:") &&
        scene.objectRoots.get(picked.slice(7))) ||
      (picked.startsWith("glb:") && scene.glbRoots.get(picked.slice(4))) ||
      null
    );
  };

  /** 지금 고른 인물·소품·GLB 의 가슴 높이 한 점. 없으면 null. */
  const selectionPoint = () => {
    const root = selectedRoot();
    if (!root) return null;
    const box = bodyBox(root);
    if (box.isEmpty()) return null;
    const center = box.getCenter(new THREE.Vector3());
    center.y = orbitChestHeight(box.min.y, box.max.y);
    return center;
  };

  /** 시선점을 부드럽게 옮기기 시작합니다. 다 옮기면 저장까지 합니다. */
  const glideTo = (point: THREE.Vector3) => {
    const moved = controls.target.distanceTo(point);
    const radius = Math.max(
      ORBIT_MIN_RADIUS,
      camera.position.distanceTo(controls.target),
    );
    // 1cm 도 안 되면 옮길 게 없습니다. 굳이 애니메이션을 걸면 저장만 늘어납니다.
    if (moved < 0.01) return;
    scene.orbitGlide = {
      from: controls.target.clone(),
      to: point.clone(),
      start: performance.now(),
      ms: orbitGlideMs(moved, radius),
    };
  };

  /**
   * 시선 축 위 바닥 교점으로 시선점을 **즉시** 옮깁니다.
   * 교점이 시선 축 위라 화면은 한 픽셀도 안 움직입니다(부드럽게 할 이유가 없음).
   */
  const focusViewCenter = () => {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const distance = orbitGroundAhead(camera.position.y, forward.y);
    if (distance === null) return false;
    controls.target.copy(camera.position).addScaledVector(forward, distance);
    return true;
  };

  /** 누른 자리에 무엇이 있는지 — 인물·소품·GLB 를 먼저 보고, 없으면 바닥(y=0). */
  const pointFromEvent = (event: MouseEvent): THREE.Vector3 | null => {
    const point = ndc(event);
    if (!point) return null;
    raycaster.setFromCamera(point, camera);
    const solid = firstSolid();
    if (solid) return solid.point.clone();
    return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  };

  /**
   * 화면 한가운데에 있는 것을 회전축으로 다시 잡습니다. **그림은 한 픽셀도 안 움직입니다.**
   *
   * 시선점을 시선 축을 따라 앞뒤로만 옮기는 것이라 카메라 자리도 방향도 그대로입니다 —
   * 바뀌는 것은 «무엇을 중심으로 도는가» 뿐입니다. 그래서 글라이드가 필요 없습니다.
   *
   * 왜 돌리기 시작할 때마다 다시 잡는가: 줌·걷기로 파고들면 시선점은 예전 자리에 남습니다.
   * 코앞의 인물을 보면서 10m 뒤의 점을 축으로 돌면 조금만 끌어도 인물이 화면 밖으로
   * 날아갑니다().
   *
   * ## 바닥은 «너무 멀면» 안 씁니다
   *
   * 지평선 근처를 보면 바닥까지의 거리가 수백 미터로 발산합니다. 그 점을 축으로 잡으면
   * 5m 앞의 인물이 손톱만 한 각도에도 화면을 가로질러 날아갑니다 — 사용자 2026-09-11:
   * 「우클릭으로 화면 이동하고 난 뒤부터 좌클릭으로 회전하는 게 휙휙 가는데? 앵커 설정한
   * 거 안 먹고?」. 화면을 옮기면 지평선이 한가운데로 오기 쉬워 바로 이 일이 납니다.
   * 그래서 바닥은 «지금 거리의 세 배» 까지만 받아들이고, 그보다 멀면 지금 거리를 그대로
   * 둡니다. 인물·소품에 맞았으면 그 거리는 얼마든 씁니다 — «보고 있는 것» 이 확실하니까요.
   */
  const anchorToViewCenter = () => {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const current = camera.position.distanceTo(controls.target);
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const solid = firstSolid();
    let distance = solid ? solid.distance : null;
    if (distance === null) {
      const ground = raycaster.ray.intersectPlane(
        groundPlane,
        new THREE.Vector3(),
      );
      const far = Math.max(ORBIT_MIN_RADIUS, current) * 3;
      if (ground) {
        const reach = camera.position.distanceTo(ground);
        if (reach <= far) distance = reach;
      }
    }
    if (distance === null || !Number.isFinite(distance)) {
      if (!Number.isFinite(current) || current < ORBIT_MIN_RADIUS) return;
      distance = current;
    }
    const radius = Math.max(
      ORBIT_MIN_RADIUS,
      Math.min(ORBIT_MAX_RADIUS, distance),
    );
    controls.target.copy(camera.position).addScaledVector(forward, radius);
  };

  /**
   * 화면에서 찍은 것이 인물·소품·GLB 중 무엇인가. 없으면 null.
   *
   * 맞힌 메시에서 부모를 거슬러 올라가 «등록된 뿌리» 를 찾습니다. 리그드 모델은 메시가
   * 수십 개로 갈라져 있어 맞힌 메시 자체로는 누구인지 알 수 없습니다.
   */
  const pickFromEvent = (event: MouseEvent): string | null => {
    const point = ndc(event);
    if (!point) return null;
    raycaster.setFromCamera(point, camera);
    /*
      ── Shift 를 누르고 찍으면 **방** ────────────────────────────────────
      

      방은 인물·소품을 **감싸고** 있어서, 그냥 찍으면 앞의 것이 늘 먼저 잡힙니다. 그래서 Shift 일 때만
      방 껍질을 봅니다 — 그 동안은 앞의 것을 아예 보지 않습니다.
    */
    if (event.shiftKey) {
      const shells = scene.background.rooms.flatMap((entry) =>
        [entry.inner, entry.outer].filter(Boolean),
      ) as THREE.Object3D[];
      for (const hit of raycaster.intersectObjects(shells, true)) {
        const found = scene.background.rooms.find(
          (entry) =>
            hit.object === entry.inner ||
            hit.object === entry.outer ||
            hit.object.parent === entry.inner ||
            hit.object.parent === entry.outer,
        );
        if (found) return `room:${found.id}`;
      }
      // 방을 못 찾았으면 아무것도 고르지 않습니다 — Shift 는 «방만» 이라는 뜻입니다.
      return null;
    }
    for (const hit of raycaster.intersectObject(scene.foreground, true)) {
      if (!hit.object.visible || hit.object.userData.helper) continue;
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        for (const [id, root] of scene.characterRoots)
          if (root === node) return `character:${id}`;
        for (const [id, root] of scene.objectRoots)
          if (root === node) return `object:${id}`;
        for (const [id, root] of scene.glbRoots)
          if (root === node) return `glb:${id}`;
        node = node.parent;
      }
    }
    return null;
  };

  /** 돌리기도 집기도 하면 안 되는 때 — 재생 중·기즈모 끄는 중·바닥 배치 중. */
  const busy = () =>
    previewing.current ||
    transform.dragging ||
    Boolean(transform.axis) ||
    handlers.current.groundPlacing;

  /*
    ── 화면에서 바로 집기 ──────────────────────────────────────────────────
    

    **끌지 않고 뗐을 때만** 고릅니다. 누르자마자 고르면 돌리려고 누른 것까지 선택이 되어,
    화면을 돌릴 때마다 고른 것이 바뀝니다. 3px 이상 움직였으면 «돌린 것» 으로 봅니다.
    빈 곳을 찍으면 선택을 풉니다 — 기즈모를 치우고 싶을 때 누를 자리가 있어야 합니다.
  */
  let pickStart: { x: number; y: number } | null = null;

  return {
    /** 왼쪽 버튼을 누르는 순간(=돌리기 시작) 축을 화면 한가운데로. 화면은 안 바뀝니다. */
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0 || busy()) return;
      if (scene.orbitGlide) return;
      pickStart = { x: event.clientX, y: event.clientY };
      anchorToViewCenter();
    },

    onPointerUp(event: PointerEvent) {
      const start = pickStart;
      pickStart = null;
      if (!start || event.button !== 0 || busy()) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 3)
        return;
      const picked = pickFromEvent(event);
      if (picked !== handlers.current.selected)
        handlers.current.onSelect(picked ?? "");
    },

    onDoubleClick(event: MouseEvent) {
      if (event.button !== 0 || busy()) return;
      if (scene.orbitGlide) return;
      const point = pointFromEvent(event);
      if (point) {
        glideTo(point);
        return;
      }
      if (selectionPoint()) return;
      focusViewCenter();
    },

    /**
     * «고른 인물로 중심 옮기기»(F). 고른 것이 없으면 화면 한가운데 바닥으로.
     * 무엇을 중심으로 잡았는지 한 줄로 돌려줍니다 — 회전축은 눈에 안 보이니
     * 무엇을 잡았는지 말해 주지 않으면 「모르겠다」 가 그대로 남습니다.
     */
    focus(): string | null {
      const point = selectionPoint();
      if (point) {
        glideTo(point);
        const picked = handlers.current.selected;
        const name = picked.startsWith("character:")
          ? handlers.current.characters.find(
              (item) => item.id === picked.slice(10),
            )?.name
          : null;
        return `${name || "고른 것"} 을(를) 회전 중심으로 잡았습니다`;
      }
      scene.orbitGlide = null;
      if (!focusViewCenter()) return null;
      if (!previewing.current) deps.commitCameraPose();
      const ahead = camera.position.distanceTo(controls.target);
      return `화면 한가운데 바닥(${ahead.toFixed(1)} m 앞)을 회전 중심으로 잡았습니다`;
    },

    /**
     * 회전 중심을 **화면 한가운데 바닥**으로 되돌립니다(Ctrl+F).
     *
     * 인물을 고른 채로는 `focus` 가 늘 그 인물을
     * 잡으므로, 고른 것을 풀지 않고도 한가운데로 되돌릴 길이 필요합니다.
     */
    focusViewCenter(): string | null {
      scene.orbitGlide = null;
      if (!focusViewCenter()) return null;
      if (!previewing.current) deps.commitCameraPose();
      const ahead = camera.position.distanceTo(controls.target);
      return `화면 한가운데 바닥(${ahead.toFixed(1)} m 앞)을 회전 중심으로 잡았습니다`;
    },

    /**
     * 고른 것 **앞으로 카메라를 옮깁니다**(M). 무엇으로 갔는지 한 줄, 고른 것이 없으면 null.
     *
     * 보던 방향은 그대로 두고 거리만 정합니다 — 방향까지 바꾸면 «어디서 보고 있었나» 를 잃어
     * 구도 잡던 흐름이 끊깁니다. 거리는 몸을 감싸는 구가 화면의 좁은 쪽 화각 안에 들어오는 만큼
     * (조금 여유). 너무 내려다보거나 올려다보던 중이면 45° 로 눕힙니다 — 발밑·정수리만 크게
     * 잡히면 «그 앞으로 갔다» 가 아니게 됩니다. 바닥 밑으로는 안 내려갑니다.
     */
    frameSelection(): string | null {
      const root = selectedRoot();
      if (!root) return null;
      const box = bodyBox(root);
      if (box.isEmpty()) return null;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const vertical = THREE.MathUtils.degToRad(camera.fov);
      const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
      const half = Math.min(vertical, horizontal) / 2;
      const distance = Math.min(
        ORBIT_MAX_RADIUS,
        Math.max(ORBIT_MIN_RADIUS * 2, (sphere.radius / Math.sin(half)) * 1.15),
      );
      const forward = camera.getWorldDirection(new THREE.Vector3());
      const limit = Math.sin(Math.PI / 4);
      if (Math.abs(forward.y) > limit) {
        const flat = Math.hypot(forward.x, forward.z) || 1;
        const scale = Math.sqrt(1 - limit * limit) / flat;
        forward.set(forward.x * scale, Math.sign(forward.y) * limit, forward.z * scale);
        // 곧장 위·아래를 보던 중이면 수평 성분이 없습니다 — 그때는 앞(−Z)에서 봅니다.
        if (flat < 1e-3) forward.set(0, Math.sign(forward.y) * limit, -Math.sqrt(1 - limit * limit));
      }
      const target = sphere.center.clone();
      const position = target.clone().addScaledVector(forward.normalize(), -distance);
      position.y = Math.max(0.1, position.y);
      scene.orbitGlide = {
        from: controls.target.clone(),
        to: target,
        camFrom: camera.position.clone(),
        camTo: position,
        start: performance.now(),
        ms: 450,
      };
      const picked = handlers.current.selected;
      const name = picked.startsWith("character:")
        ? handlers.current.characters.find((item) => item.id === picked.slice(10))?.name
        : null;
      return `${name || "고른 것"} 앞으로 카메라를 옮겼습니다`;
    },

    /** 글라이드를 한 프레임 진행합니다. 매 프레임 불러야 합니다. */
    advanceGlide() {
      const glide = scene.orbitGlide;
      if (!glide) return;
      const t = (performance.now() - glide.start) / glide.ms;
      controls.target.lerpVectors(glide.from, glide.to, orbitEase(t));
      if (glide.camFrom && glide.camTo)
        camera.position.lerpVectors(glide.camFrom, glide.camTo, orbitEase(t));
      if (t < 1) return;
      scene.orbitGlide = null;
      // 다 옮긴 뒤 한 번만 저장합니다 — 프레임마다 저장하면 되돌리기가 잠깁니다.
      if (!previewing.current) deps.commitCameraPose();
    },

    /**
     * 화각·거리에 맞춘 회전 감도를 매 프레임 다시 겁니다.
     * 화각은 카메라 무빙이, 거리는 줌·걷기가 계속 바꾸므로 한 번 걸어 두면 낡습니다.
     */
    applyFeel() {
      const radius = camera.position.distanceTo(controls.target);
      // 사람이 정한 배수를 곱합니다 — 자동값(화각·거리)은 그대로 두고 손맛만 옮깁니다.
      const speed = orbitSpeedOf(handlers.current.composition);
      controls.rotateSpeed = orbitRotateSpeed(camera.fov, radius) * speed;
      // 줌도 같이. 1.0 이 three 기본이라 배수를 그대로 곱하면 «휙휙» 이 함께 잡힙니다.
      controls.zoomSpeed = speed;
    },
  };
}

export type OrbitHandle = ReturnType<typeof createOrbit>;
