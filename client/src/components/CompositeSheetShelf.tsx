import { useState } from "react";
import { Layers3 } from "lucide-react";
import ImageActions from "@/components/ImageActions";
import ImageLightbox from "@/components/ImageLightbox";
import { assetSrc, fileNameOf } from "@/lib/mediaLibrary";

/**
 * 이어 붙여 만든 시트를 모아 두는 자리.
 *
 * "생성 결과 이미지" 는 모델이 뽑아 준 그림을 모으는 자리이고, 시트는 그것들을
 * 이어 붙여 **우리가 만든 결과물**입니다. 성격이 달라서 한 줄에 섞이면
 * 어느 것이 재료이고 어느 것이 완성품인지 알 수 없습니다.
 *
 * 시트는 한 장으로 끝나지 않습니다. 의상이 바뀌면 바뀐 칸만 갈아 끼워 다시 만들고,
 * 그렇게 여러 판이 쌓입니다. 그래서 **이름을 붙일 수 있어야 합니다** —
 * 파일 이름만으로는 «냥이 캐릭터 시트_003» 이 무엇의 판인지 알 수 없습니다.
 */

export interface CompositeSheetItem {
  id: string;
  name: string;
  thumb?: string;
  filePath?: string;
  /** 사람이 붙인 이름. "겨울 의상", "부상 상태" 처럼 무엇의 판인지 적습니다. */
  sheetLabel?: string;
}

export default function CompositeSheetShelf({
  sheets,
  label,
  onRename,
  onRemove,
  onCrop,
}: {
  sheets: CompositeSheetItem[];
  /** "제작한 캐릭터 시트" 처럼 무엇의 시트인지 */
  label: string;
  onRename?: (id: string, sheetLabel: string) => void;
  onRemove?: (id: string) => void;
  /**
   * 가위. **정작 칸을 잘라내야 할 대상이 이 합성 시트**인데 여기만 가위가
   * 없었습니다. 「모든 이미지에서 가위 툴이 있어야해」 (지시 215·217)
   */
  onCrop?: (id: string) => void;
}) {
  /** 크게 보는 시트. 6000 시트를 128px 로는 확인할 수 없습니다 */
  const [viewing, setViewing] = useState<CompositeSheetItem | null>(null);

  if (!sheets.length) return null;

  return (
    <section
      className="mt-3 rounded-lg p-3"
      style={{ background: "oklch(0.13 0.009 265)", border: "1px solid oklch(0.62 0.22 290 / 22%)" }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Layers3 className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(0.78 0.18 290)" }} />
        <p className="text-xs font-semibold" style={{ color: "oklch(0.82 0.14 290)" }}>
          {label} {sheets.length}
        </p>
        {onRename && (
          <p className="text-[10px]" style={{ color: "oklch(0.44 0.01 265)" }}>
            이름을 적어 두면 어느 판인지 나중에 알아볼 수 있습니다
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {sheets.map(sheet => {
          const fileName = fileNameOf(sheet.filePath) || sheet.name;
          const source = assetSrc(sheet.filePath) || sheet.thumb || "";
          return (
            <div key={sheet.id} className="w-32">
              <div
                className="group relative aspect-square w-full overflow-hidden rounded-md"
                style={{ background: "oklch(0.10 0.008 265)", border: "1px solid oklch(1 0 0 / 10%)" }}
              >
                {source && (
                  <img
                    src={source}
                    alt=""
                    title="크게 보기"
                    onClick={() => setViewing(sheet)}
                    // 시트는 여러 칸이 든 그림이라 자르면 내용이 사라집니다.
                    className="h-full w-full cursor-zoom-in object-contain"
                    onError={event => { event.currentTarget.style.display = "none"; }}
                  />
                )}
                <ImageActions
                  image={{ ...sheet, name: sheet.sheetLabel || fileName }}
                  onRemove={onRemove ? () => onRemove(sheet.id) : undefined}
                  onCrop={onCrop ? () => onCrop(sheet.id) : undefined}
                />
              </div>

              {onRename ? (
                <input
                  value={sheet.sheetLabel || ""}
                  onChange={event => onRename(sheet.id, event.target.value)}
                  placeholder="이 판의 이름"
                  title={fileName}
                  className="mt-1 w-full rounded px-1.5 py-1 text-[11px] outline-none"
                  style={{
                    background: "oklch(0.10 0.008 265)",
                    border: "1px solid oklch(1 0 0 / 10%)",
                    color: "oklch(0.84 0.005 265)",
                  }}
                />
              ) : (
                <p className="mt-1 truncate text-[11px]" style={{ color: "oklch(0.72 0.01 265)" }}>
                  {sheet.sheetLabel || fileName}
                </p>
              )}

              <p className="mt-0.5 truncate text-[10px]" style={{ color: "oklch(0.42 0.01 265)" }}>
                {fileName}
              </p>
            </div>
          );
        })}
      </div>

      {viewing && (
        <ImageLightbox
          image={{ name: viewing.sheetLabel || viewing.name, filePath: viewing.filePath, thumb: viewing.thumb }}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
