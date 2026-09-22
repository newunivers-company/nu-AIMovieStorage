import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { revealFile, saveProjectMediaAsset } from "@/lib/mediaLibrary";
import { fieldStyle } from "@/components/project/fieldStyle";
import {
  DOCUMENT_ACCEPT,
  describeDocument,
  readDocumentText,
} from "@/lib/documentText";
import type { BootstrapDoc } from "@/lib/bootstrapStore";

/**
 * **시나리오·기획안 파일 넣기** — PDF · 워드(docx) · 텍스트.
 *
 * ,
 * 「PDF는 프로젝트 폴더 안에 DOCU 폴더 만들어서 넣자」.
 *
 * # 두 가지를 같이 합니다
 *
 * 1. **글을 뽑아 위 칸에 채웁니다.** 몰래 LLM 으로 보내지 않습니다 — 무엇을 읽었는지
 * 눈으로 보고 고친 뒤에 「만들기」 를 누르게 합니다. PDF 는 쪽번호·머리말이 같이
 * 딸려 오는 일이 잦은데, 모른 채 보내면 인물 이름이 엉뚱하게 잡힙니다.
 * 2. **원본은 `<프로젝트>/DOCU/` 에 둡니다.** 글은 프로젝트 파일에 들어가지만, 표가
 * 무너졌을 때 다시 열어 봐야 하고 「무엇으로 만든 작품인가」 를 되짚는 길이 그것뿐입니다.
 *
 * # 그림·영상 칸과 왜 따로인가
 *
 * `BootstrapRefsField` 는 **보여 줄 것**입니다(이 얼굴로, 이 안무로). 이쪽은 **읽을
 * 것**이라, 올린 뒤에 하는 일이 정반대입니다 — 그림은 파일째 모델에게 가고, 문서는
 * 글로 바뀌어 시나리오 칸에 들어갑니다. 한 칸에 섞으면 「PDF 를 올렸는데 왜 그림
 * 설명을 적으라고 하지」 가 됩니다.
 */
