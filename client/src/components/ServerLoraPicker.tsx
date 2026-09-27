import { useMemo, useState } from "react";
import { RefreshCw, Server, X } from "lucide-react";
import {
  isServerLora,
  refreshServerLoras,
  searchServerLoras,
  serverLoraKey,
  serverLoraLabel,
  serverLoraName,
  serverLorasFor,
  useServerLoras,
} from "@/lib/comfyLoras";
import type { LocalEngineId } from "@/lib/localEngines";

/** 펼친 목록에 한 번에 보이는 줄 수 — 405개를 다 그리면 카드가 끝없이 길어집니다. */
const SHOWN = 40;

/**
 * **사내 ComfyUI 의 로라 고르기** — `LoraPicker` 옆에 붙습니다. 원격으로 도는 엔진일 때만 뜹니다.
 *
 * 고른 것은 `comfy:<서버 경로>` 로 같은 `picked` 목록에 들어갑니다(로컬 것은 파일 경로라 안 겹침).
 * 기본으로 보이는 것은 **폴더로 이 엔진에 맞다고 본 것**이고, 검색하면 서버의 전부에서 찾습니다.
 */
export default function ServerLoraPicker({
  engine,
  picked,
  onChange,
  disabled,
}: {
  engine: LocalEngineId;
  picked: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { names, loading, error } = useServerLoras(true);

  const suited = useMemo(() => serverLorasFor(engine, names), [engine, names]);
  const shown = useMemo(
    () => (query.trim() ? searchServerLoras(names, query) : suited),
    [names, query, suited],
  );
  const chosen = picked.filter(isServerLora);

  const toggle = (name: string) => {
    const key = serverLoraKey(name);
    onChange(picked.includes(key) ? picked.filter((item) => item !== key) : [...picked, key]);
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(serverLoraName(key))}
            title={`사내 ComfyUI · ${serverLoraName(key)} — 눌러서 빼기`}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium disabled:opacity-40"
            style={{
              background: "oklch(0.62 0.16 230 / 18%)",
              border: "1px solid oklch(0.62 0.16 230 / 45%)",
              color: "oklch(0.84 0.10 230)",
            }}
          >
            <Server className="h-2.5 w-2.5" />
            {serverLoraLabel(serverLoraName(key))}
            <X className="h-2.5 w-2.5" />
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          title="사내 ComfyUI 서버에 있는 로라에서 고릅니다. 이 컴퓨터에 받아 두지 않아도 됩니다."
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-white/10 disabled:opacity-40"
          style={{ color: "oklch(0.70 0.08 230)" }}
        >
          <Server className="h-3 w-3" /> 서버 로라{suited.length ? ` ${suited.length}` : ""}
        </button>
      </div>

      {open && (
        <div
          className="space-y-1.5 rounded-md p-2"
          style={{ background: "oklch(0.18 0.01 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <div className="flex items-center gap-1.5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`서버 로라 ${names.length}개에서 찾기`}
              className="min-w-0 flex-1 rounded px-2 py-1 text-[11px] outline-none"
              style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.9 0 0)" }}
            />
            <button
              type="button"
              onClick={() => void refreshServerLoras()}
              title="서버에 다시 묻습니다"
              className="rounded p-1 hover:bg-white/10"
              style={{ color: "oklch(0.6 0.01 265)" }}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="text-[10px]" style={{ color: "oklch(0.58 0.01 265)" }}>
            {query.trim()
              ? `서버 전체에서 ${shown.length}개 — 이 엔진에 맞는지는 이름으로만 판단하세요.`
              : `이 엔진 폴더에 있는 것 ${suited.length}개(폴더로 고름 · 속도용·편집용은 뺌). 세기는 1 로 겁니다.`}
          </p>
          {error && (
            <p className="text-[10px]" style={{ color: "oklch(0.75 0.14 30)" }}>
              {error}
            </p>
          )}
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {shown.slice(0, SHOWN).map((name) => {
              const on = picked.includes(serverLoraKey(name));
              return (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[10px] hover:bg-white/5"
                  title={name}
                  style={{ color: on ? "oklch(0.86 0.10 230)" : "oklch(0.7 0.01 265)" }}
                >
                  <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(name)} />
                  <span className="truncate">{serverLoraLabel(name)}</span>
                  <span className="ml-auto shrink-0 truncate opacity-50">{name.includes("/") ? name.split("/")[0] : ""}</span>
                </label>
              );
            })}
            {shown.length > SHOWN && (
              <p className="px-1 text-[10px]" style={{ color: "oklch(0.55 0.01 265)" }}>
                {shown.length - SHOWN}개 더 있습니다 — 검색어를 좁혀 주세요.
              </p>
            )}
            {!loading && !shown.length && !error && (
              <p className="px-1 text-[10px]" style={{ color: "oklch(0.55 0.01 265)" }}>
                {query.trim() ? "맞는 이름이 없습니다." : "이 엔진 폴더에는 로라가 없습니다. 검색하면 전체에서 찾습니다."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
