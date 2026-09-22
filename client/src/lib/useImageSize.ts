import { useEffect, useState } from "react";

/*
  **그림의 원본 크기(px)를 재는 한 벌.**

   자르기 탭은 그림을 창에 맞춰
  줄여 보여 주므로 화면에서 보는 크기와 실제 파일 크기가 다릅니다. «1024 × 1536» 을 적어 두면
  ① 자른 칸이 몇 px 로 나올지 ② 업스케일이 필요한지 ③ 시트에 넣어도 될 크기인지 바로 압니다.

  재는 법은 `Image` 하나를 띄워 `naturalWidth/Height` 를 읽는 것뿐이고, 브라우저가 이미 받아 둔
  그림이면 캐시에서 즉시 옵니다. 주소가 바뀌면 다시 재고, 그 전에 뜬 답은 버립니다 — 목록을
  빠르게 넘길 때 먼저 보낸 것이 나중에 도착해 엉뚱한 크기를 적는 일을 막습니다.
*/

export interface ImageSize {
  width: number;
  height: number;
}

export function useImageSize(src: string | undefined | null): ImageSize | null {
  const [size, setSize] = useState<ImageSize | null>(null);

  useEffect(() => {
    if (!src) {
      setSize(null);
      return;
    }
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (alive) setSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    // 못 읽어도 화면은 그대로 둡니다 — 크기는 «있으면 좋은 것» 이지 없으면 안 되는 것이 아닙니다.
    image.onerror = () => {
      if (alive) setSize(null);
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  return size;
}

/** 「1024 × 1536」. 없으면 빈 글자 — 부르는 쪽에서 그대로 넣어도 됩니다. */
export function sizeLabel(size: ImageSize | null | undefined): string {
  return size ? `${size.width} × ${size.height}` : "";
}