export default function BootstrapDocsField({
  projectName,
  docs,
  onChange,
  /** 뽑아낸 글을 시나리오 칸에 **덧붙입니다.** 이미 적어 둔 글을 지우지 않습니다. */
  onText,
  disabled,
}: {
  projectName: string;
  docs: BootstrapDoc[];
  onChange: (next: BootstrapDoc[]) => void;
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const take = async (files: File[]) => {
    if (!files.length || disabled) return;
    if (!projectName.trim()) {
      toast.error("먼저 제목을 적어 주세요.", {
        description: "프로젝트 폴더가 있어야 원본 문서를 둘 자리가 생깁니다.",
      });
      return;
    }
    const made: BootstrapDoc[] = [];
    const chunks: string[] = [];
    for (const file of files) {
      setBusy(file.name);
      try {
        /*
          **읽기가 먼저입니다.** 저장부터 하면 못 읽는 파일(.hwp 등)이 DOCU 에 쌓이는데,
          그것은 앱이 쓰지 않는 파일이라 사람이 나중에 왜 거기 있는지 알 수 없습니다.
        */
        const doc = await readDocumentText(file);
        if (!doc.text.trim()) {
          toast.error(`${file.name} 에서 글을 찾지 못했습니다.`, {
            description: "그림만 있는 스캔본이면 글자가 없습니다 — 글이 든 PDF 로 넣어 주세요.",
          });
          continue;
        }
        const dot = file.name.lastIndexOf(".");
        const stem = dot > 0 ? file.name.slice(0, dot) : file.name;
        const saved = await saveProjectMediaAsset(file, {
          projectName,
          assetType: "document",
          // 주인(인물·장소)이 없는 갈래입니다 — Rust 가 빈 주인이면 한 층 건너뜁니다.
          ownerName: "",
          stem,
        });
        /*
          저장이 안 돼도 **글은 넣습니다.** 브라우저로 열었거나 저장 폴더를 아직 안 정했으면
          `null` 이 옵니다. 그때 통째로 거절하면 「PDF 를 올렸는데 아무 일도 안 일어난다」 가
          됩니다 — 원본을 못 둘 뿐이지 읽는 데는 지장이 없습니다.
        */
        made.push({
          id: `doc_${Date.now()}_${made.length}`,
          path: saved?.path ?? "",
          name: file.name,
          chars: doc.text.length,
          pages: doc.pages,
        });
        /*
          **어느 파일에서 온 글인지 이름을 답니다.**

          시나리오와 인물 설정집을 같이 넣는 일이 흔한데, 그냥 이어 붙이면 어디서 문서가
          바뀌는지 LLM 도 사람도 못 봅니다. 「대본에서는 이름이 여울인데 설정집에서는
          유월」 같은 어긋남을 잡으려면 어느 쪽 말인지가 보여야 합니다.
        */
        chunks.push(`### ${file.name}

${doc.text}`);
        toast.success(describeDocument(file.name, doc), {
          description: "시나리오 칸에 글을 넣었습니다. 쪽번호·머리말이 섞였으면 지우고 만드세요.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `${file.name} 을(를) 읽지 못했습니다.`);
      }
    }
    setBusy(null);
    if (made.length) onChange([...docs, ...made]);
    // 파일마다 이름이 머리글로 붙어 있으므로(위) 사이는 빈 줄 하나면 갈립니다.
    if (chunks.length) onText(chunks.join("\n\n"));
  };

  const remove = (id: string) => {
    /*
      목록에서만 뺍니다 — **DOCU 의 원본은 지우지 않습니다.**

      규칙 3(화면에서 지우면 폴더의 원본도 지움)은 «그 파일이 곧 그 카드» 인 그림·영상의
      규칙입니다. 여기서는 이미 글을 뽑아 시나리오 칸에 부어 놓았고, 칩을 빼는 뜻은
      「이 목록에서 치우자」 이지 「원본을 버리자」 가 아닙니다. 원본까지 지우면 뽑은 글이
      어디서 왔는지 되짚을 길이 사라집니다. 파일은 «폴더 열기» 로 직접 지울 수 있습니다.
    */
    onChange(docs.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold" style={{ color: "oklch(0.84 0.01 265)" }}>
          시나리오 파일 (선택)
        </span>
        <span className="text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          PDF · 워드(.docx) · 텍스트 — 글을 뽑아 위 칸에 넣고, 원본은 «DOCU» 폴더에 둡니다
        </span>
      </div>

      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => picker.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void take(Array.from(event.dataTransfer.files));
        }}
        className="flex w-full items-center justify-center gap-2 rounded-md py-4 text-[11px] disabled:opacity-40"
        style={{
          ...fieldStyle,
          border: `1px dashed ${over ? "oklch(0.72 0.18 300 / 70%)" : "oklch(1 0 0 / 14%)"}`,
          background: over ? "oklch(0.55 0.16 300 / 12%)" : fieldStyle.background,
          color: "oklch(0.60 0.01 265)",
        }}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            «{busy}» 읽는 중…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            여기로 끌어다 놓거나 눌러서 고르기 — PDF · 워드 · 텍스트
          </>
        )}
      </button>
      <input
        ref={picker}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void take(Array.from(event.target.files || []));
          // 같은 파일을 다시 고를 수 있게 비웁니다 — 안 비우면 두 번째 선택이 안 먹습니다.
          event.target.value = "";
        }}
      />

      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {docs.map((doc) => (
            <span
              key={doc.id}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px]"
              style={{
                background: "oklch(0.55 0.15 200 / 18%)",
                color: "oklch(0.84 0.10 200)",
              }}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <button
                type="button"
                title={`${doc.path}\n누르면 저장된 자리를 엽니다`}
                onClick={() => void revealFile(doc.path)}
                className="max-w-[16rem] truncate underline-offset-2 hover:underline"
              >
                {doc.name}
              </button>
              <span style={{ color: "oklch(0.60 0.06 200)" }}>
                {doc.chars.toLocaleString("ko-KR")}자{doc.pages ? ` · ${doc.pages}쪽` : ""}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(doc.id)}
                title="목록에서만 뺍니다 — DOCU 폴더의 원본은 그대로 남습니다"
                className="shrink-0 opacity-60 hover:opacity-100 disabled:opacity-25"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
