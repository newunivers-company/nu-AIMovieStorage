import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * **마그니픽이 가진 모델 목록.**
 *
 * 마그니픽을 붙이면 그림과 영상을 **어느 모델로, 어느 해상도로** 뽑을지까지 고를 수
 * 있어야 합니다.
 *
 * # 목록을 **박아 두지 않습니다**
 *
 * 마그니픽은 모델을 자주 갈아 끼웁니다. 우리 코드에 이름을 적어 두면 새 모델이 나와도
 * 못 고르고, 없어진 모델을 계속 보여 줍니다. 그래서 `images_models_list` ·
 * `video_models_list` 를 **그때그때 물어봅니다.**
 *
 * 한 번 받아 두면 이번 세션 동안 다시 묻지 않습니다 — 목록 하나 받자고 왕복을 되풀이할
 * 이유가 없습니다.
 */

export interface MagnificModel {
  /** 생성할 때 그대로 넘기는 값. 마그니픽이 `slug` 라 부릅니다. */
  slug: string;
  name: string;
  /** 고를 수 있는 해상도들. 비어 있으면 그 모델은 해상도를 안 받습니다. */
  resolutions: string[];
  /** 이미지 전용 — 「고급·표준」 같은 등급. */
  qualities: string[];
  /** 영상 전용 — 이 모델이 받아 주는 길이(초). 비어 있으면 아무 길이나 받습니다. */
  durations: number[];
  /** 이 모델이 받아 주는 화면 비율. 비어 있으면 아무거나 받습니다. */
  aspectRatios: string[];
}

const cache: Partial<Record<"image" | "video", MagnificModel[]>> = {};

/*
  ── 카탈로그는 **JSON 이 아닙니다** ──────────────────────────────────────

  목록이 영영 안 불러와졌습니다. 오류도 안 뜨고 목록만 비어 있었는데, 까닭은
  마그니픽이 모델 목록을 **TOON 텍스트**로 주기 때문입니다(도구 설명에 «lean TOON text»
  라고 적혀 있습니다). JSON 으로 풀려다 실패하면 글자 한 덩어리가 되고, 거기서 배열을
  찾으니 아무것도 없었습니다 — 실패가 아니라 **빈 목록**이라 오류도 안 났습니다.

  생김새는 YAML 을 닮았습니다. 우리가 볼 것은 넷뿐입니다.

      models[4]:
        - slug: kling-25
          name: Kling 2.5
          durations[2]: 5,10
          resolutions[2]: 1080p,720p
          agentRecommendation:        ← 더 깊은 칸은 안 봅니다
            tier: recommended

  그래서 **깊이로 가릅니다** — 모델은 「2칸 + `- `」 에서 시작하고, 그 모델의 칸은 정확히
  4칸입니다. 더 깊은 것(레퍼런스 규칙·제약)은 지나칩니다. 전부 읽어 들이면 `references`
  안의 `type:` 같은 것이 모델 칸으로 새어 듭니다.
*/

/** `"1:1","16:9"` · `5,10` 처럼 쉼표로 이어진 값. 따옴표는 벗깁니다. */
function commaList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function parseToon(text: string): MagnificModel[] {
  const made: MagnificModel[] = [];
  let current: MagnificModel | null = null;

  const take = (key: string, value: string) => {
    if (!current) return;
    if (key === "slug") current.slug = value.replace(/^"|"$/g, "");
    else if (key === "name") current.name = value.replace(/^"|"$/g, "");
    else if (key === "resolutions") current.resolutions = commaList(value);
    else if (key === "aspectRatios") current.aspectRatios = commaList(value);
    else if (key === "qualities") current.qualities = commaList(value);
    else if (key === "durations")
      current.durations = commaList(value)
        .map(Number)
        .filter((item) => Number.isFinite(item) && item > 0);
  };

  for (const line of text.split(/\r?\n/)) {
    // 새 모델 — 「 - slug: kling-25」
    const head = /^ {2}- (\w+)(?:\[\d+\])?:\s*(.*)$/.exec(line);
    if (head) {
      current = { slug: "", name: "", resolutions: [], qualities: [], durations: [], aspectRatios: [] };
      made.push(current);
      take(head[1], head[2]);
      continue;
    }
    // 그 모델의 칸 — 정확히 네 칸. 더 깊으면 다른 것의 속입니다.
    const field = /^ {4}(\w+)(?:\[\d+\])?:\s*(.*)$/.exec(line);
    if (field) take(field[1], field[2]);
  }
  return made.filter((item) => item.slug);
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** 숫자 목록. 「5」 처럼 글자로 오는 서버도 있어 함께 받습니다. */
const numbers = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "number" ? item : Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0)
    : [];

