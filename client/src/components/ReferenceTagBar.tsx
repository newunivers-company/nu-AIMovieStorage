import { ImageIcon } from "lucide-react";
import { assetSrc } from "@/lib/mediaLibrary";

/**
 * 레퍼런스에 붙는 태그와, 그 태그를 글 상자에 넣어 주는 줄.
 *
 * 변형은 대개 "이 인물을 두고 헤어만 저 그림에서 가져와" 같은 일입니다.
 * 그런데 그걸 적을 자리가 없어서, 어느 그림에서 무엇을 가져올지 사람 머릿속에만
 * 있었습니다. 분석도 프롬프트도 그걸 모르니 그림 전체를 뭉뚱그려 봤습니다.
 *
 * 태그를 붙이면 그 말을 글로 쓸 수 있습니다.
 *
 * @정체성 에서 헤어는 @ref_1 의 헤어로 바꾸고, 옷은 @ref_2 의 의상으로 바꾼다.
 * 그 외는 모두 @정체성 그대로 두고 구도만 바꾼다.
 *
 * 태그 이름은 짧게 둡니다. 이 글은 사람이 읽고 LLM 이 읽는 것이지 생성기에 그대로
 * 넣는 값이 아닙니다. 생성기용 실제 파일 이름은 요청문에 따로 실어 보내고,
 * LLM 이 그 둘을 맞춰 최종 프롬프트를 씁니다.
 */

export interface ReferenceTag {
  id: string;
  /** @ 뒤에 붙는 짧은 이름. 정체성 기준은 "정체성", 나머지는 ref_1, ref_2 … */
  tag: string;
  /**
   * 프롬프트에 실제로 적는 글자. 플랫폼마다 다릅니다.
   *
   * Magnific 은 올린 **파일 이름**으로 그림을 부릅니다 — 우리가 파일 이름을 그대로
   * 붙여넣으니 `@ref_냥이_001` 이 곧 그 그림입니다. `@정체성`·`@ref_1` 같은 표시 이름을
   * 넣으면 마그니픽은 아무것도 못 찾습니다. ComfyUI 는
   * `<Picture N>`, Higgsfield 는 `@image_N`, 정하지 않았으면 표시 이름.
   */
  mention: string;
  /** 파일 이름(확장자 없이). 폴더에 저장된 그림만 있습니다. */
  fileStem?: string;
  /** 실제 파일 이름. LLM 이 최종 프롬프트에서 쓸 이름입니다. */
  name: string;
  thumb?: string;
  filePath?: string;
  isIdentity: boolean;
}

/**
 * 레퍼런스 목록에 태그를 매깁니다.
 *
 * 맨 앞이 정체성 기준입니다. 순서가 곧 역할이라, 목록이 바뀌면 태그도 따라 바뀝니다.
 */
/** 경로에서 파일 이름만(확장자 없이). 마그니픽이 그림을 부르는 이름입니다. */
export function fileStemOf(path?: string): string {
  if (!path) return "";
  const last = path.replace(/\\/g, "/").split("/").pop() || "";
  return last.replace(/\.[^.]+$/, "");
}

export function buildReferenceTags(
  references: { id: string; name?: string; label?: string; thumb?: string; filePath?: string }[],
  platform = "",
): ReferenceTag[] {
  let index = 0;
  return references.map((reference, position) => {
    const isIdentity = position === 0;
    if (!isIdentity) index += 1;
    const tag = isIdentity ? "정체성" : `ref_${index}`;
    const fileStem = fileStemOf(reference.filePath) || undefined;
    const mention =
      platform === "magnific" && fileStem
        ? `@${fileStem}`
        : platform === "comfyui"
          ? `<Picture ${position + 1}>`
          : platform === "higgsfield"
            ? `@image_${position + 1}`
            : `@${tag}`;
    return {
      id: reference.id,
      tag,
      mention,
      fileStem,
      name: reference.name || reference.label || (isIdentity ? "정체성 기준" : `레퍼런스 ${index}`),
      thumb: reference.thumb,
      filePath: reference.filePath,
      isIdentity,
    };
  });
}

export default function ReferenceTagBar({
  tags,
  onInsert,
}: {
  tags: ReferenceTag[];
  /** 태그를 글 상자의 커서 자리에 넣습니다. */
  onInsert: (tag: string) => void;
}) {
  if (!tags.length) return null;

  return (
    <div className="mb-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold" style={{ color: "oklch(0.60 0.01 265)" }}>
          올린 레퍼런스
        </p>
        <p className="text-[10px]" style={{ color: "oklch(0.44 0.01 265)" }}>
          누르면 「추가 외형 묘사」 에 태그가 들어갑니다. 그 뒤에 무엇을 가져올지 적으세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => {
          const source = assetSrc(tag.filePath) || tag.thumb || "";
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onInsert(tag.mention)}
              title={`${tag.mention} · ${tag.name}`}
              className="flex items-center gap-1.5 rounded-md py-1 pl-1 pr-2 text-[11px] font-semibold transition-colors hover:brightness-125"
              style={{
                background: tag.isIdentity ? "oklch(0.62 0.22 290 / 18%)" : "oklch(1 0 0 / 6%)",
                border: `1px solid ${tag.isIdentity ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 10%)"}`,
                color: tag.isIdentity ? "oklch(0.86 0.16 290)" : "oklch(0.74 0.01 265)",
              }}
            >
              <span className="h-5 w-5 shrink-0 overflow-hidden rounded" style={{ background: "oklch(0.12 0.008 265)" }}>
                {source ? (
                  <img
                    src={source}
                    alt=""
                    className="h-5 w-5 object-cover"
                    onError={event => { event.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <ImageIcon className="h-3 w-3 m-1" style={{ color: "oklch(0.34 0.01 265)" }} />
                )}
              </span>
              {tag.mention}
            </button>
          );
        })}
      </div>
    </div>
  );
}
