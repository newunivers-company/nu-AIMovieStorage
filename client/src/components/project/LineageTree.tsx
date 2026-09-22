import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { assetSrc } from "@/lib/mediaLibrary";
import type { GeneratedImageAsset } from "@/lib/projectTypes";

/**
 * 원본에서 갈라져 나온 변형들을 **곡선으로 이어** 보여 줍니다.
 *
 * # 왜 선을 긋는가
 *
 * 변형 시트는 「이 인물의 옷을 갈아입힌 판」입니다. 목록으로 쌓으면 무엇이
 * 무엇에서 나왔는지 알 수 없어요. 옷을 갈아입힌 판에서 머리만 또 바꾸면
 * 3대가 되는데, 들여쓰기만으로는 그게 안 읽힙니다.
 *
 * 카드를 열로 세우고 **부모의 오른쪽 가장자리에서 자식의 왼쪽 가장자리로**
 * 곡선을 그으면 계보가 그대로 보입니다.
 *
 * # 선은 SVG 로 그립니다
 *
 * CSS 만으로는 카드 높이가 제각각일 때 선이 어긋납니다. 실제 자리를 재서
 * 그려야 정확해요. 카드가 늘어나거나 창 크기가 바뀌면 다시 잽니다.
 */

export interface LineageNode {
  id: string;
  /** 부모 노드 id. 없으면 원본입니다 */
  parentId?: string;
  label: string;
  /** 카드에 뜨는 설명 한 줄 — 변형이면 「바꿀 요소」 */
  caption?: string;
  images: GeneratedImageAsset[];
  /** 원본인지. 원본은 지울 수 없고 번호 배지가 붙습니다 */
  isRoot?: boolean;
  /** 원본 번호. 인물마다 1, 2… */
  rootIndex?: number;
}

/** 원본 노드의 id. 변형 id 와 겹치지 않는 값이면 됩니다 */
export const LINEAGE_ROOT = "__root__";

/**
 * 원본 하나 + 변형들을 계보 노드로 만듭니다.
 *
 * 인물·장소·공용 에셋·보유 에셋이 같이 씁니다. «위 판이 없으면 원본에서 갈라진 것»
 * 규칙이 한 곳에만 있어야, 보유 에셋의 미니 계보가 큰 계보와 다르게 그려지는 일이 없습니다.
 */
export function lineageNodes({
  name,
  rootImages,
  variations,
  rootIndex,
  unnamed = "이름 없음",
}: {
  name: string;
  rootImages: GeneratedImageAsset[];
  variations: {
    id: string;
    parentVariationId?: string;
    name?: string;
    description?: string;
    generatedImages?: GeneratedImageAsset[];
  }[];
  rootIndex: number;
  /** 이름이 비었을 때 원본 카드에 뜨는 말 */
  unnamed?: string;
}): LineageNode[] {
  return [
    { id: LINEAGE_ROOT, label: name || unnamed, images: rootImages, isRoot: true, rootIndex },
    ...variations.map((variation) => ({
      id: variation.id,
      // 위 판이 없으면 원본에서 갈라진 것입니다.
      parentId: variation.parentVariationId || LINEAGE_ROOT,
      label: variation.name || "이름 없는 변형",
      caption: variation.description,
      images: variation.generatedImages || [],
    })),
  ];
}

