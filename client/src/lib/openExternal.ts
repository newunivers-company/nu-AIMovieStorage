import { invoke } from "@tauri-apps/api/core";

/**
 * **기본 브라우저로 주소를 엽니다.**
 *
 * 웹뷰의 `window.open` 은 Tauri 안에서 아무 일도 하지 않습니다. 앱 안에서 열어서도 안 됩니다 — 로그인 쿠키가 따로 놀아
 * **매번 다시 로그인**하게 됩니다.
 *
 * Rust 쪽은 `cmd /C start` 가 아니라 `rundll32 url.dll,FileProtocolHandler` 를 씁니다.
 * 앞엣것은 `&` 를 셸이 먹어 주소가 잘리는데, OAuth 주소에는 `&` 가 늘 있습니다.
 *
 * https 만 엽니다 — 다른 것을 열 일도, 열어 줄 이유도 없습니다.
 */
export function openExternal(url: string): Promise<void> {
  return invoke("open_external", { url });
}
