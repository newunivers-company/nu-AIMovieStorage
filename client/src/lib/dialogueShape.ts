import type { DialogueSyntax, ModelRule } from "@/lib/modelRules";

/**
 * **대사를 그 모델의 문법으로 고쳐 적습니다.**
 *
 * 모델마다 대사를 적는 모양이 다릅니다 — 이것 하나가 제일 크게 갈립니다. 규칙 표
 * (`modelRules.ts`)에 무엇이 맞는지는 적어 두었는데, 프롬프트를 조립하는 쪽은
 * 「소리가 나는가」 와 「금지를 어디 적는가」 만 보고 **대사 모양은 그냥 흘려보내고
 * 있었습니다**(2026-09-18 점검). 그래서 Veo 에는 자막이 박히고, H3 는 대사를
 * 못 알아듣고, Kling 은 화자를 못 가렸습니다.
 *
 * # 억지로 고치지 않습니다
 *
 * 사람이 적은 글을 기계가 완벽히 가를 수는 없습니다. 그래서 **자신 있는 것만** 고칩니다.
 *
 * - `수화: "그만해."` 처럼 «이름 : 따옴표» 로 적힌 줄만 대사로 봅니다(칸의 예시가 이 모양).
 * - 가르지 못한 줄은 **손대지 않고 그대로** 두고, 대신 그 모델의 대사 문법을 한 줄로
 * 알려 줍니다(`example` 을 그대로 보여 줍니다). 잘못 고치는 것보다 낫습니다.
 *
 * # 자막을 막는 일이 따로 있습니다
 *
 * Veo 는 대사를 **자막으로 태워 넣습니다** — 자막이 프레임에 구워진 영상으로 배웠기
 * 때문이라 지울 수 없습니다. 커뮤니티가 찾은 회피법이 «따옴표 대신 콜론»(`colon`)이라,
 * 그 모델에서는 따옴표를 떼는 것 자체가 기능입니다.
 */

/** 가른 대사 한 마디. */
export interface SpokenLine {
  /** 화자. 못 가렸으면 빈 문자열입니다. */
  who: string;
  /** 따옴표를 뗀 대사 본문. */
  what: string;
  /** 대사 뒤에 붙어 있던 연기 지시(「— 낮게, 눈은 피하지 않고」). */
  note?: string;
}

/**
 * «이름 : "대사"» 꼴만 골라냅니다.
 *
 * 화자 이름은 **한 줄 안에서 콜론 앞** 이고, 따옴표가 있어야 대사로 봅니다. 따옴표가
 * 없으면 「연출: 카메라는 고정」 같은 메모까지 대사로 읽혀 엉뚱한 소리가 납니다.
 */
export function readSpokenLines(text: string): { lines: SpokenLine[]; rest: string[] } {
  const lines: SpokenLine[] = [];
  const rest: string[] = [];
  for (const raw of text.split(/\s*\n+\s*/)) {
    const piece = raw.trim();
    if (!piece) continue;
    /*
      이름(콜론 앞) + 따옴표로 감싼 본문 + 나머지.

      이름 길이는 **40자**까지입니다. 20자로 두었더니 영문판의
      「Seo Jinwoo (Nishimura Jin): "…"」(26자)가 대사로 안 읽혀, Seedance 로 가는 영상
      프롬프트에 대사 대신 **규칙표의 예문**(「the woman says {I told you already}」)이
      그대로 실렸습니다(2026-09-21 국호 씬 1 실측). 한글 이름은 짧아 걸리지 않았고
      영문 이름만 잘렸습니다. 콜론·따옴표가 안 들어간다는 조건은 그대로라, 길이를
      늘려도 「연출: 카메라는 고정」 같은 메모가 대사로 읽히지는 않습니다.
    */
    const match = piece.match(
      /^([^:：""「『]{1,40})\s*[:：]\s*["“'「『]([^"”'」』]+)["”'」』]\s*(.*)$/,
    );
    if (!match) {
      rest.push(piece);
      continue;
    }
    const [, who, what, tail] = match;
    lines.push({
      who: who.trim(),
      what: what.trim(),
      // 꼬리의 줄표·쉼표는 «여기부터 연기 지시» 라는 표시일 뿐이라 뗍니다.
      note: tail.replace(/^[\s—–\-,·]+/, "").trim() || undefined,
    });
  }
  return { lines, rest };
}

/** 한글이 섞여 있는가 — `<d>` 안의 언어 태그를 붙일지 가릅니다. */
function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text);
}

/** 따옴표 안에 넣기 전에 문장 끝의 마침표만 뗍니다 — 안 떼면 `"….,"` 가 됩니다. */
function trimEnd(text: string): string {
  return text.replace(/[.。]+$/, "");
}

