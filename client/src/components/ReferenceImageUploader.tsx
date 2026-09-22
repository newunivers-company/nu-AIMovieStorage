import { useRef, useState } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import ImageActions from "@/components/ImageActions";
import { copyImageWithNotice } from "@/lib/mediaLibrary";

export type ReferenceImageItem = {
  id: string;
  thumb: string;
  name?: string;
  label?: string;
  filePath?: string;
  isParentReference?: boolean;
};

type ReferenceImageUploaderProps = {
  images: ReferenceImageItem[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  canRemove?: (image: ReferenceImageItem) => boolean;
  label?: string;
  /**
   * 가위를 눌렀을 때. 주면 오른쪽 아래에 가위가 붙습니다.
   *
   * 「모든 이미지에서 가위 툴이 있어야 한다」 — 얼굴만 잘라 변형 레퍼런스로
   * 바로 넣는 것이 이 앱의 기본 동작인데, 예전에는 생성 이미지에만 있어서
   * 레퍼런스를 다듬으려면 폴더를 열어 밖에서 잘라 와야 했습니다.
   */
  onCrop?: (image: ReferenceImageItem) => void;
  /**
   * 타일 위에 파일을 떨구면 **그 자리를 갈아 끼웁니다.** 빼고 다시 넣으면
   * 순서가 뒤로 가서 태그 번호가 바뀝니다. (지시 215·217)
   */
  onReplace?: (id: string, file: File) => void;
  /** 썸네일을 누르면 크게 봅니다. (지시 255·273) */
  onView?: (image: ReferenceImageItem) => void;
  /** 주면 정체성 기준이 아닌 타일에 «정체성 기준으로» 별이 붙습니다. */
  onMakeIdentity?: (image: ReferenceImageItem) => void;
  // 타일의 «업스케일 ▾» 은 없앴습니다(2026-09-09) — 키우기는 가위로 여는 편집 창 안으로 갔습니다.
  // 자세한 이유는 `ImageActions` 머리 주석.
};

export default function ReferenceImageUploader({
  images,
  onAddFiles,
  onRemove,
  canRemove,
  label = "레퍼런스 이미지",
  onCrop,
  onReplace,
  onView,
  onMakeIdentity,
}: ReferenceImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className="flex flex-wrap gap-2 rounded-lg p-2 transition-colors"
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        onAddFiles(event.dataTransfer.files);
      }}
      style={{
        background: isDragging ? "oklch(0.62 0.22 290 / 10%)" : "oklch(0.14 0.009 265)",
        border: `1px dashed ${isDragging ? "oklch(0.72 0.18 290 / 85%)" : "oklch(1 0 0 / 16%)"}`,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onAddFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {images.map((image) => (
        /*
          타일을 눌러 고르고 **Ctrl+C 로 복사**합니다. (지시 121)

          복사 아이콘은 진작 있었지만 키로 복사할 방법이 없었습니다.
          포커스를 받을 수 있어야 키를 받는데, div 는 그냥 두면 포커스가
          안 잡힙니다. tabIndex 를 주고 테두리로 지금 고른 것을 보여 줍니다.
        */
        <div
          key={image.id}
          title={`${image.name || image.label || "레퍼런스"} — 눌러서 고르고 Ctrl+C 로 복사. 파일을 떨구면 이 자리를 갈아 끼웁니다`}
          tabIndex={0}
          onDragOver={
            onReplace
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }
              : undefined
          }
          onDrop={
            onReplace
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const file = event.dataTransfer.files?.[0];
                  if (file) onReplace(image.id, file);
                }
              : undefined
          }
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") return;
            event.preventDefault();
            void copyImageWithNotice(image);
          }}
          className="relative group w-[102px] shrink-0 aspect-square rounded-md overflow-hidden outline-none focus-visible:ring-2"
          style={{ border: "1px solid oklch(1 0 0 / 10%)", background: "oklch(0.12 0.008 265)" }}
        >
          {/*
            그림이 안 뜰 때를 대비한 바닥. 위의 img 가 실패하면 스스로 숨어서
            이 아이콘이 드러납니다.
          */}
          <span className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-6 w-6" style={{ color: "oklch(0.30 0.01 265)" }} />
          </span>
          {/*
            alt 를 비워 둡니다.

            그림이 깨지면 브라우저가 alt 글자를 타일 안에 **본문처럼 그립니다.**
            파일 이름이 길면 102px 정사각형을 뚫고 나와 아래 이름표까지 덮었습니다.
            이름은 바로 아래 이름표가 이미 보여 주고, 전체 이름은 타일 title 로 뜹니다.
          */}
          {image.thumb ? (
            <img
              src={image.thumb}
              alt=""
              onClick={onView ? () => onView(image) : undefined}
              className={`relative h-full w-full object-cover ${onView ? "cursor-zoom-in" : ""}`}
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1.5 py-1 text-[9px] text-white">
            {image.name || image.label || "레퍼런스"}
          </span>
          {/*
            어느 그림이 정체성 기준인지 타일에서 바로 보이게. 이름표는 파일 이름을 먼저 쓰니 «정체성 기준»
            라벨이 묻혔고, 사용자가 기준을 바꾸려다 «뺄 수 없습니다» 만 봤습니다(2026-09-08). 바꾸는 길은
            다른 타일의 ★(정체성 기준으로) 입니다.
          */}
          {image.isParentReference && (
            <span
              className="pointer-events-none absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-bold text-white"
              style={{ background: "oklch(0.62 0.22 290 / 85%)" }}
            >
              정체성 기준
            </span>
          )}
          {/*
            버튼은 공통 컴포넌트가 그립니다. 자리를 여기서 따로 정하면
            생성 이미지와 모서리가 어긋나서, 지우려다 복사를 누르게 됩니다.
          */}
          <ImageActions
            image={image}
            onRemove={(canRemove?.(image) ?? true) ? () => onRemove(image.id) : undefined}
            onCrop={onCrop ? () => onCrop(image) : undefined}
            onMakeIdentity={onMakeIdentity && !image.isParentReference ? () => onMakeIdentity(image) : undefined}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-[102px] aspect-square rounded-md flex flex-col items-center justify-center gap-1 text-[10px] hover:bg-white/5"
        style={{ border: "1px dashed oklch(1 0 0 / 22%)", color: "oklch(0.58 0.01 265)" }}
      >
        <Upload className="w-4 h-4" />
        {isDragging ? "여기에 놓기" : images.length ? "이미지 추가" : `${label} 추가`}
      </button>
    </div>
  );
}

