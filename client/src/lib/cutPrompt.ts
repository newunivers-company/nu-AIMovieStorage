import {
  cameraMovesEnd,
  describeCameraMoves,
  SHOT_PRESETS,
} from "@/lib/cameraMoves";
import { shotSizeOf, type CompositionState,
  describeHorizonRoom,
  framePlaceOf,
  horizonOverridesLocation,
} from "@/lib/composition";
import type { ProjectContextSummary } from "@/lib/projectContext";
import type { Background, Character, Cut } from "@/lib/projectTypes";

/**
 * 컷 프롬프트를 규칙으로 조립합니다.
 *
 * # 왜 LLM 에 통째로 안 맡기는가
 *
 * 구도잡기에서 읽은 것들 — 카메라가 어디 있고, 인물이 몇 미터 앞에 있고,
 * 어떤 무빙인지 — 은 **사실**입니다. 이걸 LLM 에 넘겨 «알아서 써 줘» 하면
 * 구도를 임의로 바꿉니다. 「인물이 왼쪽에」 라고 정해 뒀는데 오른쪽에 세운
 * 문장이 나오는 식이에요.
 *
 * 그래서 두 단계로 갑니다.
 *
 * 1. **규칙이 사실을 만듭니다** — 여기서. 샷 크기·앵글·거리·무빙.
 * 2. LLM 은 그 위에서 **문장만 다듬습니다.**
 *
 * 순서를 바꾸면 안 됩니다.
 */

export interface CutPromptInput {
  cut: Cut;
  characters: Character[];
  background?: Background;
  context: ProjectContextSummary | null;
}

/*
  샷 크기는 `composition.ts` 의 `shotSizeOf` 하나만 씁니다(규칙 1).

  예전에는 여기에 같은 표가 한 벌 더 있었습니다. 화각 손잡이가 생겨 «거리 = 샷 크기»
  가 깨졌을 때 한쪽만 고치면, 컷 카드 머리줄과 프롬프트가 서로 다른 샷을 말합니다.
*/

/** 카메라 높이로 앵글을 정합니다. 눈높이 기준입니다. */
function angle(
  cameraY: number,
  subjectEyeY: number,
): { ko: string; en: string } {
  const diff = cameraY - subjectEyeY;
  if (diff > 1.2) return { ko: "높은 부감", en: "high angle looking down" };
  if (diff > 0.3) return { ko: "약한 부감", en: "slightly high angle" };
  if (diff < -1.2) return { ko: "낮은 앙각", en: "low angle looking up" };
  if (diff < -0.3) return { ko: "약한 앙각", en: "slightly low angle" };
  return { ko: "눈높이", en: "eye level" };
}

/** 화면 가로에서 인물이 어디쯤 있는지. 삼분할로 말합니다. */
function framePosition(offsetRatio: number): { ko: string; en: string } {
  if (offsetRatio < -0.18)
    return { ko: "화면 왼쪽 삼분할선", en: "on the left third of the frame" };
  if (offsetRatio > 0.18)
    return {
      ko: "화면 오른쪽 삼분할선",
      en: "on the right third of the frame",
    };
  return { ko: "화면 가운데", en: "centred in the frame" };
}

export interface CutPromptResult {
  ko: string;
  en: string;
  negativeKo: string;
  negativeEn: string;
  /** LLM 에 넘길 «사실» 들. 이걸 바꾸면 안 된다고 못을 박습니다. */
  facts: Record<string, unknown>;
}

