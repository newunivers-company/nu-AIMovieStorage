import { useEffect, useState } from "react";
import ApiTokenRow from "@/components/ApiTokenRow";
import { confirmDialog } from "@/components/ConfirmDialog";
import { openExternal } from "@/lib/openExternal";
import { Download, ExternalLink, FolderOpen, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  civitaiFilterFor,
  civitaiKnowsEngine,
  clampLoraWeight,
  deleteLora,
  LORA_WEIGHT_RANGE,
  downloadLora,
  importLoras,
  loraItems,
  onLoraProgress,
  openLoraFolder,
  patchLora,
  searchLoras,
  type LoraHit,
  useLoraFiles,
} from "@/lib/localLoras";
import {
  LOCAL_ENGINE_CATALOG,
  LOCAL_ENGINE_IDS,
  LORA_STYLES,
  type LocalEngineId,
  type LoraStyle,
} from "@/lib/localEngines";

/**
 * **로라 서랍** — 엔진마다 찾고, 받고, 정리합니다.
 *
 * 로컬 모델에 먹일 로라를 엔진별·갈래별로 찾아 받고 한자리에 건사합니다.
 *
 * # 엔진마다 갈라 두는 까닭
 *
 * 로라는 **학습한 모델의 구조에 묶여** 있습니다. Wan 로라를 LTX 에 먹이면 「키가 안 맞는다」
 * 며 로딩이 통째로 실패하고, 그때는 생성이 아예 안 됩니다. 폴더가 갈려 있으면 고를 때
 * 실수할 자리가 없습니다.
 *
 * # 밑모델 이름을 미리 적어 두는 까닭
 *
 * Civitai 는 로라마다 **어느 밑모델용인지**를 적어 둡니다(「MiniMax H3」「Wan Video 2.2 I2V-A14B」).
 * 엔진별로 그 이름을 알고 있으면 판마다 «이 엔진 것» 을 가릴 수 있습니다. 이름은 짐작이 아니라
 * 검색 결과에서 모은 것입니다(`lib/localLoras.ts` 의 `CIVITAI_FILTER` 주석). Civitai 에 없는
 * 로라는 허깅페이스에 있어, 두 곳을 같이 찾고 결과마다 출처를 답니다.
 * «이 엔진 것만» 을 끄면 다른 엔진 것까지 보이지만 그건 이 엔진에 안 맞습니다.
 */

