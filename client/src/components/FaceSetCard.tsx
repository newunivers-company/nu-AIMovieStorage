import type { DragEvent, ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { assetSrc } from "@/lib/mediaLibrary";
import UpscaleButton from "@/components/UpscaleButton";
import type { UpscaleRunOptions } from "@/lib/upscale";
import {
  faceLabel,
  orderedFaces,
  parseFaceStem,
  type FaceKey,
  type FaceLike,
  type FaceSet,
  type FaceSetEntry,
} from "@/lib/faceSets";
import type { SpaceKind } from "@/lib/blueprint";

/**
 * 6면 세트 카드 — 여섯 면을 낱장으로 늘어놓지 않고 한 장(3×2 미니 썸네일)으로.
 *
 * 한 장을 앵커 찍어 여섯 면으로 가르면 원본까지 여덟 장이 되어 선반이 한 장소로 가득 찹니다.
 * 생성 이미지 선반·씬 그림 고르기·시트 소스·구도잡기 환경 탭이 **전부 이 카드
 * 하나** 를 씁니다(규칙 1) — 한 곳에만 세트가 생기고 다른 곳은 여덟 장으로 남는 일이 없게.
 *
 * 면 이름은 파일 이름의 토큰(«천장»/«하늘»)을 그대로 읽습니다. 저장할 때 실내·실외를 보고
 * 정한 말이라 카드가 `spaceKind` 를 몰라도 맞고, 옛 파일의 «천장» 도 그대로 보입니다.
 */

/** 셀 하나에 적을 면 이름. 파일에 적힌 토큰이 먼저, 없으면(blob 만 있을 때) 공간 종류로. */
export function faceEntryLabel(
  face: FaceKey,
  entry?: FaceSetEntry<FaceLike>,
  spaceKind?: SpaceKind | null,
): string {
  const stem =
    entry?.name ||
    (entry?.path
      ? entry.path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^.]+$/, "")
      : "");
  const token = stem ? parseFaceStem(stem)?.token : undefined;
  return token ?? faceLabel(face, spaceKind);
}

/** 셀의 그림 주소. `bump` 는 같은 경로를 덮어쓴 뒤(세트 업스케일) 캐시를 깨려고 붙입니다. */
export function faceEntrySrc(
  entry: FaceSetEntry<FaceLike> | undefined,
  bump?: number,
): string {
  if (!entry) return "";
  const saved = assetSrc(entry.path);
  if (saved) return bump ? `${saved}?v=${bump}` : saved;
  return entry.thumb || "";
}

export interface FaceSetCardProps<T extends FaceLike> {
  set: FaceSet<T>;
  /** 카드 가로 px. 선반은 120, 컷 카드는 110, 구도잡기는 칸에 맞춤(생략). */
  width?: number;
  /** 미니 썸네일 한 칸의 높이 px. 기본 34. */
  cellHeight?: number;
  spaceKind?: SpaceKind | null;
  /** 카드 전체를 눌렀을 때(구도잡기: 여섯 면 한 번에 배정, 선반: 넘겨 보기). */
  onClick?: () => void;
  /** 셀 하나를 눌렀을 때. 주면 카드 클릭 대신 셀 클릭이 우선합니다(시트 소스: 그 면만 놓기). */
  onFaceClick?: (face: FaceKey, entry: FaceSetEntry<T>) => void;
  /** 셀을 끌 수 있게(시트 소스). */
  onFaceDragStart?: (
    entry: FaceSetEntry<T>,
    event: DragEvent<HTMLElement>,
  ) => void;
  /** 주면 오른쪽 위에 X — 여섯 파일이 모두 지워집니다. */
  onRemove?: () => void;
  /** 주면 오른쪽 가운데에 «업스케일 ▾» — 여섯 장을 차례로 덮어씁니다. 메뉴에서 고르면 엔진·목표가 옵니다. */
  onUpscale?: (options: UpscaleRunOptions) => void;
  /** 업스케일 진행 문구(«정면 업스케일 중 1/6»). 있으면 단추 대신 진행이 보입니다. */
  upscaling?: string | null;
  /** 같은 경로를 덮어쓴 뒤 그림을 다시 읽게 하는 숫자. */
  refreshBump?: number;
  /** 구도잡기: 이 세트가 지금 여섯 면에 걸려 있는가. */
  selected?: boolean;
  /** 이름 줄 대신 보여 줄 것(생략하면 세트 이름). */
  caption?: ReactNode;
  /** 이름 줄을 숨깁니다(구도잡기처럼 좁은 칸). */
  hideCaption?: boolean;
  title?: string;
}

