import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ConfirmDialog";
import { isDesktopApp } from "@/lib/llm";
import { chooseStorageDirectory } from "@/lib/mediaLibrary";
import {
  PROMPT_LIBRARY_LABELS,
  downloadPromptDocument,
  choosePromptLibraryFile,
  exportPromptLibrary,
  importPromptLibrary,
  promptBaseDirectory,
  promptExportDirectory,
  savePromptLibraryBundle,
  setExportFolder,
  listPromptDocumentsForEditing,
  resetPromptLibrary,
  savePromptDocument,
  type PromptDocument,
  type PromptLibraryKind,
} from "@/lib/promptLibrary";

/**
 * 가이드 문서 관리.
 *
 * # 왜 앱 안에서 고치게 하는가
 *
 * 요청 문구와 모델·플랫폼·기법 가이드는 폴더의 md 파일입니다. 편집기로 열어
 * 고쳐도 되지만, **어느 파일이 어느 버튼에 붙는지**는 폴더만 봐서는 모릅니다.
 * 「캐릭터 시트 프롬프트가 이상하다」 → 어떤 md 를 고쳐야 하는지 찾는 데
 * 매번 시간이 걸렸어요. 여기서는 갈래별로 묶여 있어 바로 찾습니다.
 *
 * 폴더를 안 정했으면 앱에 심어 둔 기본 문구를 보여 줍니다. 그때는 저장이
 * 안 되므로 그렇다고 말해 줍니다 — 고쳐 놓고 사라지는 것이 제일 나쁩니다.
 */

const KINDS: PromptLibraryKind[] = [
  "requests",
  "models",
  "platforms",
  "techniques",
];

