import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  AxisVectorFields,
  ONE_VECTOR,
  TransformRowHeader,
  ZERO_VECTOR,
} from "@/components/composition/fields";
import { OBJECT_COLORS, colorNameOf, objectKindEn } from "@/lib/compositionLegend";
import type { ObjectComposition } from "@/lib/composition";

/**
 * 소품 하나의 **수치 입력(이동·회전·크기)과 색**. 배치 탭과 환경 탭이 **같은 칸**을 씁니다.
 *
 * 배치 탭에만 있고 환경 탭에는 없으면 소품을 환경 탭에서 세운 뒤 숫자를 맞추러 탭을 오가게 됩니다.
 *
 * 기본값은 **접힌 채**입니다. 평소에는 단축키와 마우스로 화면에서 끌고, 숫자로 맞춰야 할 때만 폅니다
 * (캐릭터 탭도 같은 규칙).
 */
export function ObjectFields({
  object,
  onChange,
}: {
  object: ObjectComposition;
  onChange: (patch: Partial<ObjectComposition>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((now) => !now)}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[9px] font-semibold"
        style={{ color: "oklch(0.52 0.01 265)" }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        수치 입력 · 색
      </button>

      {open && (
        <div className="mt-1 space-y-2">
          <div>
            <TransformRowHeader label="위치" />
            <AxisVectorFields
              value={object.position}
              zUp
              defaults={ZERO_VECTOR}
              onChange={(position) => onChange({ position })}
            />
          </div>
          <div>
            <TransformRowHeader label="회전" />
            <AxisVectorFields
              value={object.rotation}
              zUp
              defaults={ZERO_VECTOR}
              unit="deg"
              step={15}
              onChange={(rotation) => onChange({ rotation })}
            />
          </div>
          <div>
            <TransformRowHeader label="크기" />
            <AxisVectorFields
              value={object.scale}
              defaults={ONE_VECTOR}
              min={0.1}
              labels={{ x: "가로", y: "높이", z: "깊이" }}
              onChange={(scale) => onChange({ scale })}
            />
          </div>

          {/*
            소품 색 — 화면 구분용이면서 **프롬프트의 낱말**입니다.

            구도 캡처에서 이름표를 뺐기 때문에(이름을 그림에 그려 버려서), 「저 상자가 소파」 라는 말을 색으로 합니다 —
            색과 소품 종류를 짝지어 프롬프트에 적어야 생성기가 어느 덩어리가 무엇인지 알아봅니다.
          */}
          {object.kind !== "light" && (
            <div>
              <TransformRowHeader label="색" />
              <div className="flex flex-wrap items-center gap-1">
                {OBJECT_COLORS.map((swatch) => {
                  const active =
                    (object.color || OBJECT_COLORS[0].hex).toLowerCase() ===
                    swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={`${swatch.ko} — 프롬프트에는 «the ${swatch.en} ${objectKindEn(object.kind)}» 로 나갑니다`}
                      onClick={() => onChange({ color: swatch.hex })}
                      className="h-6 w-6 rounded"
                      style={{
                        background: swatch.hex,
                        outline: active ? "2px solid oklch(0.85 0.15 200)" : "none",
                        outlineOffset: 1,
                        border: "1px solid oklch(1 0 0 / 18%)",
                      }}
                    />
                  );
                })}
                <input
                  type="color"
                  aria-label="소품 색 직접 고르기"
                  value={object.color || OBJECT_COLORS[0].hex}
                  onChange={(event) => onChange({ color: event.target.value })}
                  className="h-6 w-8 rounded"
                />
              </div>
              <p className="mt-1 text-[9px]" style={{ color: "oklch(0.48 0.01 265)" }}>
                «구성» 으로 보낼 때 «{colorNameOf(object.color).ko}{" "}
                {objectKindEn(object.kind)} = {object.label?.trim() || "이름을 적어 주세요"}» 로
                프롬프트에 실립니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ObjectFields;
