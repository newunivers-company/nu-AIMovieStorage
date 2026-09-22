import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BackgroundCard } from "@/components/project/StepBackgrounds";
import type { Background } from "@/lib/projectTypes";

/**
 * 구도잡기 안에서 여는 **장소 카드**.
 *
 * 배경은 결국 구도잡기에서 쓰려고 만드는 것이라, 만드는 자리를 여기로 끌어왔습니다. 방을 세우고 → 그 방에서 전개도(실외면
 * 파노라마)를 뽑고 → 고르면 바로 6면으로 들어갑니다. 씬 탭에서 미리 만들어 두는 것보다 나은 까닭은 순서입니다 — 인물을
 * 먼저 배치해 공간 크기를 눈으로 본 뒤, 그 크기를 기준으로 전개도를 뽑을 수 있습니다.
 *
 * # 카드를 다시 만들지 않습니다
 *
 * 프롬프트·분석·레퍼런스·자동 6면 커팅은 이미 장소 카드(`BackgroundCard`)가 전부 합니다. 구도잡기용으로 비슷한 것을 새로 짜면
 * 규칙 하나 고칠 때 두 곳을 고쳐야 하고, 한쪽만 고치면 «씬 탭에서 만든 장소와 구도잡기에서 만든 장소가 다른 것» 이 됩니다
 * (공통 규칙 1). 그래서 **같은 카드를 창에 띄웁니다** — 인물 시트 창이 캐릭터·배경 공용인 것과 같은 방식입니다.
 *
 * 카드가 쓰는 프로젝트 폴더·표시는 `ProjectMediaContext` 에서 옵니다. 구도잡기는 컷 카드 안에 있으므로 그 문맥이 그대로 닿습니다.
 */
export function RoomPlaceDialog({
  background,
  roomName,
  open,
  onOpenChange,
  onPatch,
  onRemove,
  placeScope,
}: {
  background: Background | null;
  /** 창 제목에 «방 1 의 장소» 라고 적어 어느 방의 것인지 알립니다. */
  roomName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (updater: (current: Background) => Partial<Background>) => void;
  onRemove: () => void;
  /** 이 카드가 무엇을 뽑는 카드인가 — 실내 방·실외 돔·벽 그림. 카드를 그 일에 맞게 좁힙니다. */
  placeScope?: "room" | "dome" | "wall" | "special";
}) {
  if (!background) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] max-w-[1100px] overflow-y-auto"
        style={{ background: "oklch(0.12 0.008 265)", border: "1px solid oklch(1 0 0 / 10%)" }}
      >
        <DialogTitle className="text-sm text-white">
          {roomName} 의 장소 — {background.name || "이름 없는 장소"}
        </DialogTitle>
        <p className="mb-2 text-[10px] leading-relaxed" style={{ color: "oklch(0.50 0.01 265)" }}>
          여기서 뽑은 전개도(실외는 파노라마)를 카드에 등록하면 <b>자동으로 여섯 면이 잘려</b> 이 방에 걸립니다. 방 크기는 이미 카드에
          적혀 있어 손으로 다시 적지 않습니다 — 구도잡기에서 인물을 놓고 본 그 크기 그대로입니다.
        </p>
        {/*
          카드는 늘 펼친 채로 띄웁니다 — 창을 열었다는 것이 이미 «이 장소를 만지겠다» 는 뜻이라, 접힌 카드를 한 번 더 누르게 할
          까닭이 없습니다.
        */}
        <BackgroundCard
          background={background}
          placeScope={placeScope}
          open
          onToggle={() => undefined}
          onPatch={onPatch}
          onRemove={() => {
            onRemove();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default RoomPlaceDialog;
