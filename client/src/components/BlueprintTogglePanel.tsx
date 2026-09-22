import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import HowToPanel, { SIX_FACES_HOWTO } from "@/components/HowToPanel";
import {
  ANCHOR_PANORAMA_GROUP_ID,
  BACKGROUND_BLUEPRINT_GROUPS,
  CUBEMAP_CHIP_ID,
  DOME_CHIP_ID,
  PANORAMA_CHIP_ID,
  PANORAMA_INTERIOR_CHIP_ID,
  ROOM_INNER_CHIP_ID,
  ROOM_OUTER_CHIP_ID,
  panoramaBoxOf,
  spaceFitsChip,
  type PanoramaSpace,
  blueprintEnglish,
  countKnownBlueprint,
  findBackgroundChip,
  getBlueprintGroups,
  getBackgroundGroups,
  type BlueprintKind,
  type BlueprintOption,
  type SpaceKind,
} from "@/lib/blueprint";

/**
 * 무엇을 뽑을지 고르는 칸 목록.
 *
 * 여기서 고른 하나하나가 시트의 칸 하나가 됩니다. **칸이 적을수록 칸마다
 * 커집니다.** 열두 개를 고르면 칸 하나가 손톱만 해지고, 그 안의 얼굴은
 * 100px 이 안 됩니다. 그 얼굴을 다음 시트의 기준으로 넘기면 모델이 없는
 * 디테일을 지어냅니다.
 *
 * 그래서 그룹째 켜고 끄는 «전체» 를 두되, 기본으로 켜 두는 것은 다섯 개뿐입니다.
 *
 * 배경 칩에는 «완성 형태»(result)가 붙어 있습니다 — 칩 이름만으로는 어떤 모양의 배경이
 * 나오는지 알 수 없어, 고르기 전에 한 번에 읽히도록 붙였습니다.
 * 캐릭터·에셋 칩에는 없으므로 설명 줄은 **result 가 있는 칩만** 그립니다.
 */
type Props = {
  kind: BlueprintKind;
  /**
   * 이 id 들만 보여 줍니다(안 주면 전부). 구도잡기의 방·돔 카드가 전개도·파노라마 칩만 남길 때 씁니다 —
   * **저장값은 안 건드립니다**, 목록만 좁힙니다.
   */
  only?: string[];
  value?: string[];
  onChange: (value: string[]) => void;
  compact?: boolean;
  /** 배경일 때만. 실내·실외에 따라 보여 줄 그룹이 달라집니다. */
  spaceKind?: SpaceKind;
  /** 앵커 파노라마의 공간 넓이(m). 파노라마 칩이 켜졌을 때 그 그룹 안에 입력칸이 섭니다. */
  panoramaSpace?: PanoramaSpace;
  onPanoramaSpaceChange?: (next: PanoramaSpace | undefined) => void;
  /** 실외 등장방형의 정육면체 크기 — 방 크기와 따로(`spaceForChips`). */
  exteriorSpace?: PanoramaSpace;
  onExteriorSpaceChange?: (next: PanoramaSpace | undefined) => void;
};

/**
 * ── 공간 넓이 입력 ─────────────────────────────────────────────────────────
 * 등장방형은 넓이를 정해 두어야 뽑을 수 있습니다 — 여기 넣은 치수가 그대로 프롬프트에 실립니다.
 *
 * 파노라마 칩을 켠 **그 그룹 안**에 둡니다 — 칩을 고르는 자리에서 바로 정해야 «넓이를 안 넣고 뽑는» 일이
 * 줄어듭니다. 앵커가 찍혀 있으면 벽까지의 거리를 옆에 보여 줍니다(그 숫자가 그대로 프롬프트에 들어갑니다).
 */
