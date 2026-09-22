import * as React from "react";
import { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTutorial } from "@/lib/tutorialStore";
import { useTutorialPanel } from "@/lib/useTutorialPanel";

/** shadcn 표준 대화상자. 사고로 잃어 다시 만든 것입니다. */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/70",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 튜토리얼 안내 카드·메뉴 판이 달고 다니는 표. 이것이 붙은 것 안에서 일어난 클릭은
 * «창 바깥» 으로 치지 않습니다 — 아래 `onInteractOutside` 를 보세요.
 */
const TUTORIAL_LAYER = "[data-tutorial-layer]";

/**
 * **튜토리얼이 도는 동안에는 창을 사람이 마음대로 닫지 못합니다.**
 *
 * 「지금은 그냥 닫기 버튼 누르면 모달이 닫히고 하니까 계속 이런 문제가 발생하잖아」.
 *
 * 걸음은 «이 창이 열려 있다» 를 전제로 자리를 가리킵니다. 그 사이 사람이 Esc 를 누르거나 바깥을
 * 눌러 창을 닫아 버리면 남은 걸음이 통째로 어긋나고, 그때마다 「자리가 화면에 없습니다」 가 뜹니다.
 * 그래서 도는 동안에는 **창을 여닫는 일을 튜토리얼이 맡습니다**(`cardWantFor` 가 걸음마다 정합니다).
 *
 * 갇히지 않습니다 — 안내 카드의 «건너뛰기» 로 튜토리얼을 끝내면 그 순간 원래대로 닫힙니다.
 * 그 길 하나는 늘 열려 있어야 하므로 X 는 감추되 지우지는 않습니다.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  onInteractOutside,
  onEscapeKeyDown,
  tutorialHolds,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /**
   * 이 창이 **품고 있는 튜토리얼 자리들**(`data-tour` 이름, 띄어쓰기로 나눔).
   *
   * 일괄 생성 창을 열어 두 걸음을 설명한 다음
   * 걸음이 그 아래 페이지의 «장르» 를 가리키는데, 창이 덮고 있어 아무것도 안 보였습니다.
   *
   * 적어 두면 창이 스스로 판단합니다 — 지금 걸음의 자리가 이 목록에 없으면 이 창은 쓸모가
   * 없으니 닫습니다. 여는 쪽(`data-tour-open`)과 짝입니다.
   *
   * **안 적으면 «아무것도 안 품음»** 이라, 튜토리얼이 도는 동안에는 떠 있지 못합니다. 그것이
   * 기본인 까닭 — 걸음과 상관없는 창이 하나라도 떠 있으면 그 걸음의 자리를 덮습니다. 창을 새로
   * 만들면서 이 줄을 빠뜨려도 «조용히 어긋나는» 쪽이 아니라 «바로 닫히는» 쪽으로 틀립니다.
   */
  tutorialHolds?: string;
}) {
  const { active: tutorialRunning } = useTutorial();
  const closeRef = useRef<HTMLButtonElement>(null);

  /*
    쓸모가 없어지면 스스로 닫습니다 — 규칙은 `useTutorialPanel` 한 곳에 있습니다.

    닫는 길을 «숨긴 닫기 단추를 누르는 것» 으로 잡은 까닭 — 창을 여닫는 상태는 부모가 쥐고
    있습니다. Radix 의 Close 를 거쳐야 부모의 `onOpenChange` 가 제대로 불려, 부모가 들고 있는
    다른 상태(고치던 카드 id 같은 것)까지 함께 정리됩니다.
  */
  useTutorialPanel({
    open: true,
    holds: tutorialHolds ?? "",
    onClose: () => closeRef.current?.click(),
  });

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        /*
          

          튜토리얼 안내 카드는 `document.body` 로 내보냅니다. Radix 가 보기에는 창 밖이라,
          «다음» 을 누르는 순간 «바깥을 눌렀다» 며 창을 닫아 버렸습니다 — 캐릭터 카드를 설명하는
          튜토리얼이 그 카드를 닫는 꼴입니다.

          그래서 튜토리얼 층에서 온 것만 골라 막습니다. 한 창씩 고치지 않고 **공용 DialogContent
          한 곳**에 두는 까닭은 규칙 1 입니다 — 창이 열 몇 개라 한 곳만 빠뜨려도 읽어서는 못 찾습니다.
        */
        onInteractOutside={(event) => {
          const target = event.detail.originalEvent.target;
          if (tutorialRunning || (target instanceof Element && target.closest(TUTORIAL_LAYER))) {
            event.preventDefault();
            return;
          }
          onInteractOutside?.(event);
        }}
        onEscapeKeyDown={(event) => {
          if (tutorialRunning) {
            event.preventDefault();
            return;
          }
          onEscapeKeyDown?.(event);
        }}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg duration-200",
          className,
        )}
        {...props}
      >
        {children}
        {/* 튜토리얼이 창을 닫을 때 누르는 자리. 사람 눈에는 안 보입니다. */}
        <DialogPrimitive.Close ref={closeRef} className="hidden" aria-hidden tabIndex={-1} />
        {showCloseButton && !tutorialRunning && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">닫기</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
