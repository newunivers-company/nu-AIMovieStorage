import { useEffect } from "react";

/**
 * **Esc 로 창을 닫습니다** — 우리가 직접 만든 모달이 같은 규칙을 쓰게.
 *
 * 사용자 2026-09-18 전수 점검에서 드러난 것입니다. Esc 를 듣는 창이 네 개뿐이었고
 * (`MotionCaptureDialog`·`ConfirmDialog`·`ImageLightbox`·`PromptDialog`), 나머지는
 * 오른쪽 위 X 를 찾아 눌러야 했습니다. 「AI 로 일괄 생성」 창은 Esc 를 아무리 눌러도
 * 안 닫혀서, 시험하던 저도 창이 떠 있는 줄 모르고 뒤에 있는 단추를 누르고 있었습니다.
 *
 * 규칙 1(공통 기능은 공통 컴포넌트) 그대로입니다 — 창마다 따로 적으면 다음에 새로 만든
 * 창에서 또 빠집니다.
 *
 * # 잡는 단계에서 끊습니다
 *
 * 확인 창이 위에 겹쳐 있을 때 Esc 를 누르면 **둘 다** 받습니다. 그러면 확인만 닫으려던
 * 것이 편집 창까지 닫습니다(`ConfirmDialog` 가 같은 이유로 capture 를 씁니다).
 * 그래서 여기서도 capture 로 받고, 처리했으면 더 내려가지 않게 막습니다.
 *
 * `enabled` 가 거짓이면 아무것도 듣지 않습니다 — 창이 닫혀 있는 동안 Esc 를 가로채면
 * 뒤에 있는 창이 못 닫힙니다.
 */
export function useEscapeClose(enabled: boolean, close: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      /*
        글을 쓰는 중이면 그냥 둡니다. 한글 입력기가 조합 중일 때의 Esc 는 «조합 취소» 라
        창을 닫을 뜻이 아닙니다 — 여기서 닫으면 쓰던 글이 통째로 사라집니다.
      */
      if (event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, close]);
}

export default useEscapeClose;
