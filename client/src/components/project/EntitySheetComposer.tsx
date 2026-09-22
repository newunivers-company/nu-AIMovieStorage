import { useEffect, useRef, useState } from "react";
import SheetComposerDialog from "@/components/SheetComposerDialog";
import { useProjectMedia } from "@/components/project/ProjectMediaContext";
import type { VisualAsset } from "@/lib/visualAsset";
import type { CharacterProfile } from "@/lib/characterProfile";
import { KIND_TEXT } from "@/components/project/useEntityLineage";
import { collectSheetSources, type SheetSourceAlternate } from "@/components/sheet/sheetSources";
import { layoutToPx } from "@/lib/sheetCompose";
import {
  uid,
  type GeneratedImageAsset,
  type ReferenceImage,
  type SheetFills,
  type SheetLayout,
  type SheetPlacement,
} from "@/lib/projectTypes";

/**
 * 시트 창(`SheetComposerDialog`) 을 여는 블록.
 *
 * 캐릭터와 배경에 같은 블록이 두 벌 있었습니다 — 주석까지 복사돼서요.
 * 배치도 id 가 앞 인물 것으로 남는 버그(R2)도 한쪽에서 고치고 다른 쪽을
 * 빠뜨릴 수 있는 구조였습니다. 시트를 만들 수 있는 갈래는 여기 하나만 부릅니다.
 *
 * # 배치도는 프로젝트 것, 그림은 인물 것
 *
 * 배치도는 한 번 짜 두고 인물마다 다시 쓰는 틀입니다. 그런데 인물 안에 갇혀 있어서
 * (`owner.sheetLayouts`) 다른 인물에서 고를 수 없었고, 그래서 빈 배치를 새로 만드는 일이 매번 생겼습니다.
 * 이제 배치도(칸의 자리·크기·이름·규격)는 `draft.sheetLayouts` 에, 어느 칸에 이 인물의
 * 어느 그림이 들어가는지는 `owner.sheetFills` 에 둡니다. 창에는 둘을 합쳐 넘기고,
 * 창이 돌려주면 다시 나눕니다.
 *
 * 닫으면 부르는 쪽에서 언마운트되어 고른 배치도가 잊힙니다. 열 때마다 첫 판부터
 * 시작하는 것이 원래 동작입니다.
 */

/** 시트를 만들 수 있는 것의 공통 모양. 캐릭터와 배경이 이 모양을 갖습니다 */
export interface SheetOwner {
  id: string;
  name: string;
  generatedImages: GeneratedImageAsset[];
  references?: ReferenceImage[];
  variations: { name?: string; generatedImages?: GeneratedImageAsset[] }[];
  /** 보유 에셋. 인물의 소지품도 시트 칸에 놓을 수 있어야 합니다 */
  assets?: VisualAsset[];
  /** 다른 원본(«어린 시절»). 보유 에셋과 같은 이유로 시트에 놓을 수 있어야 합니다 */
  alternates?: SheetSourceAlternate[];
  /** 옛 데이터. 시트 창을 열 때 프로젝트 배치도로 올라가고 비워집니다 */
  sheetLayouts?: SheetLayout[];
  sheetFills?: SheetFills;
}

/**
 * 시트 창이 고치는 칸. 이것만 고치니 갈래별 타입(Character·Background)을
 * 몰라도 되고, 부르는 쪽의 `patchEntity` 에 그대로 넘어갑니다.
 */
export type SheetOwnerPatch = Partial<Pick<SheetOwner, "sheetLayouts" | "generatedImages" | "sheetFills">>;

/** 프로젝트 배치도에는 그림을 남기지 않습니다 — 그림은 인물 쪽 `sheetFills` 입니다 */
function withoutImage(slot: SheetPlacement): SheetPlacement {
  const copy = { ...slot };
  delete copy.imageId;
  return copy;
}

/** 칸 → 그림 표. 프로필 칸은 그림이 없습니다 */
function fillsOf(placements: SheetPlacement[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of placements) {
    if (slot.kind !== "profile" && slot.imageId) out[slot.id] = slot.imageId;
  }
  return out;
}

