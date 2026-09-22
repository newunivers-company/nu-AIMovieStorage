import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  INT8_FRACTION,
  LOCAL_ENGINE_CATALOG,
  PRECISION_HEADROOM,
  PRECISION_LADDER,
  clampPrecision,
  planPrecision,
  precisionOfRun,
  type EnginePrecision,
  type LocalEngineId,
} from "@/lib/localEngines";

/*
  정밀도 규칙이 **두 벌**이라 벌어진 일을 여기서 막습니다.

  모델을 어떤 정밀도로 올릴지는 워커(`src-tauri/resources/local/common.py`)가 정합니다 —
  앱이 nvidia-smi 로 읽은 값과 torch 가 보는 값이 다를 수 있고, 실제로 올리는 쪽이 torch 라서요.
  그런데 화면도 설치 단추 옆에 «이 기계에서 어떻게 돌지» 를 미리 적어야 해서, 같은 공식을
  `localEngines.ts` 에 옮겨 적어 두었습니다. 옮겨 적은 것은 어긋납니다 — 실제로 화면은
  「24 GB 면 원래 정밀도로 돕니다」 라고 적고 워커는 그 카드에서 int8 로 올리고 있었습니다.

  그래서 이 시험은 **파이썬 파일을 직접 읽어** 견줍니다. 한쪽만 고치면 여기서 멈춥니다.
  파이썬을 돌리지는 않습니다(엔진 환경이 따로 있고 torch 가 필요합니다) — 상수와 공식의
  «모양» 을 읽어 견주는 것으로 충분합니다.
*/

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = join(HERE, "../../../src-tauri/resources/local");
const COMMON_PY = readFileSync(join(WORKER_DIR, "common.py"), "utf8");

/** 워커 모듈은 `engines/<id>.py` 입니다(워커가 `engines.<id>` 로 불러옵니다). */
function engineSource(id: string): string {
  return readFileSync(join(WORKER_DIR, "engines", `${id}.py`), "utf8");
}

function pyNumber(text: string, name: string): number {
  const hit = new RegExp(`^${name}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`, "m").exec(text);
  if (!hit) throw new Error(`파이썬 쪽에서 ${name} 을 찾지 못했습니다`);
  return Number(hit[1]);
}

