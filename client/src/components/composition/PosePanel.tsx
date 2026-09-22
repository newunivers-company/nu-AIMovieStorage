import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ConfirmDialog";
import {
  ChoiceRow,
  DegreeInput,
  FIELD_STYLE,
} from "@/components/composition/fields";
import {
  BONE_GROUPS,
  COLLAPSED_BONE_GROUPS,
  EDITABLE_BONES,
  FINGER_LABELS,
  fingerStateToBonePose,
  mergeBonePose,
} from "@/lib/rig";
import {
  type HandSide,
  type PosePreset,
  type PosePresetKind,
  bonePoseForKind,
  deletePosePreset,
  listPosePresets,
  mirrorHandBonePose,
  presetDirectory,
  savePosePreset,
  writePosePreset,
} from "@/lib/posePresets";
import { FINGER_NAMES, type Vector3Value } from "@/lib/composition";

/**
 * 포즈 편집.
 *
 * # 세 겹입니다
 *
 * 1. **프리셋** — 큰 자세를 한 번에. 서기·앉기·달리기 같은 것
 * 2. **관절** — 그 위에서 하나씩 다듬기. 3D 화면에서 직접 돌립니다
 * 3. **손가락** — 폄·반·접음 3단계, 또는 마디별 각도
 *
 * 각도는 전부 **프리셋 대비 추가 회전**입니다. 0 이 곧 프리셋 원래 자세라
 * 되돌리기가 명확해요. 절대값이면 「차렷 자세」조차 0 이 아니라서 어떤
 * 숫자로 되돌려야 할지 알 수 없습니다.
 */

// ── 관절 ─────────────────────────────────────────────────────────────────

/**
 * 관절 포즈 편집 패널.
 *
 * 각도 슬라이더 대신 「여기서 관절을 고르면 3D 화면에 회전 기즈모가 붙는」
 * 방식입니다. 슬라이더로 숫자를 맞추는 것보다 직접 돌리는 편이 훨씬 빠릅니다.
 */