export default function FaceSetCard<T extends FaceLike>({
  set,
  width,
  cellHeight = 34,
  spaceKind,
  onClick,
  onFaceClick,
  onFaceDragStart,
  onRemove,
  onUpscale,
  upscaling,
  refreshBump,
  selected,
  caption,
  hideCaption,
  title,
}: FaceSetCardProps<T>) {
  const cells = orderedFaces(set);
  const border = selected
    ? "oklch(0.55 0.15 200)"
    : upscaling
      ? "oklch(0.72 0.16 60 / 70%)"
      : "oklch(0.62 0.22 290 / 40%)";
  const label =
    title ??
    `${set.label}${set.complete ? "" : ` — ${set.missing.length}면 없음`}`;

  return (
    <div
      // 튜토리얼은 3×2 격자가 아니라 **이 바깥 상자**를 밝힙니다 — 격자만 잡으면
      // 오른쪽 위 X 와 이름 줄의 세트 업스케일이 말풍선 밖으로 빠집니다.
      data-tour="shelf-face-set"
      className="group relative shrink-0"
      style={{ width: width ? `${width}px` : undefined }}
      title={label}
      tabIndex={0}
    >
      <div
        role={onClick ? "button" : undefined}
        onClick={onClick}
        className={`grid grid-cols-3 gap-px overflow-hidden rounded-lg p-px ${onClick ? "cursor-pointer" : ""}`}
        style={{
          background: "oklch(0.10 0.006 265)",
          border: `1px solid ${border}`,
        }}
      >
        {cells.map(({ face, entry }) => {
          const src = faceEntrySrc(entry, refreshBump);
          const clickable = Boolean(entry && onFaceClick);
          return (
            <div
              key={face}
              className={`relative overflow-hidden ${clickable ? "cursor-pointer hover:brightness-125" : ""}`}
              style={{
                height: `${cellHeight}px`,
                background: "oklch(0.14 0.008 265)",
              }}
              draggable={Boolean(entry && onFaceDragStart)}
              onDragStart={
                entry && onFaceDragStart
                  ? (event) => onFaceDragStart(entry, event)
                  : undefined
              }
              onClick={
                clickable
                  ? (event) => {
                      // 셀 클릭이 카드 클릭까지 번지면 «그 면만 놓기» 가 «세트 전체» 로 바뀝니다.
                      event.stopPropagation();
                      onFaceClick!(face, entry!);
                    }
                  : undefined
              }
            >
              {src ? (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                  // 캐시 깨기용 꼬리(`?v=`)를 못 읽으면 원래 주소로, 그것도 안 되면 blob 으로.
                  onError={(event) => {
                    const current = event.currentTarget.src;
                    const plain = entry ? assetSrc(entry.path) : "";
                    if (plain && current !== plain) {
                      event.currentTarget.src = plain;
                      return;
                    }
                    if (entry?.thumb && current !== entry.thumb) {
                      event.currentTarget.src = entry.thumb;
                      return;
                    }
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-[8px]"
                  style={{
                    color: "oklch(0.40 0.01 265)",
                    border: "1px dashed oklch(1 0 0 / 10%)",
                  }}
                >
                  없음
                </span>
              )}
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 truncate px-0.5 text-center text-[7px] leading-[10px]"
                style={{
                  background: "oklch(0 0 0 / 62%)",
                  color: entry ? "white" : "oklch(0.55 0.01 265)",
                }}
              >
                {faceEntryLabel(face, entry, spaceKind)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 단추 자리는 ImageActions 의 모서리 규칙 — 오른쪽 위 빼기, 오른쪽 가운데 업스케일. */}
      {onRemove && !upscaling && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`${set.label} 빼기 — 여섯 면 모두`}
          title="세트 빼기 — 여섯 면 파일이 모두 지워집니다"
          className="absolute right-1 top-1 z-10 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          style={{
            background: "oklch(0 0 0 / 72%)",
            color: "oklch(0.78 0.16 25)",
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {upscaling && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-semibold"
          style={{
            background: "oklch(0 0 0 / 55%)",
            color: "oklch(0.88 0.12 60)",
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="px-1 text-center leading-tight">{upscaling}</span>
        </div>
      )}
      {set.legacy && (
        <span
          className="pointer-events-none absolute left-1 top-1 rounded px-1 text-[7px] font-bold"
          style={{
            background: "oklch(0 0 0 / 72%)",
            color: "oklch(0.72 0.01 265)",
          }}
          title="옛 규칙 — 6면/ 폴더가 아니라 주인 폴더 뿌리에 있는 세트"
        >
          뿌리
        </span>
      )}

      {/*
        업스케일 손잡이는 **그림 위가 아니라 이름 줄**에 섭니다.

        예전에는 카드 오른쪽 가운데에 겹쳐 있어서 3×2 격자의 «하늘»·«바닥» 칸을 가렸습니다
        — 손잡이가 그림을 덮고 있었습니다. 세트 카드는 여섯 면을 한눈에
        보려고 있는 것이라, 그림을 가리는 자리는 어디든 틀립니다. 이름 줄은 늘 비어 있고
        가로로 남습니다. 마우스를 올려야 보이던 것도 그만뒀습니다 — 이제 안 가리니까요.
      */}
      {(!hideCaption || (onUpscale && !upscaling)) && (
        <div className="mt-1 flex items-center gap-1">
          {!hideCaption && (
            <p
              className="min-w-0 flex-1 truncate text-[10px]"
              style={{ color: "oklch(0.72 0.14 290)" }}
            >
              {caption ?? set.label}
            </p>
          )}
          {onUpscale && !upscaling && (
            <UpscaleButton
              inline
              label={`${set.label} 세트 업스케일 — 여섯 장을 차례로 같은 이름에 덮어씁니다`}
              onRun={onUpscale}
            />
          )}
        </div>
      )}
    </div>
  );
}
