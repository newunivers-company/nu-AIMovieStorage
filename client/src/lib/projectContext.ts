/**
 * 프로젝트 전체에 걸리는 설정 — 장르, 비주얼 스타일, 작품 연대.
 *
 * 컷 하나하나에 "1980년대 홍콩 느와르"를 다시 적게 하면 컷마다 조금씩 달라지고,
 * 결국 한 작품 안에서 시대가 흔들립니다. 여기서 한 번 정하고 모든 프롬프트에
 * 같은 문장으로 붙입니다.
 *
 * 셋 다 여러 개를 고를 수 있습니다. 실제 작품이 장르 하나로 떨어지는 경우가 드물고,
 * 타임슬립물은 시대를 오갑니다.
 */

export interface EraPreset {
  id: string;
  /** 화면에 보이는 이름 */
  label: string;
  /** 프롬프트에 넣을 영문 표현 */
  en: string;
  /** 대략적인 연도. 정렬과 안내에만 씁니다. */
  hint: string;
}

/**
 * 손으로 잡는 연대 구간.
 *
 * # 왜 숫자가 아니라 글인가
 *
 * 처음에는 `from`·`to` 가 숫자였고 1000~2200 슬라이더로 잡았습니다.
 * 그런데 이 앱이 다루는 시대는 그 안에 다 안 들어갑니다 — 고조선도,
 * 3000년 뒤 우주도 씁니다. 범위를 정해 둘 이유가 없어요.
 *
 * 그리고 **어림잡는 것과 딱 짚는 것이 둘 다 필요합니다.**
 * 「1900년대」처럼 뭉뚱그릴 때가 있고, 「1392년」처럼 그 해를 짚을 때가
 * 있습니다. 숫자 하나로는 그 차이를 담을 수 없어서 글로 받습니다.
 */
export interface EraRange {
  id: string;
  /** 시작. "1392년" 처럼 딱 짚어도, "1900년대" 처럼 뭉뚱그려도 됩니다 */
  from: string;
  /** 끝. 시작과 같으면 한쪽만 씁니다 */
  to: string;
}

export interface ProjectContext {
  genres: string[];
  styles: string[];
  /** 고른 연대 프리셋 id */
  eras: string[];
  /** 슬라이더로 잡은 연도 구간. 여러 개 둘 수 있습니다. */
  eraRanges: EraRange[];
  /** 시대를 특정하지 않음. 켜면 나머지 연대 설정은 프롬프트에 안 나갑니다. */
  eraUnspecified: boolean;
}


// ── 장르 ──────────────────────────────────────────────────────────────────

export const GENRE_OPTIONS = [
  "시네마틱 단편",
  "뮤직비디오",
  "광고/브랜드",
  "다큐멘터리",
  "모션그래픽",
  "판타지",
  "SF",
  "느와르",
  "로맨스",
  "액션",
  "공포",
  "스릴러",
  "코미디",
  "드라마",
  "기타",
];

const GENRE_EN: Record<string, string> = {
  "시네마틱 단편": "cinematic short film",
  "뮤직비디오": "music video",
  "광고/브랜드": "commercial brand film",
  "다큐멘터리": "documentary",
  "모션그래픽": "motion graphics",
  "판타지": "fantasy",
  "SF": "science fiction",
  "느와르": "film noir",
  "로맨스": "romance",
  "액션": "action",
  "공포": "horror",
  "스릴러": "thriller",
  "코미디": "comedy",
  "드라마": "drama",
};

// ── 비주얼 스타일 ─────────────────────────────────────────────────────────

/**
 * 애니메이션은 2D 와 3D 로 나눠 둡니다.
 * 그냥 "animation" 이라고만 하면 모델이 둘 사이를 오가서
 * 컷마다 질감이 달라집니다.
 */
export const STYLE_OPTIONS = [
  "사실적 실사",
  "시네마틱 필름",
  "2D 애니메이션",
  "3D 애니메이션",
  "스톱모션",
  "빈티지/레트로",
  "사이버펑크",
  "판타지",
  "미니멀",
  "다큐멘터리",
  "흑백",
];

const STYLE_EN: Record<string, string> = {
  "사실적 실사": "photorealistic live action",
  "시네마틱 필름": "cinematic film look, shallow depth of field",
  "2D 애니메이션": "2D hand-drawn animation, cel shading, flat color",
  "3D 애니메이션": "3D CG animation, stylized rendering",
  "스톱모션": "stop-motion animation, tactile handmade textures",
  "빈티지/레트로": "vintage retro film stock, grain",
  "사이버펑크": "cyberpunk, neon-lit, high contrast",
  "판타지": "fantasy art direction",
  "미니멀": "minimal composition, restrained palette",
  "다큐멘터리": "documentary realism, available light",
  "흑백": "black and white",
};

