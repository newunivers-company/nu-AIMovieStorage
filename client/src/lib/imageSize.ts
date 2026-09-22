/**
 * 그림의 가로세로비를 재는 **한 벌짜리** 도우미.
 *
 * 2026-09-12 정리에서 합쳤습니다. `usePlannerMedia` 와 `CompositionPlanner` 에 거의 같은
 * 코드가 따로 있었는데, 한쪽에만 «높이 0 방어» 가 있었습니다. 그쪽만 고친 흔적입니다 —
 * 방어가 없는 판은 0-높이 그림에서 `Infinity` 를 돌려주고, 그 값이 방 비율로 들어가면
 * 상자가 통째로 사라집니다.
 */

/**
 * 주소를 읽어 가로÷세로를 돌려줍니다. 못 읽거나 높이가 0 이면 `null`.
 *
 * 던지지 않고 `null` 을 주는 까닭: 부르는 쪽이 전부 «재 보고 되면 쓴다» 라서, 실패를
 * 예외로 올리면 호출부마다 try 가 붙습니다.
 */
export function measureAspect(url?: string | null): Promise<number | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const image = new Image();
    image.onload = () =>
      resolve(
        image.naturalHeight > 0
          ? image.naturalWidth / image.naturalHeight
          : null,
      );
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
