/*
  **작품 대표 그림 한 장을 고르는 규칙.**

  

  보드 카드가 전부 필름 아이콘이라 어느 작품인지 그림으로 구분이 안 됐습니다. 그래서 두 층으로
  둡니다 — ① 사람이 정한 것(`draft.coverPath`)이 있으면 그것, ② 없으면 **작품 안에서 알아서
  찾습니다.** 갓 만든 작품도 인물이나 장소를 한 장 뽑는 순간 카드에 그림이 생깁니다.

  찾는 차례는 «그 작품을 가장 잘 말해 주는 것» 순입니다 — 장소(공간이 한눈에 보입니다) → 인물
  대표 그림 → 컷 대표 그림. 6000×6000 합성 시트는 건너뜁니다(카드만 봐서는 누구인지 모릅니다).

  규칙을 여기 한 벌로 두는 까닭은 보드(`ProjectsPage`)와 주제 설정의 «대표 그림» 칸이 **같은 것**을
  보여 줘야 하기 때문입니다. 두 벌로 적으면 보드에는 뜨는데 설정에는 안 뜨는 일이 생깁니다.
*/

interface CoverImage {
  filePath?: string;
  isPrimary?: boolean;
  isCompositeSheet?: boolean;
  /** 6면 세트의 한 장. 낱장으로는 무슨 그림인지 모르니 대표로 쓰지 않습니다. */
  face?: string;
}

interface CoverOwner {
  generatedImages?: CoverImage[];
}

interface CoverSource {
  coverPath?: string;
  backgrounds?: CoverOwner[];
  characters?: CoverOwner[];
  scenes?: Array<{ cuts?: Array<{ images?: CoverImage[] }> }>;
}

/** 대표로 쓸 만한 그림인가 — 합성 시트와 6면 낱장은 뺍니다. */
function usable(image: CoverImage | undefined): image is CoverImage {
  return Boolean(image?.filePath) && !image?.isCompositeSheet && !image?.face;
}

function pickFrom(owners: CoverOwner[] | undefined): string | undefined {
  for (const owner of owners ?? []) {
    const images = (owner.generatedImages ?? []).filter(usable);
    const primary = images.find((image) => image.isPrimary) ?? images[0];
    if (primary?.filePath) return primary.filePath;
  }
  return undefined;
}

/**
 * 이 작품의 대표 그림 경로. 없으면 `undefined` — 그때만 카드가 필름 아이콘으로 남습니다.
 *
 * `assetSrc` 로 감싸는 것은 부르는 쪽의 일입니다(여기는 순수 함수라 시험할 수 있습니다).
 */
export function coverOf(draft: CoverSource | null | undefined): string | undefined {
  if (!draft) return undefined;
  const chosen = draft.coverPath?.trim();
  if (chosen) return chosen;
  return (
    pickFrom(draft.backgrounds) ??
    pickFrom(draft.characters) ??
    (draft.scenes ?? [])
      .flatMap((scene) => scene.cuts ?? [])
      .flatMap((cut) => (cut.images ?? []).filter(usable))
      .map((image) => image.filePath)
      .find(Boolean)
  );
}

/**
 * 대표 그림을 **로컬 모델로 뽑을 때** 쓸 프롬프트.
 *
 * 제목·로그라인·장르·화풍을 한 줄로 엮습니다. 인물 카드처럼 «누구인가» 를 못 박을 수 없으니
 * (작품 전체를 한 장에 담는 것이라) 분위기와 공간을 시킵니다 — 글자와 사람 얼굴은 뺍니다.
 * 카드에 작게 뜨는 그림이라 얼굴이 들어가면 누구인지도 모를 뭉개진 얼굴만 남습니다.
 */
export function coverPromptOf(draft: {
  title?: string;
  logline?: string;
  genre?: string;
  style?: string;
  tone?: string;
}): { ko: string; en: string } {
  const bits = [draft.title, draft.logline, draft.tone].map((item) => item?.trim()).filter(Boolean);
  const look = [draft.genre, draft.style].map((item) => item?.trim()).filter(Boolean);
  const ko = [
    bits.join(" — ") || "이름 없는 작품",
    look.length ? look.join(" · ") : "",
    "작품을 한 장으로 말하는 대표 그림, 넓은 화면, 인물 얼굴 없이 공간과 분위기 위주, 글자 없음",
  ]
    .filter(Boolean)
    .join(", ");
  const en = [
    bits.join(" — ") || "Untitled project",
    look.join(", "),
    "a single key visual that sums up the whole work, wide cinematic frame, atmosphere and setting rather than faces, no text, no watermark",
  ]
    .filter(Boolean)
    .join(", ");
  return { ko, en };
}