// ── 작품 연대 ─────────────────────────────────────────────────────────────

/**
 * 연대 프리셋.
 *
 * 한국사와 서양사를 따로 둡니다. 같은 15세기라도 조선 초와 르네상스는
 * 옷도 건축도 빛도 전혀 다른데, "15세기"라고만 적으면 모델이 서양 쪽으로 기웁니다.
 */
export const ERA_GROUPS: { label: string; items: EraPreset[] }[] = [
  {
    label: "한국사",
    items: [
      { id: "kr-gojoseon", label: "고조선·상고", en: "ancient Gojoseon-era Korea", hint: "~기원전" },
      { id: "kr-three", label: "삼국시대", en: "Three Kingdoms of Korea (Goguryeo, Baekje, Silla)", hint: "4~7세기" },
      { id: "kr-goryeo", label: "고려시대", en: "Goryeo dynasty Korea", hint: "10~14세기" },
      { id: "kr-joseon-early", label: "조선 전기", en: "early Joseon dynasty Korea", hint: "14~16세기" },
      { id: "kr-joseon-late", label: "조선 후기", en: "late Joseon dynasty Korea", hint: "17~19세기" },
      { id: "kr-daehan", label: "대한제국·개화기", en: "Korean Empire, late 19th century modernization", hint: "1897~1910" },
      { id: "kr-colonial", label: "일제강점기", en: "Japanese colonial period Korea", hint: "1910~1945" },
      { id: "kr-war", label: "한국전쟁·전후", en: "Korean War and postwar Korea", hint: "1950년대" },
      { id: "kr-industrial", label: "산업화기", en: "1970s-80s industrializing Korea", hint: "1970~80년대" },
    ],
  },
  {
    label: "서양·세계사",
    items: [
      { id: "w-prehistoric", label: "선사시대", en: "prehistoric era", hint: "~기원전" },
      { id: "w-antiquity", label: "고대(그리스·로마)", en: "classical antiquity, Greek and Roman", hint: "기원전~5세기" },
      { id: "w-medieval", label: "중세", en: "European Middle Ages", hint: "5~15세기" },
      { id: "w-renaissance", label: "르네상스", en: "Renaissance Europe", hint: "14~16세기" },
      { id: "w-baroque", label: "바로크·절대왕정", en: "Baroque era, absolutist Europe", hint: "17~18세기" },
      { id: "w-industrial", label: "산업혁명·빅토리아", en: "Industrial Revolution, Victorian era", hint: "19세기" },
      { id: "w-belle", label: "20세기 초", en: "early 20th century, Belle Epoque to interwar", hint: "1900~1930년대" },
      { id: "w-ww2", label: "제2차 세계대전", en: "World War II era", hint: "1939~1945" },
      { id: "w-coldwar", label: "냉전기", en: "Cold War era", hint: "1950~80년대" },
    ],
  },
  {
    label: "현대·미래",
    items: [
      { id: "m-modern", label: "현대", en: "present day", hint: "지금" },
      { id: "m-near", label: "근미래", en: "near future", hint: "수십 년 뒤" },
      { id: "m-far", label: "먼 미래", en: "far future", hint: "수백 년 뒤" },
      { id: "m-post", label: "포스트 아포칼립스", en: "post-apocalyptic", hint: "붕괴 이후" },
      { id: "m-retrofuture", label: "레트로퓨처", en: "retrofuturism, past visions of the future", hint: "과거가 상상한 미래" },
    ],
  },
];

export const ERA_PRESETS: EraPreset[] = ERA_GROUPS.flatMap(group => group.items);

export function findEra(id: string) {
  return ERA_PRESETS.find(era => era.id === id);
}

/** 슬라이더 범위. 이보다 옛날은 위 프리셋으로 고르는 편이 정확합니다. */
/**
 * 한쪽 끝을 글로 폅니다.
 *
 * 예전에 숫자로 저장한 것이 남아 있을 수 있어서 그것도 받습니다.
 * 10으로 나뉘면 「1900년대」, 아니면 「1392년」으로 읽던 규칙 그대로입니다.
 */
export function eraPointText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value % 10 === 0 ? `${value}년대` : `${value}년`;
  }
  return typeof value === "string" ? value.trim() : "";
}

/** 19 → "19th". 세기를 영어로 적을 때 씁니다. */
function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/** 「초반」·「중반」·「후반」 같은 꼬리표. 앞에서부터 긴 것을 먼저 봅니다. */
const ERA_MODIFIERS: { pattern: RegExp; en: string }[] = [
  { pattern: /(초반|초엽|초)$/, en: "early " },
  { pattern: /(중반|중엽)$/, en: "mid-" },
  { pattern: /(후반|후기|말)$/, en: "late " },
];

