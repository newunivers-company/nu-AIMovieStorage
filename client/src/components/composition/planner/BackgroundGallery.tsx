import { useState } from "react";
import { Grid3X3, X } from "lucide-react";
import { FIELD_STYLE } from "@/components/composition/fields";
import FaceSetCard from "@/components/FaceSetCard";
import type { FaceLike, FaceSet } from "@/lib/faceSets";

/**
 * **6면 세트 전체보기** — 만들어 둔 전개도 세트를 큰 그리드로 놓고, 누르면 그 세트가 **방에 통째로** 걸립니다.
 *
 * 그전에는 낱장 목록이라 고른 그림이 «지금 면»(정면) 한 장에만 붙었습니다 — 여섯 면 세트를 늘어놓고
 * 고르게 해 놓고 한 면만 거는 것은 화면이 거짓말을 하는 셈이라, 목록 자체를 세트로 바꿨습니다.
 *
 * 이름은 **그림 아래**에, 자르지 않고 다 보입니다 — 그림 위에 겹쳐 놓으면 그림도 가리고 긴 이름은
 * 잘려서 어느 세트인지 구별이 안 됩니다.
 */
export function BackgroundGallery<T extends FaceLike>({
  sets,
  sources,
  roomName,
  isAssigned,
  onPick,
  onClose,
}: {
  sets: FaceSet<T>[];
  /**
   * **전개도 원본**(자르기 전 한 장)들. 이 창은 방에 거는 자리이자 라이브러리를 살피는 자리라 원본도 같이
   * 놓습니다 — 세트는 걸 수 있고, 원본은 «무엇에서 잘렸는지» 를 보는 자리입니다.
   */
  sources?: { id: string; name?: string; thumb?: string | null }[];
  /** 어느 방에 걸릴지 — 제목에 적습니다. */
  roomName: string;
  isAssigned: (set: FaceSet<T>) => boolean;
  onPick: (set: FaceSet<T>) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = (name?: string | null) =>
    (name || "").toLowerCase().includes(query.toLowerCase());
  const filtered = sets.filter((set) => matches(set.label));

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: "oklch(0.11 0.008 265 / 97%)" }}
    >
      <div
        className="flex shrink-0 items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}
      >
        <Grid3X3 className="h-4 w-4" style={{ color: "oklch(0.70 0.15 200)" }} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">배경 라이브러리</p>
          <p className="text-xs" style={{ color: "oklch(0.52 0.01 265)" }}>
            세트를 누르면 여섯 면이 <b>{roomName}</b> 에 한 번에 걸립니다 · 세트 {sets.length}개 ·
            전개도 원본 {(sources ?? []).length}장
          </p>
        </div>
        <input
          data-tour="env-gallery-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 검색..."
          className="ml-auto h-9 w-56 rounded-md px-3 text-xs outline-none"
          style={FIELD_STYLE}
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 hover:bg-white/10"
          title="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="composition-scroll min-h-0 flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <p className="pt-16 text-center text-xs" style={{ color: "oklch(0.48 0.01 265)" }}>
            아직 6면 세트가 없습니다 — 방 속성의 «전개도 만들기» 로 뽑은 그림이 잘리면 여기 모입니다.
          </p>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {filtered.map((set) => (
              <div key={set.id} className="space-y-1.5">
                <FaceSetCard
                  set={set}
                  cellHeight={52}
                  selected={isAssigned(set)}
                  title={`${set.label} — 누르면 여섯 면이 «${roomName}» 에 한 번에 걸립니다${
                    set.complete ? "" : ` (${set.missing.length}면 없음 → 비워 둠)`
                  }`}
                  onClick={() => {
                    onPick(set);
                    onClose();
                  }}
                />
                {/* 이름은 그림 **아래**에, 줄을 넘겨서라도 다 보입니다. */}
                <p
                  className="px-0.5 text-[11px] leading-snug"
                  style={{
                    color: isAssigned(set) ? "oklch(0.82 0.14 200)" : "oklch(0.70 0.01 265)",
                  }}
                >
                  {set.label}
                  {isAssigned(set) && " · 걸림"}
                  {!set.complete && (
                    <span style={{ color: "oklch(0.60 0.14 60)" }}>
                      {" "}
                      · {set.missing.length}면 없음
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {/*
          ── 전개도 원본 ────────────────────────────────────────────────
          자르기 전 한 장입니다. 세트와 달리 **걸 수 없습니다** — 방에 붙는 것은 잘린 여섯 면이고, 원본은
          «이 세트가 무엇에서 나왔나» 를 확인하는 자리입니다 — 여기는 거는 곳이자 라이브러리를 살피는 곳입니다.
        */}
        {(sources ?? []).filter((item) => matches(item.name)).length > 0 && (
          <div data-tour="env-gallery-sources" className="mt-6">
            <p className="mb-2 text-xs font-semibold" style={{ color: "oklch(0.62 0.01 265)" }}>
              전개도 원본 · 배경 그림
            </p>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
            >
              {(sources ?? [])
                .filter((item) => matches(item.name))
                .map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <div
                      className="aspect-video w-full overflow-hidden rounded-lg"
                      style={{ background: "oklch(0.16 0.01 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
                    >
                      {item.thumb && (
                        <img src={item.thumb} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="px-0.5 text-[11px] leading-snug" style={{ color: "oklch(0.66 0.01 265)" }}>
                      {item.name || "이름 없는 그림"}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BackgroundGallery;