export default function LineageTree({
  nodes,
  onOpen,
  onBranch,
  onRemove,
  onDropImages,
  accent,
  compact = false,
}: {
  nodes: LineageNode[];
  onOpen: (id: string) => void;
  /** 이 카드에서 또 갈라내기 */
  onBranch: (id: string) => void;
  onRemove: (id: string) => void;
  /**
   * 카드에 그림을 끌어다 놓았을 때. 밖에서 뽑아 온 결과를 바로 붙입니다.
   *
   * 없으면 떨구는 자리가 안 생깁니다 — 아직 안 붙인 화면도 있어서 선택입니다.
   */
  onDropImages?: (id: string, files: FileList) => void;
  accent: string;
  /**
   * 작은 카드(132px). 보유 애셋의 미니 계보가 씁니다.
   *
   * 인물 패널 안에 에셋 계보가 또 들어가는데, 카드가 인물 것과 같은 크기면 에셋 두엇에
   * 패널이 화면을 덮습니다. 기능(열기·«이 카드에서 변형»·X·떨구기)은 똑같고 크기만 다릅니다.
   * 폭 상수는 `lineageGrid.ts` 의 `COMPACT_CARD`·`COMPACT_GAP` 과 같아야 합니다.
   */
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  /** 부모 → 자식 곡선을 실제 자리에서 계산합니다. */
  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const base = host.getBoundingClientRect();
    // 테두리 상자(getBoundingClientRect)가 아니라 **안쪽 상자**로 잽니다.
    //
    // 선을 그리는 svg 는 `absolute` 라도 넘치면 스크롤 영역을 늘립니다.
    // 테두리 폭으로 잡으면 svg 가 테두리만큼 삐져나가 가로 스크롤바가
    // 생기고, 그 스크롤바가 다시 안쪽 폭을 깎아 **스크롤바가 스스로를
    // 유지하는 고리**가 됩니다. 실제로 계보가 한 열뿐인 카드에도
    // 스크롤바가 붙어 있었습니다. 안쪽 상자로 재면 넘칠 수가 없습니다.
    setSize({ width: host.clientWidth, height: host.clientHeight });

    const next: string[] = [];
    for (const node of nodes) {
      if (!node.parentId) continue;
      const from = cardRefs.current.get(node.parentId);
      const to = cardRefs.current.get(node.id);
      if (!from || !to) continue;

      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      // 부모의 오른쪽 한가운데에서 자식의 왼쪽 한가운데로.
      const x1 = a.right - base.left;
      const y1 = a.top + a.height / 2 - base.top;
      const x2 = b.left - base.left;
      const y2 = b.top + b.height / 2 - base.top;
      // 손잡이를 가로 간격의 절반쯤 두면 부드럽게 휩니다.
      const grip = Math.max(18, (x2 - x1) * 0.55);
      next.push(`M ${x1} ${y1} C ${x1 + grip} ${y1}, ${x2 - grip} ${y2}, ${x2} ${y2}`);
    }
    setPaths(next);
  }, [nodes]);

  useLayoutEffect(() => {
    measure();
    const host = hostRef.current;
    if (!host) return;
    // 카드가 늘거나 그림이 늦게 떠서 높이가 바뀌면 다시 잽니다.
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    cardRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [measure, nodes.length]);

  /** 깊이별로 열을 나눕니다. 원본이 0열, 거기서 갈라진 것이 1열. */
  const depthOf = (node: LineageNode): number => {
    let depth = 0;
    let current = node;
    while (current.parentId) {
      const parent = nodes.find((item) => item.id === current.parentId);
      if (!parent) break;
      current = parent;
      depth += 1;
      if (depth > 12) break; // 고리가 생겨도 멈춥니다
    }
    return depth;
  };

  const columns: LineageNode[][] = [];
  nodes.forEach((node) => {
    const depth = depthOf(node);
    (columns[depth] ||= []).push(node);
  });

  return (
    /*
      스크롤 상자가 아닙니다.

      예전에는 `overflow-x-auto` 였습니다. 그런데 웹뷰가 스크롤바를 겹쳐
      그리지 않고 **자리를 차지하게** 그려서, 넘치지 않는데도 계보 밑에
      회색 막대가 10px 씩 남았습니다. 게다가 그 10px 이 안쪽 폭을 깎아
      선 그리는 svg 가 삐져나가고, 그게 다시 스크롤바를 부르는 고리가
      됐습니다.

      이제 패널 폭을 계보 열 수에서 정확히 계산하므로(`lineagePanelStyle`)
      넘칠 일이 없습니다. 창이 아주 좁아 패널이 100% 로 묶이는 때만
      페이지가 가로로 밀립니다 — 그 편이 카드가 잘려 안 보이는 것보다 낫습니다.
    */
    <div ref={hostRef} className={`relative flex items-start pb-1 ${compact ? "gap-4" : "gap-6"}`}>
      {/* 계보 선. 카드 뒤에 깔고 클릭을 막지 않습니다. */}
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={size.width}
        height={size.height}
        style={{ zIndex: 0 }}
      >
        {paths.map((d, index) => (
          <path
            key={index}
            d={d}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeOpacity={0.55}
          />
        ))}
      </svg>

      {columns.map((column, depth) => (
        <div
          key={depth}
          className={`relative flex shrink-0 flex-col ${compact ? "gap-2" : "gap-3"}`}
          style={{ zIndex: 1 }}
        >
          {column.map((node) => (
            <LineageCard
              key={node.id}
              node={node}
              accent={accent}
              compact={compact}
              onOpen={() => onOpen(node.id)}
              onBranch={() => onBranch(node.id)}
              onDropFiles={onDropImages ? (files) => onDropImages(node.id, files) : undefined}
              onRemove={() => onRemove(node.id)}
              register={(element) => {
                if (element) cardRefs.current.set(node.id, element);
                else cardRefs.current.delete(node.id);
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LineageCard({
  node,
  accent,
  compact,
  onOpen,
  onBranch,
  onRemove,
  onDropFiles,
  register,
}: {
  node: LineageNode;
  accent: string;
  compact: boolean;
  onOpen: () => void;
  onBranch: () => void;
  onRemove: () => void;
  onDropFiles?: (files: FileList) => void;
  register: (element: HTMLDivElement | null) => void;
}) {
  const preview = node.images.find((image) => image.isPrimary) || node.images[0];
  const [dragging, setDragging] = useState(false);

  return (
    /*
      카드 자체가 떨구는 자리입니다.

      밖에서 뽑아 온 그림을 붙이려면 카드를 열고 한참 내려가 「생성 이미지」
      칸을 찾아야 했습니다. 계보에서 «이 판» 이 눈앞에 있는데 두 단계를 더
      거치는 것이 이상합니다. 여기 그냥 놓으면 이 판의 그림이 됩니다.
    */
    <div
      ref={register}
      className={`group relative overflow-hidden rounded-xl ${compact ? "w-[132px]" : "w-[210px]"}`}
      onDragOver={
        onDropFiles
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragging(true);
            }
          : undefined
      }
      onDragLeave={(event) => {
        // 안쪽 요소로 옮겨간 것뿐이면 그대로 둡니다. 아니면 테두리가 깜빡입니다.
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={
        onDropFiles
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragging(false);
              onDropFiles(event.dataTransfer.files);
            }
          : undefined
      }
      style={{
        background: dragging ? `${accent}1a` : "oklch(0.16 0.01 265)",
        border: `1px solid ${dragging ? accent : node.isRoot ? `${accent}55` : "oklch(1 0 0 / 10%)"}`,
      }}
    >
      {/* 원본에는 번호를, 변형에는 갈래 이름을 붙입니다. */}
      <div className={`flex items-center gap-1.5 ${compact ? "px-2 pb-1 pt-1.5" : "px-2.5 pb-1.5 pt-2"}`}>
        <span
          className={`${compact ? "text-[9px]" : "text-[10px]"} font-bold`}
          style={{ color: node.isRoot ? "oklch(0.72 0.01 265)" : accent }}
        >
          {node.isRoot ? "원본" : "변형"}
        </span>
        {node.isRoot && typeof node.rootIndex === "number" && (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: `${accent}33`, color: accent }}
          >
            {node.rootIndex}
          </span>
        )}
      </div>

      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div
          className="relative aspect-[4/3] w-full overflow-hidden"
          style={{ background: "oklch(0.10 0.006 265)" }}
        >
          {preview ? (
            <img
              src={assetSrc(preview.filePath) || preview.thumb || ""}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[10px]"
              style={{ color: "oklch(0.35 0.01 265)" }}
            >
              그림 없음
            </div>
          )}

          {/* 이름과 설명은 그림 위에 얹습니다. 카드 높이를 일정하게 두려고요. */}
          <div
            className={`absolute inset-x-0 bottom-0 ${compact ? "px-2 pb-1 pt-5" : "px-2.5 pb-1.5 pt-6"}`}
            style={{
              background:
                "linear-gradient(to top, oklch(0.10 0.006 265) 25%, transparent 100%)",
            }}
          >
            <p className={`truncate ${compact ? "text-[10px]" : "text-[11px]"} font-semibold text-white`}>
              {node.label || (node.isRoot ? "이름 없음" : "이름 없는 변형")}
            </p>
            {/* 작은 카드에는 설명 줄이 안 들어갑니다 — 한 줄에 몇 글자 못 넣어 «…» 만 남습니다. */}
            {node.caption && !compact && (
              <p className="truncate text-[9px]" style={{ color: "oklch(0.60 0.01 265)" }}>
                {node.caption}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* 여기서 또 갈라냅니다. 원본에서도, 변형에서도. */}
      <button
        type="button"
        onClick={onBranch}
        data-tour="character-variation"
        className={`w-full text-left font-semibold ${compact ? "px-2 py-1 text-[9px]" : "px-2.5 py-1.5 text-[10px]"}`}
        style={{ background: "oklch(1 0 0 / 4%)", color: accent }}
      >
        <Plus className="mr-0.5 inline h-2.5 w-2.5" /> 이 카드에서 변형
      </button>

      {!node.isRoot && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${node.label || "변형"} 지우기`}
          className="absolute right-1.5 top-1.5 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "oklch(0 0 0 / 72%)", color: "oklch(0.74 0.16 25)" }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
