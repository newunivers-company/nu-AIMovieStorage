/*
  `lib/compositionEdit.ts` 를 갈래별로 나눈 조각입니다(2026-09-17).

  한 파일에 순수 함수 174개가 모여 3,900줄이 되면서 «어디에 있더라» 를 매번 찾아야 했습니다.
  파일 안에 이미 그어 두었던 구분선을 그대로 파일 경계로 삼았고, 부르는 길은 그대로입니다
  (`@/lib/compositionEdit` 배럴이 전부 다시 내보냅니다).
*/

export * from "./compositionEdit/core";
export * from "./compositionEdit/characters";
export * from "./compositionEdit/props";
export * from "./compositionEdit/background";
export * from "./compositionEdit/rooms";
export * from "./compositionEdit/groups";
export * from "./compositionEdit/pivot";
export * from "./compositionEdit/glb";
export * from "./compositionEdit/timeline";
export * from "./compositionEdit/orbit";
