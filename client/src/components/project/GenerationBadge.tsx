import { Info } from "lucide-react";
import { toast } from "sonner";
import { describeGeneration } from "@/lib/generationInfo";
import type { GenerationInfo } from "@/lib/projectTypes";

/**
 * **이 그림·영상을 어떻게 뽑았나** — 선반의 타일 구석에 붙는 작은 표지.
 *
 * 마우스를 올리면 모델·서버·시드·로라·프롬프트가 보이고, 누르면 그 글을 통째로 복사합니다
 * (같은 시드로 다시 뽑거나 동료에게 조합을 알려 줄 때). 로컬·사내 ComfyUI 로 뽑은 것에만
 * 기록이 있어서, 기록이 없으면 아무것도 그리지 않습니다.
 */
export default function GenerationBadge({
  generation,
  className = "",
}: {
  generation?: GenerationInfo;
  className?: string;
}) {
  if (!generation) return null;
  const text = describeGeneration(generation);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("생성 정보를 복사했습니다.");
    } catch {
      toast.error("클립보드에 넣지 못했습니다.");
    }
  };
  return (
    <button
      type="button"
      data-generation-badge
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
      title={`${text}\n\n눌러서 복사`}
      className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold ${className}`}
      style={{
        background: generation.lorasFailed ? "oklch(0.35 0.12 60 / 85%)" : "oklch(0.12 0.01 265 / 80%)",
        color: generation.backend === "comfy" ? "oklch(0.84 0.10 230)" : "oklch(0.80 0.01 265)",
      }}
    >
      <Info className="h-2.5 w-2.5" />
      {generation.backend === "comfy" ? "사내" : "로컬"}
    </button>
  );
}
