import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPOSITION,
  HORIZON_DEFAULT_COLOR,
  describeHorizonRoom,
  horizonColorOf,
  horizonOverridesLocation,
  normalizeCompositionRoom,
} from "./composition";
import { addRoomIn, setRoomHiddenIn, setRoomHorizonColorIn } from "./compositionEdit/rooms";
import { buildCutPrompt } from "./cutPrompt";
import type { Background, Cut } from "./projectTypes";

/*
  호리존 방이 **저장본을 지나도 살아남는지** — 정규화가 새 칸을 떨어뜨리면 다시 열 때 호리존이
  빈 실내 방이 됩니다. 이 저장소에서 새 칸이 사라진 사고의 모양이 늘 그것이었습니다.
*/
describe("호리존 방", () => {
  it("정규화가 호리존 색을 지킵니다", () => {
    const room = normalizeCompositionRoom({ id: "r1", name: "호리존 1", horizon: { color: "#F2F2F2" } });
    expect(room.horizon).toEqual({ color: "#f2f2f2" });
  });

  it("모양이 틀린 색은 떨어뜨립니다 — 검은 벽 대신 보통 방", () => {
    expect(normalizeCompositionRoom({ id: "r1", horizon: { color: "white" } }).horizon).toBeUndefined();
    expect(normalizeCompositionRoom({ id: "r1", horizon: { color: "#fff" } }).horizon).toBeUndefined();
    expect(horizonColorOf(" #AbCdEf ")).toBe("#abcdef");
    expect(horizonColorOf(12)).toBeUndefined();
  });

  it("실외 표와 호리존이 같이 저장돼 있으면 호리존이 이깁니다 — 갈래는 하나", () => {
    // 돔 안내선은 뜨는데 껍질은 숨는 «반쪽 실외» 를 막습니다. 색을 일부러 적은 쪽이 갈래입니다.
    const room = normalizeCompositionRoom({ id: "r1", outdoor: true, horizon: { color: "#ffffff" } });
    expect(room.horizon).toEqual({ color: "#ffffff" });
    expect(room.outdoor).toBeUndefined();
    // 색이 모양이 틀려 떨어지면 실외 표는 그대로 삽니다 — 실외 방을 실내로 만들면 안 되니까요.
    expect(normalizeCompositionRoom({ id: "r2", outdoor: true, horizon: { color: "white" } }).outdoor).toBe(true);
  });

  it("호리존을 세우면 색·이름·치수가 정해지고 실외 갈래는 안 붙습니다", () => {
    const made = addRoomIn(DEFAULT_COMPOSITION, "horizon");
    const room = made.state.rooms?.find((item) => item.id === made.id);
    expect(room?.name).toBe("호리존 1");
    expect(room?.horizon).toEqual({ color: HORIZON_DEFAULT_COLOR });
    expect(room?.outdoor).toBeUndefined();
    expect([room?.width, room?.depth, room?.height]).toEqual([8, 6, 4]);
    expect(room?.faces).toEqual({});
  });

  it("색 바꾸기는 호리존 방에만 듣고, 프롬프트 문장에 그 색이 실립니다", () => {
    const made = addRoomIn(DEFAULT_COMPOSITION, "horizon");
    const painted = setRoomHorizonColorIn(made.state, made.id, "#00B140");
    expect(painted.rooms?.[0].horizon?.color).toBe("#00b140");
    const line = describeHorizonRoom(painted);
    expect(line?.ko).toContain("#00b140");
    expect(line?.en).toContain("cyclorama");

    const indoor = addRoomIn(DEFAULT_COMPOSITION, "indoor");
    const untouched = setRoomHorizonColorIn(indoor.state, indoor.id, "#00b140");
    expect(untouched.rooms?.[0].horizon).toBeUndefined();
    expect(describeHorizonRoom(untouched)).toBeNull();
  });
});

/*
  **호리존이 장소를 이깁니다** — 컷에 배경을 골라 둔 채 호리존 방을 활성으로 두면 «장소는 …» 과 «배경: 호리존 …» 이
  한 프롬프트에 같이 실리던 것(2026-09-22 점검). 규칙은 `horizonOverridesLocation` 한 벌이고, 컷 프롬프트가 그것을 따릅니다.
*/
describe("호리존이 장소를 이깁니다", () => {
  const cafe = {
    id: "bg-cafe",
    name: "카페",
    description: "창가 자리, 오후 햇살",
  } as Background;
  const cutWith = (composition: Cut["composition"], useComposition?: boolean): Cut =>
    ({
      id: "cut-1",
      title: "컷",
      description: "",
      characterIds: [],
      backgroundId: cafe.id,
      composition,
      useComposition,
    }) as Cut;

  it("판단은 한 벌 — 활성 방이 숨기지 않은 호리존일 때만", () => {
    expect(horizonOverridesLocation(undefined)).toBe(false);
    expect(horizonOverridesLocation(DEFAULT_COMPOSITION)).toBe(false);
    expect(horizonOverridesLocation(addRoomIn(DEFAULT_COMPOSITION, "indoor").state)).toBe(false);

    const studio = addRoomIn(DEFAULT_COMPOSITION, "horizon");
    expect(horizonOverridesLocation(studio.state)).toBe(true);
    // 숨긴 호리존은 화면에 없으니 배경도 아닙니다 — `describeHorizonRoom` 과 같은 판단.
    expect(horizonOverridesLocation(setRoomHiddenIn(studio.state, studio.id, true))).toBe(false);
  });

  it("호리존이 활성이면 «장소는 …» 줄과 facts.location 이 빠지고 호리존 문장만 실립니다", () => {
    const studio = addRoomIn(DEFAULT_COMPOSITION, "horizon");
    const result = buildCutPrompt({ cut: cutWith(studio.state), characters: [], background: cafe, context: null });
    expect(result.ko).not.toContain("장소는 카페");
    expect(result.en).not.toContain("Location: 카페");
    expect(result.facts.location).toBeUndefined();
    expect(result.facts.horizon).toEqual({ color: HORIZON_DEFAULT_COLOR });
    expect(result.en).toContain("cyclorama");
  });

  it("실내 방이거나 «구도 안 씀» 이면 장소가 그대로 실립니다", () => {
    const indoor = addRoomIn(DEFAULT_COMPOSITION, "indoor");
    const plain = buildCutPrompt({ cut: cutWith(indoor.state), characters: [], background: cafe, context: null });
    expect(plain.ko).toContain("장소는 카페");
    expect(plain.facts.location).toBe("카페");
    expect(plain.facts.horizon).toBeUndefined();

    // 구도를 끄면 호리존 방이 있어도 구도를 안 읽습니다 — 장소가 이깁니다.
    const studio = addRoomIn(DEFAULT_COMPOSITION, "horizon");
    const off = buildCutPrompt({ cut: cutWith(studio.state, false), characters: [], background: cafe, context: null });
    expect(off.ko).toContain("장소는 카페");
    expect(off.facts.horizon).toBeUndefined();
  });
});
