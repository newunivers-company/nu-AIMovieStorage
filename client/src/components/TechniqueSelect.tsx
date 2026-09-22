import { useEffect, useState } from "react";
import { listTechniqueOptions } from "@/lib/promptLibrary";

/**
 * 이 컷에 어떤 기법 가이드를 실을지 고릅니다.
 *
 * 연기 지시·카메라 무빙·VFX 처럼 **모델과 무관하게 늘 지켜야 할 것**을
 * 담은 문서입니다. 설정의 「기법 가이드」 에서 내용을 고칠 수 있고, 새
 * 문서를 만들면 여기 자동으로 뜹니다.
 *
 * # 왜 전부 싣지 않는가
 *
 * 요청문이 길어질수록 토큰이 늘고, 정작 중요한 지시가 긴 문서에 묻힙니다.
 * 대사 없는 풍경 컷에 연기 지시를 실을 이유가 없습니다. 필요한 것만
 * 골라 싣습니다. (지시 131)
 */
export function TechniqueSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    let alive = true;
    void listTechniqueOptions()
      .then((list) => alive && setOptions(list))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!options.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="shrink-0 text-[10px]" style={{ color: "oklch(0.48 0.01 265)" }}>
        기법
      </span>
      {options.map((option) => {
        const on = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              onChange(
                on ? value.filter((id) => id !== option.id) : [...value, option.id],
              )
            }
            title={
              on
                ? `${option.label} 가이드를 요청에서 뺍니다`
                : `${option.label} 가이드를 요청에 함께 싣습니다`
            }
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              background: on ? "oklch(0.70 0.15 160 / 20%)" : "oklch(1 0 0 / 5%)",
              border: `1px solid ${on ? "oklch(0.70 0.15 160 / 45%)" : "oklch(1 0 0 / 8%)"}`,
              color: on ? "oklch(0.82 0.15 160)" : "oklch(0.55 0.01 265)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
