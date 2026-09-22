import { afterEach, describe, expect, it, vi } from "vitest";
import chromeKeys from "@/locales/keys.chrome.json";

/**
 * 언어 한 벌(`i18n.ts`)의 약속을 못 박습니다.
 *
 * vitest 는 node 에서 돕니다 — `localStorage` 도 `document` 도 없습니다. 그래서 시험마다
 * 저장소와 문서를 흉내 내어 꽂고, 모듈을 새로 읽어(`vi.resetModules`) «앱을 막 켠 상태» 를
 * 만듭니다. 모듈이 읽히는 순간 저장된 언어를 읽기 때문에, 저장소를 먼저 꽂아야 합니다.
 */

const KEY = "ai-video-storage.locale.v1";

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

async function boot(seed?: Record<string, string>) {
  vi.resetModules();
  const storage = memoryStorage(seed);
  const doc = { documentElement: { lang: "" } };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("document", doc);
  const i18n = await import("@/lib/i18n");
  return { ...i18n, storage, doc };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/locales/en.json");
});

describe("기본 언어", () => {
  it("저장된 것이 없으면 한국어이고, 문구는 원문 그대로 나온다", async () => {
    const { getLocale, t, doc } = await boot();
    expect(getLocale()).toBe("ko");
    expect(t("저장")).toBe("저장");
    // `<html lang>` 은 BCP-47 태그 — `localeTag` 와 같은 값이어야 날짜 형식과 글꼴 선택이 한 벌로 갑니다.
    expect(doc.documentElement.lang).toBe("ko-KR");
  });

  it("저장된 언어가 있으면 그것으로 켜진다", async () => {
    const { getLocale, t } = await boot({ [KEY]: "ja" });
    expect(getLocale()).toBe("ja");
    expect(t("저장")).toBe("保存");
  });

  it("저장소에 엉뚱한 값이 있으면 한국어로 물러난다", async () => {
    const { getLocale } = await boot({ [KEY]: "fr" });
    expect(getLocale()).toBe("ko");
  });

  it("목록은 네 언어이고 이름은 그 언어의 글자다", async () => {
    const { LOCALES, DEFAULT_LOCALE } = await boot();
    expect(LOCALES.map((entry) => entry.id)).toEqual(["ko", "en", "ja", "zh"]);
    expect(LOCALES.map((entry) => entry.label)).toEqual(["한국어", "English", "日本語", "中文"]);
    expect(DEFAULT_LOCALE).toBe("ko");
  });
});

describe("setLocale", () => {
  it("저장하고, 문서의 lang 을 맞추고, 듣는 쪽에 알린다", async () => {
    const { setLocale, getLocale, subscribeLocale, t, storage, doc } = await boot();
    const heard = vi.fn();
    subscribeLocale(heard);

    setLocale("en");

    expect(getLocale()).toBe("en");
    expect(storage.getItem(KEY)).toBe("en");
    expect(doc.documentElement.lang).toBe("en-US");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(t("저장")).toBe("Save");
  });

  it("같은 언어를 다시 넣으면 알리지 않는다", async () => {
    const { setLocale, subscribeLocale } = await boot();
    const heard = vi.fn();
    subscribeLocale(heard);
    setLocale("ko");
    expect(heard).not.toHaveBeenCalled();
  });

  it("모르는 값은 무시한다 — 바뀌지도, 저장되지도, 알리지도 않는다", async () => {
    const { setLocale, getLocale, subscribeLocale, storage } = await boot();
    const heard = vi.fn();
    subscribeLocale(heard);

    setLocale("fr" as never);

    expect(getLocale()).toBe("ko");
    expect(storage.getItem(KEY)).toBeNull();
    expect(heard).not.toHaveBeenCalled();
  });

  it("구독을 끊으면 더 듣지 않는다", async () => {
    const { setLocale, subscribeLocale } = await boot();
    const heard = vi.fn();
    const stop = subscribeLocale(heard);
    stop();
    setLocale("zh");
    expect(heard).not.toHaveBeenCalled();
  });

  it("저장소가 없어도 이번 실행 동안은 바뀐다", async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("document", undefined);
    const { setLocale, getLocale, t } = await import("@/lib/i18n");
    expect(getLocale()).toBe("ko");
    setLocale("ja");
    expect(getLocale()).toBe("ja");
    expect(t("취소")).toBe("キャンセル");
  });
});

