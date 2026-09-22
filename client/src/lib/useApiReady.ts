import { useEffect, useState } from "react";
import { getActiveProvider, getApiKeyStatus } from "@/lib/llm";

/**
 * 지금 고른 제공자의 API 키가 저장돼 있는가.
 *
 * 키가 없으면 「이미지 분석」·「프롬프트 작성」 같은 API 단추를 **미리
 * 막습니다.** 예전에는 누를 수는 있고 실패한 뒤에야 토스트로 알렸습니다.
 * 몇 십 초를 기다린 끝에 「연결이 안 됐습니다」 를 보는 것은 최악입니다.
 * (지시 113)
 *
 * 작업별 모델은 제공자마다 따로 저장되지만, 실제로 부를 때 쓰는 것은 지금
 * 고른 쪽 하나뿐이라 그것만 봅니다.
 */
export function useApiReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      void getApiKeyStatus(getActiveProvider())
        .then((status) => alive && setReady(status.saved))
        .catch(() => alive && setReady(false));

    check();
    // 설정에서 키를 넣고 돌아왔을 때 바로 풀리게 합니다. 창을 다시 볼 때
    // 확인하면 새로고침 없이도 맞춰집니다.
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return ready;
}
