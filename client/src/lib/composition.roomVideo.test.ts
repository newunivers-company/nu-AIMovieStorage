import { describe, expect, it } from "vitest";
import {
  isDomeRoom,
  normalizeCompositionRoom,
  roomVideoFaceOf,
  roomVideoOf,
} from "./composition";
import { isVideoFile } from "./mediaLibrary";

/*
  배경 영상(면·돔에 거는 `<video>`)이 **저장본을 지나도 살아남는지**, 그리고 **안 보이는 면에 걸리지
  않는지**. 새 칸이 정규화에서 떨어져 다시 열 때 사라지는 것이 이 저장소에서 반복된 사고의 모양이고,
  면이 방 모양과 어긋나면 「켰는데 아무 일도 안 일어난다」 가 됩니다 — 둘 다 읽어서는 못 찾습니다.
*/
describe("배경 영상", () => {
  it("정규화가 걸어 둔 영상을 지킵니다", () => {
    const room = normalizeCompositionRoom({
      id: "r1",
      video: { face: "back", source: "D:/작품/장소/거리_배경영상_001.mp4" },
    });
    expect(room.video).toEqual({ face: "back", source: "D:/작품/장소/거리_배경영상_001.mp4" });
  });

  it("안 건 방은 없음 — 기본은 꺼짐입니다", () => {
    expect(normalizeCompositionRoom({ id: "r1" }).video).toBeUndefined();
    expect(roomVideoOf(undefined)).toBeUndefined();
    expect(roomVideoOf("mp4")).toBeUndefined();
  });

  it("면 이름이 이상하면 정면으로 돌립니다 — 켠 것을 조용히 끄지 않습니다", () => {
    expect(roomVideoOf({ face: "왼쪽", source: "a.mp4" })).toEqual({ face: "front", source: "a.mp4" });
    expect(roomVideoOf({ face: "panorama" })).toEqual({ face: "panorama", source: "" });
  });

  it("켜 두고 아직 안 고른 상태가 남습니다 — 목록이 비었을 때 만들기를 눌러야 하니까요", () => {
    const room = normalizeCompositionRoom({ id: "r1", video: { face: "front", source: "" } });
    expect(room.video).toEqual({ face: "front", source: "" });
  });

  it("걸 자리는 지금 방 모양이 정합니다 — 돔은 늘 돔 전체", () => {
    const dome = normalizeCompositionRoom({
      id: "r1",
      outdoor: true,
      video: { face: "front", source: "a.mp4" },
    });
    expect(isDomeRoom(dome)).toBe(true);
    expect(roomVideoFaceOf(dome)).toBe("panorama");

    // 방형으로 바꾼 실외에 돔 값이 남아 있으면 정면으로 — 안 보이는 자리에 걸리지 않게.
    const box = normalizeCompositionRoom({
      id: "r2",
      outdoor: true,
      outdoorShape: "box",
      video: { face: "panorama", source: "a.mp4" },
    });
    expect(isDomeRoom(box)).toBe(false);
    expect(roomVideoFaceOf(box)).toBe("front");

    // 실내는 적어 둔 면 그대로입니다.
    expect(
      roomVideoFaceOf(normalizeCompositionRoom({ id: "r3", video: { face: "top", source: "a.mp4" } })),
    ).toBe("top");
  });
});

/*
  폴더 읽기는 그림과 영상을 함께 돌려줍니다. 나누는 규칙이 한 벌이어야 «그 화면에서만 영상이 깨진
  그림으로 뜨는» 어긋남이 안 생깁니다.
*/
describe("영상 파일 가리기", () => {
  it("확장자로 가립니다 — 대소문자와 asset:// 주소까지", () => {
    expect(isVideoFile("D:/a/거리_001.mp4")).toBe(true);
    expect(isVideoFile("D:/a/거리_001.MOV")).toBe(true);
    expect(isVideoFile("http://asset.localhost/D%3A%2Fa%2F%EA%B1%B0%EB%A6%AC_001.webm")).toBe(true);
    expect(isVideoFile("D:/a/거리_001.png")).toBe(false);
    expect(isVideoFile("")).toBe(false);
    expect(isVideoFile(null)).toBe(false);
  });
});
