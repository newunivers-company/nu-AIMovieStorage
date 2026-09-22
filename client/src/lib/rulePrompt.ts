import {
  backgroundAllowsLabels,
  backgroundFrameKind,
  backgroundFrameGroup,
  backgroundNegativeEnglish,
  backgroundPanelCount,
  listBlueprint,
  type BlueprintKind,
  type BlueprintRouteMark,
  type PanoramaSpace,
  composeUnfoldPrompt,
  unfoldChipOf,
  unfoldNegativeOf,
  type SpaceKind,
} from "@/lib/blueprint";
import { referenceModeOption, resolveReferenceMode, type ReferenceMode } from "@/lib/promptWorkflow";
import type { ProjectContextSummary } from "@/lib/projectContext";

/**
 * LLM 없이 규칙으로 프롬프트를 조립합니다.
 *
 * # 왜 필요한가
 *
 * API 키가 없어도 앱이 멈추면 안 됩니다. 그리고 **키가 있어도 이게 필요합니다** —
 * 요청이 실패하는 일이 실제로 있고, 그때 빈 칸을 보여 주는 것보다 규칙으로
 * 조립한 것이라도 보여 주는 편이 낫습니다. 손으로 고쳐 쓸 바탕은 되니까요.
 *
 * # 왜 하나로 합쳤는가
 *
 * 원래는 `characterSheetCompiler` 와 `backgroundPromptCompiler` 가 따로
 * 있었습니다. 그런데 둘이 하는 일이 같았어요 — 작품 설정을 앞에 놓고,
 * 고른 칸을 나열하고, 레퍼런스 활용 방식을 적고, 금지 사항을 붙입니다.
 * 따로 두니 «장르는 소재이고 스타일은 화풍» 같은 규칙을 한쪽에만 넣고
 * 다른 쪽을 빠뜨리는 일이 생겼습니다. 한 곳에서 고치면 셋이 함께 바뀝니다.
 */

export interface RulePromptInput {
  kind: BlueprintKind;
  /** 캐릭터·배경·에셋의 이름 */
  name: string;
  /** 사람이 적어 둔 설명 */
  description: string;
  /** 고른 레퍼런스 구성 칸 */
  blueprint: string[];
  /** 작품 전체 설정 */
  context: ProjectContextSummary | null;
  /** 레퍼런스 이미지 장수 */
  referenceCount: number;
  referenceMode?: ReferenceMode;
  /** 레퍼런스를 보고 적어 둔 분석 */
  analysis?: string;
  /** 같은 분석의 영어. 없으면 영문 칸에는 **안 싣습니다** — 한국어를 그대로 보내지 않습니다. */
  analysisEn?: string;
  /** 배경일 때만 */
  spaceKind?: SpaceKind;
  /** 캐릭터일 때만. 키·체형 같은 기본 정보 */
  basics?: string[];
  /**
   * 같은 기본 정보의 **영어**.
   *
   * 화면의 스위치가 프롬프트에 닿는지 훑다가 찾은 구멍입니다 — 기본 정보가
   * **한국어 프롬프트에만** 실렸습니다. «나이 19 · 키 162cm · 마른 편» 이 영문에는
   * 한 글자도 안 갔습니다. 밖의 생성기 대부분이 영문 쪽을 쓰는데도요.
   *
   * 한국어를 그대로 번역해 보내지 않습니다 — 부르는 쪽이 영어 표현으로 따로 적어 줍니다.
   */
  basicsEn?: string[];
  /** 프롬프트에 적을 레퍼런스 부르는 글자(플랫폼별). 첫째가 정체성 기준. */
  references?: { mention: string; isIdentity: boolean }[];
  /**
   * 정체성 그림 위에 찍은 표시. «도면 + 동선» 칩의 화살표 설명이 여기서 나옵니다.
   *
   * 없으면 칩이 기본 문장(«주요 통로를 따라 두세 갈래»)을 씁니다 — 자리표가 그대로
   * 생성기에 가면 그림에 «{{marks}}» 라고 적힙니다.
   */
  marks?: BlueprintRouteMark[] | null;
  /** 앵커 파노라마의 공간 넓이(m). 파노라마 칩 문장 뒤에 거리·각도 단서로 붙습니다. */
  space?: PanoramaSpace | null;
  /** 전개도 틀 그림의 태그. 전개도 칩 문장이 그 그림을 이름으로 부릅니다(`blueprintEnglish`). */
  templateMention?: string | null;
}

