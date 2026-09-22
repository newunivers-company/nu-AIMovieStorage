import { useState } from "react";
import { assetSrc } from "@/lib/mediaLibrary";

/**
 * 구운 시트 한 장을 **작게 보여 주고, 누르면 크게** 띄웁니다.
 *
 * 스토리보드 시트가 화면을 통째로 차지하던 것을 접은 자리입니다.
 *
 * 시트는 가로가 1,660~6,340px 입니다. `w-full` 로 깔면 어느 화면에서든 시트 한 장이 목록을
 * 통째로 밀어냅니다. 그렇다고 원래 크기로 두어도 화면보다 큽니다 — **높이를 묶고** 누르면
 * 화면에 맞춰 통째로 보여 주는 것이 두 화면 모두에 맞았습니다.
 *
 * 부품으로 뽑은 까닭: 씬 구성 탭과 확인 탭에 같은 것을 두 벌 적었다가 한쪽만 고쳐,
 * 같은 자리를 두 번 고치게 됐습니다(공통 규칙 1 — 공통 기능은 공통 컴포넌트로).
 */
export default function SheetPreview({
  path,
  alt,
  maxHeight = 280,
}: {
  /** 프로젝트 폴더 안의 그림 경로. */
  path: string;
  alt: string;
  /** 미리보기 높이 한도(px). 화면마다 조금 다릅니다. */
  maxHeight?: number;
}) {
  const [big, setBig] = useState(false);
  const src = assetSrc(path) || undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setBig(true)}
        title="눌러서 크게 보기"
        className="block w-full"
      >
        <img
          src={src}
          alt={alt}
          className="mx-auto max-w-full rounded-md"
          style={{ maxHeight, border: "1px solid oklch(1 0 0 / 10%)" }}
        />
      </button>

      {big && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-6"
          style={{ background: "oklch(0 0 0 / 88%)" }}
          onClick={() => setBig(false)}
        >
          {/* 화면에 맞춰 줄여 한 장이 통째로 보이게 — 굴리며 읽는 것보다 낫습니다. */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-md"
            style={{ background: "white" }}
          />
        </div>
      )}
    </>
  );
}