/** 한 마디를 그 모양으로 적습니다. `speakerId` 는 `tagged` 가 쓰는 `(S1)` 번호입니다. */
function writeLine(syntax: DialogueSyntax, line: SpokenLine, speakerId: string): string {
  const who = line.who || "The speaker";
  const note = line.note ? ` ${line.note}` : "";
  switch (syntax) {
    // 따옴표를 아예 안 씁니다 — 이것이 Veo 의 자막을 줄이는 회피법입니다.
    case "colon":
      return `${who} says: ${line.what}${note}`;
    case "labeled":
      return line.note
        ? `[${who}, ${line.note}]: "${line.what}"`
        : `[${who}]: "${line.what}"`;
    /*
      화자 번호와 언어 태그(MiniMax-H3). 태그 **안에는 대사 원문만** 넣습니다 —
      연출·행동·음색은 전부 밖에(공식). 대사의 글자와 문장부호는 한 글자도 안 바꿉니다.
    */
    case "tagged": {
      const lang = hasHangul(line.what) ? "[Korean] " : "";
      return `${who} (${speakerId}) says: <d>${lang}${line.what}</d>${note}`;
    }
    // Seedance 는 중괄호로 대사만 감쌉니다. `<d>` 를 보내면 태그가 글자로 그려집니다.
    case "braced":
      return `${who} says {${line.what}}${note}`;
    /*
      구 단위로 끊고 **연기 지시를 대사 사이에** 넣는 모양(LTX). 연구에서 「멈춤 지시가
      대사 지시 중 가장 크게 먹힌다」 고 나온 모델이라, 지시를 대사와 떼어 놓으면 안 됩니다.
    */
    case "segmented":
      return line.note
        ? `${who} speaks, ${line.note}: "${line.what}"`
        : `${who} says, "${line.what}"`;
    case "block":
    case "quoted":
    default:
      return line.note
        ? `${who} says, "${trimEnd(line.what)}," ${line.note}.`
        : `${who} says, "${line.what}"`;
  }
}

export interface ShapedDialogue {
  /** 프롬프트에 실을 줄들. 대사를 못 가렸으면 원문이 그대로 한 줄로 들어 있습니다. */
  lines: string[];
  /** 대사를 하나라도 가려 고쳐 적었는가. */
  shaped: boolean;
  /** 못 가렸을 때 덧붙일 «이 모델은 이렇게 적습니다» 한 줄. */
  hint?: string;
  /** 화자가 권장 수를 넘었을 때의 알림(한국어). 없으면 넘지 않은 것입니다. */
  speakerWarning?: string;
}

/**
 * 연기 지시 한 덩이를 그 모델의 대사 문법으로 고쳐 적습니다.
 *
 * 소리를 못 만드는 모델(`syntax: "none"`)은 여기 오기 전에 걸러집니다 — 그쪽은 대사를
 * 통째로 빼고 입 모양만 남기는 다른 길입니다(`cutVideoPrompt.ts`).
 */
export function shapeDialogue(rule: ModelRule | null, text: string): ShapedDialogue {
  const body = text.trim();
  if (!body) return { lines: [], shaped: false };
  const syntax = rule?.dialogue.syntax;
  // 규칙을 모르거나 대사 문법이 없으면 손대지 않습니다.
  if (!rule || !syntax || syntax === "none") return { lines: [body], shaped: false };

  const { lines: spoken, rest } = readSpokenLines(body);
  if (!spoken.length) {
    return {
      lines: [body],
      shaped: false,
      /*
        예문을 **맨 문장으로 내보내지 않습니다.** 「Seedance 2.5 의 대사 문법: Shot 1 (0-3s):
        the woman says {…}」 가 프롬프트 한가운데 서 있으면 생성기는 그것을 지시로 읽어
        엉뚱한 여자가 엉뚱한 말을 합니다(2026-09-21 실측). 사람에게 «이렇게 적어 달라» 는
        안내라는 것이 글에서 드러나야 합니다.
      */
      hint: rule.dialogue.example
        ? `(대사를 ${rule.label} 문법으로 못 옮겼습니다 — 「이름: "대사" — 지시」 꼴로 적으면 «${rule.dialogue.example}» 모양으로 바꿔 보냅니다.)`
        : undefined,
    };
  }

  /*
    화자 번호(`S1`·`S2`)는 **이름당 하나**로 고정합니다. 같은 사람이 두 번 말하는데
    번호가 달라지면 생성기가 두 사람으로 읽어 목소리가 바뀝니다.
  */
  const ids = new Map<string, string>();
  for (const line of spoken) {
    if (line.who && !ids.has(line.who)) ids.set(line.who, `S${ids.size + 1}`);
  }
  const written = spoken.map((line) => writeLine(syntax, line, ids.get(line.who) ?? "S1"));
  /*
    `block` 만 «본문 뒤 별도 블록» 입니다 — 다른 모양은 서술 안에 섞여 들어갑니다.
    제목 줄을 빼먹으면 모델이 그냥 서술로 읽어 소리를 안 냅니다.
  */
  const lines = syntax === "block" ? ["Dialogue:", ...written.map((item) => `- ${item}`)] : written;

  // 가르지 못한 줄(순수 연기 지시)은 대사 **뒤**에 그대로 둡니다.
  if (rest.length) lines.push(...rest);

  const speakers = new Set(spoken.map((line) => line.who).filter(Boolean));
  const max = rule.dialogue.maxSpeakers;
  return {
    lines,
    shaped: true,
    speakerWarning:
      max && speakers.size > max
        ? `${rule.label} 은 한 컷에 화자 ${max}명까지가 좋습니다 — 지금 ${speakers.size}명입니다. 컷을 나누는 편이 낫습니다.`
        : undefined,
  };
}
