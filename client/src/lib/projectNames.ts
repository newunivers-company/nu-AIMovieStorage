import { safeFileName } from "@/lib/mediaLibrary";

/**
 * **폴더 이름을 정하는 곳.**
 *
 * , 「모캡 폴더도 마찬가지네」.
 *
 * 차이는 없었습니다 — **같은 장면인데 부르는 곳마다 대체 이름이 달랐습니다.**
 * 컷 카드는 제목이 비면 「장면」, 확인 탭은 「장면 1」 을 썼고, 그 둘이 각각 폴더를
 * 만들어 한 장면의 파일이 두 곳으로 갈렸습니다.
 *
 * 모캡은 올린 영상의 **파일 이름을 그대로** 폴더로 썼습니다. 유튜브에서 받은 이름에는
 * 이모지와 해시태그가 줄줄이 붙어 있어, 폴더 이름이 200자를 넘고 탐색기에서 읽을 수가
 * 없었습니다(`비타민 주세요 💊💊😋😋 #dancechallenge #kpop …`).
 *
 * 그래서 «무엇을 폴더 이름으로 삼는가» 를 여기 한 곳으로 모읍니다. 부르는 쪽마다 적으면
 * 반드시 또 갈라집니다.
 */

/**
 * 장면 폴더 이름. 제목이 없으면 **「장면 N」**.
 *
 * 순번을 쓰는 까닭: 제목 없는 장면이 둘이면 「장면」 하나에 두 장면의 파일이 섞입니다.
 * 대신 장면 순서를 바꾸면 폴더가 어긋나므로, 제목을 적어 두는 편이 언제나 낫습니다.
 */
export function sceneFolderName(title: string | undefined, index: number): string {
  return safeFileName(title?.trim() || `장면 ${index + 1}`);
}

/** 컷 파일 이름 앞부분 — 「<장면>_컷3」. 구도·배경·영상이 모두 이 꼴을 씁니다. */
export function cutStem(title: string | undefined, index: number, order: number): string {
  return `${sceneFolderName(title, index)}_컷${order}`;
}

/**
 * 올린 영상을 **폴더 이름으로 쓸 수 있게** 다듬습니다.
 *
 * - 확장자를 떼고
 * - 해시태그 덩어리(`#…`)를 걷고
 * - 이모지·특수 기호를 지우고
 * - 연달아 붙은 공백을 하나로
 * - 40자에서 자릅니다
 *
 * 알아볼 수 있을 만큼은 남깁니다 — 「춤선이 너무 예뻤던 윤아의 태연 Why 댄스 커버」.
 * 원래 이름은 저장 기록(`MocapSource.name`)에 그대로 남아 있어 잃지 않습니다.
 */
export function mediaOwnerName(fileName: string, limit = 40): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base
    // 해시태그는 제목이 아니라 꼬리표입니다. 통째로 걷습니다.
    .replace(/#\S+/g, " ")
    /*
      한글·영문·숫자·공백과 몇 가지 문장부호만 남깁니다.
      이모지는 폴더 이름에 들어가도 되지만, 그대로 두면 탐색기·터미널·백업 도구마다
      다르게 보이고 검색이 안 됩니다.
    */
    .replace(/[^\p{Script=Hangul}\p{Script=Latin}\p{Script=Han}0-9\s._\-()[\]]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const short = cleaned.length > limit ? `${cleaned.slice(0, limit).trim()}…` : cleaned;
  // 「…」 는 파일 이름에 써도 되지만, 아무것도 안 남았으면 이름을 하나 줍니다.
  return safeFileName(short || "영상");
}
