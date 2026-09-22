import { Crop, Eraser, Image as ImageIcon, Trash2 } from "lucide-react";
import { ERASE_COLOR, cropColor, type CropBox, type PreviewResult } from "@/lib/cropBoxes";
import { safeFileName, type ProjectAssetType } from "@/lib/mediaLibrary";

/**
 * **오른쪽 목록 판** — 그린 상자마다의 이름·덮을 색, 그리고 «저장될 파일» 미리보기.
 *
 * `SheetPanelCropper.tsx` 에서 떼어 냈습니다. 자르기·지우기를 저장 전에 미리 보는 것,
 * 그리고 파일 이름만 보고도 무슨 일을 한 칸인지 아는 것 — 그 둘이 이 판의 전부입니다.
 * **저장을 누르기 전에는 파일이 생기지 않으므로**, 여기 보이는 이름과 그림이 결과를
 * 미리 보는 유일한 길입니다.
 */
export default function CropperBoxList({
  boxes,
  cropBoxes,
  eraseBoxes,
  preview,
  previewFresh,
  nameOptions,
  update,
  updateRecorded,
  remove,
  cropStem,
  eraseStem,
  refPrefix,
  upscaleTail,
  assetType,
  markAssetType,
}: {
  boxes: CropBox[];
  cropBoxes: CropBox[];
  eraseBoxes: CropBox[];
  preview: PreviewResult | null;
  /** 미리보기가 **지금 상자들과 맞는가**. 굽는 중이면 흐리게 보여 줍니다. */
  previewFresh: boolean;
  /** 이름 칸의 추천 목록(레퍼런스 구성에 있는 이름). */
  nameOptions: string[];
  /** 되돌리기에 안 쌓는 고치기 — 이름 한 글자마다 판이 쌓이면 Ctrl+Z 가 헛돕니다. */
  update: (id: string, patch: Partial<CropBox>) => void;
  /** 되돌리기에 쌓는 고치기 — 덮을 색처럼 결과 그림이 바뀌는 일(규칙 4). */
  updateRecorded: (id: string, patch: Partial<CropBox>) => void;
  remove: (id: string) => void;
  /** 자른 칸 하나의 파일 이름 몸통. */
  cropStem: (box: CropBox) => string;
  /** 지운 판의 파일 이름 몸통. */
  eraseStem: () => string;
  /** 레퍼런스로 등록될 때 붙는 접두(`ref_`). */
  refPrefix: (type: ProjectAssetType) => string;
  /** 업스케일을 켜 뒀으면 이름 꼬리에 붙는 말. */
  upscaleTail: (longEdge: number) => string;
  assetType: ProjectAssetType;
  /** 표시한 그림·지운 판을 넣을 곳. 안 주면 `assetType` 과 같습니다. */
  markAssetType?: ProjectAssetType;
}) {
  return (
    <>
      {/*
      빈 상태와 상자 줄은 같은 조건에서 하나만 그려집니다. 한쪽에만 앵커를 달면
      다른 쪽에서 튜토리얼이 자리를 못 찾아 가운데 카드로 물러나므로 둘 다에 답니다.
    */}
      {boxes.length === 0 ? (
        <div
          data-tour="cropper-box-list"
          className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg text-xs"
          style={{
            border: "1px dashed oklch(1 0 0 / 12%)",
            color: "oklch(0.45 0.01 265)",
          }}
        >
          <Crop className="h-5 w-5" />
          아직 그린 자리가 없습니다
        </div>
      ) : (
        boxes.map((box, index) => (
          <div
            key={box.id}
            /*
              이름이 둘입니다. `cropper-box-list` 는 빈 상태에도 붙어 «여기가 목록이다» 를 가리키고,
              `cropper-box-row` 는 **상자가 실제로 생겼을 때만** 붙습니다 — 걸음의 `until` 이
              그것을 기다립니다 — 상자를 안 그렸는데 저장 걸음으로 넘어가면 단추가 꺼진
              채라 튜토리얼이 막힙니다. 하나로는 둘을 구분할 수 없어 갈라 둡니다.
            */
            data-tour="cropper-box-list cropper-box-row"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2"
            style={{
              background: "oklch(0.13 0.009 265)",
              border: "1px solid oklch(1 0 0 / 8%)",
            }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{
                background:
                  box.mode === "erase" ? ERASE_COLOR : cropColor(index),
              }}
            >
              {box.mode === "erase" ? (
                <Eraser className="h-3 w-3" />
              ) : (
                index + 1
              )}
            </span>
            {box.mode === "erase" ? (
              // 지우기는 파일이 안 생기니 이름 대신 «무슨 색으로 덮을지» 를 둡니다.
              // 색 바꾸기는 결과 그림이 바뀌는 일이라 되돌리기에 기록합니다(규칙 4).
              <label
                className="flex min-w-0 flex-1 items-center gap-2 text-[11px]"
                style={{ color: "oklch(0.55 0.01 265)" }}
              >
                덮을 색
                <input
                  type="color"
                  value={box.fill || "#808080"}
                  onChange={(event) =>
                    updateRecorded(box.id, { fill: event.target.value })
                  }
                  title="비워 두면 상자 둘레의 색을 평균 내어 씁니다"
                  className="h-5 w-8 shrink-0 rounded border-0 bg-transparent p-0"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateRecorded(box.id, { fill: undefined })
                  }
                  disabled={!box.fill}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] disabled:opacity-30"
                  style={{
                    background: "oklch(1 0 0 / 6%)",
                    color: "oklch(0.70 0.14 200)",
                  }}
                >
                  자동
                </button>
              </label>
            ) : (
              <input
                value={box.name}
                onChange={(event) =>
                  update(box.id, { name: event.target.value })
                }
                list="sheet-panel-crop-names"
                placeholder="이 칸의 이름"
                className="min-w-0 flex-1 rounded bg-transparent px-2 py-1 text-xs outline-none"
                style={{
                  border: "1px solid oklch(1 0 0 / 10%)",
                  color: "oklch(0.85 0.005 265)",
                }}
              />
            )}
            <button
              type="button"
              onClick={() => remove(box.id)}
              aria-label="이 자리 지우기"
              className="shrink-0 rounded p-1 hover:bg-white/10"
              style={{ color: "oklch(0.60 0.15 25)" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}

      <datalist id="sheet-panel-crop-names">
        {nameOptions.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>

      <p
        className="pt-1 text-[11px] leading-relaxed"
        style={{ color: "oklch(0.45 0.01 265)" }}
      >
        이름이 곧 파일 이름이 되고, Magnific 에서는 그대로 <b>@태그</b>
        가 됩니다. 레퍼런스 구성에 있는 이름을 그대로 쓰면 나중에 찾기
        쉽습니다.
      </p>

      {/*
      저장될 파일 — 무엇이 어떤 이름으로 생길지 저장 전에 보여 줍니다.
      이름만 봐도 자른 칸인지 지운 칸인지 알 수 있어야, 폴더에서 다시 찾을 때
      열어 보지 않고 고릅니다.
    */}
      {boxes.length > 0 && (
        <div
          className="space-y-1.5 pt-2"
          style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <p
            className="text-[10px] font-semibold"
            style={{ color: "oklch(0.62 0.01 265)" }}
          >
            저장될 파일{" "}
            <span
              className="font-normal"
              style={{ color: "oklch(0.45 0.01 265)" }}
            >
              — 번호는 저장할 때 붙습니다
            </span>
          </p>

          {eraseBoxes.length > 0 && (
            <div
              className="flex items-center gap-2 rounded-lg p-1.5"
              style={{
                background: "oklch(0.12 0.008 265)",
                border: "1px solid oklch(1 0 0 / 7%)",
              }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded"
                style={{ background: "oklch(0.10 0.006 265)" }}
              >
                {previewFresh && preview?.url ? (
                  <img
                    src={preview.url}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <ImageIcon
                    className="h-4 w-4"
                    style={{ color: "oklch(0.35 0.01 265)" }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[11px]"
                  style={{ color: "oklch(0.85 0.005 265)" }}
                  title={eraseStem()}
                >
                  {refPrefix(markAssetType || assetType)}
                  {safeFileName(eraseStem())}_NNN
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: "oklch(0.50 0.01 265)" }}
                >
                  지운 판 · {eraseBoxes.length}곳
                  {previewFresh && preview
                    ? ` · ${preview.width}×${preview.height}${upscaleTail(Math.max(preview.width, preview.height))}`
                    : " · 만드는 중…"}
                </p>
              </div>
            </div>
          )}

          {cropBoxes.map((box) => {
            const crop = previewFresh
              ? preview?.crops.find((item) => item.boxId === box.id)
              : undefined;
            const named = Boolean(box.name.trim());
            return (
              <div
                key={box.id}
                className="flex items-center gap-2 rounded-lg p-1.5"
                style={{
                  background: "oklch(0.12 0.008 265)",
                  border: "1px solid oklch(1 0 0 / 7%)",
                }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded"
                  style={{ background: "oklch(0.10 0.006 265)" }}
                >
                  {crop ? (
                    <img
                      src={crop.url}
                      alt=""
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <ImageIcon
                      className="h-4 w-4"
                      style={{ color: "oklch(0.35 0.01 265)" }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[11px]"
                    style={{
                      color: named
                        ? "oklch(0.85 0.005 265)"
                        : "oklch(0.70 0.19 15)",
                    }}
                    title={named ? cropStem(box) : undefined}
                  >
                    {named
                      ? `${refPrefix(assetType)}${safeFileName(cropStem(box))}_NNN`
                      : "이 칸의 이름을 정해 주세요"}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "oklch(0.50 0.01 265)" }}
                  >
                    잘라낸 칸
                    {crop
                      ? ` · ${crop.width}×${crop.height}${upscaleTail(Math.max(crop.width, crop.height))}`
                      : " · 만드는 중…"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/*
      업스케일 칸. 자르면 그림이 작아지니 «키우기» 는 여기 있는 것이 자연스럽습니다.
      엔진·목표 한 벌을 «업스케일해서 저장» 과 «지금 그림 업스케일» 이
      같이 씁니다. 설치된 엔진이 없으면 고를 것이 없으니 길만 알려 줍니다.
    */}
    </>
  );
}