// 엔진 → Civitai 그물은 `lib/localLoras.ts` 의 `CIVITAI_FILTER` 한 벌입니다(규칙 하나에 두 벌을 두지 않으려고 옮겼습니다).
const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`;

export default function LoraLibraryPanel() {
  const files = useLoraFiles();
  // 카탈로그의 키가 아니라 «이 빌드에 실린» 목록에서 고릅니다 — 공개판에서 빠진 엔진은 서랍에도 없어야 합니다.
  const engineIds = LOCAL_ENGINE_IDS.filter(
    (id) => LOCAL_ENGINE_CATALOG[id].kind === "image" || LOCAL_ENGINE_CATALOG[id].kind === "video",
  );
  const [engine, setEngine] = useState<LocalEngineId>(engineIds[0]);
  const [query, setQuery] = useState("");
  /** 밑모델 그물을 걸까. 켜 두면 이 엔진에 맞는 것만 — 다만 아무것도 안 나올 수 있습니다. */
  const [narrow, setNarrow] = useState(true);
  const [hits, setHits] = useState<LoraHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => onLoraProgress((event) => setStatus(event.done ? "" : event.message)), []);

  const mine = loraItems(files, engine);
  const have = new Set(mine.map((item) => item.fileName));

  const find = async () => {
    setSearching(true);
    try {
      setHits(await searchLoras(query, narrow ? civitaiFilterFor(engine) : undefined));
    } catch (error) {
      toast.error(String(error));
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const take = async (hit: LoraHit) => {
    setBusy(hit.id);
    try {
      // 권장 세기가 있으면 그걸로 받습니다 — 1 은 «원래 세기» 지, 알맞은 세기가 아닙니다.
      const weight = hit.advisedWeight ? clampLoraWeight(hit.advisedWeight) : undefined;
      await downloadLora(engine, hit.downloadUrl, hit.fileName, {
        source: hit.pageUrl,
        trigger: hit.trigger,
        name: hit.name,
        weight,
      });
      toast.success(`${hit.name} 을(를) 받았습니다.`, {
        description: [
          hit.trigger
            ? `불러오는 말: ${hit.trigger} — 프롬프트에 넣어야 먹습니다.`
            : "프롬프트에 «불러오는 말» 이 필요한 로라도 있습니다.",
          weight
            ? `세기는 만든 사람이 권장한 ${weight} 로 놓았습니다.`
            : "권장 세기가 소개에 안 적혀 있습니다 — 소개 쪽을 보고 세기를 맞추세요.",
        ].join(" "),
        duration: 10000,
      });
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy("");
      setStatus("");
    }
  };

  /**
   * 규칙 3 — 화면에서 지우면 폴더의 원본도 지웁니다. 되돌릴 수 없으니 반드시 한 번 묻고,
   * 받아 둔 목록의 휴지통과 검색 결과의 「지우기」 가 **이 하나**를 씁니다 — 로라는 한 장씩
   * 지울 수 있어야 하는데, 지우는 길이 둘이면 한쪽만 원본을 남깁니다.
   */
  const remove = async (fileName: string, name: string) => {
    const ok = await confirmDialog({
      title: `${name} 을(를) 지울까요?`,
      subject: fileName,
      description: "저장 폴더의 원본 파일도 함께 지워집니다. 되돌릴 수 없습니다.",
      confirmLabel: "지우기",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteLora(engine, fileName);
      toast.success(`${name} 을(를) 지웠습니다.`);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const box = {
    background: "oklch(0.11 0.007 265)",
    border: "1px solid oklch(1 0 0 / 10%)",
    color: "oklch(0.84 0.01 265)",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={engine}
          onChange={(event) => {
            setEngine(event.target.value as LocalEngineId);
            setHits(null);
          }}
          className="rounded-md px-2 py-1.5 text-[11px] outline-none"
          style={box}
        >
          {engineIds.map((id) => (
            <option key={id} value={id}>
              {LOCAL_ENGINE_CATALOG[id].name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() =>
            void importLoras(engine).then((count) => count && toast.success(`${count}개를 폴더에 넣었습니다.`))
          }
          title="브라우저로 직접 받아 둔 파일을 이 엔진 폴더로 들입니다"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
          style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.78 0.14 160)" }}
        >
          <Upload className="h-3 w-3" /> 파일 고르기
        </button>
        <button
          type="button"
          onClick={() => void openLoraFolder(engine)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold"
          style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.62 0.01 265)" }}
        >
          <FolderOpen className="h-3 w-3" /> 폴더 열기
        </button>
      </div>

      {/* ── 받아 둔 것 ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold" style={{ color: "oklch(0.72 0.01 265)" }}>
          받아 둔 로라 {mine.length}개
        </p>
        {!mine.length && (
          <p className="text-[10px]" style={{ color: "oklch(0.44 0.01 265)" }}>
            아직 없습니다. 아래에서 찾아 받거나 «파일 고르기» 로 넣으세요.
          </p>
        )}
        {mine.map((item) => (
          <div
            key={item.path}
            className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5"
            style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 8%)" }}
          >
            <input
              // 세기 칸과 같은 까닭으로 처음값 입력입니다 — 통제값이면 다시 그릴 때 지운 글자가 파일
              // 이름으로 되살아나고 끝의 빈칸이 잘려 두 낱말 이름을 못 칩니다. 손을 떼면 정돈합니다.
              key={item.path}
              defaultValue={item.name}
              onChange={(event) => patchLora(item.path, { name: event.target.value })}
              onBlur={(event) => {
                event.target.value = item.name;
              }}
              className="min-w-0 flex-1 rounded px-2 py-1 text-[11px] outline-none"
              style={box}
            />
            {/* 갈래 — 화풍끼리는 섞이면 안 되므로 적어 둡니다. */}
            <select
              value={item.style ?? "other"}
              onChange={(event) => patchLora(item.path, { style: event.target.value as LoraStyle })}
              className="rounded px-1.5 py-1 text-[10px] outline-none"
              style={box}
            >
              {LORA_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
            <label
              className="flex items-center gap-1 text-[10px]"
              style={{ color: "oklch(0.55 0.01 265)" }}
              title="1 이 원래 세기. 소개에 권장 세기가 적혀 있으면 받을 때 그걸로 놓습니다 — 화풍 로라는 대개 1 미만이 알맞습니다."
            >
              세기
              <input
                type="number"
                min={LORA_WEIGHT_RANGE.min}
                max={LORA_WEIGHT_RANGE.max}
                step={0.05}
                // 통제값(value)이 아니라 처음값입니다 — 「0.」 처럼 치는 도중의 글자를 React 가
                // 숫자로 되돌리지 않게. 칠 때마다 저장하고, 빈 칸·엉뚱한 글자는 저장하지 않습니다.
                key={item.path}
                defaultValue={item.weight}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (event.target.value.trim() !== "" && Number.isFinite(next)) {
                    patchLora(item.path, { weight: clampLoraWeight(next) });
                  }
                }}
                onBlur={(event) => {
                  // 손을 떼면 저장된 값으로 정돈합니다(2.5 라 쳤으면 2, 비웠으면 원래 값).
                  event.target.value = String(item.weight);
                }}
                className="w-16 rounded px-1.5 py-1 text-[10px] outline-none"
                style={box}
              />
            </label>
            <label
              className="flex cursor-pointer items-center gap-1 text-[10px]"
              style={{ color: "oklch(0.55 0.01 265)" }}
              title="켜 두면 따로 고르지 않은 생성에 기본으로 들어갑니다"
            >
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(event) => patchLora(item.path, { enabled: event.target.checked })}
                className="h-3 w-3"
              />
              기본
            </label>
            <span className="text-[10px]" style={{ color: "oklch(0.40 0.01 265)" }}>
              {mb(item.sizeBytes)}
            </span>
            {/* 원본 쪽 바로가기 — 불러오는 말·예시 그림이 거기 있습니다. */}
            {item.source && (
              <button
                type="button"
                onClick={() => void openExternal(item.source!).catch((error) => toast.error(String(error)))}
                title={`원본 쪽을 엽니다${item.trigger ? ` · 불러오는 말: ${item.trigger}` : ""}`}
                className="rounded p-1 hover:bg-white/10"
                style={{ color: "oklch(0.72 0.13 250)" }}
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void remove(item.fileName, item.name)}
              title="지우기 — 폴더의 파일도 함께 지워집니다"
              className="rounded p-1 hover:bg-white/10"
              style={{ color: "oklch(0.70 0.14 25)" }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* ── 찾기 ───────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void find()}
            placeholder="찾을 로라 — 「dance」 「cinematic」 「anime style」"
            className="min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-[11px] outline-none"
            style={box}
          />
          <label className="flex items-center gap-1 text-[10px]" style={{ color: "oklch(0.55 0.01 265)" }}>
            <input
              type="checkbox"
              checked={narrow}
              onChange={(event) => setNarrow(event.target.checked)}
              className="h-3 w-3"
            />
            이 엔진 것만
          </label>
          <button
            type="button"
            onClick={() => void find()}
            disabled={searching}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-semibold text-white gradient-primary disabled:opacity-40"
          >
            {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            찾기
          </button>
        </div>

        {status && (
          <p className="text-[10px]" style={{ color: "oklch(0.72 0.14 290)" }}>
            {status}
          </p>
        )}

        {/*
          Civitai 에 갈래가 없는 엔진은 «이 엔진 것만» 을 켜도 이름에 든 낱말로만 거릅니다.
          말없이 두면 결과가 적거나 없을 때 «필터가 고장났나» 로 읽힙니다.
        */}
        {narrow && !civitaiKnowsEngine(engine) && (
          <p className="text-[10px]" style={{ color: "oklch(0.72 0.14 60)" }}>
            Civitai 에는 이 엔진의 갈래가 없습니다 — 이름·밑모델에{" "}
            {civitaiFilterFor(engine).keywords.map((word) => `「${word}」`).join(" ")} 가 든 것만 보여 줍니다.
            이 엔진 로라는 대개 Hugging Face 나 배포처에서 받아 «파일 고르기» 로 넣습니다.
          </p>
        )}

        {hits?.length === 0 && (
          <p className="text-[10px]" style={{ color: "oklch(0.44 0.01 265)" }}>
            {narrow
              ? civitaiKnowsEngine(engine)
                ? "이 엔진 갈래에서는 찾은 것이 없습니다. 검색어를 바꾸거나, «이 엔진 것만» 을 끄면 다른 엔진 것까지 보입니다(그건 이 엔진에 안 맞습니다)."
                : "이 엔진 이름이 든 로라가 없습니다. «이 엔진 것만» 을 끄면 다른 엔진 것까지 보이지만, 그건 이 엔진에 안 맞습니다."
              : "찾은 것이 없습니다. 검색어를 바꿔 보세요."}
          </p>
        )}

        {hits?.map((hit) => (
          <div
            key={hit.id}
            className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5"
            style={{ background: "oklch(0.115 0.008 265)", border: "1px solid oklch(1 0 0 / 7%)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold" style={{ color: "oklch(0.84 0.01 265)" }}>
                {hit.name}
              </p>
              <p className="truncate text-[10px]" style={{ color: "oklch(0.48 0.01 265)" }}>
                {/* 출처를 앞에 답니다 — 허깅페이스 것은 «불러오는 말» 이 없어 소개 쪽에서 봐야 합니다. */}
                <span style={{ color: hit.source === "huggingface" ? "oklch(0.78 0.14 60)" : "oklch(0.72 0.13 250)" }}>
                  {hit.source === "huggingface" ? "Hugging Face" : "Civitai"}
                </span>
                {" · "}
                {hit.baseModel || "밑모델 모름"} · {mb(hit.sizeBytes)} · 내려받기{" "}
                {hit.downloads.toLocaleString()}
                {hit.advisedWeight ? ` · 권장 세기 ${hit.advisedWeight}` : ""}
                {hit.trigger ? ` · 불러오는 말: ${hit.trigger}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void openExternal(hit.pageUrl).catch((error) => toast.error(String(error)))}
              title="원본 쪽을 엽니다 — 예시 그림과 쓰는 법이 있습니다"
              className="rounded p-1 hover:bg-white/10"
              style={{ color: "oklch(0.72 0.13 250)" }}
            >
              <ExternalLink className="h-3 w-3" />
            </button>
            {have.has(hit.fileName) ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[10px]" style={{ color: "oklch(0.74 0.14 160)" }}>
                  받아 둠
                </span>
                {/* 받아 둔 것을 여기서 바로 물릴 수 있게 — 목록까지 내려가 찾지 않아도 됩니다. */}
                <button
                  type="button"
                  onClick={() => void remove(hit.fileName, hit.name)}
                  title="지우기 — 폴더의 파일도 함께 지워집니다"
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold"
                  style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.70 0.14 25)" }}
                >
                  <Trash2 className="h-3 w-3" />
                  지우기
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void take(hit)}
                disabled={Boolean(busy)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-40"
                style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.78 0.16 290)" }}
              >
                {busy === hit.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                받기
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.44 0.01 265)" }}>
        로라는 <b>학습한 모델에 묶여</b> 있습니다 — 엔진이 다르면 로딩이 통째로 실패하므로 폴더를
        갈라 둡니다. <b>화풍 로라는 한 번에 하나</b>입니다(시네마틱과 애니를 겹치면 어느 쪽도
        아닌 결이 나옵니다). 로그인해야 받을 수 있는 것은 브라우저로 받아 «파일 고르기» 로
        넣으세요. 「불러오는 말」 이 있는 로라는 그 말을 <b>프롬프트에 적어야</b> 먹습니다.
      </p>

      {/*
        ── 로그인은 앱이 합니다 ─────────────────────────────────────────────
        Civitai 는 상당수 로라를 로그인한 계정에만
        내주고, 프로그램에 허용된 로그인은 API 키뿐입니다. 여기 한 번 넣어 두면 «받기» 마다 붙습니다.
        허깅페이스 토큰은 로컬 엔진 설정의 그 줄과 같은 저장소라 어느 쪽에서 넣어도 같습니다.
      */}
      <div className="grid gap-2 md:grid-cols-2">
        <ApiTokenRow
          provider="civitai"
          title="Civitai API 키"
          description="로그인이 필요한 로라를 받을 때 앱이 이 키로 대신 로그인합니다. civitai.com → 계정 설정 → API Keys 에서 만듭니다."
          placeholder="Civitai API 키"
          link={{ label: "키 만들기", url: "https://civitai.com/user/account" }}
        />
        <ApiTokenRow
          provider="huggingface"
          title="허깅페이스 토큰"
          description="승인이 필요한 저장소의 로라를 받을 때 씁니다(읽기 권한이면 됩니다)."
          placeholder="hf_…"
          prefix="hf_"
          link={{ label: "토큰 만들기", url: "https://huggingface.co/settings/tokens" }}
        />
      </div>
    </div>
  );
}