export function BonePosePanel({
  bonePose,
  activeBone,
  onSelectBone,
  onChangeBone,
  onResetBone,
  onResetAll,
  fineSnap,
  onFineSnap,
}: {
  bonePose: Record<string, Vector3Value>;
  activeBone: string | null;
  onSelectBone: (bone: string | null) => void;
  onChangeBone: (bone: string, rotation: Vector3Value) => void;
  onResetBone: (bone: string) => void;
  onResetAll: () => void;
  boneTransformMode: "translate" | "rotate";
  onBoneTransformMode: (mode: "translate" | "rotate") => void;
  fineSnap: boolean;
  onFineSnap: (value: boolean) => void;
}) {
  const [closedGroups, setClosedGroups] = useState<string[]>(
    COLLAPSED_BONE_GROUPS,
  );
  const current = (activeBone && bonePose[activeBone]) || { x: 0, y: 0, z: 0 };
  const adjusted = Object.values(bonePose).filter(
    (r) => r.x || r.y || r.z,
  ).length;

  const axisRow = (
    key: keyof Vector3Value,
    label: string,
    ringColor: string,
  ) => {
    const degrees = Math.round((current[key] * 180) / Math.PI);
    return (
      <div key={key} className="flex items-center gap-1.5">
        <span
          className="flex w-14 shrink-0 items-center gap-1 text-[10px]"
          style={{ color: "oklch(0.52 0.01 265)" }}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: ringColor }}
          />
          {label}
        </span>
        <div className="flex-1">
          <DegreeInput
            value={degrees}
            onChange={(next) =>
              activeBone &&
              onChangeBone(activeBone, {
                ...current,
                [key]: (next * Math.PI) / 180,
              })
            }
          />
        </div>
        <button
          type="button"
          onClick={() =>
            activeBone && onChangeBone(activeBone, { ...current, [key]: 0 })
          }
          disabled={!current[key]}
          title={`${label} 초기화`}
          className="shrink-0 rounded p-0.5 disabled:opacity-25"
          style={{
            color: current[key]
              ? "oklch(0.70 0.15 200)"
              : "oklch(0.38 0.01 265)",
          }}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </button>
      </div>
    );
  };

  return (
    <div data-tour="layout-joints" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px]" style={{ color: "oklch(0.50 0.01 265)" }}>
          관절을 고르면 3D 화면에 기즈모가 붙습니다
          {adjusted > 0 && ` · ${adjusted}개 조정됨`}
        </p>
        <button
          type="button"
          onClick={onResetAll}
          disabled={adjusted === 0}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] disabled:opacity-30"
          style={{
            color: adjusted ? "oklch(0.70 0.15 200)" : "oklch(0.38 0.01 265)",
          }}
        >
          <RotateCcw className="h-2.5 w-2.5" /> 전체 초기화
        </button>
      </div>

      {/* 그룹을 접을 수 있게 둡니다. 손가락까지 다 펴 두면 서른여섯 칸이라
          위쪽 상체 관절이 화면 밖으로 밀려납니다. */}
      {BONE_GROUPS.map((group) => {
        const bones = EDITABLE_BONES.filter((bone) => bone.group === group);
        const touchedCount = bones.filter((bone) => {
          const value = bonePose[bone.id];
          return !!value && !!(value.x || value.y || value.z);
        }).length;
        const open = !closedGroups.includes(group);
        return (
          <div key={group}>
            <button
              type="button"
              onClick={() =>
                setClosedGroups((current) =>
                  current.includes(group)
                    ? current.filter((item) => item !== group)
                    : [...current, group],
                )
              }
              className="mb-1 flex w-full items-center gap-1 text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: "oklch(0.40 0.01 265)" }}
            >
              {open ? (
                <ChevronDown className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
              {group}
              <span style={{ color: "oklch(0.34 0.01 265)" }}>
                ({bones.length})
              </span>
              {touchedCount > 0 && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{ background: "oklch(0.70 0.15 200)" }}
                />
              )}
            </button>
            <div className="grid grid-cols-3 gap-1" hidden={!open}>
              {bones.map((bone) => {
                const value = bonePose[bone.id];
                // 불리언으로 강제하지 않으면 (0 || 0 || 0) === 0 이 그대로 렌더링돼
                // 버튼에 "0" 이 찍힙니다.
                const touched = !!value && !!(value.x || value.y || value.z);
                const active = activeBone === bone.id;
                return (
                  <button
                    key={bone.id}
                    type="button"
                    onClick={() => onSelectBone(active ? null : bone.id)}
                    className="relative rounded-md px-1 py-1.5 text-[10px]"
                    style={{
                      background: active
                        ? "oklch(0.62 0.22 290 / 20%)"
                        : "oklch(1 0 0 / 4%)",
                      border: `1px solid ${active ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 7%)"}`,
                      color: active
                        ? "oklch(0.84 0.19 290)"
                        : "oklch(0.64 0.01 265)",
                    }}
                  >
                    {/* IK 뱃지는 없앴습니다 — 이제 모든 관절이 회전만 합니다. */}
                    {bone.label}
                    {touched && (
                      <span
                        className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full"
                        style={{ background: "oklch(0.70 0.15 200)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {activeBone && (
        <div
          className="space-y-2 rounded-md p-2.5"
          style={{
            background: "oklch(0.13 0.01 265)",
            border: "1px solid oklch(1 0 0 / 7%)",
          }}
        >
          <div className="flex items-center justify-between">
            <p
              className="text-[10px] font-semibold"
              style={{ color: "oklch(0.72 0.15 200)" }}
            >
              {EDITABLE_BONES.find((bone) => bone.id === activeBone)?.label ||
                activeBone}
            </p>
            <button
              type="button"
              onClick={() => onResetBone(activeBone)}
              className="flex items-center gap-1 text-[9px]"
              style={{ color: "oklch(0.70 0.15 200)" }}
            >
              <RotateCcw className="h-2.5 w-2.5" /> 이 관절 초기화
            </button>
          </div>

          {/*
            **IK 이동은 없앴습니다.** 관절 회전만으로 잡습니다.

            IK 로 손을 끌면 팔꿈치가 따라오는데, 그 따라오는 양이 커서
            원하는 자리에 못 세웠습니다. 되돌리기도 어려웠고요. 라고 정한
            방향입니다. (지시 10)

            **2026-09-21 에 다시 검토했고 다시 보류했습니다.** Sketch2Pose 를 보고
            「화면에서 관절을 끌면 3D 가 따라오게」 를 제안했는데, 그것이 곧 IK 라
            여기서 걷어낸 바로 그것입니다. 「팔꿈치가 제멋대로 따라오던」 까닭은
            **팔꿈치가 어느 쪽을 향할지(pole)를 안 정해서** 인 것으로 보이고 그건
            고칠 수 있지만, 로 정했습니다.

            그림 한 장에서 포즈를 통째로 가져오는 길(`poseFromImage`)이 생겨서
            **출발점 잡기는 그쪽이 맡습니다.** 여기는 다듬는 자리로 남습니다.
          */}
          {axisRow("x", "X축", "#ff5b5b")}
          {axisRow("y", "Y축", "#5bff8a")}
          {axisRow("z", "Z축", "#5b8aff")}
          <p
            className="text-[9px] leading-relaxed"
            style={{ color: "oklch(0.42 0.01 265)" }}
          >
            색은 기즈모 링 색과 같습니다 · 0° = 프리셋 원래 자세
          </p>
        </div>
      )}

      <label
        className="flex items-center gap-2 rounded-md px-2 py-1.5"
        style={{
          background: "oklch(1 0 0 / 4%)",
          border: "1px solid oklch(1 0 0 / 7%)",
        }}
      >
        <input
          type="checkbox"
          checked={fineSnap}
          onChange={(event) => onFineSnap(event.target.checked)}
          className="h-3 w-3"
        />
        <span className="text-[10px]" style={{ color: "oklch(0.62 0.01 265)" }}>
          미세 조정 — 2cm · 2° 단위로 끊어서 움직입니다
        </span>
      </label>
    </div>
  );
}

// ── 손가락 ───────────────────────────────────────────────────────────────

/**
 * 좌우 손의 손가락을 프리셋 + 마디별 각도로 다루는 패널.
 *
 * 프리셋과 수치 입력이 **같은 값**(`bonePose`)을 씁니다. 그래서 프리셋을
 * 누르면 아래 수치가 그대로 표시되고 거기서 이어서 손볼 수 있습니다.
 */
export function HandPosePanel({
  bonePose,
  onChange,
}: {
  bonePose: Record<string, Vector3Value>;
  onChange: (
    entries: Record<string, Vector3Value>,
    clearedHand?: "Left" | "Right",
  ) => void;
}) {
  const [side, setSide] = useState<"Left" | "Right">("Right");
  return (
    // 앵커는 판 뿌리에 — 왼손/오른손 토글 · 관절 세부 조정 안내 · «이 손 전체 펴기» 가 한 판이라서입니다.
    <div data-tour="layout-hands" className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        {(["Left", "Right"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSide(item)}
            className="rounded-md px-2 py-1.5 text-[10px]"
            style={{
              background:
                side === item
                  ? "oklch(0.62 0.22 290 / 20%)"
                  : "oklch(1 0 0 / 4%)",
              border: `1px solid ${side === item ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 7%)"}`,
              color:
                side === item ? "oklch(0.84 0.19 290)" : "oklch(0.64 0.01 265)",
            }}
          >
            {item === "Left" ? "왼손" : "오른손"}
          </button>
        ))}
      </div>

      {/*
        **손 모양 프리셋(주먹·가위·보자기…)과 폄/반/접음을 걷어냈습니다.**

        각도 계산이 계속 틀어졌습니다. 같은 «주먹» 인데 손가락마다 굽는 축이
        달라서, 프리셋을 고칠 때마다 다른 손가락이 어긋났어요. 로 정했습니다. (문제 6)

        그래서 여기서는 **관절을 직접 돌려 맞추고**, 마음에 들면 아래
        「현재 자세 저장」 으로 내 프리셋을 만듭니다. 내가 만든 값이라
        틀어질 일이 없습니다.
      */}
      <p
        className="rounded-md px-2 py-1.5 text-[9px] leading-relaxed"
        style={{
          background: "oklch(1 0 0 / 4%)",
          border: "1px solid oklch(1 0 0 / 7%)",
          color: "oklch(0.55 0.01 265)",
        }}
      >
        손가락은 위 「관절 세부 조정」 에서 마디를 골라 각도로 맞춥니다. 다
        맞췄으면 아래 <b>현재 자세 저장</b> 으로 내 프리셋에 담아 두세요.
      </p>

      {/* 손가락 15개 관절의 현재 각도를 한 번에 보여줍니다.
          어느 마디가 왜 틀어져 있는지 관절을 하나씩 눌러보지 않고 확인할 수 있습니다. */}
      <div
        className="rounded-md p-2"
        style={{
          background: "oklch(0.13 0.01 265)",
          border: "1px solid oklch(1 0 0 / 7%)",
        }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className="text-[9px] font-semibold"
            style={{ color: "oklch(0.50 0.01 265)" }}
          >
            현재 각도 (Y / Z°)
          </span>
          <button
            type="button"
            onClick={() => {
              let entries: Record<string, Vector3Value> = {};
              for (const finger of FINGER_NAMES) {
                entries = {
                  ...entries,
                  ...fingerStateToBonePose(side, finger, "extend"),
                };
              }
              onChange(entries, side);
            }}
            className="flex items-center gap-1 text-[9px]"
            style={{ color: "oklch(0.70 0.15 200)" }}
          >
            <RotateCcw className="h-2.5 w-2.5" /> 이 손 전체 펴기
          </button>
        </div>
        {FINGER_NAMES.map((finger) => (
          <div
            key={finger}
            className="flex items-center gap-1 text-[9px]"
            style={{ color: "oklch(0.55 0.01 265)" }}
          >
            <span className="w-7 shrink-0">{FINGER_LABELS[finger]}</span>
            {[1, 2, 3].map((joint) => {
              const value = bonePose[`${side}Hand${finger}${joint}`];
              // Z 는 굽힘, Y 는 벌림입니다. 둘 다 보여야 «왜 이 손가락만
              // 삐딱한가» 를 관절을 눌러 보지 않고 알 수 있습니다.
              const y = value ? Math.round((value.y * 180) / Math.PI) : 0;
              const z = value ? Math.round((value.z * 180) / Math.PI) : 0;
              const touched = y !== 0 || z !== 0;
              return (
                <span
                  key={joint}
                  className="flex-1 rounded px-1 py-0.5 text-center tabular-nums"
                  style={{
                    background: touched
                      ? "oklch(0.55 0.15 200 / 16%)"
                      : "transparent",
                    color: touched
                      ? "oklch(0.74 0.15 200)"
                      : "oklch(0.38 0.01 265)",
                  }}
                >
                  {y} / {z}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p
        className="text-[9px] leading-relaxed"
        style={{ color: "oklch(0.42 0.01 265)" }}
      >
        프리셋은 위 관절 목록의 손가락 각도를 채웁니다. 누른 뒤 손가락 관절을
        골라 수치로 다듬을 수 있습니다. 첫마디는 건드리지 않습니다 — 굽히면
        손등이 무너집니다.
      </p>
    </div>
  );
}

// ── 사용자 프리셋 ────────────────────────────────────────────────────────

/**
 * 화면에서 맞춘 자세를 이름·그룹을 붙여 저장하고 다시 불러옵니다.
 * 각도를 코드에 하드코딩하는 대신 눈으로 맞춘 값을 재사용하는 방식입니다.
 */
export function PosePresetLibrary({
  bonePose,
  onApply,
}: {
  bonePose: Record<string, Vector3Value>;
  onApply: (entries: Record<string, Vector3Value>, replaceAll: boolean) => void;
}) {
  const [presets, setPresets] = useState<PosePreset[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [kind, setKind] = useState<PosePresetKind>("body");
  const [hand, setHand] = useState<HandSide>("Right");
  const [applyHand, setApplyHand] = useState<HandSide>("Right");

  // 설정에서 폴더를 정하면 파일로, 아니면 브라우저 저장소로 갑니다.
  const [folder, setFolder] = useState("");

  const refresh = () => {
    void listPosePresets().then(setPresets);
    /*
      **실제로 저장되는 자리**를 봐야 합니다.

      예전에는 `getPresetFolder()` — 「설정에서 따로 지정한 값」 — 을 봤습니다.
      그건 안 지정하면 빈 문자열이라, 기본 자리(저장 폴더/PosePreset)에
      멀쩡히 저장되는데도 「이 브라우저에만 저장됩니다」 라는 거짓 경고가
      떴습니다. 프롬프트 문서 쪽에서 「되돌릴 폴더가 설정돼 있지 않습니다」 가
      떴던 것과 같은 착각입니다.
    */
    setFolder(presetDirectory());
  };
  useEffect(refresh, []);

  const groups = [...new Set(presets.map((preset) => preset.group))];

  /** 끌고 있는 프리셋과 지금 올라가 있는 자리. 화면 상태라 저장하지 않습니다. */
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  /**
   * 끌어 놓은 자리로 옮깁니다. 그룹이 다르면 **그룹째 옮겨집니다** — 그룹 이름을 따로 고치는
   * 칸을 두지 않아도 목록에서 바로 재분류할 수 있습니다.
   *
   * 자리는 그룹 안에서 0,1,2… 로 다시 매겨 저장합니다. 끌 때마다 그 그룹 전부를 다시 쓰는
   * 것이라 파일 몇 개가 함께 바뀌지만, 간격을 두고 매기다 자리가 모자라 깨지는 것보다 낫습니다.
   */
  const reorder = async (sourceId: string | null, target: PosePreset) => {
    setDragId(null);
    setDropId(null);
    if (!sourceId || sourceId === target.id) return;
    const source = presets.find((item) => item.id === sourceId);
    if (!source) return;
    const rest = presets.filter(
      (item) => item.group === target.group && item.id !== source.id,
    );
    const at = rest.findIndex((item) => item.id === target.id);
    const ordered = [...rest];
    ordered.splice(at < 0 ? ordered.length : at, 0, {
      ...source,
      group: target.group,
    });
    await Promise.all(
      ordered.map((item, index) =>
        item.order === index &&
        item.group === (item.id === source.id ? target.group : item.group)
          ? Promise.resolve()
          : writePosePreset(
              { ...item, group: target.group, order: index },
              item.id === source.id ? source : item,
            ),
      ),
    );
    refresh();
  };

  /** 지우기 전에 반드시 묻습니다 — 되돌릴 수 없습니다. */
  const removePreset = async (preset: PosePreset) => {
    const ok = await confirmDialog({
      title: "이 포즈 프리셋을 지울까요?",
      subject: `${preset.group} · ${preset.name}`,
      description:
        "저장 폴더의 원본 파일도 함께 지워집니다. 되돌릴 수 없습니다.",
      confirmLabel: "지우기",
      tone: "danger",
    });
    if (!ok) return;
    await deletePosePreset(preset);
    refresh();
  };

  const commitSave = async () => {
    if (!name.trim()) {
      toast.error("프리셋 이름을 입력해 주세요.");
      return;
    }
    const payload = bonePoseForKind(bonePose, kind, hand);
    if (Object.keys(payload).length === 0) {
      toast.error(
        kind === "hand"
          ? "저장할 손가락 각도가 없습니다."
          : "저장할 관절 각도가 없습니다.",
      );
      return;
    }
    await savePosePreset({
      name: name.trim(),
      group: group || "기본",
      kind,
      hand: kind === "hand" ? hand : undefined,
      bonePose: payload,
    });
    setName("");
    setSaving(false);
    refresh();
    toast.success(`"${name.trim()}" 프리셋을 저장했습니다.`);
  };

  const apply = (preset: PosePreset) => {
    if (preset.kind === "hand") {
      // 한쪽 손만 맞춰 저장했으면 반대 손에는 좌우를 뒤집어 적용합니다.
      onApply(mirrorHandBonePose(preset.bonePose, applyHand), false);
      toast.success(
        `${applyHand === "Left" ? "왼손" : "오른손"}에 "${preset.name}" 적용`,
      );
      return;
    }
    onApply(preset.bonePose, preset.kind === "full");
    toast.success(`"${preset.name}" 적용`);
  };

  return (
    <div className="space-y-2">
      <div data-tour="layout-presets" className="flex items-center justify-between">
        <p
          className="text-[10px] font-semibold"
          style={{ color: "oklch(0.45 0.01 265)" }}
        >
          내 프리셋
        </p>
        <button
          type="button"
          onClick={() => setSaving((value) => !value)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
          style={{ color: "oklch(0.80 0.18 290)" }}
        >
          <Plus className="h-2.5 w-2.5" /> 현재 자세 저장
        </button>
      </div>

      {/*
        폴더가 없으면 프리셋이 브라우저 저장소에만 남습니다. 앱을 다시 깔거나
        저장소를 비우면 통째로 사라지는데, 그걸 모르면 «어제 만든 자세가
        없어졌다» 가 됩니다. 그래서 저장하기 전에 미리 말해 둡니다.
      */}
      {!folder && (
        <p
          className="rounded-md px-2 py-1.5 text-[9px] leading-relaxed"
          style={{
            background: "oklch(0.70 0.14 60 / 12%)",
            border: "1px solid oklch(0.70 0.14 60 / 30%)",
            color: "oklch(0.84 0.12 60)",
          }}
        >
          설정에서 프리셋 폴더를 지정하지 않아 이 브라우저에만 저장됩니다.
        </p>
      )}

      {saving && (
        <div
          className="space-y-1.5 rounded-md p-2.5"
          style={{
            background: "oklch(0.13 0.01 265)",
            border: "1px solid oklch(0.62 0.22 290 / 30%)",
          }}
        >
          <ChoiceRow
            value={kind}
            columns={3}
            options={[
              { id: "full" as PosePresetKind, label: "전체" },
              { id: "body" as PosePresetKind, label: "몸통·팔다리" },
              { id: "hand" as PosePresetKind, label: "손 모양" },
            ]}
            onChange={setKind}
          />

          {kind === "hand" && (
            <ChoiceRow
              value={hand}
              columns={2}
              options={[
                { id: "Left" as HandSide, label: "왼손 기준" },
                { id: "Right" as HandSide, label: "오른손 기준" },
              ]}
              onChange={setHand}
            />
          )}

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="프리셋 이름 (예: 주먹, 총 겨누기)"
            className="h-8 w-full rounded-md px-2 text-xs outline-none"
            style={FIELD_STYLE}
          />
          <input
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            placeholder="그룹 (예: 손 모양, 액션)"
            className="h-8 w-full rounded-md px-2 text-xs outline-none"
            style={FIELD_STYLE}
          />

          <p
            className="text-[9px] leading-relaxed"
            style={{ color: "oklch(0.45 0.01 265)" }}
          >
            {kind === "hand"
              ? "한쪽 손만 맞춰 저장하면 반대 손에는 좌우를 뒤집어 적용합니다."
              : "손가락을 제외한 몸통·팔·다리 각도를 저장합니다."}
          </p>

          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => void commitSave()}
              className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-white gradient-primary"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setSaving(false)}
              className="rounded-md px-2 py-1.5 text-[10px]"
              style={{
                background: "oklch(1 0 0 / 5%)",
                color: "oklch(0.62 0.01 265)",
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {presets.length === 0 ? (
        <p
          className="rounded-md px-2 py-3 text-center text-[10px]"
          style={{
            background: "oklch(1 0 0 / 3%)",
            color: "oklch(0.45 0.01 265)",
          }}
        >
          저장된 프리셋이 없습니다. 자세를 맞춘 뒤 위에서 저장하세요.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span
              className="text-[9px]"
              style={{ color: "oklch(0.45 0.01 265)" }}
            >
              손 프리셋 적용 대상
            </span>
            {(["Left", "Right"] as HandSide[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setApplyHand(item)}
                className="rounded px-1.5 py-0.5 text-[9px]"
                style={{
                  background:
                    applyHand === item
                      ? "oklch(0.55 0.15 200 / 22%)"
                      : "oklch(1 0 0 / 4%)",
                  color:
                    applyHand === item
                      ? "oklch(0.76 0.15 200)"
                      : "oklch(0.55 0.01 265)",
                }}
              >
                {item === "Left" ? "왼손" : "오른손"}
              </button>
            ))}
          </div>

          {/*
            ── 내 프리셋 — 그룹별 버튼 ─────────────────────────────────────
            

            생김새는 `ChoiceRow` 와 같은 값(둥근 모서리·같은 배경·테두리·글자 크기)입니다 —
            여기만 다르게 그리면 같은 패널 안에서 두 가지 단추가 됩니다(공통 규칙 2).
          */}
          {groups.map((groupName) => (
            <div key={groupName}>
              <p
                className="mb-1 text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: "oklch(0.40 0.01 265)" }}
              >
                {groupName}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {presets
                  .filter((preset) => preset.group === groupName)
                  .map((preset) => {
                    const dragging = dragId === preset.id;
                    const over = dropId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className="relative"
                        draggable
                        onDragStart={(event) => {
                          setDragId(preset.id);
                          event.dataTransfer.effectAllowed = "move";
                          // 파이어폭스는 데이터가 없으면 드래그를 시작하지 않습니다.
                          event.dataTransfer.setData("text/plain", preset.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropId(null);
                        }}
                        onDragOver={(event) => {
                          if (!dragId || dragId === preset.id) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropId(preset.id);
                        }}
                        onDragLeave={() =>
                          setDropId((current) =>
                            current === preset.id ? null : current,
                          )
                        }
                        onDrop={(event) => {
                          event.preventDefault();
                          void reorder(dragId, preset);
                        }}
                        style={{ opacity: dragging ? 0.4 : 1 }}
                      >
                        <button
                          type="button"
                          onClick={() => apply(preset)}
                          title={`${preset.name} — 끌어서 자리를 옮깁니다`}
                          className="w-full rounded-md py-1.5 pl-2 pr-5 text-left text-[10px]"
                          style={{
                            background: "oklch(1 0 0 / 4%)",
                            border: `1px solid ${over ? "oklch(0.62 0.22 290 / 70%)" : "oklch(1 0 0 / 7%)"}`,
                            color: "oklch(0.64 0.01 265)",
                          }}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="shrink-0 rounded px-1 text-[8px] font-bold"
                              style={{
                                background:
                                  preset.kind === "hand"
                                    ? "oklch(0.55 0.15 200 / 22%)"
                                    : "oklch(0.62 0.22 290 / 22%)",
                                color:
                                  preset.kind === "hand"
                                    ? "oklch(0.76 0.15 200)"
                                    : "oklch(0.82 0.19 290)",
                              }}
                            >
                              {preset.kind === "hand"
                                ? preset.hand === "Left"
                                  ? "왼손"
                                  : "오른손"
                                : "포즈"}
                            </span>
                            <span className="truncate">{preset.name}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePreset(preset)}
                          title="이 프리셋 지우기"
                          aria-label={`${preset.name} 지우기`}
                          className="absolute right-0.5 top-0.5 rounded p-0.5 hover:bg-white/10"
                          style={{ color: "oklch(0.55 0.14 25)" }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export { mergeBonePose };
