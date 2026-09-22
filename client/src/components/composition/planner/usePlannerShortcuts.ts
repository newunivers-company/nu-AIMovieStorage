import { useEffect, type RefObject } from "react";
import { toast } from "sonner";
import { addMotionKeyAtIn, addPoseKeyIn, type UpdateComposition } from "@/lib/compositionEdit";
import { isTypingTarget } from "@/lib/isTypingTarget";
import type { CharacterComposition } from "@/lib/composition";

/**
 * **구도잡기 창 전체 단축키** — Ctrl+Z 되돌리기 · K 키 찍기 · 스페이스 재생.
 *
 * 2026-09-18 에 `CompositionPlanner.tsx` 에서 떼어 냈습니다. 셋 다 «창이 열려 있을 때만
 * window 에 귀를 대고, 글자를 치는 중이면 물러난다» 는 같은 뼈대라 한자리에 모아 두면
 * 하나를 고칠 때 나머지를 빠뜨리지 않습니다(규칙 1).
 *
 * 창이 닫혀 있으면 아무것도 안 답니다 — 이 창은 컷 카드마다 **항상 마운트**되어 있어서
 * (`open` 은 Dialog 에만 갑니다) 안 걸러 두면 작업실에 컷이 스무 개일 때 스페이스 한 번에
 * 리스너 스무 개가 동시에 반응합니다.
 */
export function usePlannerShortcuts({
  open,
  playing,
  setPlaying,
  undo,
  redo,
  setState,
  playheadRef,
  selectedTargetId,
  transformMode,
  activeBone,
  characters,
  targetNames,
}: {
  open: boolean;
  playing: boolean;
  setPlaying: (next: boolean) => void;
  undo: () => void;
  redo: () => void;
  setState: UpdateComposition;
  playheadRef: RefObject<number>;
  /** 지금 고른 인물·소품. 없으면 K 가 «먼저 고르세요» 로 안내합니다. */
  selectedTargetId: string;
  /** 기즈모 모드(1·2·3). K 가 어느 속성에 찍을지를 이것이 정합니다. */
  transformMode: "translate" | "rotate" | "scale";
  /** 관절 기즈모로 잡은 본. 있으면 K 가 자세 키입니다. */
  activeBone: string | null;
  characters: CharacterComposition[];
  targetNames: Record<string, string>;
}) {
  // Ctrl/Cmd+Z 되돌리기, Ctrl+Shift+Z(또는 Ctrl+Y) 다시 실행.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      // 입력란 안에서는 브라우저 기본 되돌리기를 그대로 둡니다. 까닭은 `isTypingTarget`.
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /*
    ── K — 고른 대상의 «지금 고른 속성» 에 키 ─────────────────────────────
    , 「첫 키만 k 로 찍는 건 아니야… 1초일 때 키프레임을 3초일
    때 그대로 둔 상태에서 4초까지 무빙을 주고 싶다면… 값이 달라지지 않으니까 자동으로
    키프레임이 안 찍히잖아. 그때 k 로 키프레임 찍는 거지」.

    속성은 **기즈모 모드**(1·2·3)가 정합니다. 따로 고르게 하면 «회전 기즈모를 잡고 있는데
    이동에 키가 찍히는» 어긋남이 생깁니다. 찍는 값은 **화면에 보이는 그 시각의 자세**입니다
    (`addMotionKeyAtIn`) — 자세를 그대로 붙잡아 두는 키가 K 의 가장 흔한 쓰임이라서요.

    재생 중에는 안 받습니다 — 재생은 트랙이 대상을 움직이는 중이라 그 값을 키로 적으면
    움직이던 자리가 굳습니다. 글자를 치는 중에도 안 받습니다.
  */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyK" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (playing) return;
      event.preventDefault();
      if (!selectedTargetId) {
        toast.info("키를 찍을 대상을 먼저 고르세요", {
          description: "인물·소품을 누르거나 타임라인 레이어 막대를 누른 뒤 K.",
          id: "k-key",
        });
        return;
      }
      const isCharacter = characters.some((item) => item.characterId === selectedTargetId);
      /*
        ── 자세 키 ──────────────────────────────────────────────────────
        

        **관절을 고른 상태**(본 기즈모)면 1·2·3 이 아니라 자세입니다 — 그때 1·2·3 은 관절 기즈모의
        모드라 «이동 키» 가 찍히면 손에 쥔 것과 어긋납니다. 프리셋만 눌러 관절을 안 고른 채
        자세를 찍고 싶을 때는 **Shift+K**.
      */
      if (isCharacter && (activeBone || event.shiftKey)) {
        const at = playheadRef.current;
        // 관절을 잡고 K 면 그 관절 줄에 **곧바로** 점이 섭니다(`MotionKey.joints`).
        setState((current) =>
          addPoseKeyIn(current, selectedTargetId, at, undefined, activeBone ? [activeBone] : []),
        );
        toast.message(`${targetNames[selectedTargetId] ?? "대상"} · 자세 키 — ${at.toFixed(2)}초`, {
          description: "관절마다의 회전을 지금 보이는 그대로 찍었습니다. 이제 관절을 돌리면 자동으로 찍힙니다.",
          id: "k-key",
        });
        return;
      }
      const channel =
        transformMode === "rotate" ? "rotation" : transformMode === "scale" ? "scale" : "position";
      const label = channel === "rotation" ? "회전" : channel === "scale" ? "크기" : "이동";
      // 인물 크기는 캐릭터의 키가 정합니다 — 트랙으로 바꾸면 키 설정과 두 곳이 어긋납니다.
      if (isCharacter && channel === "scale") {
        toast.info("인물 크기는 키로 찍지 않습니다", {
          description: "인물 크기는 캐릭터 설정의 키(cm)가 정합니다. 1(이동)·2(회전)를 고른 뒤 K, 자세는 Shift+K.",
          id: "k-key",
        });
        return;
      }
      const at = playheadRef.current;
      setState((current) => addMotionKeyAtIn(current, selectedTargetId, channel, at));
      toast.message(`${targetNames[selectedTargetId] ?? "대상"} · ${label} 키 — ${at.toFixed(2)}초`, {
        description: "지금 보이는 자세 그대로 찍었습니다.",
        id: "k-key",
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, playing, selectedTargetId, transformMode, activeBone, characters, targetNames, setState, playheadRef]);

  /*
    ── 스페이스바로 재생·멈춤 ────────────────────────────────────────────
    
    영상 편집 도구의 공통 약속이라, 손이 이미 그렇게 움직입니다.

    글자를 치는 중에는 안 받습니다 — 이름을 고치다 스페이스를 누르면 띄어쓰기 대신
    재생이 시작되면 안 됩니다.
  */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (isTypingTarget(event.target)) return;
      /*
        **단추에 초점이 있어도** 받습니다. 예전엔 단추를 걸렀는데, 타임라인 레이어 이름·키 단추를
        한 번 누르면 초점이 거기 남아 스페이스가 재생을 못 멈췄습니다(). 초점을 풀어 그 단추가 스페이스로 눌리지 않게 합니다.
      */
      const focused = event.target;
      if (focused instanceof HTMLElement && focused.closest("button")) focused.blur();
      event.preventDefault();
      setPlaying(!playing);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, playing, setPlaying]);
}
