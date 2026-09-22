/**
 * **그림 한 장을 고르는 네모 타일.**
 *
 * 컷 카드의 인물·배경·레퍼런스 세 탭이 같이 씁니다. `CutCard.tsx` 가 2,600줄이라
 * 2026-09-18 에 떼어 냈습니다 — 바깥에 기대는 것이 하나도 없는 순수 표시 조각입니다.
 */
export default function PickTile({
  label,
  thumb,
  selected,
  accent,
  onClick,
}: {
  label: string;
  thumb?: string;
  selected: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={selected}
      className="w-[72px] shrink-0 text-left"
    >
      <div
        className="aspect-square w-full overflow-hidden rounded-md"
        style={{
          background: "oklch(0.10 0.006 265)",
          // 고른 것은 테두리 + 한 겹 더. 어두운 그림 위에서도 테두리 한 줄은 잘 안 보입니다.
          border: `1px solid ${selected ? accent : "oklch(1 0 0 / 10%)"}`,
          boxShadow: selected ? `0 0 0 1px ${accent}` : undefined,
        }}
      >
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[9px]"
            style={{ color: "oklch(0.40 0.01 265)" }}
          >
            그림 없음
          </span>
        )}
      </div>
      <p
        className="truncate text-[9px]"
        style={{ color: selected ? accent : "oklch(0.52 0.01 265)" }}
      >
        {label}
      </p>
    </button>
  );
}
