import { useState } from "react";
import { MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { RequestTextDialog, type PromptQuad, type PromptTailShape } from "@/components/RequestTextDialog";
import { composeRequestText } from "@/lib/llmRequestText";
import {
  loadCommonRules,
  loadModelGuide,
  loadPlatformGuide,
  loadRequestTemplate,
  loadTechniqueGuides,
} from "@/lib/promptLibrary";
import { getTargetPlatform } from "@/components/PlatformSelect";
import type { DEFAULT_REQUEST_TEMPLATES } from "@/lib/promptLibraryDefaults";

export type RequestTemplateId = keyof typeof DEFAULT_REQUEST_TEMPLATES;

/**
 * "LLM 요청문" 버튼 + 창을 한 덩어리로 묶은 것.
 *
 * 프롬프트를 쓰는 자리가 여섯 군데인데, 각각에 버튼·상태·조립 코드를 복사해 두면
 * 요청문 형식을 바꿀 때마다 여섯 곳을 고쳐야 합니다. 여기 하나만 고치면 되게 합니다.
 */
export function LlmRequestButton({
  template,
  title,
  data,
  modelId,
  imageCount,
  techniques,
  label = "LLM 요청문",
  className,
  onApplyPrompt,
  onApplyText,
  applyTextLabel,
  tail,
}: {
  /** requests 폴더의 md 파일 이름 */
  template: RequestTemplateId;
  /** 창 제목 */
  title: string;
  /** 작업 데이터. 호출 시점의 값을 읽도록 함수로 받습니다. */
  data: () => unknown;
  /** 대상 모델 id. 있으면 models 폴더의 가이드를 함께 붙입니다. */
  modelId?: string;
  /** 이미지가 필요한 작업이면 장수 */
  imageCount?: () => number;
  /**
   * 이 요청에 함께 실을 기법 가이드 id.
   *
   * 연기 지시·카메라 무빙·VFX 같은 것들입니다. 손으로 붙여넣어 쓰는
   * 창에도 실려야 합니다 — API 쪽만 고치면 같은 요청인데 결과가 달라집니다.
   */
  techniques?: () => string[];
  label?: string;
  className?: string;
  /**
   * 받아온 답을 다시 앱에 넣는 길. **둘 중 하나는 꼭 넘기세요.**
   *
   * 안 넘기면 창에 「② 결과 넣기」 가 안 생겨서, 요청문만 만들어 주고
   * 받은 답을 넣을 길이 없어집니다. 실제로 그렇게 한동안 끊겨 있었습니다.
   */
  onApplyPrompt?: (result: PromptQuad) => void;
  onApplyText?: (raw: string) => void;
  applyTextLabel?: string;
  /** 뒤 두 칸이 네거티브가 아니라 **가사**인 카드(곡)에서 "가사" 를 넘깁니다. */
  tail?: PromptTailShape;
}) {
  const [text, setText] = useState<string | null>(null);

  const open = async () => {
    try {
      /*
        플랫폼 가이드도 같이 싣습니다. (지시 128)

        마그니픽은 `@파일이름`, 컴피UI 는 `<picture 1>` 로 레퍼런스를
        가리킵니다. 손으로 붙여넣어 쓰는 이 창이야말로 그 문법이 맞아야
        합니다 — API 로 받는 쪽만 고치고 여기를 빠뜨리면, 같은 요청인데
        결과가 달라집니다.
      */
      const platformId = getTargetPlatform();
      const [system, modelGuide, platformGuide, techniqueGuides, commonRules] = await Promise.all([
        loadRequestTemplate(template),
        modelId ? loadModelGuide(modelId) : Promise.resolve(""),
        platformId ? loadPlatformGuide(platformId) : Promise.resolve(""),
        loadTechniqueGuides(techniques?.() ?? []),
        // 손으로 붙여넣는 글도 API 로 보내는 글과 **한 글자도 달라선 안 됩니다.**
        loadCommonRules(),
      ]);
      /*
        `::when` 문단을 가르는 값들. (지시 165)

        요청문에는 「keep 이면 이렇게, blend 면 저렇게」 같은 갈래가 들어
        있습니다. 그 갈래를 고르는 값을 안 넘기면 **문단이 통째로 지워집니다.**
        그러면 손으로 붙여넣어 받은 결과가 API 로 받은 것과 달라집니다 —
        같은 요청문이어야 하는데요.

        고른 값을 작업 데이터에서 그대로 꺼내 씁니다. 따로 받아 두면
        데이터와 어긋나는 날이 옵니다.
      */
      const payload = data();
      const vars: Record<string, string> = {};
      if (platformId) vars.platform = platformId;
      if (payload && typeof payload === "object") {
        for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
          if (typeof value === "string") vars[key] = value;
        }
      }

      setText(composeRequestText({
        system,
        modelGuide,
        platformGuide,
        techniqueGuides,
        commonRules,
        prompt: JSON.stringify(payload, null, 2),
        imageCount: imageCount?.() ?? 0,
        vars,
      }));
    } catch (error) {
      toast.error(`요청문을 만들지 못했습니다. ${error}`);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        className={
          className
          ?? "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:bg-white/10"
        }
        style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.74 0.14 200)" }}
      >
        <MessageSquareQuote className="h-3 w-3" /> {label}
      </button>
      <RequestTextDialog
        open={text !== null}
        title={title}
        text={text ?? ""}
        onClose={() => setText(null)}
        onApplyPrompt={onApplyPrompt}
        onApplyText={onApplyText}
        applyTextLabel={applyTextLabel}
        tail={tail}
      />
    </>
  );
}