export function buildCutPrompt(input: CutPromptInput): CutPromptResult {
  const { cut, characters, background, context } = input;
  /*
    **«구도 씀» 을 끄면 구도를 안 읽습니다.**

    이 스위치가
    **무시되고 있었습니다.** 컷 카드에서 «구도 안 씀» 으로 꺼도 여기서 `cut.composition`
    을 그대로 읽어, 샷 크기·앵글·거리·무빙 문장을 프롬프트에 박았습니다. 안 올린 배치도를
    설명해 봐야 생성기가 맞출 것이 없는데도요.

    더 나쁜 것은 LLM 요청이었습니다 — 구도는 `null` 로 보내면서 «사실» 에는 카메라와 인물
    자리를 채워 보내, 한 요청 안에서 두 말이 서로 어긋났습니다.
  */
  const composition: CompositionState | undefined =
    cut.useComposition === false ? undefined : cut.composition;

  const ko: string[] = [];
  const en: string[] = [];
  const facts: Record<string, unknown> = {};

  if (context) {
    ko.push(context.ko);
    en.push(context.en);
  }

  /*
    **호리존이 장소를 이깁니다**(`horizonOverridesLocation` — 규칙은 거기 한 벌). 컷에 배경을 골라 뒀어도 활성 방이
    호리존이면 «장소는 …» 줄과 `facts.location` 을 빼고, 아래 구도 절의 호리존 문장만 싣습니다. 둘 다 실으면 생성기가
    제품을 카페 안에 세웁니다. «구도 안 씀» 이면 `composition` 이 없어 호리존도 없고, 장소가 그대로 실립니다.
  */
  if (background && !horizonOverridesLocation(composition)) {
    ko.push(`장소는 ${background.name}. ${background.description}`.trim());
    en.push(`Location: ${background.name}. ${background.description}`.trim());
    facts.location = background.name;
  }

  // ── 구도에서 읽어 낸 사실들 ────────────────────────────────────────────
  if (composition) {
    /*
      **호리존 방이면 배경도 사실입니다.** 장소 카드가 없는 방이라 위의 «장소는 …» 줄이 안 생기고, 그러면 생성기가
      배경을 지어냅니다 — 제품 컷에서 가장 안 되는 일입니다. 문장은 영상 프롬프트와 **한 벌**
      (`describeHorizonRoom`)이라 색을 바꾸면 둘 다 따라옵니다.
    */
    const horizon = describeHorizonRoom(composition);
    if (horizon) {
      ko.push(horizon.ko);
      en.push(horizon.en);
      facts.horizon = { color: horizon.color };
    }

    const cameraPos = composition.camera.position;
    const placed = composition.characters.filter((item) => !item.hidden);

    const cameraFacts = placed.map((placement) => {
      const source = characters.find(
        (item) => item.id === placement.characterId,
      );
      const height = (source?.heightCm ?? 170) / 100;
      const dx = placement.position.x - cameraPos.x;
      const dz = placement.position.z - cameraPos.z;
      const distance = Math.hypot(dx, dz);
      // 화면 점유율로 정합니다 — 화각(12°~90°)을 만져도 이름이 따라옵니다.
      const size = shotSizeOf(distance, composition.camera.fovDegrees, height);
      const view = angle(cameraPos.y, placement.position.y + height * 0.94);
      /*
        화면에서의 자리는 **공용 함수**가 냅니다(`framePlaceOf`).

        2026-09-21 점검: 여기 있던 가로 화각 식이 `summarizeCompositionCamera` 것과
        **달랐습니다** — 이쪽은 각도에 비율을 그냥 곱했고(`fov × 16/9 / 2`) 저쪽은
        제대로 `atan(tan(fov/2) × 비율)` 이었습니다. 같은 구도인데 컷 프롬프트와 영상
        프롬프트가 인물을 **다른 자리에 적고** 있었습니다.
      */
      const place = framePlaceOf(composition.camera, placement.position, height);
      const where = framePosition(place.lateral);

      return {
        name: source?.name || "인물",
        distanceM: Math.round(distance * 10) / 10,
        shot: size,
        angle: view,
        position: where,
        heightCm: source?.heightCm ?? 170,
        screen: { xPct: place.xPct, yPct: place.yPct },
      };
    });

    facts.camera = {
      fovDegrees: composition.camera.fovDegrees,
      heightM: Math.round(cameraPos.y * 100) / 100,
    };
    facts.subjects = cameraFacts.map((item) => ({
      name: item.name,
      distanceM: item.distanceM,
      shot: item.shot.en,
      angle: item.angle.en,
      framePosition: item.position.en,
      /*
        **화면에서의 자리를 숫자로도** 넘깁니다(왼쪽 0% · 오른쪽 100%).
        사용자 2026-09-21: Seedance 2.5 가 `x 42%, y 44%` 를 받아 줍니다 — 말로 「왼쪽에」
        라고만 하면 컷마다 옮겨 가는데 숫자는 안 흔들립니다. 받아 주지 않는 모델에는
        그냥 무시되는 값이라 해가 없습니다.
      */
      screenXPct: item.screen.xPct,
      screenYPct: item.screen.yPct,
      heightCm: item.heightCm,
    }));

    cameraFacts.forEach((item) => {
      ko.push(
        `${item.name}: ${item.shot.ko}, ${item.angle.ko}, ${item.position.ko}. ` +
          `카메라에서 ${item.distanceM}m, 키 ${item.heightCm}cm.`,
      );
      en.push(
        `${item.name}: ${item.shot.en}, ${item.angle.en}, ${item.position.en}, ` +
          `${item.distanceM} metres from camera.`,
      );
    });

    const moves = composition.cameraMoves ?? [];
    const move = moves[0];
    const described = describeCameraMoves(moves);
    if (described && move) {
      const preset = SHOT_PRESETS.find((item) => item.id === move.shotId);
      ko.push(`카메라 무빙: ${described.ko}. ${preset?.hint ?? ""}`.trim());
      en.push(`Camera move: ${described.en}.`);
      // 문장이 클립 전부를 말하므로 사실도 전부여야 합니다 — 길이는 마지막 클립이 끝나는 시각.
      facts.cameraMove = {
        preset: preset?.label,
        seconds: cameraMovesEnd(moves),
        clips: moves.length,
      };
    } else {
      ko.push("카메라는 고정입니다.");
      en.push("The camera is locked off, no camera movement.");
      facts.cameraMove = null;
    }
  } else if (characters.length) {
    /*
      **구도가 없으면 인물을 이름으로라도 적습니다.**

      여태 인물 이름을 «구도에 놓인 사람» 에게서만 꺼냈습니다. 그래서 구도를 안 쓰면
      컷에 사람을 골라 두었는데도 프롬프트에 **한 명도 안 적혔습니다.** 자리를 모르는 것과
      사람이 없는 것은 다릅니다.
    */
    const names = characters.map((item) => item.name).filter(Boolean);
    ko.push(`등장인물: ${names.join(", ")}. 자리와 구도는 정해 두지 않았습니다.`);
    en.push(`People in this shot: ${names.join(", ")}.`);
    facts.people = names;
  }

  if (cut.description.trim()) {
    ko.push(cut.description.trim());
    en.push(cut.description.trim());
  }

  return {
    ko: ko.filter(Boolean).join(" "),
    en: en.filter(Boolean).join(" "),
    negativeKo:
      "말하지 않은 물건, 글자·워터마크, 여러 장으로 나뉜 화면, 다른 구도, 다른 카메라 위치",
    negativeEn:
      "objects that were not described, text, watermark, split panels, different framing, different camera position",
    facts,
  };
}
