/**
 * 프롬프트 폴더에 처음 깔아 둘 기본 문서.
 *
 * 여기 있는 건 어디까지나 씨앗입니다. 사용자가 폴더에서 고치면 그쪽이 우선이고,
 * 이 파일은 폴더가 없거나 파일이 지워졌을 때의 안전망으로만 쓰입니다.
 *
 * # 본문은 `client/src/prompts/<갈래>/<id>.md` 에 있습니다
 *
 * 예전에는 문서 스물일곱 편이 이 파일 하나에 템플릿 문자열로 들어 있었습니다
 * (3,458줄). 문서 안의 코드 블록 백틱을 전부 \` 로 피해야 했고, 하나만 빠뜨려도
 * 파일 전체가 깨졌습니다. md 로 빼면 프롬프트 폴더에 깔리는 모습 그대로 고칠 수
 * 있고, 빌드 때 `import.meta.glob` 이 본문을 글자 그대로 읽어 옵니다.
 *
 * 폴더 이름은 프롬프트 폴더의 갈래(`PromptLibraryKind`)와 같고, 파일 이름(확장자를
 * 뺀 것)이 그대로 id 입니다. 목록 순서는 파일 이름순입니다 — 요청 문구만 예외로,
 * 아래 `REQUEST_TEMPLATE_IDS` 순서를 따릅니다.
 */

/**
 * 갈래 폴더 아래의 md 전부를 빌드에 넣습니다.
 *
 * `?raw` 라서 본문이 문자열 그대로 들어오고, eager 인 이유는 이 값들이 동기적으로
 * 쓰이기 때문입니다 — `Record<string, string>` 꼴을 그대로 지켜야 부르는 쪽
 * (promptLibrary.ts)이 바뀌지 않습니다.
 */
const PROMPT_FILES = import.meta.glob<string>("../prompts/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

type PromptKind = "models" | "requests" | "platforms" | "techniques";

/**
 * 줄 끝을 LF 로 맞춥니다.
 *
 * 템플릿 문자열은 파일이 CRLF 여도 자바스크립트가 LF 로 읽어 줍니다. `?raw` 는
 * 그런 정리를 안 하므로, 윈도에서 autocrlf 로 받은 md 가 CRLF 면 머리말의
 * `label: Kling 3.0` 뒤에 CR 이 붙어 라벨이 달라집니다. 예전 값과 글자 하나
 * 다르지 않게 하려고 여기서 같은 규칙을 적용합니다. (.gitattributes 도 LF 로 못 박아
 * 두었지만, 한쪽만 믿지 않습니다.)
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** 한 갈래의 문서 전부. id → 본문. */
function readKind(kind: PromptKind): Record<string, string> {
  const prefix = `../prompts/${kind}/`;
  const result: Record<string, string> = {};
  // 글롭이 주는 순서를 믿지 않고 파일 이름순으로 고정합니다. 이 순서가 화면의
  // 기본 목록 순서이자 폴더에 심는 순서가 됩니다.
  for (const path of Object.keys(PROMPT_FILES).sort()) {
    if (!path.startsWith(prefix)) continue;
    const id = path.slice(prefix.length, -".md".length);
    result[id] = normalizeLineEndings(PROMPT_FILES[path]);
  }
  return result;
}

export const DEFAULT_MODEL_GUIDES: Record<string, string> = readKind("models");

/**
 * LLM 요청 문구의 id.
 *
 * 다른 셋과 달리 목록을 여기 적어 두는 이유가 둘 있습니다.
 * - `keyof typeof DEFAULT_REQUEST_TEMPLATES` 가 요청 종류의 타입입니다. 파일 이름에서는
 * 타입을 뽑을 수 없습니다.
 * - 화면 목록과 폴더 심기가 이 순서를 따릅니다. 파일 이름순으로 두면 캐릭터·배경
 * 문구가 섞여 버립니다.
 */
const REQUEST_TEMPLATE_IDS = [
  // 늘 붙는 공통 규칙. 맨 앞에 둡니다 — 폴더를 열었을 때 제일 먼저 보이게.
  "_공통규칙",
  // 평소 말투 → 프롬프트 말. 칸마다 «프롬프트 말로» 단추가 이걸 씁니다.
  "natural-to-prompt",
  "background-scale",
  "character-analysis",
  "character-sheet",
  "character-variation",
  "background-variation",
  "background-analysis",
  "background-sheet",
  "asset-prompt",
  "cut-prompt",
  // 컷 **영상** 프롬프트 — 규칙 뼈대 위에 상황·환경·동작을 채우는 LLM 요청.
  "cut-video-prompt",
  "storyboard",
  "storyboard-video",
  "blender",
  "character-profile",
  // 레퍼런스가 하나도 없을 때 첫 장을 뽑는 프롬프트. 캐릭터·배경·에셋이 같이 씁니다.
  "first-reference",
  "bgm-prompt",
  "background-faces",
  // 「AI 로 일괄 생성」 의 두 단계. 한 번에 다 시키면 뒤로 갈수록 문장이 짧아져 나눴습니다.
  "project-bootstrap",
  "project-details",
  "project-shots",
] as const;

type RequestTemplateId = (typeof REQUEST_TEMPLATE_IDS)[number];

function readRequestTemplates(): Record<RequestTemplateId, string> {
  const files = readKind("requests");
  const result = {} as Record<RequestTemplateId, string>;
  for (const id of REQUEST_TEMPLATE_IDS) {
    const contents = files[id];
    // 요청 문구가 비면 LLM 이 빈 지시를 받고 아무 말이나 합니다. 조용히 넘어가지 않습니다.
    if (contents === undefined) {
      throw new Error(`요청 문구 파일이 없습니다: client/src/prompts/requests/${id}.md`);
    }
    result[id] = contents;
  }
  return result;
}

export const DEFAULT_REQUEST_TEMPLATES: Record<RequestTemplateId, string> = readRequestTemplates();

/**
 * 생성 플랫폼별 가이드.
 *
 * 같은 모델이라도 **돌리는 곳에 따라 레퍼런스를 거는 문법이 다릅니다.**
 * 이걸 알려 주지 않으면 LLM 이 레퍼런스를 어떻게 가리켜야 할지 몰라
 * 그냥 문장으로 풀어 씁니다. 그러면 생성기가 그림을 안 봅니다.
 *
 * ⚠ 원본 137KB 중 되살린 것은 일부입니다. 여기 넷은 기록에 남은 규칙을
 * 바탕으로 다시 쓴 최소본이라, 쓰면서 채워 나가야 합니다.
 */
export const DEFAULT_PLATFORM_GUIDES: Record<string, string> = readKind("platforms");

/**
 * 기법 가이드.
 *
 * 특정 모델이나 플랫폼과 무관하게, 좋은 프롬프트가 되려면 늘 지켜야 하는 것들입니다.
 */
export const DEFAULT_TECHNIQUE_GUIDES: Record<string, string> = readKind("techniques");
