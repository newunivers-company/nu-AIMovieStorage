/**
 * **글자를 치는 중인가.**
 *
 * 창 전체에 건 단축키(Ctrl+Z·K·스페이스…)는 입력란 안에서 받으면 안 됩니다.
 * 이름을 고치다 스페이스를 누르면 띄어쓰기 대신 재생이 시작되고, 칸 안에서 Ctrl+Z 를
 * 누르면 글자 대신 구도가 통째로 되돌아갑니다.
 *
 * 한 벌로 모은 까닭: 2026-09-18 점검에서 **같은 가드가 아홉 벌** 발견됐는데
 * (구도잡기 넷·타임라인 넷·칸 자르기 하나) 그중 하나만 `select` 를 빠뜨리고 있었습니다.
 * 고르개 안에서 Ctrl+Z 를 누르면 구도가 되돌아가던 것이 그 탓입니다 — 여덟 곳은
 * 맞고 한 곳만 틀린 꼴이라, 읽어서는 절대 못 찾습니다(규칙 1).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest("input, textarea, select, [contenteditable='true']")
  );
}
