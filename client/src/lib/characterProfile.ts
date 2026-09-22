/**
 * 캐릭터의 «생김새가 아닌 것».
 *
 * 지금까지 이 앱이 붙잡아 온 것은 전부 눈에 보이는 값이었습니다 — 얼굴, 체형,
 * 의상, 색. 그런데 시트를 씨댄스 같은 영상 모델에 넘길 때 필요한 것은 그것만이
 * 아닙니다. "A는 이 시트의 모습과 특징을 가진다, A가 무엇을 한다" 로 프롬프트를
 * 쓰려면, **A가 어떤 사람인지**가 어딘가에 적혀 있어야 합니다.
 *
 * 성격·말투·습관은 매번 머리에서 짜내기 어렵고, 짜낼 때마다 조금씩 달라집니다.
 * 어제는 "무뚝뚝하지만 정 많은" 이었는데 오늘은 "차갑고 계산적인" 이 되면
 * 컷마다 다른 사람이 연기합니다. 한 번 정해 적어 두는 것이 이 파일의 목적입니다.
 *
 * 생김새(analysisResult)와는 **일부러 따로 둡니다.** 생김새는 그림에서 읽어 내는
 * 값이고, 이쪽은 사람이 정하는 설정입니다. 섞어 두면 시트를 다시 뽑을 때
 * 성격까지 덮어써집니다.
 */

export interface CharacterProfile {
  /** 부르는 이름·별칭. 본명과 다를 수 있습니다. */
  callName: string;
  age: string;
  mbti: string;
  /** 한 줄 요약. 시트 맨 위에 큰 글자로 나갑니다. */
  tagline: string;
  personality: string;
  speech: string;
  habits: string;
  background: string;
  /** 연출 메모. 이 인물을 찍을 때의 규칙. */
  directing: string;
}

export const EMPTY_CHARACTER_PROFILE: CharacterProfile = {
  callName: "",
  age: "",
  mbti: "",
  tagline: "",
  personality: "",
  speech: "",
  habits: "",
  background: "",
  directing: "",
};

export interface ProfileField {
  id: keyof CharacterProfile;
  label: string;
  placeholder: string;
  /** 여러 줄 칸인지. 한 줄짜리는 나란히 놓습니다. */
  long: boolean;
}

/**
 * 칸의 순서가 곧 시트에 찍히는 순서입니다.
 *
 * 짧은 값(나이, MBTI)을 앞에 둡니다. 시트를 훑는 사람도, 프롬프트를 읽는 모델도
 * 앞쪽을 더 확실히 봅니다.
 */
export const PROFILE_FIELDS: ProfileField[] = [
  { id: "callName", label: "부르는 이름", placeholder: "여울, 여울 언니", long: false },
  { id: "age", label: "나이", placeholder: "24세 (외견 20대 초반)", long: false },
  { id: "mbti", label: "MBTI", placeholder: "INFJ", long: false },
  { id: "tagline", label: "한 줄 요약", placeholder: "겁이 많지만 물러서지 않는 정찰병", long: false },
  { id: "personality", label: "성격", placeholder: "낯을 가리고 말수가 적다. 위기에서는 오히려 침착해진다.", long: true },
  { id: "speech", label: "말투·화법", placeholder: "짧게 끊어 말한다. 존댓말과 반말을 상대에 따라 섞는다.", long: true },
  { id: "habits", label: "버릇·습관", placeholder: "생각할 때 귀 끝을 만진다. 앉을 때 한쪽 무릎을 세운다.", long: true },
  { id: "background", label: "배경·관계", placeholder: "폐허가 된 관측소 출신. 동생을 찾고 있다.", long: true },
  { id: "directing", label: "연출 메모", placeholder: "클로즈업에서 시선을 먼저 준다. 과장된 표정은 쓰지 않는다.", long: true },
];

export function normalizeProfile(value?: Partial<CharacterProfile> | null): CharacterProfile {
  return { ...EMPTY_CHARACTER_PROFILE, ...(value || {}) };
}


/**
 * 시트와 프롬프트에 찍을 «라벨: 값» 줄.
 *
 * 화면에 보이는 칸 순서와 같은 순서로 나옵니다. 비어 있는 칸은 통째로 뺍니다 —
 * "버릇: (없음)" 같은 줄은 모델에게 정보가 아니라 잡음입니다.
 *
 * 캐릭터 카드에 이미 있는 값(이름, 역할, 키)은 profile 에 없어도 여기서 붙여
 * 줍니다. 같은 값을 두 군데 적게 하면 반드시 어긋납니다.
 */
export function profileLines(
  profile: Partial<CharacterProfile> | null | undefined,
  basics?: { name?: string; role?: string; heightCm?: number; gender?: string },
): { label: string; value: string }[] {
  const full = normalizeProfile(profile);
  const lines: { label: string; value: string }[] = [];

  const push = (label: string, value?: string | null) => {
    const text = (value || "").trim();
    if (text) lines.push({ label, value: text });
  };

  push("이름", basics?.name);
  push("역할", basics?.role);
  push("부르는 이름", full.callName);
  push("나이", full.age);
  push("성별", basics?.gender);
  push("키", basics?.heightCm ? `${basics.heightCm}cm` : "");
  push("MBTI", full.mbti);
  push("한 줄 요약", full.tagline);
  push("성격", full.personality);
  push("말투", full.speech);
  push("버릇", full.habits);
  push("배경", full.background);
  push("연출 메모", full.directing);

  return lines;
}

