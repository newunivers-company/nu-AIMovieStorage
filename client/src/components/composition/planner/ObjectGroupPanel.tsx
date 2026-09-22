import { Eye, EyeOff } from "lucide-react";
import { NameInput } from "@/components/composition/fields";
import {
  groupMemberIdsOf,
  objectGroupsOf,
  patchObjectGroupIn,
  topObjectGroupsOf,
  ungroupObjectsIn,
  updateObjectIn,
  type UpdateComposition,
} from "@/lib/compositionEdit";
import type { CompositionObjectGroup, CompositionState } from "@/lib/composition";

/** 이 목록에 낼 묶음만 고르는 체 — 환경 탭은 «그 방 안» 것만 냅니다. */
function keep(
  state: CompositionState,
  group: CompositionObjectGroup,
  only?: string[],
) {
  if (!only) return true;
  return groupMemberIdsOf(state, group.id).some((id) => only.includes(id));
}

/**
 * 묶은 것을 **한 줄로** 보여 줍니다 — 누르면 덩어리가 골라지고, 끌면 통째로 움직입니다.
 *
 * 묶은 소품은 낱개로 늘어놓지 않고 **묶음 이름 하나**로 섭니다 — 그래야 한 번에 잡아 옮기고,
 * 표시와 프롬프트에도 그 이름 하나로 실립니다. 다루는 모양은 캐릭터 줄과 같게 맞췄습니다.
 * 그래서 배치 탭과 환경 탭이 **이 컴포넌트 하나**를 같이 씁니다(CLAUDE.md 규칙 1).
 */
