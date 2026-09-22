import { useRef, useState } from "react";
import { Loader2, PersonStanding, Upload } from "lucide-react";
import { toast } from "sonner";
import { poseFromImage } from "@/lib/poseFromImage";
import { assetSrc } from "@/lib/mediaLibrary";
import type { Vector3Value } from "@/lib/composition";

/**
 * **그림에서 포즈 가져오기** — 사진·그림 한 장을 끌어다 놓으면 인형이 그 자세가 됩니다.
 *
 * Sketch2Pose 의 방식을 실측으로 확인한 뒤 들여왔습니다 — 관절을 하나씩 손으로 잡는
 * 일이 가장 오래 걸려서, 시작 자세만이라도 그림에서 떠오면 시간이 크게 줄기 때문입니다.
 *
 * # 되는 것과 안 되는 것을 **미리** 적어 둡니다
 *
 * 실측(`scripts/runSketchPoseBench.mjs`)에서 **막대 인간은 못 읽습니다.** 검출기가
 * 사람 «사진» 으로 배웠기 때문입니다. 그런데 사람은 그걸 모르고 막대 그림부터 그려 봅니다.
 * 그래서 칸 옆에 **처음부터** 적어 둡니다 — 실패하고 나서 알려 주면 이미 늦습니다.
 *
 * | 넣으면 | 결과 |
 * | --- | --- |
 * | 사진·만화·실루엣 | 28~33/33 로 잘 잡힙니다 |
 * | 막대 인간(선) | **못 잡습니다** — 관절을 손으로 잡으세요 |
 */
export default function PoseFromImageField({
  gender,
  onPose,
  disabled,
  /** 이 프로젝트에 이미 있는 그림들 — 끌어다 놓기 말고 눌러서 고르는 길. */
  library,
}: {
  gender?: string;
  onPose: (bones: Record<string, Vector3Value>) => void;
  disabled?: boolean;
  library?: { name: string; filePath?: string; thumb?: string }[];
}) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const read = async (make: () => Promise<HTMLImageElement>) => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const pose = await poseFromImage(await make(), gender);
      onPose(pose.bones);
      /*
        **몇 개나 보였는지 같이 말합니다.** 포즈가 조금 이상해도 「20/33 만 보였다」 를
        알면 사람이 그림을 바꿔 다시 넣을지, 손으로 고칠지 스스로 정합니다.
      */
      toast.success(`포즈를 넣었습니다 — 관절 ${pose.seen}/33`, {
        description:
          pose.seen >= 30
            ? "온몸이 또렷하게 잡혔습니다. 어긋난 관절은 관절 판에서 고치세요."
            : "일부 관절은 가려서 짐작한 값입니다. 관절 판에서 확인해 주세요.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error), { duration: 10000 });
    } finally {
      setBusy(false);
    }
  };

  const fromFile = (file: File) =>
    read(
      () =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const image = new Image();
          image.onload = () => {
            // 다 읽은 뒤에 놓습니다 — 먼저 놓으면 큰 그림에서 중간에 끊깁니다.
            resolve(image);
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
          };
          image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`${file.name} 은(는) 그림이 아닙니다.`));
          };
          image.src = url;
        }),
    );

  const fromPath = (path: string, name: string) =>
    read(
      () =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          // 캔버스로 옮겨 읽어야 하므로 오염되지 않게 받습니다(`assetSrc` 규칙).
          image.crossOrigin = "anonymous";
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`${name} 을(를) 읽지 못했습니다.`));
          image.src = assetSrc(path) || path;
        }),
    );

  return (
    <div data-tour="layout-pose-from-image" className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-[11px] font-semibold" style={{ color: "oklch(0.84 0.14 300)" }}>
          그림에서 포즈 가져오기
        </span>
        <span className="text-[10px]" style={{ color: "oklch(0.45 0.01 265)" }}>
          사진 · 만화 · 실루엣 — <b style={{ color: "oklch(0.70 0.15 40)" }}>막대 인간은 못 읽습니다</b>
        </span>
      </div>

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => picker.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void fromFile(file);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-md py-3 text-[11px] disabled:opacity-40"
        style={{
          background: over ? "oklch(0.55 0.16 300 / 14%)" : "oklch(0.16 0.01 265)",
          border: `1px dashed ${over ? "oklch(0.72 0.18 300 / 70%)" : "oklch(1 0 0 / 14%)"}`,
          color: "oklch(0.62 0.01 265)",
        }}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 관절을 찾는 중…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" /> 그림을 끌어다 놓거나 눌러서 고르기
          </>
        )}
      </button>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void fromFile(file);
          // 같은 그림을 다시 고를 수 있게 비웁니다.
          event.target.value = "";
        }}
      />

      {/*
        프로젝트에 이미 있는 그림에서 바로 — 레퍼런스로 등록해 둔 인물 시트가
        대개 전신 정면이라 이 길에 가장 잘 맞습니다.
      */}
      {library && library.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {library.slice(0, 12).map((item) => (
            <button
              key={item.filePath || item.name}
              type="button"
              disabled={disabled || busy || !item.filePath}
              onClick={() => item.filePath && void fromPath(item.filePath, item.name)}
              title={`${item.name} — 이 그림의 포즈를 가져옵니다`}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] disabled:opacity-40"
              style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.72 0.10 300)" }}
            >
              <PersonStanding className="h-3 w-3 shrink-0" />
              <span className="max-w-[9rem] truncate">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
