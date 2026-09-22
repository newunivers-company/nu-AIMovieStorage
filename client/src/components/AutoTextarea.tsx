import { forwardRef, useEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * 내용에 맞게 키가 자라는 글 상자.
 *
 * 프롬프트와 분석은 길어서, 정해진 높이 안에 두면 안쪽 스크롤이 생깁니다.
 * 그러면 한눈에 못 읽고, 어디까지 읽었는지도 잃어버립니다. 페이지는 어차피
 * 스크롤되므로 상자가 늘어나는 편이 낫습니다.
 *
 * 값이 밖에서 바뀌는 경우(붙여넣기, LLM 결과 채우기)에도 다시 재야 하므로
 * value 를 함께 봅니다.
 */
const AutoTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number }
>(function AutoTextarea({ value, minRows = 3, className, ...props }, forwarded) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  const attach = (node: HTMLTextAreaElement | null) => {
    inner.current = node;
    if (typeof forwarded === "function") forwarded(node);
    else if (forwarded) forwarded.current = node;
  };

  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    // 먼저 줄여야 줄어드는 경우에도 제대로 잽니다. auto 없이 재면 한 번 커진 높이가 남습니다.
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={attach}
      value={value}
      rows={minRows}
      // resize-none 은 손잡이를 없앱니다. 높이를 코드가 정하므로 손으로 끌면 다음 입력에 되돌아갑니다.
      className={`${className ?? ""} resize-none overflow-hidden`}
    />
  );
});

export default AutoTextarea;