/** 파이썬 튜플/목록에 든 따옴표 낱말들. */
function pyStrings(text: string, name: string): string[] | null {
  const hit = new RegExp(`^${name}\\s*=\\s*[([]([^)\\]]*)[)\\]]`, "m").exec(text);
  if (!hit) return null;
  return [...hit[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** 이 엔진의 bf16 크기 — 모듈 상수이거나, 그림 엔진 셋처럼 `ImageEngine` 에 넘기는 인자입니다. */
function pythonBf16Gb(id: string): number | null {
  const text = engineSource(id);
  const konst = /^BF16_GB\s*=\s*([0-9]+(?:\.[0-9]+)?)/m.exec(text);
  if (konst) return Number(konst[1]);
  const arg = /bf16_gb=([0-9]+(?:\.[0-9]+)?)/.exec(text);
  return arg ? Number(arg[1]) : null;
}

/** 이 엔진이 실제로 올릴 수 있는 정밀도. 안 적었으면 사다리 전부입니다. */
function pythonSupported(id: string): EnginePrecision[] {
  return (pyStrings(engineSource(id), "SUPPORTED") as EnginePrecision[] | null) ?? [
    ...PRECISION_LADDER,
  ];
}

/**
 * 워커에서 정밀도를 고르는 엔진 — **파이썬 쪽이 기준**입니다.
 *
 * 그림 엔진 셋은 제 파일에서 고르지 않고 몸통(`engines/_image.py`)이 대신 고릅니다.
 * 그 길도 같은 한 곳(`common.plan_precision`)으로 갑니다.
 */
function enginesWithPrecision(): LocalEngineId[] {
  return readdirSync(join(WORKER_DIR, "engines"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".py") && !entry.name.startsWith("_"))
    .map((entry) => entry.name.slice(0, -3) as LocalEngineId)
    .filter((id) => {
      const text = engineSource(id);
      return (
        text.includes("common.plan_precision(") ||
        text.includes("from engines._image import ImageEngine")
      );
    });
}

const HEADROOM = pyNumber(COMMON_PY, "PRECISION_HEADROOM");
const INT8 = pyNumber(COMMON_PY, "INT8_FRACTION");

describe("정밀도 규칙 — 워커와 화면이 한 벌인가", () => {
  it("여유·절반 문턱이 워커와 같다", () => {
    expect(PRECISION_HEADROOM).toBe(HEADROOM);
    expect(INT8_FRACTION).toBe(INT8);
  });

  it("정밀도 사다리가 워커와 같다(차례까지)", () => {
    expect(pyStrings(COMMON_PY, "PRECISION_LADDER")).toEqual([...PRECISION_LADDER]);
  });

  /*
    상수만 견주면 «공식 자체» 가 바뀐 것은 못 잡습니다(예: 여유를 나누기에서 빼기로).
    그래서 판단하는 세 줄의 모양을 그대로 확인합니다.
  */
  it("워커가 정밀도를 고르는 세 줄의 모양이 그대로다", () => {
    expect(COMMON_PY).toContain("room = have / PRECISION_HEADROOM");
    expect(COMMON_PY).toContain("if room >= bf16_gb:");
    expect(COMMON_PY).toContain("elif room >= bf16_gb / INT8_FRACTION:");
  });

  it("VRAM 을 훑어도 화면의 셈이 워커의 규칙과 같다", () => {
    const sizes = [8, 10, 16, 19, 24, 32, 48, 124, 126];
    const vrams = [0, 4, 8, 12, 16, 24, 32, 48, 80, 96, 192];
    for (const bf16Gb of sizes) {
      for (const vramGb of vrams) {
        // 파이썬 쪽 규칙을 그 파일에서 읽은 상수로 다시 세운 기대값.
        const room = vramGb / HEADROOM;
        const expected =
          vramGb <= 0 ? "bf16" : room >= bf16Gb ? "bf16" : room >= bf16Gb / INT8 ? "int8" : "int4";
        expect(`${bf16Gb}GB 모델 · VRAM ${vramGb}GB → ${planPrecision(bf16Gb, vramGb)}`).toBe(
          `${bf16Gb}GB 모델 · VRAM ${vramGb}GB → ${expected}`,
        );
      }
    }
  });

  /*
    사람이 못 박은 값은 규칙보다 셉니다(다른 프로그램이 VRAM 을 쥐고 있을 때 손으로 내리는 길).
    그 길은 워커의 `plan_precision` 이 `requested != "auto"` 로 갈라 놓고, 화면은 `precisionPlanFor`
    가 같은 자리에서 갈라 놓습니다 — 여기서는 규칙 쪽이 그 값을 덮지 않는지만 봅니다.
  */
  it("GPU 를 못 읽으면 bf16 — 양자화가 오히려 느립니다", () => {
    expect(planPrecision(124, 0)).toBe("bf16");
    expect(COMMON_PY).toContain('wanted, why = "bf16", "GPU 없음"');
  });
});

describe("엔진 카탈로그 — 화면의 숫자가 워커의 숫자와 같은가", () => {
  const ids = enginesWithPrecision();

  /*
    양쪽에서 셉니다. 한 엔진만 빠뜨리면 그 엔진의 안내만 조용히 틀리는데, 읽어서는 못 찾습니다.
    - 워커가 정밀도를 고르는데 카탈로그에 bf16 크기가 없으면 → 화면 안내가 제 근거 없이 나갑니다.
    - 카탈로그에 적었는데 워커가 안 고르면 → 아무도 안 쓰는 숫자가 남아 나중에 믿게 됩니다.
  */
  it("정밀도를 고르는 엔진과 bf16 크기를 적은 엔진이 서로 같다", () => {
    const written = (Object.keys(LOCAL_ENGINE_CATALOG) as LocalEngineId[]).filter(
      (id) => LOCAL_ENGINE_CATALOG[id].needs.bf16Gb != null,
    );
    expect([...ids].sort()).toEqual([...written].sort());
    expect(ids.length).toBeGreaterThanOrEqual(9);
  });

  it("그림 엔진 셋의 몸통도 같은 한 곳에서 고른다", () => {
    expect(readFileSync(join(WORKER_DIR, "engines/_image.py"), "utf8")).toContain(
      "common.plan_precision(",
    );
  });

  it.each(ids)("%s — bf16 크기가 워커와 같다", (id) => {
    expect(LOCAL_ENGINE_CATALOG[id].needs.bf16Gb).toBe(pythonBf16Gb(id));
  });

  it.each(ids)("%s — 올릴 수 있는 정밀도가 워커와 같다", (id) => {
    const catalog = LOCAL_ENGINE_CATALOG[id].precisionModes ?? [...PRECISION_LADDER];
    expect(catalog).toEqual(pythonSupported(id));
  });

  it("bf16 으로 돌릴 VRAM 은 손으로 적지 않고 bf16 크기에서 나온다", () => {
    for (const id of ids) {
      const needs = LOCAL_ENGINE_CATALOG[id].needs;
      expect(needs.vramGb).toBeCloseTo((needs.bf16Gb as number) * PRECISION_HEADROOM, 6);
    }
  });

  it("줄일 수 있다고 적은 엔진은 워커에도 그 길이 있다", () => {
    for (const id of ids) {
      const engine = LOCAL_ENGINE_CATALOG[id];
      const canShrink = (engine.precisionModes ?? [...PRECISION_LADDER]).some(
        (mode) => mode !== "bf16",
      );
      // 줄이는 길이 없는 엔진(모듈러 파이프라인)은 «줄이면 이만큼» 을 적으면 안 됩니다 —
      // 적어 두면 화면이 「줄여서 돕니다」 라고 알리고 워커는 원본을 올립니다.
      // 다만 오프로드로 버티는 엔진은 «줄여서» 가 «흘려서» 라서 설명이 있어야 합니다.
      if (!canShrink && engine.needs.quantVramGb != null) {
        expect(engine.needs.quantNote).toMatch(/흘려/);
      }
    }
  });
});

describe("할 수 있는 정밀도로 내려 잡기", () => {
  it("워커와 같은 차례로 고른다 — 작은 쪽을 먼저", () => {
    expect(clampPrecision("int4", ["bf16", "int8"])).toBe("int8");
    expect(clampPrecision("int8", ["bf16"])).toBe("bf16");
    expect(clampPrecision("bf16", ["int8"])).toBe("int8");
    expect(clampPrecision("int8", ["bf16", "int8", "int4"])).toBe("int8");
  });

  it("워커에도 같은 도우미가 있다", () => {
    expect(COMMON_PY).toContain("def _nearest_precision(wanted, supported):");
    expect(COMMON_PY).toContain("for mode in order[start:] + list(reversed(order[:start])):");
  });

  it("H3 는 int4 를 고를 수 없어 int8 로 내려 잡는다", () => {
    // 24 GB 카드에서 규칙은 int4 를 고르지만, 이 엔진의 양자화는 torchao int8 뿐입니다.
    const engine = LOCAL_ENGINE_CATALOG.minimaxh3;
    const planned = planPrecision(engine.needs.bf16Gb as number, 24);
    expect(planned).toBe("int4");
    expect(clampPrecision(planned, engine.precisionModes)).toBe("int8");
  });
});

describe("실제로 올라간 정밀도 읽기", () => {
  it("워커가 보내는 칸 이름과 같다", () => {
    for (const field of ["precision", "precision_requested", "precision_why", "vram_gb"]) {
      expect(COMMON_PY).toContain(`"${field}":`);
    }
  });

  it("요청과 실제를 나눠 읽는다", () => {
    expect(
      precisionOfRun({
        precision: "int8",
        precision_requested: "int4",
        precision_why: "int4 로 가고 싶지만 이 엔진은 bf16·int8 까지입니다",
        vram_gb: 96,
      }),
    ).toEqual({
      requested: "int4",
      mode: "int8",
      why: "int4 로 가고 싶지만 이 엔진은 bf16·int8 까지입니다",
      vramGb: 96,
    });
  });

  it("이 값이 없던 시절의 결과는 null", () => {
    expect(precisionOfRun({ seed: 1 })).toBeNull();
    expect(precisionOfRun(null)).toBeNull();
  });
});
