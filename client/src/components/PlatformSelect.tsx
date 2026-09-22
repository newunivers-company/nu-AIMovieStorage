import { useEffect, useState } from "react";
import { listPlatformOptions } from "@/lib/promptLibrary";

/**
 * 어느 생성 플랫폼에 넣을 프롬프트인지.
 *
 * 같은 모델이라도 돌리는 곳에 따라 레퍼런스 거는 법이 다릅니다.
 * Magnific 은 @img1, ComfyUI 는 <Picture 1> 입니다. 이걸 모르면 LLM 이
 * 레퍼런스를 어떻게 가리켜야 할지 알 수 없어 그냥 문장으로 풀어 씁니다.
 *
 * 앱 전체에 하나만 둡니다. 자산마다 다른 플랫폼을 쓰는 경우는 드물고,
 * 자산마다 고르게 하면 어디선가 빠뜨렸을 때 그 하나만 형식이 어긋납니다.
 */

const STORAGE_KEY = "ai-video-storage.target-platform.v1";

export function getTargetPlatform(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) || "";
}

export function saveTargetPlatform(id: string) {
  window.localStorage.setItem(STORAGE_KEY, id);
}

/** 지금 고른 플랫폼. 바뀌면 화면도 같이 갱신됩니다. */
export function useTargetPlatform() {
  const [platform, setPlatform] = useState(getTargetPlatform);

  useEffect(() => {
    const sync = () => setPlatform(getTargetPlatform());
    window.addEventListener("ai-video-storage:platform", sync);
    return () => window.removeEventListener("ai-video-storage:platform", sync);
  }, []);

  return platform;
}

export default function PlatformSelect({ className }: { className?: string }) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const platform = useTargetPlatform();

  useEffect(() => { void listPlatformOptions().then(setOptions); }, []);

  return (
    <select
      value={platform}
      onChange={event => {
        saveTargetPlatform(event.target.value);
        // 같은 창의 다른 선택기도 함께 바뀌어야 합니다.
        window.dispatchEvent(new Event("ai-video-storage:platform"));
      }}
      title="생성 플랫폼 — 레퍼런스를 어떻게 가리킬지가 여기서 갈립니다"
      className={className ?? "shrink-0 rounded-lg px-2.5 py-1.5 text-xs outline-none"}
      style={{
        background: "oklch(0.14 0.009 265)",
        border: "1px solid oklch(1 0 0 / 10%)",
        color: platform ? "oklch(0.83 0.01 265)" : "oklch(0.52 0.01 265)",
      }}
    >
      <option value="">플랫폼 미지정</option>
      {options.map(option => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  );
}
