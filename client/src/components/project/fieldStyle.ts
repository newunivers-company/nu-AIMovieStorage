/**
 * 입력 칸(input·select·textarea)의 공통 모양.
 *
 * 일곱 파일에 같은 값이 복사돼 있었습니다. 한 군데서 색을 고치면 나머지가
 * 남아 페이지마다 칸 색이 달라집니다. 캐릭터 페이지가 기준입니다(규칙 2) —
 * 다른 값이 필요하면 여기를 고치지 말고 그 자리에서 덮어쓰세요.
 */
export const fieldStyle = {
  background: "oklch(0.18 0.012 265)",
  border: "1px solid oklch(1 0 0 / 10%)",
  color: "white",
} as const;
