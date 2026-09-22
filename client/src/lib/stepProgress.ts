import { hasProjectContext } from "@/lib/projectContext";
import type { ProjectDraft } from "@/lib/projectTypes";

/**
 * 이 단계를 «채웠는가».
 *
 * 위치가 아니라 **내용**을 봅니다. 캐릭터를 건너뛰고 배경으로 갔다면
 * 캐릭터는 채운 것이 아닙니다. 「확인」 은 스토리보드에 실릴 컷이
 * 하나라도 있으면 채운 것으로 칩니다.
 *
 * 프로그래스 바의 동그라미와, 프로젝트를 다시 열 때 «어디서 이어서 할지»
 * 가 같은 판정을 씁니다. 예전에는 둘이 NewProjectPage 안에 따로
 * 적혀 있어서, 한쪽만 고치면 동그라미는 찼는데 엉뚱한 단계에서 열리는 식으로
 * 어긋날 수 있었습니다. 판정은 여기 하나뿐이어야 합니다.
 *
 * 파일에서 막 읽은 초안은 옛 저장본이라 배열이 빠져 있을 수 있어서 `?.` 로 받습니다.
 */
export function stepFilled(draft: ProjectDraft, step: number): boolean {
  switch (step) {
    case 1:
      return Boolean(draft.title.trim()) || hasProjectContext(draft);
    case 2:
      return (draft.characters?.length || 0) > 0;
    case 3:
      /*
        씬 단계가 **장소·에셋까지 품습니다** — 배경은 씬 안에서 만드는 것이라 탭을 따로 두지 않습니다.
        그래서 «채웠다» 의 기준은 장면입니다 — 장소만 만들고 장면이 없으면 아직 아무 컷도 못 만듭니다.
      */
      return (draft.scenes?.length || 0) > 0;
    case 4:
      // 스토리보드는 컷을 모아 보여 주는 것이라, 실릴 컷이 하나라도 있어야
      // «생겼다» 고 할 수 있습니다. 장면만 만들고 컷이 없으면 빈 판입니다.
      return (draft.scenes || []).some((scene) => scene.cuts.length > 0);
    default:
      return false;
  }
}