export interface RulePromptResult {
  ko: string;
  en: string;
  negativeKo: string;
  negativeEn: string;
}

/**
 * 어디에나 붙는 금지 사항.
 *
 * **생성기는 빈 곳을 싫어합니다.** 손이 비어 있으면 도구를 쥐여 주고,
 * 자리가 비어 있으면 소품을 깔아 둡니다. 그렇게 들어온 물건은 다음 컷에서
 * 사라지므로 연속성이 깨지고, 시트에서 잘라 낸 레퍼런스에도 따라붙습니다.
 */
const NEGATIVE_KO = [
  "말하지 않은 물건",
  "손에 쥔 도구나 소품",
  "글자·워터마크·로고",
  "여러 장으로 나뉜 화면",
  "잘린 팔다리",
  "흐릿하거나 뭉개진 부분",
];

const NEGATIVE_EN = [
  "objects that were not described",
  "props or tools placed in empty hands",
  "text, watermark, logo, signature",
  "collage, split panels, multiple frames",
  "cropped limbs",
  "blurry or smudged areas",
];

const KIND_LABEL: Record<BlueprintKind, string> = {
  character: "캐릭터",
  background: "배경",
  asset: "에셋",
};

const KIND_EN: Record<BlueprintKind, string> = {
  character: "character reference sheet",
  background: "location reference sheet",
  asset: "prop reference sheet",
};

