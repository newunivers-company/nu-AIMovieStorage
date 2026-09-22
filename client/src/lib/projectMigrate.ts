/**
 * 저장본의 **판(schemaVersion)** 과, 옛 판을 한 걸음씩 올리는 길.
 *
 * 여태 저장본을 읽는 일은 «읽는 자리마다 즉석 보정» 이었습니다. 구도는 여는 순간
 * 정규화하고, 진행 표시는 화면이 옮기고, 배치도는 시트 창이 바꿉니다. 규칙이 흩어져
 * 있으면 「이 파일이 어느 판인가」 를 아무도 모르고, 보정 하나를 고칠 때 **여덟 곳은
 * 맞고 한 곳만 틀린** 모양이 됩니다 — 이 저장소가 반복해 터뜨린 사고가 그 모양입니다.
 *
 * 그래서 저장본에 번호를 적고, 올리는 함수를 한 줄로 세웁니다. 새 판이 생기면 `STEPS`
 * 에 함수를 하나 더 붙이기만 하면 됩니다. 지금 판 번호는 그 길이에서 따라 나오므로
 * **번호를 두 곳에 적을 일이 없습니다**(한 벌 규칙).
 *
 * ── 판을 «초안 밖» 에 두는 까닭 ─────────────────────────────────────────────
 * `schemaVersion` 은 저장본의 겉(`LocalProject`)에 붙고 `draft` 안에는 넣지 않습니다.
 * 저장 관문에 「내용이 그대로면 쓰지 않습니다」 규칙이 있고, 그 비교가 `draft` 를 통째로
 * 견줍니다. 판을 초안 안에 넣으면 판 없는 옛 저장본이 열리는 순간 전부 «달라졌다» 가
 * 되어, 앱을 켜기만 해도 작품 수만큼 파일 쓰기가 나갑니다. 두 창이 서로를 되돌리는
 * 핑퐁을 막으려고 둔 장치를 스스로 깨는 셈입니다. 그래서 올리는 함수도 «초안을 그대로
 * 돌려주는 걸음» 이면 **받은 객체를 그대로** 돌려줘야 합니다.
 */

/*
  ── 아직 여기로 옮기지 않은 즉석 보정 목록 ───────────────────────────────────

  이번 걸음은 «판을 매기고 길을 깐다» 까지입니다. 아래 보정을 지금 옮기면 회귀가 납니다
  (읽는 자리마다 조건이 조금씩 다르고, 화면이 그 차이에 기대고 있습니다). 다음 사람이
  한 걸음씩 옮길 수 있도록 **어디에 무엇이 흩어져 있는지만** 적어 둡니다.

  - `lib/composition.ts` `normalizeComposition`
      · `@deprecated roomSize/roomDepth/roomHeight` → `rooms[0]` 의 치수
      · `@deprecated roomOccludes`(= 여섯 면 전부) · `occludeFaces` · `faces` → `rooms[0]`
      · `cameraMove` 한 개 → `cameraMoves` 목록의 첫 칸
      · 실외 두르는 방식이 안 적힌 저장본은 «돔»
      · 축척 손잡이가 «배경 눈높이» 에서 «방 한 변» 으로 바뀐 것
      · 대상 `rotationY` ↔ `rotation.y`
  - `lib/projectTypes.ts` `settleLoading`
      · 저장된 «돌고 있음» 표시(analysisLoading·promptLoading) 끄기
      · 빠진 배열(assets·alternates·refImages…)을 기본값으로 채우기
  - `lib/projectTypes.ts` `migrateProgress` — 다섯 단계 진행 표시를 네 단계로
  - `lib/sheetCompose.ts` `layoutToPx` — `coords` 없는 «긴 변 6000 기준» 배치도를 실제 px 로
      (부르는 자리가 `components/project/EntitySheetComposer.tsx` 에 흩어져 있습니다)
  - `lib/faceSets.ts` `faceOf` — `face` 칸이 없는 그림을 파일 이름으로 갈래 짓기
  - `lib/cameraMoves.ts` — 옛 프리셋 id 를 지금 id 로
  - `lib/roomPreset.ts` — 표가 없는 저장본의 자리 해석
  - `lib/cutCompositionSync.ts` — `isMannequin` 표가 없는 배치를 목록으로 가려내기
  - `lib/promptLinks.ts` `legacyTailRests` — 옛 판이 남긴 여러 줄 꼬리 찌꺼기
  - `lib/compositionColors.ts` — 마네킹 색을 옛 자리(`mannequins[].color`)에서도 읽기
  - `lib/tutorialStore.ts` — 없는 걸음을 가리키는 옛 저장본
  - `lib/mediaLibrary.ts` `migrateProjectLayout` — 폴더 구조 옮기기. 이건 **파일을 움직이므로**
    여기로 오면 안 됩니다(판 올리기는 저장본 한 덩이를 손보는 일이라야 되돌리기 쉽습니다).
*/