/** JSON 으로 주는 서버도 있을 수 있어 그 길도 남깁니다. */
function listOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") {
    for (const key of ["models", "data", "items", "results"]) {
      const found = (value as Record<string, unknown>)[key];
      if (Array.isArray(found)) return found as Record<string, unknown>[];
    }
  }
  return [];
}

export async function loadMagnificModels(
  kind: "image" | "video",
  /** 참이면 받아 둔 것을 버리고 다시 묻습니다 — 「불러오기」 단추가 이걸 씁니다. */
  fresh = false,
): Promise<MagnificModel[]> {
  if (!fresh && cache[kind]) return cache[kind]!;
  const reply = await invoke<unknown>("magnific_call", {
    tool: kind === "image" ? "images_models_list" : "video_models_list",
    args: {},
  });
  const made = typeof reply === "string"
    ? parseToon(reply)
    : listOf(reply)
        .map((item) => ({
          slug: String(item.slug ?? item.id ?? item.model ?? ""),
          name: String(item.name ?? item.label ?? item.slug ?? ""),
          resolutions: strings(item.resolutions),
          qualities: strings(item.qualities),
          durations: numbers(item.durations ?? item.durationOptions),
          aspectRatios: strings(item.aspectRatios),
        }))
        .filter((item) => item.slug);
  /*
    빈 목록은 **성공이 아닙니다.** 오류도 없이 비어 있으면 «연결했는데 왜 안 뜨지» 를
    알 길이 없습니다. 받아 온 것을 그대로 붙여 까닭을 보여 줍니다.
  */
  if (!made.length) {
    const peek = typeof reply === "string" ? reply.slice(0, 200) : JSON.stringify(reply).slice(0, 200);
    throw new Error(`모델 목록을 읽지 못했습니다. 받은 답: ${peek || "(빈 답)"}`);
  }
  cache[kind] = made;
  return made;
}

/**
 * 이 씬의 길이를 **그 모델이 받아 주는 길이**로 맞춥니다.
 *
 * 영상은 씬마다 러닝타임이 저절로 정해져 뽑혀야 합니다.
 *
 * 러닝타임을 정하는 것은 **컷 길이의 합**입니다. 그런데 생성기마다 받아 주는 길이가
 * 정해져 있어서(5초·10초만 되는 모델이 흔합니다) 그대로는 못 보냅니다. 그렇다고 우리가
 * 10초로 못 박아 두면, 20초를 받는 모델을 골라도 10초로 잘립니다 — 예전 코드가 그랬습니다.
 *
 * 그래서 **모델에게 물어보고** 가장 가까운 값으로 맞춥니다. 목록이 없으면 위 한계까지만
 * 자르고, 그것도 없으면 씬이 정한 길이를 그대로 보냅니다.
 */
export function fitDuration(models: MagnificModel[], slug: string | undefined, wanted: number): number {
  const model = slug ? models.find((item) => item.slug === slug) : undefined;
  const choices = model?.durations ?? [];
  if (choices.length) {
    // 모자란 것보다 넘치는 편이 낫습니다 — 컷이 잘리면 이야기가 끊깁니다.
    const over = choices.filter((item) => item >= wanted).sort((a, b) => a - b)[0];
    if (over) return over;
    return Math.max(...choices);
  }
  return wanted;
}

/**
 * 화면에서 쓰는 목록. 연결 전이거나 실패하면 **빈 목록**입니다 —
 * 그때는 「마그니픽이 알아서」 하나만 고를 수 있습니다.
 */
export function useMagnificModels(kind: "image" | "video", enabled: boolean) {
  const [models, setModels] = useState<MagnificModel[]>(cache[kind] ?? []);
  const [failed, setFailed] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * 목록을 받아 옵니다.
   *
   * «마그니픽이 알아서» 에서 그림·영상 모델 목록이 안 뜨는 일이 있었습니다.
   *
   * 저절로 한 번 받아 보되, 안 되면 **까닭을 적고 불러오기 단추를 내놓습니다.** 조용히 비어 있으면
   * «연결했는데 왜 안 뜨지» 를 알 길이 없습니다 — 연결이 끊겼는지, 도구 이름이 바뀌었는지,
   * 그냥 느린 건지.
   */
  const reload = useCallback(
    async (fresh = true) => {
      setLoading(true);
      setFailed("");
      try {
        setModels(await loadMagnificModels(kind, fresh));
      } catch (error) {
        setFailed(String(error));
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    if (!enabled || cache[kind]) return;
    void reload(false);
  }, [kind, enabled, reload]);

  return { models, failed, loading, reload };
}