export function buildRulePrompt(input: RulePromptInput): RulePromptResult {
  /*
    전개도(«등장방형») 칩은 칸 틀·카메라 문장이 곧 프롬프트입니다(`composeUnfoldPrompt`). 아래 일반 조립은 «정체성 기준 —
    같은 장소, 같은 배치» 를 붙여 항공 마스터의 구도를 끌어오므로 타지 않습니다. 장소 자리에는 정체성 그림을
    «무엇이 있는지» 로만 부르는 문장과 사람이 적은 설명을 넣습니다.
  */
  const unfoldChip = input.kind === "background" ? unfoldChipOf(input.blueprint) : null;
  if (unfoldChip) {
    /*
      정체성 그림의 **태그는 부르지 않습니다** — 태그로 불린 그림만 «구성» 으로 올라가는데, 드론 사진인 정체성 그림이 올라가면
      옆면이 항공 시점으로 끌려갔습니다(실측 기록은 `usePromptCard.withUnfoldFrame` 주석에). 장소는 사람이 적은 설명과
      그림 분석을 «그 안에 서서 본» 말로 넣습니다. 둘 다 비면 이름만.
    */
    const note = [input.description.trim(), input.analysis?.trim()].filter(Boolean).join(" ");
    const place = composeUnfoldPrompt(unfoldChip, input.space, input.templateMention, {
      en: note ? `${input.name}: ${note} (seen from standing inside it at eye level, not from above)` : input.name || "the place described in the project",
      ko: note ? `${input.name}: ${note} (위에서가 아니라 그 안에 서서 본 모습)` : input.name || "작품 설정의 그 장소.",
    });
    return {
      ko: place.ko,
      en: place.en,
      negativeKo: [unfoldNegativeOf(unfoldChip).ko, "사람, 동물, 글자, 워터마크, 테두리"].join(", "),
      negativeEn: [unfoldNegativeOf(unfoldChip).en, backgroundNegativeEnglish(input.blueprint).join(", ")].filter(Boolean).join(", "),
    };
  }
  const panels = listBlueprint(input.kind, input.blueprint, "ko", input.spaceKind, input.marks, input.space, input.templateMention);
  const panelsEn = listBlueprint(input.kind, input.blueprint, "en", input.spaceKind, input.marks, input.space, input.templateMention);
  /*
    배경 칩은 «칸 N개 시트» 가 아닙니다.

    예전에는 고른 칩 개수가 곧 칸 수였습니다. 그래서 조감도 하나를 켜도 «Lay out 1 panels»
    가 붙었고, 마스터 + 표시 + 빛을 켜면 «6칸 시트» 가 됐습니다. 게다가 «중성 회색 배경» 은
    캐릭터 시트 규칙인데 배경에도 따라붙어 파노라마 카메라 블록과 정면으로 모순됐습니다
    (docs/복원/10 §4). 칸을 만드는 것은 **`panels` 를 가진 칩뿐**이고(세트 다섯과 «벽면 전개도»),
    그 칸 수와 배열은 칩 문장 안에 있습니다.
  */
  const isBackground = input.kind === "background";
  const frameKind = isBackground ? backgroundFrameKind(input.blueprint) : "none";
  const oneImage = isBackground && (frameKind === "panorama" || frameKind === "single");
  const panorama = frameKind === "panorama";
  const mode = resolveReferenceMode(input.referenceMode, input.referenceCount);
  const modeOption = referenceModeOption(
    input.kind === "asset" ? "asset" : input.kind,
    mode,
  );

  // ── 한국어 ────────────────────────────────────────────────────────────
  const ko: string[] = [];

  if (input.context) {
    // 작품 설정이 맨 앞입니다. 뒤로 갈수록 모델이 덜 따릅니다.
    ko.push(input.context.ko);
  }

  ko.push(`${input.name || KIND_LABEL[input.kind]} ${KIND_LABEL[input.kind]} 시트.`);

  if (input.basics?.length) ko.push(input.basics.join(", ") + ".");
  if (input.description.trim()) ko.push(input.description.trim());
  if (input.analysis?.trim()) ko.push(input.analysis.trim());

  if (panorama) {
    ko.push(`앵커 지점에서 본 파노라마 한 장 — ${panels.join(", ")}. 칸으로 나누지 않습니다.`);
  } else if (oneImage && panels.length) {
    ko.push(`한 장으로 그립니다 — ${panels.join(", ")}. 칸으로 나누지 않습니다.`);
  } else if (isBackground && frameKind === "set" && panels.length) {
    // 세트 묶음은 «같은 시점, 조건만 다름» 이지만, 칸을 나누는 마스터(벽면 전개도)는
    // 칸마다 다른 벽입니다. 같은 말로 묶으면 네 칸에 같은 벽이 나옵니다.
    const conditions = backgroundFrameGroup(input.blueprint) === "set";
    ko.push(
      `칸 ${backgroundPanelCount(input.blueprint)}개짜리 한 장 — ${panels.join(", ")}. ` +
        (conditions
          ? "칸마다 같은 장소를 같은 시점·같은 구도로 그리고, 바뀌는 조건만 다릅니다."
          : "칸마다 같은 장소이고, 각 칸이 무엇을 보여 주는지는 위 문장이 정한 그대로입니다."),
    );
  } else if (isBackground && panels.length) {
    ko.push(`${panels.join(", ")}.`);
  } else if (panels.length) {
    ko.push(
      `칸 ${panels.length}개로 나눠 각각 그립니다 — ${panels.join(", ")}. ` +
        "칸마다 같은 인물·같은 장소·같은 물건이어야 하고, 재질과 색과 조명 방향이 모든 칸에서 같아야 합니다.",
    );
  }

  if (input.referenceCount > 0) {
    ko.push(`레퍼런스 ${input.referenceCount}장. ${modeOption.hint}.`);
  }
  // 어느 그림이 무엇인지. 마그니픽은 파일 이름으로 부르므로 이 글자가 곧 그림입니다.
  const identity = input.references?.find((item) => item.isIdentity);
  const others = (input.references || []).filter((item) => !item.isIdentity);
  if (identity) {
    // 배경에서 «적지 않은 것은 이 그림 그대로» 라고 하면 **구도까지** 베낍니다.
    // 마스터가 항공 그림이면 파노라마를 시켜도 다시 항공이 나옵니다(docs/복원/10 §1 의 실패).
    ko.push(
      isBackground
        ? `정체성 기준은 ${identity.mention} — 같은 장소·같은 재질·같은 색이지만, 시점은 이 프롬프트가 정합니다. 구도를 베끼지 않습니다.`
        : `정체성 기준은 ${identity.mention} — 적지 않은 것은 전부 이 그림 그대로.`,
    );
  }
  if (others.length) ko.push(`참고 레퍼런스: ${others.map((item) => item.mention).join(", ")}.`);

  // «중성 회색 배경» 은 캐릭터·에셋 시트 규칙입니다. 배경에 붙이면 장소가 스튜디오가 됩니다.
  if (!isBackground) ko.push("배경은 중성 회색(#808080), 조명은 고르게. 글자나 표는 넣지 않습니다.");
  else if (panorama) ko.push("항공 시점이 아니라 그 자리에 선 눈높이입니다.");

  /*
    ── 인물 시트에는 소품을 그리지 않습니다 ──────────────────────────────
    인물 시트에는 인물만 담습니다 — 영상에서 그 레퍼런스를 참고할 때 인물과 소품이
    한 덩어리로 읽히는 일이 잦았습니다.

    인물 시트는 컷·영상에서 «이 사람» 을 가리키는 손잡이입니다. 사람과 물건이 한 장에
    같이 있으면 생성기가 둘을 한 덩어리로 읽어, 그 인물이 나오는 컷마다 쓰지도 않은
    소품이 따라 들어옵니다. 필요한 소품은 **에셋 시트로 따로** 뽑아 나란히 겁니다.

    경계는 «손을 펴면 떨어지는가» — 옷·신발·안경·시계처럼 **걸친 것**은 그 사람의
    외형이라 남기고, 쥐거나 메거나 놓인 것만 뺍니다. 에셋 시트(`asset`)는 물건 자체가
    주인공이므로 당연히 해당 없습니다.
  */
  const propChipsOn =
    input.kind === "character" &&
    (input.blueprint ?? []).some((id) => id.startsWith("prop-") && id !== "prop-none");
  if (input.kind === "character" && !propChipsOn) {
    ko.push("인물만 그립니다 — 손에 쥔 물건·가방·가구 같은 소품은 넣지 않습니다(옷과 장신구는 제외).");
  } else if (propChipsOn) {
    // 소품 칸을 일부러 켰으면 «소품 없음» 은 정면 모순입니다. 대신 **떼어 놓으라**고 적습니다.
    ko.push("소품은 인물과 떨어진 별도 칸에 놓습니다 — 인물 칸에서는 손을 비웁니다.");
  }

  // ── 영어 ──────────────────────────────────────────────────────────────
  const en: string[] = [];

  if (input.context) en.push(input.context.en);

  en.push(`${KIND_EN[input.kind]} of ${input.name || "the subject"}.`);

  if (input.basicsEn?.length) en.push(input.basicsEn.join(", ") + ".");
  if (input.description.trim()) en.push(input.description.trim());
  /*
    분석문은 **영어판이 있을 때만** 싣습니다. 한국어를 영문 칸에 그대로 넣으면 생성기가
    그 부분을 통째로 무시하거나 글자로 그려 넣습니다. 옛 카드는 영어판이
    없으니 그때는 안 싣습니다 — 잘못된 말을 보내느니 덜 보내는 편이 낫습니다.
    분석을 다시 받으면 그때부터 둘 다 생깁니다.
  */
  if (input.analysisEn?.trim()) en.push(input.analysisEn.trim());

  if (isBackground) {
    /*
      배경 칩 문장은 카메라(시점·높이·화각)와 판 구성을 스스로 담고 있습니다.
      그래서 «Lay out N panels» 를 덧붙이지 않고 **문장을 맨 앞에 그대로** 놓습니다 —
      뒤에 파묻히면 스타일 메모로 읽혀 그냥 넓은 풍경 사진이 나옵니다.
    */
    if (panelsEn.length) en.unshift(`${panelsEn.join("; ")}.`);
  } else if (panelsEn.length) {
    en.push(
      `Lay out ${panelsEn.length} panels: ${panelsEn.join("; ")}. ` +
        "Every panel shows the same subject with identical materials, colours, lighting direction and time of day.",
    );
  }

  if (input.referenceCount > 0) en.push(modeOption.english + ".");
  if (identity) {
    /*
      «same subject; keep every unspecified trait» 는 배경에서 구도 복제를 부릅니다.
      그리고 레퍼런스가 없을 때 «the reference images» 라고 쓰면 허공을 가리켜, 모델이
      그림 안에 «참고 이미지» 같은 액자를 그리기도 합니다. 그래서 장수가 0 이면 아예 안 씁니다.
    */
    en.push(
      isBackground
        ? `Identity reference: ${identity.mention} — exactly the same place (same layout, buildings, materials, colours, light); the viewpoint is set by this prompt, not by the reference.`
        : `Identity reference: ${identity.mention} — same subject; keep every unspecified trait from it.`,
    );
  }
  if (others.length) en.push(`Additional references: ${others.map((item) => item.mention).join(", ")}.`);

  if (!isBackground) {
    en.push(
      "Neutral mid-grey background (#808080), even studio lighting, no text, no labels, no table or grid lines.",
    );
  }
  // 한국어 쪽과 같은 규칙(위 「인물 시트에는 소품을 그리지 않습니다」) — 두 칸이 다른 말을 하면 안 됩니다.
  if (input.kind === "character" && !propChipsOn) {
    en.push("The character alone, empty hands, no props, no held objects, no furniture; worn clothing and accessories are part of the character.");
  } else if (propChipsOn) {
    en.push("Props are laid out in their own separate panels, never held by the character; the character's own panels keep empty hands.");
  }

  /*
    부정문은 본문이 아니라 negative 칸으로 보냅니다.

    미드저니는 본문의 «no text» 를 내용어로 읽어 글자를 오히려 더 그리고, Flux 도 부정문을
    자주 흘립니다. 칩마다 적어 둔 negativeEnglish 를 여기서 합칩니다 — 라벨을 그리는 칩
    (배치도·도면·축척)이 켜져 있으면 «text/labels» 는 빠집니다(정면 모순이라 모델마다 다르게 풉니다).
  */
  const chipNegatives = isBackground ? backgroundNegativeEnglish(input.blueprint) : [];
  const labelsOn = isBackground && backgroundAllowsLabels(input.blueprint);
  /*
    판이 여러 칸이면 공통 금지의 «collage, split panels, multiple frames» 를 빼야 합니다.

    이 줄은 캐릭터 시트 시절의 값인데 배경에도 그대로 실렸습니다. 그런데 시간대 4칸·계절
    4칸·날씨 3칸·빛 2칸·랜드마크 7칸·벽면 전개도 4칸은 전부 «칸을 나눈 한 장» 을 **일부러**
    시킵니다. 본문은 「four equal panels with thin white gutters」, negative 는 「split panels」 —
    labelsOn 이 «text» 를 빼는 것과 같은 종류의 정면 모순입니다.
    대신 «다른 장소가 섞인 콜라주» 만 막는 판 중립 문구로 바꿉니다.
    덤으로 배경에는 뜻이 없는 인체 전용 두 줄(빈 손의 소품·잘린 팔다리)도 뺍니다.
  */
  const panelsOn = isBackground && backgroundPanelCount(input.blueprint) > 1;
  const base = NEGATIVE_EN.filter(
    (word) => !isBackground || !/^(props or tools|cropped limbs)/.test(word),
  )
    .map((word) =>
      panelsOn && word.startsWith("collage,") ? "a collage of different places, mismatched styles" : word,
    )
    .map((word) =>
      // 도면·배치도는 라벨이 목적입니다. 공통 금지의 «text» 까지 그대로 두면 이름이 반쯤 나옵니다.
      labelsOn && word.startsWith("text,") ? "watermark, logo, signature" : word,
    )
    .map((word) =>
      /*
        공통 금지는 «빈 손에 쥐여진» 소품만 막습니다 — 어깨에 멘 가방이나 옆에 놓인
        의자는 그대로 통과했습니다. 인물 시트에서는 그것들도 막아야 합니다.
      */
      input.kind === "character" && !propChipsOn && word.startsWith("props or tools")
        ? "props, held objects, weapons, bags, furniture, anything the character is holding or carrying"
        : word,
    );
  const negativeEn = [...base, ...chipNegatives].filter(
    (word, index, all) => all.indexOf(word) === index,
  );
  // 한국어 금지도 같은 기준으로 맞춥니다 — 화면에 en/ko 가 나란히 보이는데 서로 다른 말을 하면 안 됩니다.
  const negativeKo = NEGATIVE_KO.filter((word) => {
    if (labelsOn && word === "글자·워터마크·로고") return false;
    if (panelsOn && word === "여러 장으로 나뉜 화면") return false;
    if (isBackground && (word === "손에 쥔 도구나 소품" || word === "잘린 팔다리")) return false;
    // 인물 시트는 «쥔 것» 만이 아니라 멘 것·놓인 것까지 막습니다 — 아래에서 더 센 말로 바꿔 넣습니다.
    if (input.kind === "character" && !propChipsOn && word === "손에 쥔 도구나 소품") return false;
    return true;
  })
    .concat(
      input.kind === "character" && !propChipsOn
        ? ["소품·들고 있는 물건·가방·무기·가구"]
        : [],
    ).concat(labelsOn ? ["워터마크·로고"] : []);

  return {
    ko: ko.join(" "),
    en: en.join(" "),
    negativeKo: negativeKo.join(", "),
    negativeEn: negativeEn.join(", "),
  };
}
