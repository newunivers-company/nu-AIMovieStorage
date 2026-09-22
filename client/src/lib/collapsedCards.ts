import { useState } from "react";

/**
 * 인물·장소·공용 에셋 패널의 «접힘» 상태.
 *
 * # 왜 프로젝트 파일이 아니라 이 컴퓨터의 localStorage 인가
 *
 * 접었는지는 **보기 상태**이지 작품의 내용이 아닙니다. 초안에 넣으면 접을 때마다
 * 저장 파일이 바뀌어 자동 저장이 돌고, 되돌리기(Ctrl+Z) 기록에 «접기» 가 끼어들며,
 * 같은 프로젝트를 다른 자리에서 열었을 때 남이 접어 둔 대로 보입니다. 사용자 2026-09-08:
 * 「캐릭터들이 늘어나면 스크롤이 너무 길어질 수 있으니까...캐릭터 부분을 하나의 카드로
 * 줄일 수 있는 버튼도 있으면(디폴트는 열려 있는거고)」 — 기본은 펼침이라, 저장된 것이
 * 없으면 전부 펼쳐집니다.
 *
 * localStorage 는 없을 수도(브라우저 설정·샌드박스), 막혀 있을 수도 있습니다. 전부
 * try/catch 로 감싸 — 못 읽으면 «안 접힘», 못 쓰면 이 세션만 기억합니다.
 */
const STORAGE_KEY = "frameforge.lineage.collapsed";

/** 접어 둔 항목의 id 전부. 읽지 못하면 빈 집합(= 전부 펼침) */
export function loadCollapsedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

/** 한 항목의 접힘을 기록합니다. 쓰지 못해도 조용히 넘깁니다 — 보기 상태라 잃어도 됩니다 */
export function saveCollapsed(id: string, collapsed: boolean) {
  try {
    const ids = loadCollapsedIds();
    if (collapsed) ids.add(id);
    else ids.delete(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage 가 없거나 꽉 찼거나 막혀 있음 — 화면 상태는 이미 바뀌었으니 그대로 둡니다.
  }
}

/**
 * 패널 하나의 접힘 상태. `[접혔는가, 뒤집기]`.
 *
 * id 는 인물·장소·에셋의 id 입니다 — 이름은 바뀌지만 id 는 안 바뀌어서, 이름을 고쳐도
 * 접힘이 따라갑니다.
 */
export function useCollapsedCard(id: string): [collapsed: boolean, toggle: () => void] {
  const [collapsed, setCollapsed] = useState(() => loadCollapsedIds().has(id));
  const toggle = () => {
    // 저장은 갱신 함수 밖에서 — StrictMode 가 갱신 함수를 두 번 돌려도 기록은 한 번이면 됩니다.
    const next = !collapsed;
    saveCollapsed(id, next);
    setCollapsed(next);
  };
  return [collapsed, toggle];
}