function PanoramaSpaceFields({
  space,
  onChange,
  indoor,
  unfold,
}: {
  space?: PanoramaSpace;
  onChange: (next: PanoramaSpace | undefined) => void;
  /** 실내 등장방형이면 가로·깊이·층고, 실외면 정육면체 한 변. 카드 유형이 아니라 **고른 칩**이 정합니다. */
  indoor: boolean;
  /** 방 전개도(안쪽·바깥쪽) 칩 — 거리·각도 대신 «틀 그림이 자동으로 들어간다» 는 안내. */
  unfold?: "inner" | "outer" | null;
}) {
  const number = (raw: string) => {
    const value = Number(raw);
    return raw === "" || !Number.isFinite(value) || value <= 0 ? undefined : value;
  };
  const set = (key: keyof PanoramaSpace, raw: string) => {
    const value = number(raw);
    if (!indoor) {
      // 실외는 정육면체 — 한 변을 세 치수에 같이 적어 둡니다(구도잡기 방이 그대로 읽을 수 있게).
      onChange(value ? { width: value, depth: value, height: value } : undefined);
      return;
    }
    const next = { width: space?.width, depth: space?.depth, height: space?.height, [key]: value };
    if (!next.width && !next.depth && !next.height) onChange(undefined);
    else onChange({ width: next.width ?? 0, depth: next.depth ?? 0, ...(next.height ? { height: next.height } : {}) });
  };
  const field = (key: keyof PanoramaSpace, label: string, placeholder: string) => (
    <label className="flex items-center gap-1">
      <span style={{ color: "oklch(0.55 0.01 265)" }}>{label}</span>
      <input
        type="number"
        min={0}
        step={0.5}
        value={space?.[key] || ""}
        placeholder={placeholder}
        onChange={(event) => set(key, event.target.value)}
        className="w-14 rounded px-1.5 py-0.5 text-right tabular-nums outline-none"
        style={{ background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.90 0.01 265)" }}
      />
      <span style={{ color: "oklch(0.45 0.01 265)" }}>m</span>
    </label>
  );
  const chipId = indoor ? PANORAMA_INTERIOR_CHIP_ID : PANORAMA_CHIP_ID;
  const ready = spaceFitsChip(chipId, space);
  const box = ready ? panoramaBoxOf(space, indoor) : null;
  return (
    <div
      className="mt-2 space-y-1 rounded-md p-2 text-[10px]"
      style={{ background: "oklch(0.62 0.22 290 / 7%)", border: "1px solid oklch(0.62 0.22 290 / 22%)" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold" style={{ color: "oklch(0.84 0.12 290)" }}>
          {indoor ? "방 크기" : "공간 크기 (정육면체)"}
        </span>
        {indoor ? (
          <>
            {field("width", "가로", "12")}
            {field("depth", "깊이", "10")}
            {field("height", "층고", "2.4")}
          </>
        ) : (
          field("width", "한 변", "50")
        )}
      </div>
      <p className="leading-relaxed" style={{ color: "oklch(0.55 0.02 290)" }}>
        {indoor
          ? ready
            ? `이 방(${box!.width}×${box!.depth}×${box!.height} m)의 ${unfold === "outer" ? "바깥 네 벽·지붕·기단" : "안쪽 네 벽·천장·바닥"}을 십자로 편 한 장입니다. 방 크기 그대로의 회색 칸 «틀 그림» 은 «프롬프트 작성»·«규칙 조립» 을 누를 때 레퍼런스에 자동으로 들어가 «구성» 으로 함께 올라가고, 들어온 전개도는 ${unfold === "outer" ? "«_외벽» 세트로" : "여섯 면으로"} 자동으로 잘립니다. 방 안쪽·바깥쪽이 이 크기를 같이 씁니다.`
            : "가로·깊이·층고를 넣으세요 — 방 안쪽·바깥쪽 전개도가 이 크기로 틀 그림과 프롬프트를 짓습니다."
          : `한 변 ${space?.width || 50} m 공터 한가운데 눈높이(1.6 m)에서 본 네 방향·하늘과, 그 공터 땅 전체의 실측 지도(${space?.width || 50}×${space?.width || 50} m)를 십자로 편 한 장입니다. 구도잡기는 옆면 아래를 잘라 지평선을 바닥에서 1.6 m 에 맞춘 ${space?.width || 50}×${space?.width || 50}×${(space?.width || 50) / 2 + 1.6} m 방으로 세웁니다 — 인물과 축척이 맞습니다. 방 크기와 따로 둡니다.`}{" "}
        {indoor ? (
          <>
            <b style={{ color: "oklch(0.70 0.10 290)" }}>모델</b> — 나노 바나나 프로로 확인했습니다(6×4×3 m · 8×6×2.8 m, 셋 중 둘꼴로 칸 배치·비율이 맞음). 한 번에 2~3 장 뽑아 고르세요. 칸을 무시하고 방 사진 한 장이 나오면 다시 뽑거나 GPT 2.5(유료)로.
          </>
        ) : (
          <>
            <b style={{ color: "oklch(0.70 0.10 290)" }}>모델</b> — 나노 바나나 프로 <b>4K</b> 로 확인했습니다(50 m, 여섯 장 모두 눈높이·작은 달·경계 나무 14~22 m). «구성» 에는 <b>틀 그림만</b> 올라가고 정체성 그림은 글로 옮겨 적힙니다 — 드론 사진인 정체성 그림을 같이 올리면 옆면이 항공 시점으로 끌려갔습니다.
          </>
        )}
      </p>
    </div>
  );
}

/** 칩 하나를 한 줄로. «조감도 45° — 45° 위에서 … (1:1 한 장 · 앵커 찍기)» */
function chipLine(option: BlueprintOption): string {
  const tail = [option.frame, option.use].filter(Boolean).join(" · ");
  return `${option.label} — ${option.result}${tail ? ` (${tail})` : ""}`;
}

/** 칩 단추에 걸리는 툴팁. 완성 형태가 있으면 그것을, 없으면 예전처럼 영문 문장을. */
function chipTitle(option: BlueprintOption, spaceKind?: SpaceKind): string {
  if (!option.result) return blueprintEnglish(option, spaceKind);
  return [option.result, option.use, option.frame].filter(Boolean).join(" · ");
}

export default function BlueprintTogglePanel({
  kind,
  only,
  value = [],
  onChange,
  compact = false,
  spaceKind,
  panoramaSpace,
  onPanoramaSpaceChange,
  exteriorSpace,
  onExteriorSpaceChange,
}: Props) {
  const all = kind === "background" ? getBackgroundGroups(spaceKind) : getBlueprintGroups(kind);
  /*
    `only` 를 주면 **그 칩만** 남깁니다. 구도잡기에서 방 전개도를 뽑을 때 도면·동선·사람 크기 기준 같은 칸이
    함께 뜨면 고를 일이 없는 것을 계속 지나쳐야 합니다 — 전개도에 드는 칩은 방 모양·실내·실외·안쪽면·바깥쪽면
    뿐입니다. 목록만 좁히고 **저장값은 건드리지 않습니다** — 씬 탭에서 같은 카드를 열면 그대로입니다.
  */
  const groups = only
    ? all
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => only.includes(option.id)),
        }))
        .filter((group) => group.options.length > 0)
    : all;
  const title =
    kind === "character"
      ? "캐릭터 레퍼런스 구성"
      : kind === "background"
        ? "배경 레퍼런스 구성"
        : "에셋 레퍼런스 구성";

  const selected = new Set(value);
  /** «설명» 을 펼친 그룹. 기본은 접힘 — 칩만 보고 고르는 사람이 더 많습니다. */
  const [openHelp, setOpenHelp] = useState<Set<string>>(new Set());

  const toggleHelp = (groupId: string) =>
    setOpenHelp((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  /**
   * 칩 하나 켜고 끄기.
   *
   * 배타 묶음(마스터·2차·세트)은 하나만 켜집니다. 다른 것을 켜면 앞 것이 **조용히** 꺼집니다 —
   * 토스트로 알리면 고를 때마다 화면이 튀고, 어차피 칩 색으로 바로 보입니다.
   * 마스터를 둘 켜면 «칸 2개 시트» 로 조립돼 앵커를 찍을 수 없는 그림이 나왔습니다.
   */
  const toggle = (option: BlueprintOption) => {
    const next = new Set(selected);
    /*
      끄기는 «이 칩으로 읽히는 저장 id 를 전부» 지웁니다.

      예전에는 `next.delete(option.id)` 로 정확히 그 id 만 지웠습니다. 저장값에 옛 id
      (`master-aerial-high`)가 남아 있으면 화면에는 꺼진 것으로 보이는데, 한 번 켰다 끄면
      옛 id 만 남아 «꺼 놓았는데 프롬프트에는 계속 실리는» 상태가 됐습니다
      (`resolveBackgroundChips` 는 별칭을 읽습니다). 다른 마스터를 켜서 밀어내기 전까지는
      끌 방법이 없었습니다.
    */
    const dropAliases = () => {
      if (kind !== "background") return;
      for (const id of [...next]) {
        // **저장 id 기준**으로 비교합니다(`chip.id !== option.id` 로 보면 같은 칩의 옛 id 가 살아남습니다).
        if (id !== option.id && findBackgroundChip(id)?.id === option.id) next.delete(id);
      }
    };
    if (next.has(option.id)) {
      next.delete(option.id);
      dropAliases();
    } else {
      if (option.exclusiveGroup) {
        /*
          **보이는 칩만 훑으면 안 됩니다.** 실외 프로젝트에 실내 마스터가 켜진 채 남아 있으면
          그 칩은 화면에 안 뜨는데 저장값에는 있습니다. 안 지우면 조립할 때 «먼저 켠 것 하나»
          규칙에 걸려 보이지도 않는 칩이 이깁니다. 그래서 전체 목록에서 지웁니다.
        */
        const all = kind === "background" ? BACKGROUND_BLUEPRINT_GROUPS : groups;
        for (const group of all) {
          for (const other of group.options) {
            if (other.id !== option.id && other.exclusiveGroup === option.exclusiveGroup) {
              next.delete(other.id);
            }
          }
        }
        if (kind === "background") {
          // 옛 id(«항공뷰» 등)는 목록에 없지만 읽을 때 지금 칩으로 갈아 끼워집니다.
          // 여기서 안 지우면 새로 켠 마스터가 옛 id 에 밀려 요청에 안 실립니다.
          for (const id of [...next]) {
            const chip = findBackgroundChip(id);
            if (chip && id !== option.id && chip.exclusiveGroup === option.exclusiveGroup) {
              next.delete(id);
            }
          }
        }
      }
      // 배타 묶음이 아닌 칩에도 옛 id 가 남아 있을 수 있습니다 — 새 id 와 겹치지 않게 지웁니다.
      dropAliases();
      next.add(option.id);
    }
    onChange([...next]);
  };

  const toggleGroup = (ids: string[], allOn: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (allOn) next.delete(id);
      else next.add(id);
    }
    onChange([...next]);
  };

  return (
    <section className="space-y-2" data-tour="card-blueprint">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="min-w-0 flex-1 truncate text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          선택한 기준을 담은 장소·촬영 가능한 공간의 이미지 레퍼런스 요구사항으로 넣습니다
        </p>
        <span className="shrink-0 text-[10px]" style={{ color: "oklch(0.55 0.14 290)" }}>
          {/* 지금 이 화면에 보이는 칩만 셉니다 — 보이는 칩과 숫자가 어긋나면 안 됩니다.
              (옛 id 별칭·다른 공간유형 칩이 숫자에만 끼던 것을 spaceKind 를 넘겨 맞췄습니다.) */}
          {countKnownBlueprint(kind, value, spaceKind)}개 선택
        </span>
      </div>

      {/*
        칸이 **하나뿐이면 폭을 다 씁니다.** 구도잡기에서 전개도만 뽑을 때는 그룹이 하나라,
        두 칸 격자에 두면 오른쪽이 텅 빈 채 화면의 절반만 쓰게 됩니다.
      */}
      <div
        className={cn(
          "grid gap-2",
          compact || groups.length < 2 ? "sm:grid-cols-1" : "sm:grid-cols-2",
        )}
      >
        {groups.map((group) => {
          const ids = group.options.map((option) => option.id);
          const allOn = ids.every((id) => selected.has(id));
          // 배타 묶음은 하나만 켜지므로 «전체» 가 뜻을 잃습니다(누르면 곧바로 규칙과 어긋남).
          const exclusive = group.options.some((option) => option.exclusiveGroup);
          const described = group.options.filter((option) => option.result);
          const picked = group.options.filter((option) => selected.has(option.id) && option.result);
          const helpOpen = openHelp.has(group.id);
          return (
            <div
              key={group.id}
              className="rounded-lg p-3"
              style={{ background: "oklch(0.13 0.009 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
            >
              {/* flex-wrap — «사용 방법» 을 펼치면 목록이 이 머리 줄 아래로 내려옵니다(HowToPanel 설명 참조). */}
              <div className="mb-1 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-white">{group.label}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: "oklch(0.45 0.01 265)" }}>
                    {group.description}
                  </p>
                </div>
                {!exclusive && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(ids, allOn)}
                    className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      background: allOn ? "oklch(0.62 0.22 290 / 18%)" : "oklch(1 0 0 / 5%)",
                      color: allOn ? "oklch(0.84 0.16 290)" : "oklch(0.52 0.01 265)",
                    }}
                  >
                    {allOn && <Check className="h-2.5 w-2.5" />} 전체
                  </button>
                )}
                {/* «설명» 은 단추만 머리 줄에 두고 펼친 목록은 머리 줄 **밖**에 그립니다.
                    HowToPanel 은 자기 목록이 w-full 이라 머리 줄의 마지막 자식이어야 하는데,
                    여기서도 w-full 목록을 만들면 둘 중 하나가 셋째 줄로 떨어집니다. */}
                {described.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleHelp(group.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      background: helpOpen ? "oklch(0.62 0.22 290 / 18%)" : "oklch(1 0 0 / 5%)",
                      color: helpOpen ? "oklch(0.84 0.16 290)" : "oklch(0.52 0.01 265)",
                    }}
                  >
                    설명
                  </button>
                )}
                {/* 6면 배경 만드는 법 — 읽으면서 바로 고르도록 파노라마 칩 옆에 둡니다.
                    머리 줄의 **마지막 자식** 이어야 합니다. 펼친 목록이 w-full 로 줄을 통째로 차지하므로,
                    «전체» 앞에 두면 «전체» 단추가 목록 아래 셋째 줄로 혼자 떨어졌습니다. */}
                {group.id === ANCHOR_PANORAMA_GROUP_ID && <HowToPanel {...SIX_FACES_HOWTO} />}
              </div>

              {helpOpen && (
                <ul
                  className="mb-2 space-y-1 rounded-md p-2 text-[10px] leading-relaxed"
                  style={{ background: "oklch(1 0 0 / 4%)", color: "oklch(0.60 0.01 265)" }}
                >
                  {described.map((option) => (
                    <li key={option.id}>{chipLine(option)}</li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-1">
                {group.options.map((option) => {
                  const on = selected.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggle(option)}
                      title={chipTitle(option, spaceKind)}
                      className="rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
                      style={{
                        background: on ? "oklch(0.62 0.22 290 / 20%)" : "oklch(1 0 0 / 5%)",
                        border: `1px solid ${on ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 8%)"}`,
                        color: on ? "oklch(0.86 0.16 290)" : "oklch(0.58 0.01 265)",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {group.id === ANCHOR_PANORAMA_GROUP_ID &&
                onPanoramaSpaceChange &&
                ((selected.has(CUBEMAP_CHIP_ID) || selected.has(DOME_CHIP_ID)) ||
                  selected.has(ROOM_INNER_CHIP_ID) ||
                  selected.has(ROOM_OUTER_CHIP_ID)) && (
                  <PanoramaSpaceFields
                    // 실외는 따로 둔 정육면체 크기, 방 안쪽·바깥쪽은 한 벌을 같이 씁니다.
                    key={(selected.has(CUBEMAP_CHIP_ID) || selected.has(DOME_CHIP_ID)) ? "exterior" : "room"}
                    space={(selected.has(CUBEMAP_CHIP_ID) || selected.has(DOME_CHIP_ID)) ? exteriorSpace : panoramaSpace}
                    onChange={
                      (selected.has(CUBEMAP_CHIP_ID) || selected.has(DOME_CHIP_ID)) ? (onExteriorSpaceChange ?? onPanoramaSpaceChange) : onPanoramaSpaceChange
                    }
                    indoor={!(selected.has(CUBEMAP_CHIP_ID) || selected.has(DOME_CHIP_ID))}
                    unfold={
                      selected.has(ROOM_OUTER_CHIP_ID) ? "outer" : selected.has(ROOM_INNER_CHIP_ID) ? "inner" : null
                    }
                  />
                )}

              {/* 고른 것 — 무엇이 나오는지 칩을 켠 자리에서 바로 읽게. 안내(hint)가 있으면 함께. */}
              {picked.length > 0 && (
                <div className="mt-2 space-y-1">
                  {picked.map((option) => (
                    <p key={option.id} className="text-[10px] leading-relaxed" style={{ color: "oklch(0.62 0.06 290)" }}>
                      <b style={{ color: "oklch(0.80 0.12 290)" }}>{option.label}</b> — {option.result}
                      {option.frame ? ` · ${option.frame}` : ""}
                      {option.hint && (
                        <span className="block" style={{ color: "oklch(0.50 0.01 265)" }}>
                          {option.hint}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
