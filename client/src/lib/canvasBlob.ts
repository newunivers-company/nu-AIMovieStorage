/**
 * 캔버스를 PNG blob 으로. 두 줄짜리지만 창마다 따로 적어 두면 화질 설정(`image/png`)이
 * 갈립니다 — 한 군데가 `image/jpeg` 로 새면 레퍼런스에 압축 자국이 남습니다.
 */
export function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}
