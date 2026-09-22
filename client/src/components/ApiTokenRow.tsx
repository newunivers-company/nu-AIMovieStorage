import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { openExternal } from "@/lib/openExternal";

/**
 * **바깥 서비스의 키·토큰 한 줄** — 저장·끝 네 글자 보기·지우기.
 *
 * 허깅페이스 토큰 줄(`LocalEnginesPanel`)이 먼저 있었고, 2026-09-22 에 Civitai API 키가
 * 필요해지면서 같은 모양을 두 번 적을 뻔했습니다.
 * 규칙 1 — 한 벌로 두고 서비스 이름만 바꿔 씁니다. 값은 `llm.rs` 의 키 저장소(설정 폴더 파일)에
 * 들어가고 화면에는 끝 네 글자만 보입니다.
 */
export default function ApiTokenRow({
  provider,
  title,
  description,
  placeholder,
  prefix,
  link,
  onChanged,
}: {
  /** 키 저장소의 이름 — "civitai" | "huggingface" 처럼. Rust `read_api_key(provider)` 가 같은 이름으로 읽습니다. */
  provider: string;
  title: string;
  description: string;
  placeholder: string;
  /** 값이 이 글자로 시작해야 하면(허깅페이스 `hf_`). 아니면 잘못 붙인 것이라 막습니다. */
  prefix?: string;
  /** 키를 만드는 곳 — 「어디서 받나」 를 묻지 않게 바로 여는 단추. */
  link?: { label: string; url: string };
  /** 저장·지우기 뒤에 할 일(예: 떠 있는 워커를 내려 새 토큰을 물게). */
  onChanged?: () => Promise<void> | void;
}) {
  const [status, setStatus] = useState<{ saved: boolean; hint?: string | null } | null>(null);
  const [draft, setDraft] = useState("");
  const refresh = async () => {
    try {
      setStatus(await invoke<{ saved: boolean; hint?: string | null }>("get_api_key_status", { provider }));
    } catch {
      setStatus({ saved: false });
    }
  };
  useEffect(() => {
    void refresh();
    // provider 가 바뀌면 그 저장소의 상태를 다시 읽습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const save = async () => {
    const token = draft.trim();
    if (prefix && !token.startsWith(prefix)) {
      toast.error(`${title} 은(는) ${prefix} 로 시작합니다.`);
      return;
    }
    await invoke("save_api_key", { provider, key: token });
    setDraft("");
    await refresh();
    await onChanged?.();
    toast.success(`${title} 을(를) 저장했습니다.`);
  };

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "oklch(0.14 0.01 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold" style={{ color: "oklch(0.80 0.01 265)" }}>
          {title}
        </span>
        <span className="text-[10px]" style={{ color: status?.saved ? "oklch(0.75 0.14 160)" : "oklch(0.55 0.01 265)" }}>
          {status?.saved ? `저장됨 · …${status.hint ?? ""}` : "없음"}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed" style={{ color: "oklch(0.48 0.01 265)" }}>
        {description}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <input
          type="password"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && draft.trim() && void save()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md px-2 py-1 text-[11px] outline-none"
          style={{ background: "oklch(0.16 0.01 265)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.85 0.01 265)" }}
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => void save()}
          className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white gradient-primary disabled:opacity-40"
        >
          저장
        </button>
        {status?.saved && (
          <button
            type="button"
            onClick={async () => {
              await invoke("delete_api_key", { provider });
              await refresh();
              await onChanged?.();
            }}
            className="rounded-md px-2 py-1 text-[11px]"
            style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.70 0.12 25)" }}
          >
            지우기
          </button>
        )}
        {link && (
          <button
            type="button"
            onClick={() => void openExternal(link.url).catch((error) => toast.error(String(error)))}
            title={link.url}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
            style={{ background: "oklch(1 0 0 / 5%)", color: "oklch(0.72 0.13 250)" }}
          >
            <ExternalLink className="h-3 w-3" /> {link.label}
          </button>
        )}
      </div>
    </div>
  );
}