/**
 * 영어로 옮깁니다.
 *
 * # 못 옮기면 빈 문자열입니다
 *
 * 예전에는 모르는 말을 **그대로 돌려줬습니다.** 그래서 「19세기」라고 적으면
 * 영문 프롬프트에 `set in 1392 to 19세기` 가 나갔어요. 영어 프롬프트에 한글이
 * 섞이면 모델이 그 부분을 통째로 무시하거나 엉뚱하게 읽습니다.
 *
 * 그래서 아는 꼴만 옮기고, 모르면 빈 문자열을 돌려줍니다. 화면은 그걸 보고
 * 「영문에는 못 싣습니다」 라고 알려 줍니다 — 말없이 빠지는 것보다 낫습니다.
 *
 * 아는 꼴:
 * 1392, 1392년 → 1392
 * 1900년대 → the 1900s
 * 19세기 → the 19th century
 * 1900년대 후반 → the late 1900s
 * 기원전 300년 → 300 BC
 * 이미 영어로 적은 것 → 그대로
 */
export function eraPointEnglish(value: unknown): string {
  let text = eraPointText(value);
  if (!text) return "";

  // 이미 영어(또는 숫자)로 적었으면 손대지 않습니다.
  if (!/[가-힣]/.test(text)) return text;

  let suffix = "";
  const bc = text.match(/^기원전\s*(.+)$/);
  if (bc) {
    text = bc[1].trim();
    suffix = " BC";
  }

  let modifier = "";
  for (const item of ERA_MODIFIERS) {
    const matched = text.match(new RegExp(`^(.+?)\s*${item.pattern.source.replace(/\$$/, "")}$`));
    if (matched) {
      text = matched[1].trim();
      modifier = item.en;
      break;
    }
  }

  const century = text.match(/^(\d{1,3})\s*세기$/);
  if (century) return `the ${modifier}${ordinal(Number(century[1]))} century${suffix}`;

  const decade = text.match(/^(\d{1,4})\s*년대$/);
  if (decade) return `the ${modifier}${decade[1]}s${suffix}`;

  const year = text.match(/^(\d{1,4})\s*년?$/);
  if (year) return `${year[1]}${suffix}`;

  // 「조선 후기」 같은 말은 여기까지 옵니다. 로마자로 바꿔 봐야 모델이 못
  // 알아들으므로 안 싣습니다. 그런 것은 위의 연대 프리셋으로 고르세요.
  return "";
}

/** 적었는데 영어로 못 옮기는 값인지. 화면이 이걸로 귀띔합니다. */
export function eraPointNeedsHelp(value: unknown): boolean {
  return Boolean(eraPointText(value)) && !eraPointEnglish(value);
}

/**
 * 아무것도 안 적은 구간을 걷어냅니다.
 *
 * 「+ 구간 추가」를 눌러 놓고 아무것도 안 적은 채 다음 단계로 넘어가면,
 * 돌아왔을 때 빈 줄이 그대로 남아 있었습니다. 프롬프트에는 안 실리니 아무
 * 일도 안 하는 줄인데, 화면에는 「아직 안 적었습니다」 가 계속 떠 있어서
 * **뭔가 덜 한 것처럼 보입니다.** 저장할 때 치웁니다.
 *
 * 한쪽만 적은 것은 남깁니다 — 그건 「1900년대부터」 처럼 뜻이 있습니다.
 */
export function withoutEmptyEraRanges<T extends Pick<ProjectContext, "eraRanges">>(context: T): T {
  const kept = (context.eraRanges || []).filter(range => Boolean(formatRange(range)));
  if (kept.length === (context.eraRanges || []).length) return context;
  return { ...context, eraRanges: kept };
}

/** 연도를 직접 적은 구간이 하나라도 있는지. 있으면 시대 단추는 안 실립니다. */
export function hasEraRange(context: Pick<ProjectContext, "eraRanges">): boolean {
  return (context.eraRanges || []).some(range => Boolean(formatRange(range)));
}

export function formatRange(range: EraRange) {
  const from = eraPointText(range.from);
  const to = eraPointText(range.to);
  if (!from && !to) return "";
  if (!to || from === to) return from || to;
  if (!from) return to;
  return `${from} ~ ${to}`;
}

function formatRangeEn(range: EraRange) {
  const from = eraPointEnglish(range.from);
  const to = eraPointEnglish(range.to);
  if (!from && !to) return "";
  if (!to || from === to) return from || to;
  if (!from) return to;
  return `${from} to ${to}`;
}

// ── 프롬프트에 붙일 요약 ──────────────────────────────────────────────────

export interface ProjectContextSummary {
  ko: string;
  en: string;
  /** LLM 요청문에 그대로 실을 구조. 사람이 읽는 문장보다 이쪽이 덜 흔들립니다. */
  facts: {
    genres: string[];
    styles: string[];
    period: string[];
    periodUnspecified: boolean;
  };
}

