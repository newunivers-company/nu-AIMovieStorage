import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyRoomDrift } from "@/components/composition/viewport/sceneHelpers";
import { ROOM_DRIFT_MAX, roomDriftOf } from "@/lib/composition";

/*
  **배경 흐름이 «시각에 따라» 움직이는지 실제로 재 봅니다.**

  화면에서만 흐르고 레퍼런스 영상에 한 프레임도 안 찍히면 이 기능은 헛일입니다. 그 둘을
  가르는 것은 «offset 이 프레임 수가 아니라 절대 시각에서 나오는가» 하나입니다 —
  재생은 60fps, 캡처는 24fps 로 돌기 때문에 프레임 수를 세면 두 영상이 서로 달라집니다.

  그래서 같은 시각을 주면 늘 같은 오프셋이 나오고(캡처가 재생을 재현할 수 있고),
  다른 시각을 주면 그만큼 움직이는지를 봅니다.
*/
describe("배경 흐름", () => {
  const fresh = () => {
    const texture = new THREE.Texture();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };

  it("같은 시각이면 늘 같은 자리 — 캡처가 재생을 그대로 재현합니다", () => {
    const a = fresh();
    const b = fresh();
    applyRoomDrift([a], { x: 0.2, y: 0 }, 1.5);
    // 재생 루프가 여러 번 지나간 뒤 캡처가 같은 시각을 물어본 상황.
    applyRoomDrift([b], { x: 0.2, y: 0 }, 0.4);
    applyRoomDrift([b], { x: 0.2, y: 0 }, 0.9);
    applyRoomDrift([b], { x: 0.2, y: 0 }, 1.5);
    expect(b.offset.x).toBeCloseTo(a.offset.x, 6);
    expect(b.offset.y).toBeCloseTo(a.offset.y, 6);
  });

  it("시각이 흐르면 그만큼 움직입니다", () => {
    const t = fresh();
    applyRoomDrift([t], { x: 0.25, y: 0 }, 0);
    const start = t.offset.x;
    applyRoomDrift([t], { x: 0.25, y: 0 }, 2);
    // 초당 0.25배씩 2초 → 0.5배. 감싸기(RepeatWrapping)라 1을 넘으면 되돌아옵니다.
    const moved = Math.abs(((t.offset.x - start) % 1) + 1) % 1;
    expect(moved).toBeCloseTo(0.5, 6);
  });

  it("끄면 움직이지 않습니다", () => {
    const t = fresh();
    applyRoomDrift([t], undefined, 3);
    expect(t.offset.x).toBe(0);
    expect(t.offset.y).toBe(0);
  });

  it("속도는 상한에 묶입니다 — 손으로 고친 저장본이 배경을 날려 버리지 않게", () => {
    expect(roomDriftOf({ x: 999, y: -999 })).toEqual({ x: ROOM_DRIFT_MAX, y: -ROOM_DRIFT_MAX });
    expect(roomDriftOf({ x: 0, y: 0 })).toBeUndefined();
    expect(roomDriftOf("이상한 값")).toBeUndefined();
  });
});