export default function PromptLibraryPanel() {
  const [kind, setKind] = useState<PromptLibraryKind>("requests");
  const [documents, setDocuments] = useState<PromptDocument[]>([]);
  const [openName, setOpenName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [folder, setFolder] = useState("");
  const [exportFolder, setExportFolderState] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = (next: PromptLibraryKind) => {
    // «직접 지정한 값» 이 아니라 실제로 쓰이는 자리를 봅니다. 문구 폴더는
    // 기본 저장 폴더에서 갈라지므로, 정상 상태에서도 직접 지정값은 비어 있습니다.
    setFolder(promptBaseDirectory());
    setExportFolderState(promptExportDirectory());
    void listPromptDocumentsForEditing(next)
      .then(({ documents: list }) => {
        setDocuments(list);
        // 갈래를 바꾸면 열어 둔 문서도 그 갈래의 첫 번째로 옮깁니다.
        const first = list[0]?.fileName ?? null;
        setOpenName(first);
        setDraft(list[0]?.contents ?? "");
      })
      .catch(() => {
        setDocuments([]);
        setOpenName(null);
        setDraft("");
      });
  };

  useEffect(() => refresh(kind), [kind]);

  const open = documents.find((item) => item.fileName === openName);

  /**
   * 고른 파일을 되살립니다. 대화상자로 고르든 파일 입력으로 고르든
   * 여기 한 곳을 지납니다 — 확인 문구가 두 갈래로 갈라지면 안 됩니다.
   */
  const applyBundle = async (name: string, text: string) => {
    const ok = await confirmDialog({
      title: `${name} 을 되살릴까요?`,
      description:
        "파일에 든 문서가 지금 폴더의 같은 이름 문서를 덮어씁니다. 파일에 없는 문서는 그대로 둡니다.",
      confirmLabel: "되살리기",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const count = await importPromptLibrary(JSON.parse(text));
      toast.success(`문서 ${count}개를 되살렸습니다.`);
      refresh(kind);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const pickAndImport = async () => {
    try {
      const picked = await choosePromptLibraryFile(exportFolder);
      // 데스크톱이 아니면 예전처럼 파일 입력으로 물러섭니다.
      if (!picked) {
        if (!isDesktopApp()) fileRef.current?.click();
        return;
      }
      const name = picked.path.split(/[\/]/).pop() || "파일";
      await applyBundle(name, picked.contents);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const save = async () => {
    if (!open) return;
    if (!folder) {
      toast.error(
        "먼저 위에서 프롬프트 문구 폴더를 정해 주세요. 폴더가 없으면 저장할 곳이 없습니다.",
      );
      return;
    }
    try {
      await savePromptDocument(kind, open.fileName, draft);
      toast.success(`${open.fileName}.md 를 저장했습니다.`);
      refresh(kind);
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <div className="space-y-3">
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "oklch(0.45 0.01 265)" }}
      >
        요청 문구와 가이드는 폴더의 md 파일입니다. 여기서 고치면 그 파일이
        바뀌고, 다음 요청부터 바로 반영됩니다. <b>내보낸 json 은 그때의 사본</b>
        이라, 뒤에 고친 것은 다시 내보내야 담깁니다.
        {!folder && (
          <>
            {" "}
            <b style={{ color: "oklch(0.80 0.12 60)" }}>
              폴더를 정하지 않아 지금은 앱에 심어 둔 기본 문구를 보고 있습니다 —
              저장은 안 됩니다.
            </b>
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((id) => {
          const on = id === kind;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
              style={{
                background: on
                  ? "oklch(0.62 0.22 290 / 20%)"
                  : "oklch(1 0 0 / 5%)",
                border: `1px solid ${on ? "oklch(0.62 0.22 290 / 45%)" : "oklch(1 0 0 / 8%)"}`,
                color: on ? "oklch(0.86 0.16 290)" : "oklch(0.58 0.01 265)",
              }}
            >
              {PROMPT_LIBRARY_LABELS[id]}
            </button>
          );
        })}
        <span className="min-w-0 flex-1" />
        {/*
          내보내기·불러오기가 「기본값으로」 왼쪽에 있는 이유.
          되돌리기는 **고쳐 놓은 것을 지우는** 버튼입니다. 그 옆에 «먼저
          받아 두는 길» 이 나란히 있어야 실수로 날리는 일이 줄어듭니다.
        */}
        <button
          type="button"
          onClick={async () => {
            try {
              const where = await savePromptLibraryBundle(
                await exportPromptLibrary(),
                exportFolder,
              );
              toast.success(`문구 전체를 내보냈습니다. ${where}`);
            } catch (error) {
              toast.error(String(error));
            }
          }}
          title="네 갈래의 문서를 json 한 장에 담아 아래 자리에 저장합니다"
          className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            background: "oklch(1 0 0 / 6%)",
            color: "oklch(0.72 0.14 200)",
          }}
        >
          <Download className="mr-1 inline h-3 w-3" /> 전체 내보내기
        </button>
        <button
          type="button"
          onClick={() => void pickAndImport()}
          title="내보낸 json 을 골라 그대로 되살립니다. 위 «내보낼 자리» 에서 열립니다"
          className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            background: "oklch(1 0 0 / 6%)",
            color: "oklch(0.72 0.14 200)",
          }}
        >
          <Upload className="mr-1 inline h-3 w-3" /> 불러오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            // 같은 파일을 다시 고를 수 있게 비워 둡니다.
            event.target.value = "";
            if (!file) return;
            await applyBundle(file.name, await file.text());
          }}
        />
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmDialog({
              title: `${PROMPT_LIBRARY_LABELS[kind]} 를 기본값으로 되돌릴까요?`,
              description:
                "손으로 고친 내용이 앱의 기본 문구로 덮어써집니다. 되돌릴 수 없습니다 — 필요하면 먼저 «전체 내보내기» 로 받아 두세요.",
              confirmLabel: "되돌리기",
              tone: "danger",
            });
            if (!ok) return;
            const count = await resetPromptLibrary(kind).catch(() => 0);
            if (!count) {
              toast.error("되돌릴 폴더가 설정돼 있지 않습니다.");
              return;
            }
            toast.success(
              `${PROMPT_LIBRARY_LABELS[kind]} ${count}개를 기본값으로 되돌렸습니다.`,
            );
            refresh(kind);
          }}
          title="손으로 고친 문구를 앱의 최신 기본값으로 덮어씁니다"
          className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            background: "oklch(1 0 0 / 6%)",
            color: "oklch(0.70 0.14 60)",
          }}
        >
          <RotateCcw className="mr-1 inline h-3 w-3" /> 기본값으로
        </button>
      </div>

      {/*
        내보낼 자리를 보여 주고 바꾸게 둡니다.
        예전에는 브라우저 다운로드로 떨어뜨렸는데, 어디로 갔는지 앱이 모르니
        되살릴 때 그 파일을 다시 찾아 헤매야 했습니다. 기본은 문구 폴더 안의
        `user` 입니다 — 앱이 깔아 주는 기본 md 와 섞이지 않는 자리입니다.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="shrink-0 text-[10px] font-semibold"
          style={{ color: "oklch(0.52 0.01 265)" }}
        >
          내보낼 자리
        </span>
        <p
          className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-[10px]"
          style={{
            background: "oklch(0.11 0.008 265)",
            border: "1px solid oklch(1 0 0 / 8%)",
            color: exportFolder
              ? "oklch(0.70 0.01 265)"
              : "oklch(0.42 0.01 265)",
          }}
          title={exportFolder}
        >
          {exportFolder || "기본 저장 폴더를 먼저 정해 주세요"}
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              // 지금 잡힌 자리에서 엽니다.
              const picked = await chooseStorageDirectory(exportFolder);
              if (!picked) return;
              setExportFolder(picked);
              setExportFolderState(picked);
              toast.success("내보낼 자리를 바꿨습니다.");
            } catch {
              toast.error("데스크톱 앱에서 폴더를 선택해 주세요.");
            }
          }}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
          style={{
            background: "oklch(1 0 0 / 6%)",
            color: "oklch(0.72 0.01 265)",
          }}
        >
          바꾸기
        </button>
        <button
          type="button"
          onClick={() => {
            setExportFolder("");
            setExportFolderState(promptExportDirectory());
            toast.success("기본 자리로 되돌렸습니다.");
          }}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
          style={{
            background: "oklch(1 0 0 / 6%)",
            color: "oklch(0.70 0.14 60)",
          }}
        >
          기본 자리로
        </button>
      </div>

      {/*
        새 문서 만들기. (지시 97 「추가 및 수정 가능하도록」)

        예전에는 고치기만 되고 새로 만들 길이 없어서, 문서를 늘리려면
        탐색기로 폴더를 열어 md 를 직접 넣어야 했습니다.
      */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!folder}
          title={
            !folder ? "폴더를 먼저 정해야 문서를 만들 수 있습니다" : undefined
          }
          onClick={async () => {
            const name = window.prompt(
              `새 ${PROMPT_LIBRARY_LABELS[kind]} 문서 이름 (확장자 없이)`,
              "",
            );
            const fileName = name?.trim();
            if (!fileName) return;
            if (documents.some((item) => item.fileName === fileName)) {
              toast.error("같은 이름의 문서가 이미 있습니다.");
              return;
            }
            try {
              // 머리말을 미리 넣어 둡니다. 이 앱은 id·label 로 문서를 찾습니다.
              await savePromptDocument(
                kind,
                fileName,
                `---
id: ${fileName}
label: ${fileName}
---

`,
              );
              refresh(kind);
              toast.success(
                `${fileName}.md 를 만들었습니다. 목록에서 골라 적으세요.`,
              );
            } catch (error) {
              toast.error(String(error));
            }
          }}
          className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-35"
          style={{
            background: "oklch(0.62 0.22 290 / 18%)",
            color: "oklch(0.84 0.16 290)",
          }}
        >
          + 새 문서
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="text-[11px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          이 갈래에는 문서가 없습니다.
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-[13rem_1fr]">
          <div
            className="max-h-72 overflow-y-auto rounded-lg p-1"
            style={{
              background: "oklch(0.11 0.008 265)",
              border: "1px solid oklch(1 0 0 / 8%)",
            }}
          >
            {documents.map((item) => {
              const on = item.fileName === openName;
              return (
                <button
                  key={item.fileName}
                  type="button"
                  onClick={() => {
                    setOpenName(item.fileName);
                    setDraft(item.contents);
                  }}
                  className="block w-full truncate rounded px-2 py-1.5 text-left text-[11px]"
                  style={{
                    background: on
                      ? "oklch(0.62 0.22 290 / 18%)"
                      : "transparent",
                    color: on ? "oklch(0.86 0.16 290)" : "oklch(0.62 0.01 265)",
                  }}
                  title={item.meta.title || item.fileName}
                >
                  {item.fileName}.md
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              rows={14}
              className="w-full resize-y rounded-lg px-2.5 py-2 font-mono text-[11px] leading-relaxed outline-none"
              style={{
                background: "oklch(0.11 0.008 265)",
                border: "1px solid oklch(1 0 0 / 8%)",
                color: "oklch(0.82 0.01 265)",
              }}
            />
            <div className="flex items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate text-[10px]"
                style={{ color: "oklch(0.42 0.01 265)" }}
              >
                {open ? `${open.fileName}.md` : ""}
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (!open) return;
                  try {
                    const where = await downloadPromptDocument(
                      { ...open, contents: draft },
                      exportFolder,
                    );
                    toast.success(`내보냈습니다. ${where}`);
                  } catch (error) {
                    toast.error(String(error));
                  }
                }}
                disabled={!open}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] disabled:opacity-40"
                style={{
                  background: "oklch(1 0 0 / 5%)",
                  color: "oklch(0.70 0.01 265)",
                }}
              >
                <Download className="h-3 w-3" /> 내보내기
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!open || draft === open.contents}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white gradient-primary disabled:opacity-40"
              >
                <Save className="h-3 w-3" /> 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