/**
 * 프로젝트 설정을 프롬프트 한 줄로 만듭니다.
 *
 * "연대 없음"을 켜면 시대 항목을 아예 빼는 게 아니라
 * "특정 시대에 묶이지 않음"이라고 분명히 적습니다. 비워 두면 모델이
 * 자기 마음대로 현대나 중세를 골라 버립니다.
 */
export function summarizeProjectContext(context: ProjectContext): ProjectContextSummary {
  /*
    **모르는 칩은 영문에서 버립니다.**

    프롬프트 점검에서 드러났습니다 — 표에 없는 장르·스타일이면 `?? genre` 로
    **한국어 라벨이 그대로 영문 프롬프트에** 들어가고 있었습니다. 그것도 맨 앞에요.
    영문에 한국어가 섞이면 생성기가 **그 부분만 통째로 무시합니다** — 운이 좋으면요.
    나쁘면 글자를 그림에 그려 넣습니다.

    같은 저장소의 `cutToggleEnglish` 는 이미 «모르면 빈 글자» 규칙을 씁니다. 맞춥니다.
    한국어 쪽은 그대로 다 보여 줍니다 — 사람이 읽는 글이라 버릴 까닭이 없습니다.
  */
  const genresKo = context.genres;
  const genresEn = context.genres.map(genre => GENRE_EN[genre]).filter(Boolean);
  const stylesKo = context.styles;
  const stylesEn = context.styles.map(style => STYLE_EN[style]).filter(Boolean);

  const periodKo: string[] = [];
  const periodEn: string[] = [];

  if (context.eraUnspecified) {
    periodKo.push("특정 시대 없음");
    periodEn.push("no specific historical period");
  } else {
    /*
      연도를 직접 적었으면 위의 시대 단추는 무시합니다.

      두 곳에서 시대를 정하면 반드시 어긋납니다 — 「조선 후기」를 눌러 놓고
      「1900년대」를 적으면 프롬프트에 «시대 조선 후기, 1900년대» 가 나가고,
      모델은 그중 하나를 골라 그립니다. 어느 쪽이 나올지는 그때그때 다릅니다.

      **더 좁게 짚은 쪽이 이깁니다.** 직접 적은 연도가 그것입니다.
      화면에서도 그때 단추를 흐리게 해서, 왜 안 실리는지 보이게 합니다.
    */
    if (!hasEraRange(context)) {
      for (const id of context.eras) {
        const era = findEra(id);
        if (!era) continue;
        periodKo.push(era.label);
        periodEn.push(era.en);
      }
    }
    for (const range of context.eraRanges) {
      // 아직 아무것도 안 적은 빈 구간은 프롬프트에 안 실립니다.
      const ko = formatRange(range);
      if (!ko) continue;
      periodKo.push(ko);
      // 영어로 못 옮긴 구간은 영문 쪽에만 안 실립니다. 빈 문자열을 밀어
      // 넣으면 "set in , " 처럼 쉼표만 남습니다.
      const en = formatRangeEn(range);
      if (en) periodEn.push(en);
    }
  }

  const koParts = [
    genresKo.length ? `장르 ${genresKo.join("·")}` : "",
    stylesKo.length ? `스타일 ${stylesKo.join("·")}` : "",
    periodKo.length ? `시대 ${periodKo.join(", ")}` : "",
  ].filter(Boolean);

  const enParts = [
    genresEn.join(", "),
    stylesEn.join(", "),
    periodEn.length ? `set in ${periodEn.join(" and ")}` : "",
  ].filter(Boolean);

  return {
    ko: koParts.join(" / "),
    en: enParts.join(", "),
    facts: {
      genres: genresEn,
      styles: stylesEn,
      period: periodEn,
      periodUnspecified: context.eraUnspecified,
    },
  };
}

/** 프로젝트 설정이 하나도 없으면 프롬프트에 붙일 것도 없습니다. */
export function hasProjectContext(context: ProjectContext) {
  return Boolean(
    context.genres.length ||
    context.styles.length ||
    context.eras.length ||
    context.eraRanges.length ||
    context.eraUnspecified,
  );
}

/**
 * 작품 설정이 하나라도 있으면 요약, 없으면 null — «설정 없음» 은 빈 요약과 다릅니다(프롬프트에 빈 줄이 아니라
 * 아무것도 안 실려야 합니다). 이 판단이 화면(`StepBasics`)·미디어 컨텍스트(`projectMedia`)·일괄 생성 4단계
 * (`bootstrapPrompts`) 세 곳에 따로 적혀 있었습니다 — 조건이 하나 늘면 한 곳을 빠뜨립니다(2026-09-22 검토).
 */
export function projectContextOf(context: ProjectContext): ProjectContextSummary | null {
  return hasProjectContext(context) ? summarizeProjectContext(context) : null;
}
