import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  CLAUDE_MODEL_OPTIONS,
  OPENAI_MODEL_OPTIONS,
  isDesktopApp,
  type LlmProvider,
} from "@/lib/llm";

/*
  **제공자에게 물어본 모델 목록.**

   실제로 그랬습니다 — 앱에는 `gpt-5.6-*` 이 박혀 있는데
  계정에는 이미 `gpt-6-luna`·`gpt-6-sol`·`gpt-6-astra` 가 있었습니다(같은 날 실측).

  # 박아 둔 목록을 없애지 않는 까닭

  키가 없거나 네트워크가 막히면 드롭다운이 **통째로 빕니다.** 그러면 아무것도 못 고르고,
  설정을 열어 봐야 왜 비었는지도 모릅니다. 그래서 받아 온 것이 있으면 그걸 쓰고 없으면
  박아 둔 것으로 물러섭니다. 박아 둔 목록은 «옛 목록» 이 아니라 **바닥**입니다.

  # 이름표는 우리 것을 씁니다

  OpenAI 는 id 만 줍니다(`gpt-5.6-terra`). 우리가 아는 id 에는 사람이 읽을 이름
  (「GPT-5.6 Terra — 균형」)을 덧씌우고, 모르는 새 id 는 그대로 보여 줍니다 — 모른다고
  숨기면 새 모델을 쓰려고 목록을 받아 온 뜻이 없어집니다.
*/
export interface ModelChoice {
  id: string;
  label: string;
}

/** 하루. 켤 때마다 묻지 않되, 하루 지나면 새로 받습니다. */
const FRESH_MS = 24 * 60 * 60 * 1000;
const STORE_KEY = "frameforge.modelCatalog.v1";

interface Cached {
  models: ModelChoice[];
  fetchedAt: number;
}

type Catalog = Partial<Record<LlmProvider, Cached>>;

let catalog: Catalog = readStored();
let loading: Partial<Record<LlmProvider, boolean>> = {};
const listeners = new Set<() => void>();

/** 마지막으로 내준 값. `useSyncExternalStore` 는 같은 값이면 같은 참조를 받아야 합니다. */
let snapshot = { catalog, loading };

function readStored(): Catalog {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(STORE_KEY);
    return saved ? (JSON.parse(saved) as Catalog) : {};
  } catch {
    // 저장소를 못 쓰면 이번에 받은 것만 씁니다 — 목록은 그래도 돕니다.
    return {};
  }
}

function announce() {
  snapshot = { catalog, loading };
  for (const listen of listeners) listen();
}

function remember(provider: LlmProvider, models: ModelChoice[]) {
  catalog = { ...catalog, [provider]: { models, fetchedAt: Date.now() } };
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(catalog));
  } catch {
    // 못 적어도 이번 판에서는 씁니다.
  }
  announce();
}

/**
 * 받아 온 목록에 **우리 이름표**를 입힙니다. 모르는 id 는 온 그대로.
 *
 * 이름표 사전을 여기 또 적지 않고 박아 둔 목록에서 읽습니다 — 두 벌로 두면 한쪽만
 * 고쳐지는 날이 옵니다(이 저장소가 반복해 겪은 모양).
 */
function withOurLabels(provider: LlmProvider, models: ModelChoice[]): ModelChoice[] {
  const known = new Map(fallbackFor(provider).map((item) => [item.id, item.label]));
  return models.map((item) => ({ id: item.id, label: known.get(item.id) ?? item.label }));
}

function fallbackFor(provider: LlmProvider): ModelChoice[] {
  return provider === "claude" ? CLAUDE_MODEL_OPTIONS : OPENAI_MODEL_OPTIONS;
}

/**
 * 지금 쓸 목록. 받아 온 것이 있으면 그것, 없으면 박아 둔 것.
 *
 * 받아 온 목록에 **박아 둔 것이 빠져 있어도 함께 보여 줍니다.** 제공자가 어느 날
 * 목록에서 뺐는데 프로젝트가 그 모델로 저장돼 있으면, 드롭다운에서 사라져 버립니다.
 */
export function modelsFor(provider: LlmProvider): ModelChoice[] {
  const got = catalog[provider]?.models;
  const base = fallbackFor(provider);
  if (!got?.length) return base;
  const seen = new Set(got.map((item) => item.id));
  return [...got, ...base.filter((item) => !seen.has(item.id))];
}

/** 이 제공자의 목록을 언제 받았나. 안 받았으면 `null`. */
export function fetchedAtFor(provider: LlmProvider): number | null {
  return catalog[provider]?.fetchedAt ?? null;
}

export function isLoadingModels(provider: LlmProvider): boolean {
  return Boolean(loading[provider]);
}

/**
 * 제공자에게 목록을 물어봅니다.
 *
 * @param force 하루가 안 지났어도 새로 받습니다(사람이 단추를 눌렀을 때).
 * @returns 받았으면 개수, 안 받았으면 `null`(키 없음·데스크톱 아님·이미 신선함).
 *
 * **오류를 던지지 않습니다.** 설정을 열 때마다 자동으로 부르는데, 키가 없다고 알림이
 * 뜨면 아직 키를 넣지 않은 사람에게 매번 잔소리가 됩니다. 사람이 단추를 눌렀을 때만
 * 부르는 쪽이 알림을 띄우도록 `reason` 을 돌려줍니다.
 */
export async function refreshModels(
  provider: LlmProvider,
  force = false,
): Promise<{ count: number } | { reason: string }> {
  if (!isDesktopApp()) return { reason: "데스크톱 앱에서만 받아올 수 있습니다." };
  if (loading[provider]) return { reason: "이미 받는 중입니다." };
  const cached = catalog[provider];
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) {
    return { count: cached.models.length };
  }
  loading = { ...loading, [provider]: true };
  announce();
  try {
    const got = await invoke<ModelChoice[]>("list_llm_models", { provider });
    const models = withOurLabels(provider, got ?? []);
    if (!models.length) return { reason: "쓸 수 있는 글 모델이 목록에 없습니다." };
    remember(provider, models);
    return { count: models.length };
  } catch (error) {
    return { reason: String(error) };
  } finally {
    loading = { ...loading, [provider]: false };
    announce();
  }
}

/** 화면이 목록 변화를 따라오게 합니다. */
export function useModelCatalog() {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
    () => snapshot,
    () => snapshot,
  );
}
