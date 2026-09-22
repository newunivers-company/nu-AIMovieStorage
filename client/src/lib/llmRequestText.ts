/**
 * API 없이 쓰는 경로.
 *
 * 앱이 LLM 을 직접 부르지 않고, 그대로 붙여넣을 수 있는 요청문을 만들어 줍니다.
 * claude.ai 나 ChatGPT 웹에 붙여넣으면 구독만으로 같은 결과를 얻습니다.
 *
 * API 호출과 같은 재료(시스템 문구 + 데이터)를 씁니다.
 * 두 경로가 갈라지면 결과가 달라지고, 그러면 어느 쪽을 믿어야 할지 알 수 없습니다.
 */

export interface RequestTextInput {
  /** 요청 문구(md 파일에서 읽은 시스템 프롬프트) */
  system: string;
  /** 작업 데이터 */
  prompt: string;
  /** 대상 모델 가이드. 있으면 함께 붙입니다. */
  modelGuide?: string;
  /**
   * **늘 붙는 공통 규칙**(`requests/_공통규칙.md`).
   *
   * 칩을 고르든 말든 붙습니다. 안 고르는 사람에게 규칙이 가장 필요하기 때문입니다.
   */
  commonRules?: string;
  /**
   * 생성 플랫폼 가이드.
   *
   * 같은 모델이라도 돌리는 곳에 따라 레퍼런스 거는 문법이 다릅니다.
   * Magnific 은 @태그, ComfyUI 는 <Picture 1> 입니다. 이걸 안 알려 주면
   * LLM 이 레퍼런스를 문장으로 풀어 써서 생성기가 그림을 안 봅니다.
   */
  platformGuide?: string;
  /** 모델과 무관하게 늘 지켜야 하는 것들. 여러 개를 이어 붙인 한 덩어리입니다. */
  techniqueGuides?: string;
  /** 이미지가 필요한 작업이면 안내를 답니다. */
  imageCount?: number;
  /**
   * `::when` 문단을 고르는 값들.
   *
   * 요청 문구 하나에 «실외일 때는 이렇게, 실내일 때는 저렇게» 같은 갈래가
   * 생깁니다. 갈래마다 파일을 따로 두면 공통 규칙을 고칠 때 전부 찾아
   * 고쳐야 하고, 그러다 한 곳을 빠뜨립니다. 그래서 한 파일 안에 두고
   * 상황에 맞는 문단만 남깁니다.
   */
  vars?: Record<string, string>;
}

/**
 * 조건 문단을 정리합니다.
 *
 * ```
 * ::when spaceKind=interior
 * 천장을 걷어 낸 배치도로 그립니다.
 * ::end
 * ```
 *
 * 값이 맞으면 안쪽 글만 남기고 표시줄을 지웁니다. 안 맞으면 통째로 지웁니다.
 * **없는 값은 빈 문자열로 봅니다** — 아직 안 고른 것은 «아니다» 쪽입니다.
 * 그러지 않으면 배경 유형을 안 정한 상태에서 실내·실외 지시가 둘 다 들어갑니다.
 */
export function applyTemplateConditions(text: string, vars: Record<string, string> = {}): string {
  const block = /^::when[ \t]+([\w.-]+)[ \t]*=[ \t]*([^\n]*)\n([\s\S]*?)^::end[ \t]*$/gm;

  let previous = "";
  let current = text;
  // 중첩된 것이 있을 수 있어 더 바뀌지 않을 때까지 돌립니다.
  for (let guard = 0; guard < 10 && current !== previous; guard += 1) {
    previous = current;
    current = current.replace(block, (_all, name: string, wanted: string, body: string) => {
      const actual = (vars[name] ?? "").trim();
      const expected = wanted.trim();
      // «::when 이름=» 처럼 값을 비워 두면 «값이 있으면» 이라는 뜻입니다.
      const matched = expected ? actual === expected : Boolean(actual);
      return matched ? body.replace(/\n$/, "") : "";
    });
  }

  // 문단이 빠진 자리에 빈 줄이 세 줄씩 남습니다. 두 줄로 줄입니다.
  return current.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 요청문을 **고정부와 변동부로 갈라** 돌려줍니다.
 *
 * 2026-09-19 에 갈랐습니다. 이 앱은 **같은 글을 되풀이해 보내는 구조**입니다 —
 * 컷 프롬프트 하나에 템플릿 + 공통규칙 + 기법 문서가 붙는데, 그 앞부분은 컷 예순두 개에
 * **글자 하나 안 바뀌고** 그대로 다시 갑니다. 「국호」 한 편 실측으로 되풀이가 약 252만 자,
 * 입력 토큰 115만이었습니다.
 *
 * 앞부분을 캐시에 얹으면 두 번째부터 입력 요금의 **0.1배**로 읽힙니다. 그러려면
 * 「어디까지가 늘 같은가」 를 조립하는 쪽이 알려 줘야 합니다 — 한 문자열로 이어 붙이면
 * 제공사는 알 길이 없습니다.
 *
 * `fixed` 에는 **작업 데이터가 절대 들어가면 안 됩니다.** 한 글자라도 섞이면 요청마다
 * 캐시가 어긋나 오히려 쓰기 요금(1.25배)만 냅니다.
 */
export function splitRequestText(input: RequestTextInput): { fixed: string; fresh: string } {
  const fixed: string[] = [];

  fixed.push(applyTemplateConditions(input.system, input.vars).trim());
  if (input.modelGuide?.trim()) fixed.push(`## 대상 모델 가이드

${input.modelGuide.trim()}`);
  if (input.platformGuide?.trim()) fixed.push(`## 생성 플랫폼 가이드

${input.platformGuide.trim()}`);
  if (input.commonRules?.trim()) fixed.push(`## 늘 지킬 것

${input.commonRules.trim()}`);
  if (input.techniqueGuides?.trim()) fixed.push(`## 지켜야 할 것

${input.techniqueGuides.trim()}`);

  const fresh: string[] = [`## 작업 데이터

\`\`\`json
${input.prompt.trim()}
\`\`\``];
  if (input.imageCount) {
    fresh.push(
      `## 이미지

이 요청에는 레퍼런스 이미지 ${input.imageCount}장이 필요합니다. ` +
        `이 문구를 붙여넣은 뒤 같은 대화에 이미지를 함께 올려 주세요.`,
    );
  }
  return { fixed: fixed.join(SEAM), fresh: fresh.join(SEAM) };
}

/** 토막 사이에 넣는 가름줄. 갈라 보내도 이어 붙이면 예전과 **한 글자도 안 달라야** 합니다. */
const SEAM = "\n\n---\n\n";

/**
 * 갈라 둔 두 조각을 사람이 읽을 한 장으로 잇습니다.
 *
 * 「LLM 요청문」 창은 사람이 복사해 붙여넣는 자리라 **한 덩어리**여야 합니다. 갈라 보내는
 * 것은 API 로 갈 때뿐이고, 화면에 뜨는 글과 실제로 가는 글이 **한 글자도 달라지면 안 됩니다** —
 * 그래야 결과를 견줄 수 있습니다. 그래서 이 함수가 두 조각을 그대로 잇습니다.
 */
export function composeRequestText(input: RequestTextInput): string {
  const { fixed, fresh } = splitRequestText(input);
  return [fixed, fresh].filter(Boolean).join(SEAM);
}