export function GroupRows({
  state,
  setState,
  selected,
  setSelected,
  only,
  picked,
  togglePick,
}: {
  state: CompositionState;
  setState: UpdateComposition;
  selected: string;
  setSelected: (value: string) => void;
  /** 여기 든 소품이 하나라도 속한 묶음만 냅니다. 안 주면 전부. */
  only?: string[];
  /**
   * **Ctrl 로 함께 잡아 둔 것**(소품 id 와 묶음 id 가 섞입니다).
   *
   * 이미 묶은 덩어리에 소품을 더 묶을 수 있어야 하는데, 덩어리 줄이 잡히지 않아
   * «덩어리 하나 + 소품 하나» 를 골라도 둘로 세어지지 않아 묶기 단추가 안 떴습니다.
   * `groupObjectsIn` 은 처음부터 둘을 섞어 받습니다 — 화면에서 잡을 길만 없었습니다.
   */
  picked?: string[];
  togglePick?: (id: string) => void;
}) {
  return (
    <>
      {topObjectGroupsOf(state)
        .filter((group) => keep(state, group, only))
        .map((group) => {
          const memberIds = groupMemberIdsOf(state, group.id);
          const first = memberIds[0];
          const on = selected === `object:${first}`;
          const marked = picked?.includes(group.id) ?? false;
          const shown = state.objects.filter(
            (item) => memberIds.includes(item.id) && item.visible,
          ).length;
          return (
            <div key={group.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={(event) => {
                  // Ctrl(맥은 ⌘) 로 누르면 **덩어리째 함께 잡습니다** — 소품과 섞어 다시 묶으려고.
                  if ((event.ctrlKey || event.metaKey) && togglePick) {
                    togglePick(group.id);
                    return;
                  }
                  setSelected(on || !first ? "none" : `object:${first}`);
                }}
                title={`${group.name} — 소품 ${memberIds.length}개가 한 덩어리입니다. 끌면 통째로 움직입니다${
                  group.swapRef ? ` · 에셋 «${group.swapRef.name}»` : ""
                } · Ctrl 을 누르고 누르면 다른 것과 함께 잡힙니다`}
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-[10px]"
                style={{
                  background: on
                    ? "oklch(0.62 0.22 290 / 22%)"
                    : marked
                      ? "oklch(0.72 0.16 60 / 18%)"
                      : "oklch(1 0 0 / 5%)",
                  color: on ? "oklch(0.84 0.10 290)" : "oklch(0.66 0.01 265)",
                  border: `1px solid ${marked ? "oklch(0.72 0.16 60 / 70%)" : `${group.color}55`}`,
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: group.color }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {group.name}
                  {group.swapRef && (
                    <span className="ml-1 font-normal" style={{ color: "oklch(0.72 0.14 160)" }}>
                      · {group.swapRef.name}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[9px]" style={{ color: "oklch(0.52 0.01 265)" }}>
                  {memberIds.length}개
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setState((current) => {
                    // 덩어리는 전부 함께 보이거나 함께 숨습니다.
                    const hide = shown > 0;
                    let next = current;
                    for (const id of memberIds)
                      next = updateObjectIn(next, id, { visible: !hide });
                    return next;
                  })
                }
                title={shown > 0 ? "덩어리를 숨깁니다" : "다시 보이게"}
                className="shrink-0 rounded p-1 hover:bg-white/10"
              >
                {shown > 0 ? (
                  <Eye className="h-3 w-3" style={{ color: "oklch(0.62 0.01 265)" }} />
                ) : (
                  <EyeOff className="h-3 w-3" style={{ color: "oklch(0.42 0.01 265)" }} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setState((current) => ungroupObjectsIn(current, group.id))}
                title="묶음을 풉니다 — 소품은 그대로 남습니다"
                className="shrink-0 rounded px-1 text-[9px] font-semibold"
                style={{ color: "oklch(0.62 0.16 25)" }}
              >
                풀기
              </button>
            </div>
          );
        })}
    </>
  );
}

/**
 * 만들어 둔 덩어리의 **이름 · 색 · 무엇으로 바꿀지 · 묶음 에셋**.
 *
 * 낱개뿐 아니라 **묶음에도 에셋을 겁니다** — 의자 넷을 «식탁 세트» 로 묶었으면
 * 프롬프트에도 그 에셋 하나로 실려야 @ 로 링크를 걸 수 있습니다.
 */
export function GroupCards({
  state,
  setState,
  only,
  groupIds,
  assets,
  onCreateAsset,
}: {
  state: CompositionState;
  setState: UpdateComposition;
  only?: string[];
  /** **이 덩어리들만** 냅니다(고른 덩어리 하나를 보여 줄 때). `only` 보다 우선합니다. */
  groupIds?: string[];
  assets?: { kind: "character" | "asset" | "background"; id: string; name: string; group: string }[];
  onCreateAsset?: (groupId: string, label: string) => void;
}) {
  const pickable = (assets ?? []).filter((item) => item.kind === "asset");
  return (
    <>
      {objectGroupsOf(state)
        .filter((group) =>
          groupIds ? groupIds.includes(group.id) : keep(state, group, only),
        )
        .map((group) => (
          <div
            key={group.id}
            className="mt-1.5 rounded-md p-1.5"
            style={{ background: "oklch(1 0 0 / 4%)", border: `1px solid ${group.color}44` }}
          >
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={group.color}
                onChange={(event) =>
                  setState((current) =>
                    patchObjectGroupIn(current, group.id, { color: event.target.value }),
                  )
                }
                title="덩어리 색 — 속한 소품이 함께 바뀝니다. 이 색이 프롬프트의 이름표가 됩니다"
                className="h-4 w-6 shrink-0 rounded"
                style={{ background: "transparent", border: "none" }}
              />
              <NameInput
                aria-label="덩어리 이름"
                value={group.name}
                onCommit={(name) =>
                  setState((current) => patchObjectGroupIn(current, group.id, { name }))
                }
              />
              <button
                type="button"
                onClick={() => setState((current) => ungroupObjectsIn(current, group.id))}
                title="묶음을 풉니다 — 소품은 그대로 남습니다"
                className="shrink-0 rounded px-1 text-[9px]"
                style={{ color: "oklch(0.62 0.16 25)" }}
              >
                풀기
              </button>
            </div>

            {/*
              이 덩어리를 **무엇으로 바꿔 그릴지**. 비워 두면 프롬프트에 안 나갑니다 —
              「회색 상자를 회색 상자로 그려라」 는 아무 값도 없으니까요.
            */}
            <input
              value={group.describeAs ?? ""}
              onChange={(event) =>
                setState((current) =>
                  patchObjectGroupIn(current, group.id, { describeAs: event.target.value }),
                )
              }
              placeholder="무엇으로 바꿀까요 — 예: 바닥에 깔린 옅은 안개"
              title="이 덩어리가 실제로는 무엇인지 적습니다. 영어로 적으면 생성기가 더 정확히 읽습니다"
              className="mt-1 w-full rounded px-1.5 py-1 text-[10px] outline-none"
              style={{
                background: "oklch(0.11 0.008 265)",
                border: "1px solid oklch(1 0 0 / 10%)",
                color: "oklch(0.88 0.01 265)",
              }}
            />

            {assets && (
              <select
                value={group.swapRef ? `${group.swapRef.kind}:${group.swapRef.id}` : ""}
                onChange={(event) => {
                  const found = pickable.find(
                    (item) => `${item.kind}:${item.id}` === event.target.value,
                  );
                  setState((current) =>
                    patchObjectGroupIn(current, group.id, { swapRef: found ?? undefined }),
                  );
                }}
                className="mt-1 w-full rounded px-1.5 py-1 text-[9px] outline-none"
                style={{
                  background: "oklch(0.11 0.008 265)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  color: "oklch(0.88 0.01 265)",
                }}
              >
                <option value="">
                  {pickable.length ? "묶음 에셋 안 고름" : "만들어 둔 에셋이 없습니다"}
                </option>
                {pickable.map((item) => (
                  <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                    {item.group} · {item.name}
                  </option>
                ))}
              </select>
            )}

            {onCreateAsset && (
              <button
                type="button"
                data-tour="layout-group-asset"
                onClick={() => onCreateAsset(group.id, group.name)}
                className="mt-1 w-full rounded px-2 py-1 text-[9px] font-semibold"
                style={{
                  background: "oklch(0.70 0.15 160 / 16%)",
                  border: "1px solid oklch(0.70 0.15 160 / 40%)",
                  color: "oklch(0.82 0.14 160)",
                }}
              >
                {group.swapRef
                  ? `«${group.swapRef.name}» 열기 — 시트 뽑기`
                  : "이 덩어리의 에셋 만들기 — 시트를 뽑아 바로 잇습니다"}
              </button>
            )}
          </div>
        ))}
    </>
  );
}