describe("t — 찾기와 물러나기", () => {
  it("사전에 없는 문장은 한국어 원문 그대로", async () => {
    const { setLocale, t } = await boot();
    setLocale("en");
    expect(t("이 문장은 사전에 없습니다")).toBe("이 문장은 사전에 없습니다");
  });

  it("빈 번역은 «아직 없음» 으로 쳐서 원문으로 물러난다", async () => {
    vi.doMock("@/locales/en.json", () => ({ default: { 저장: "", 취소: "Cancel" } }));
    const { setLocale, t, missingKeys } = await boot();
    setLocale("en");
    expect(t("저장")).toBe("저장");
    expect(t("취소")).toBe("Cancel");
    expect(missingKeys("en", ["저장", "취소"])).toEqual(["저장"]);
  });

  it("Object 의 것(constructor 등)을 번역으로 집어 오지 않는다", async () => {
    const { setLocale, t } = await boot();
    setLocale("en");
    expect(t("constructor")).toBe("constructor");
    expect(t("toString")).toBe("toString");
  });
});

describe("t — 자리표시자", () => {
  it("한국어에서도 채운다", async () => {
    const { t } = await boot();
    expect(t("{title} 을 숨겼습니다.", { title: "냥이" })).toBe("냥이 을 숨겼습니다.");
  });

  it("번역을 찾은 뒤에 채운다", async () => {
    const { setLocale, t } = await boot();
    setLocale("en");
    expect(t("{title} 을 숨겼습니다.", { title: "냥이" })).toBe("Hid 냥이.");
    setLocale("zh");
    expect(t("{provider} 키를 저장했습니다.", { provider: "Claude" })).toBe("已保存 Claude 密钥。");
  });

  it("숫자도 받고, 값이 없는 자리는 그대로 둔다", async () => {
    const { t } = await boot();
    expect(t("{count} 씬", { count: 3 })).toBe("3 씬");
    expect(t("{count} 씬 · {other}", { count: 3 })).toBe("3 씬 · {other}");
    expect(t("{count} 씬")).toBe("{count} 씬");
  });
});

describe("검수", () => {
  it("한국어는 빠진 키가 없다", async () => {
    const { missingKeys } = await boot();
    expect(missingKeys("ko", ["아무거나"])).toEqual([]);
  });

  it("missingKeys 는 사전에 없는 것만 고른다", async () => {
    const { missingKeys } = await boot();
    expect(missingKeys("en", ["저장", "이 문장은 사전에 없습니다"])).toEqual(["이 문장은 사전에 없습니다"]);
  });

  it("크롬 키 전부가 세 사전에 들어 있다", async () => {
    const { missingKeys } = await boot();
    for (const locale of ["en", "ja", "zh"] as const) {
      expect(missingKeys(locale, chromeKeys), locale).toEqual([]);
    }
  });

  it("번역의 자리표시자는 원문과 같은 이름이다 — 다르면 t() 가 못 채운다", async () => {
    // 자리표시자의 정의는 `placeholderNames` 하나입니다 — 시험이 제 정규식을 따로 들면 화면과 어긋납니다.
    const { placeholderNames } = await boot();
    const holes = (text: string) => [...placeholderNames(text)].sort();
    for (const locale of ["en", "ja", "zh"] as const) {
      const dictionary = (await import(`@/locales/${locale}.json`)).default as Record<string, string>;
      for (const key of chromeKeys) {
        expect(holes(dictionary[key]), `${locale}: ${key}`).toEqual(holes(key));
      }
    }
  });

  it("placeholderNames — 영문 이름만, 나온 차례대로, 중복 없이", async () => {
    const { placeholderNames } = await boot();
    expect(placeholderNames("{count} 씬 · {title} · {count}")).toEqual(["count", "title"]);
    // 한글 이름의 중괄호는 «파일 이름 꼴» 을 보여 주는 글이라 자리가 아닙니다.
    expect(placeholderNames("«{씬}_{cutNN}_{샷}.mp4»")).toEqual(["cutNN"]);
    expect(placeholderNames("자리 없음")).toEqual([]);
  });

  it("BCP-47 태그", async () => {
    const { localeTag } = await boot();
    expect(localeTag("ko")).toBe("ko-KR");
    expect(localeTag("en")).toBe("en-US");
    expect(localeTag("ja")).toBe("ja-JP");
    expect(localeTag("zh")).toBe("zh-CN");
  });
});
