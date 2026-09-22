/**
 * **되돌리기를 아는 손잡이(슬라이더).**
 *
 * `<input type="range">` 의 `onChange` 는 **끄는 동안 한 눈금마다** 옵니다. 그대로
 * 되돌리기에 쌓으면 손잡이 한 번에 판이 수십 개 밀려 들어가고, 쉰 칸 제한에 걸려
 * **그 한 번의 끌기가 앞의 기록을 통째로 지웁니다**(지시 263 과 같은 사고).
 *
 * 그래서 규칙은 하나입니다 — **끌기 시작에 한 번만 기록하고, 끄는 동안은 안 쌓는다.**
 * Ctrl+Z 한 번이 «한 번의 끌기» 를 풉니다. 시트 배치 창이 이미 이렇게 고쳐져 있었는데
 * 구도잡기 손잡이에는 안 와 있어서, 한 벌로 묶었습니다(규칙 1).
 */
export default function PlannerRange({
  value,
  min,
  max,
  step,
  mark,
  onChange,
  className,
  title,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  /** 지금 판을 기록만 합니다 — 되돌리기 훅의 `mark`. */
  mark: () => void;
  /** 끄는 동안 불립니다. **기록에 안 쌓는** 갱신이라야 합니다. */
  onChange: (next: number) => void;
  className?: string;
  title?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      title={title}
      // 끌기 시작(과 키보드로 처음 누를 때)에 한 번. 도중은 기록하지 않습니다.
      onPointerDown={mark}
      onKeyDown={mark}
      onChange={(event) => onChange(Number(event.target.value))}
      className={className}
    />
  );
}