/** 저장본의 겉 — 판과 초안. 겉이 더 있어도 상관없습니다(`LocalProject` 가 그대로 들어옵니다). */
export interface VersionedProject {
  schemaVersion?: number;
  draft?: unknown;
}

/**
 * 판을 한 걸음 올리는 함수. `STEPS[i]` 는 **i 판을 i+1 판으로** 올립니다.
 *
 * `schemaVersion` 은 올리는 쪽에서 찍지 않습니다 — 마지막에 한 번만 찍습니다. 걸음마다
 * 찍게 두면 걸음을 더할 때 번호를 손으로 맞춰야 하고, 한 걸음만 빠뜨려도 조용히 어긋납니다.
 */
interface MigrationStep {
  /** 무엇을 옮기는 걸음인지 — 로그와 다음 사람이 읽을 자리입니다. */
  note: string;
  up: (saved: VersionedProject) => VersionedProject;
}

const STEPS: MigrationStep[] = [
  {
    // 0 → 1. 지금 모양을 1 판으로 봅니다. 옮길 것은 없고 «번호를 매긴다» 가 전부입니다.
    // 받은 객체를 그대로 돌려주는 것이 중요합니다(위 «초안 밖» 절의 까닭).
    note: "판 매기기 — 지금 모양을 1 판으로",
    up: (saved) => saved,
  },
];

/** 지금 판. `STEPS` 길이에서 따라 나옵니다 — 걸음을 더하면 저절로 올라갑니다. */
export const PROJECT_SCHEMA_VERSION = STEPS.length;

/**
 * 이 저장본이 몇 판인가. 안 적혀 있으면 **0**(판을 매기기 전의 저장본)입니다.
 *
 * 사람이 손으로 만진 파일도 들어옵니다(폴더가 원본이라 그럴 수 있습니다). 정수가 아니거나
 * 음수면 0 으로 봅니다 — 모르는 값 때문에 멀쩡한 작품을 못 읽는 쪽이 더 나쁩니다.
 */
export function schemaVersionOf(saved: unknown): number {
  const version = (saved as VersionedProject | null)?.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return 0;
  return version;
}

/**
 * 저장본을 **지금 판까지** 차례로 올립니다. 읽는 자리에서 한 번씩 부릅니다.
 *
 * - 이미 지금 판이면 **받은 것을 그대로** 돌려줍니다(새 객체를 만들지 않습니다).
 * - 모르는 **미래 판**(우리보다 높은 번호)이면 **손대지 않고 그대로** 돌려주고 경고만 남깁니다.
 * 내려 깎으면 새 판에만 있는 칸이 사라져 **파일이 상합니다.** 새 판으로 저장한 뒤 옛 앱으로
 * 한 번 여는 일은 정상적으로 일어납니다(두 대에 판이 다른 앱이 깔려 있을 수 있습니다).
 *
 * @param label 경고에 찍을 이름. 보통 작품 id 나 파일 경로입니다.
 */
export function migrateSavedProject<T extends VersionedProject>(saved: T, label = "저장본"): T {
  if (!saved || typeof saved !== "object") return saved;

  const from = schemaVersionOf(saved);
  if (from > PROJECT_SCHEMA_VERSION) {
    console.warn(
      `[저장본 판] ${label}: 이 앱보다 새로운 판(${from} > ${PROJECT_SCHEMA_VERSION})입니다. ` +
        "손대지 않고 그대로 씁니다 — 앱을 올린 뒤 여세요.",
    );
    return saved;
  }
  if (from === PROJECT_SCHEMA_VERSION) return saved;

  let moved: VersionedProject = saved;
  for (let step = from; step < PROJECT_SCHEMA_VERSION; step += 1) {
    moved = STEPS[step].up(moved);
  }
  // 번호는 마지막에 한 번만. 걸음이 객체를 그대로 돌려줬어도 여기서 새 겉을 만듭니다.
  return { ...(moved as T), schemaVersion: PROJECT_SCHEMA_VERSION };
}