export default function EntitySheetComposer({
  kind,
  owner,
  onClose,
  projectName,
  sharedAssets,
  basics,
  profile,
  patchOwner,
  layouts,
  patchProject,
  editing,
}: {
  kind: "character" | "background";
  owner: SheetOwner;
  onClose: () => void;
  projectName: string;
  /** 프로젝트의 공용 에셋. 주인이 따로 없으니 어느 시트에나 놓을 수 있습니다 */
  sharedAssets: VisualAsset[] | undefined;
  /** 프로필 상자 표에 찍을 값들. 갈래마다 다릅니다 */
  basics: { label: string; value: string }[];
  /** 성격 프로필. 캐릭터만 있습니다 */
  profile?: CharacterProfile;
  /** 소유자를 «지금 값을 받아» 고칩니다. 값으로 넘기면 안 됩니다 */
  patchOwner: (updater: (current: SheetOwner) => SheetOwnerPatch) => void;
  /** 프로젝트 공용 배치도 */
  layouts: SheetLayout[];
  /** 프로젝트 배치도를 «지금 값을 받아» 고칩니다 */
  patchProject: (updater: (current: SheetLayout[]) => SheetLayout[]) => void;
  /** 고치는 중인 시트. 있으면 그 판을 되살려 열고 «다시 굽기» 가 이 항목을 바꿉니다 */
  editing?: GeneratedImageAsset;
}) {
  const { renamePaths } = useProjectMedia();
  const text = KIND_TEXT[kind];
  const ownerName = owner.name || text.noun;

  /**
   * 시트 창에서 지금 고른 배치도. 없으면 첫 판을 씁니다.
   *
   * 앞 인물의 id 가 남으면 저장이 조용히 버려집니다(R2). 그래서 id 를 «누구 것인지» 와
   * 묶어 두고, 소유자가 다르면 없는 것으로 칩니다 — 부르는 쪽이 초기화를 잊어도 새
   * 소유자에게 옮겨 붙지 않습니다.
   */
  const [picked, setPicked] = useState<{ ownerId: string; layoutId: string } | null>(null);
  const sheetLayoutId = picked && picked.ownerId === owner.id ? picked.layoutId : undefined;
  const select = (id: string) => setPicked({ ownerId: owner.id, layoutId: id });

  /** 배치도가 하나도 없을 때 첫 변경에 만들 배치도의 id. 창의 가상 «기본 배치» 줄이 이 id 를 씁니다 */
  const pendingId = useRef(uid());

  /*
    창에는 늘 px 좌표계의 배치도만 넘깁니다. 마운트 효과가 옛 것을 px 로 저장하지만 첫 그림은
    그 전에 그려지므로, 여기서도 한 번 거릅니다 — 이미 px 면 같은 객체라 비용이 없습니다.
  */
  const pxLayouts = layouts.map(layoutToPx);

  /** 지금 고른 배치도. 아직 없으면 첫 판, 그것도 없으면 undefined */
  const currentLayout = pxLayouts.find((item) => item.id === sheetLayoutId) || pxLayouts[0];
  const targetId = currentLayout?.id ?? pendingId.current;

  /** 배치도 하나를 고칩니다. 아직 없으면(첫 변경) 만들면서 고칩니다. 새로 만드는 것은 늘 px 좌표계 */
  const patchLayout = (id: string, update: (layout: SheetLayout) => SheetLayout) =>
    patchProject((current) => {
      const list = current.some((item) => item.id === id)
        ? current
        : [...current, { id, name: `${ownerName} 기본 배치`, placements: [], coords: "px" as const }];
      return list.map((item) => (item.id === id ? update(item) : item));
    });

  /*
    열 때 한 번:

    0. **옛 «긴 변 6000 기준» 배치도를 px 로 올립니다.** 좌표계가 규격의 실제 px 로 바뀌었습니다 —
       그림은 뽑힌 크기 그대로 칸에 들어가야 하니까요. `coords` 가 없는 배치도는
       `layoutToPx` 로 한 번 바꿔 저장합니다 — 바뀐 것이 없으면 같은 배열을 돌려줘 저장을 건너뜁니다.
    1. **옛 소유자 배치도를 프로젝트로 올립니다.** id 는 유지합니다(R2 — id 가 바뀌면 고른
       배치도가 저장을 놓칩니다). 이름 앞에 인물 이름을 붙여 누구 것이었는지 남기고, 그림은
       이 인물의 `sheetFills` 로 옮긴 뒤 `sheetLayouts` 를 비웁니다. 되돌릴 수 없는 1회
       이전이라 updater 함수형으로만 씁니다. 올리면서 px 로도 바꿉니다(옛 것은 전부 6000 기준).
    2. **고치는 중인 시트가 있으면** 그 판을 되살립니다. 시트가 가리키는 배치도가 아직 있고
       칸이 같으면 그것을 고르고, 아니면 스냅샷으로 새 배치도를 만들어 고릅니다.
       (되살리지 않으면 고치러 들어갈 때마다 시트가 한 장씩 새로 생깁니다.)
       스냅샷도 옛 것일 수 있어 `layoutToPx` 로 읽습니다.
  */
  const prepared = useRef(false);
  useEffect(() => {
    if (prepared.current) return;
    prepared.current = true;

    // 옛 것이 하나라도 있을 때만 부릅니다. 부르는 쪽의 patchProject 는 갱신 함수가 같은 배열을 돌려줘도
    // 초안을 새로 만들어 자동 저장이 한 번 돕니다 — 창을 열 때마다 아무 변경 없이 저장되면 안 됩니다.
    if (layouts.some((layout) => layout.coords !== "px")) {
      patchProject((current) => {
        const converted = current.map(layoutToPx);
        return converted.some((layout, index) => layout !== current[index]) ? converted : current;
      });
    }

    const legacy = owner.sheetLayouts || [];
    if (legacy.length) {
      const pool = collectSheetSources(owner, sharedAssets);
      const nameOf = (imageId?: string) => pool.find((item) => item.id === imageId)?.name;
      patchProject((current) => {
        const known = new Set(current.map((item) => item.id));
        const lifted: SheetLayout[] = legacy
          .filter((layout) => !known.has(layout.id))
          .map((layout) =>
            layoutToPx({
              ...layout,
              name: `${ownerName} · ${layout.name || "배치"}`,
              // 그때 놓였던 그림 이름을 칸 이름으로 남깁니다. 다른 인물이 써도 «전신» 은 «전신» 이니까요.
              placements: layout.placements.map((slot) => ({
                ...withoutImage(slot),
                label: slot.label ?? (slot.kind !== "profile" ? nameOf(slot.imageId) : undefined),
              })),
            }),
          );
        return [...current, ...lifted];
      });
      patchOwner((current) => {
        const fills: SheetFills = { ...(current.sheetFills || {}) };
        for (const layout of legacy) {
          fills[layout.id] = { ...(fills[layout.id] || {}), ...fillsOf(layout.placements) };
        }
        return { sheetFills: fills, sheetLayouts: [] };
      });
    }

    // 옛 시트(coords 없음)의 스냅샷은 6000 기준이라 px 로 읽습니다. 안 바꾸면 4096 시트가 6000 자리에 놓입니다.
    const snapshot = editing?.sheet ? layoutToPx(editing.sheet) : undefined;
    if (editing && snapshot) {
      const existing = snapshot.layoutId ? layouts.find((item) => item.id === snapshot.layoutId) : undefined;
      const sameShape =
        !!existing &&
        existing.placements.length === snapshot.placements.length &&
        snapshot.placements.every((slot) => existing.placements.some((item) => item.id === slot.id));
      let target: string;
      if (existing && sameShape) {
        target = existing.id;
        // 규격 없는 배치도는 6000 시트라 칸 값이 6000 px 입니다(옛 것이든 새 것이든). 스냅샷 규격을
        // 물려줄 때 칸도 그 비율로 같이 옮겨야 4096 시트에 6000 px 칸이 남지 않습니다.
        if (!existing.size) {
          patchLayout(existing.id, (layout) => layoutToPx({ ...layout, size: snapshot.size, coords: undefined }));
        }
      } else {
        target = uid();
        const created: SheetLayout = {
          id: target,
          name: `${editing.sheetLabel || editing.name} 배치`,
          size: snapshot.size,
          captions: snapshot.captions,
          placements: snapshot.placements.map(withoutImage),
          coords: "px",
        };
        patchProject((current) => [...current, created]);
        // 시트가 새 배치도를 가리키게 해 둡니다 — 안 하면 «다시 굽기» 없이 닫을 때마다 「X 배치」 가 또 생깁니다.
        patchOwner((current) => ({
          generatedImages: current.generatedImages.map((img) =>
            img.id === editing.id && img.sheet ? { ...img, sheet: { ...img.sheet, layoutId: target } } : img,
          ),
        }));
      }
      patchOwner((current) => ({
        sheetFills: { ...(current.sheetFills || {}), [target]: fillsOf(snapshot.placements) },
      }));
      select(target);
    }
    // 마운트 1회. 이후 값이 바뀌어도 다시 올리면 안 됩니다(두 번 올리면 배치도가 겹칩니다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 창에 넘기는 판 = 배치도의 칸 + 이 인물의 그림 */
  const fills = (currentLayout && owner.sheetFills?.[currentLayout.id]) || {};
  const placements: SheetPlacement[] = (currentLayout?.placements || []).map((slot) =>
    slot.kind === "profile" ? slot : { ...slot, imageId: fills[slot.id] },
  );

  /** 창이 돌려준 판을 프로젝트(기하·이름·글자·칸 추가/삭제)와 인물(그림)로 나눠 씁니다 */
  const handlePlacements = (next: SheetPlacement[]) => {
    const id = targetId;
    // 창이 돌려주는 값은 px 라 표시도 같이 찍습니다 — 옛 배치도에 px 값을 넣고 표시를 안 하면 다음에 또 변환됩니다.
    patchLayout(id, (layout) => ({ ...layout, placements: next.map(withoutImage), coords: "px" }));
    patchOwner((current) => ({
      sheetFills: { ...(current.sheetFills || {}), [id]: fillsOf(next) },
    }));
    if (!currentLayout) select(id);
  };

  return (
    <SheetComposerDialog
      open
      onOpenChange={(next) => !next && onClose()}
      ownerName={ownerName}
      projectName={projectName}
      assetType={text.generatedAssetType}
      profile={profile}
      basics={basics}
      /*
        원본 + 변형 + 보유 에셋 + 공용 에셋. 시트는 «의상이 바뀌었을 때 필요한 칸만 갈아 끼우는»
        자리라 변형이 들어가고, 공용 에셋은 주인이 없어 어느 시트에나, 보유 에셋은 그 인물의
        소지품이라 그 인물 시트에 들어갑니다.
      */
      images={collectSheetSources(owner, sharedAssets)}
      layouts={pxLayouts}
      layoutId={targetId}
      onLayoutSelect={select}
      onLayoutAdd={(from) => {
        // 복제입니다. 칸 몇 개만 갈아 끼우려고 만든 것이라 칸을 그대로 물려받고,
        // 이 인물이 넣어 둔 그림도 새 칸 id 로 따라갑니다. from 이 없으면 빈 판입니다.
        // 사본은 px 좌표계로 만듭니다. 원본이 옛 6000 기준이면 여기서 바꿔 물려받습니다.
        const base = from ? layoutToPx(from) : undefined;
        const ids = new Map((base?.placements || []).map((slot) => [slot.id, uid()] as const));
        const fromFills = base ? owner.sheetFills?.[base.id] || {} : {};
        const created: SheetLayout = {
          id: uid(),
          name: base ? `${base.name || "배치"} 사본` : `새 배치도 ${layouts.length + 1}`,
          size: base?.size,
          captions: base?.captions,
          placements: (base?.placements || []).map((slot) => ({ ...withoutImage(slot), id: ids.get(slot.id)! })),
          coords: "px",
        };
        const copiedFills: Record<string, string> = {};
        for (const slot of base?.placements || []) {
          const imageId = slot.imageId ?? fromFills[slot.id];
          if (slot.kind !== "profile" && imageId) copiedFills[ids.get(slot.id)!] = imageId;
        }
        patchProject((current) => [...current, created]);
        if (Object.keys(copiedFills).length) {
          patchOwner((current) => ({
            sheetFills: { ...(current.sheetFills || {}), [created.id]: copiedFills },
          }));
        }
        select(created.id);
      }}
      // 배치도 이름은 되돌리기 대상이 아닙니다(변형 이름과 같은 규칙).
      onLayoutRename={(id, name) => patchLayout(id, (layout) => ({ ...layout, name }))}
      onLayoutRemove={(id) => patchProject((current) => current.filter((item) => item.id !== id))}
      onLayoutSizeChange={(id, size) => patchLayout(id, (layout) => ({ ...layout, size }))}
      onLayoutCaptionsChange={(id, captions) => patchLayout(id, (layout) => ({ ...layout, captions }))}
      placements={placements}
      onPlacementsChange={handlePlacements}
      editing={editing}
      onSheetCreated={(image) =>
        patchOwner((current) => ({
          generatedImages: [...current.generatedImages, image],
        }))
      }
      // 같은 항목(id·이름표)을 유지한 채 파일·판만 바꿉니다. 새 항목이 생기면 안 됩니다.
      onSheetReplaced={(image, previousPath) => {
        patchOwner((current) => ({
          generatedImages: current.generatedImages.map((item) => (item.id === image.id ? image : item)),
        }));
        // 옛 파일은 지워졌고 이름(번호)이 바뀌었습니다. 표시(imageMarks)·컷 구도잡기의 배경 선택은
        // 파일 경로를 열쇠로 드니 초안 전체에서 갈아 끼웁니다(배경 시트에서 실제로 끊겼습니다).
        if (previousPath && image.filePath && previousPath !== image.filePath) {
          renamePaths(new Map([[previousPath, image.filePath]]));
        }
      }}
      onImagesAdded={(added) =>
        patchOwner((current) => ({
          generatedImages: [...current.generatedImages, ...added],
        }))
      }
    />
  );
}
