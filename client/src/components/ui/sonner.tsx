import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      /*
       * 위 가운데에 띄웁니다.
       *
       * 기본값인 오른쪽 아래는 이 앱에서 가장 나쁜 자리입니다. 거기에 «시트 제작»,
       * «변형 저장», API 기록처럼 **연달아 누르는 버튼들**이 몰려 있어서, 알림이
       * 뜰 때마다 다음에 누를 것을 가립니다. 알림은 결과를 알리는 것이지 손을
       * 막으라고 있는 것이 아닙니다.
       *
       * 위쪽 가운데는 상단 바 아래의 빈 띠라 가릴 것이 없고, 눈이 먼저 가는
       * 자리이기도 합니다. offset 으로 상단 바(56px) 아래에 놓습니다.
       */
      position="top-center"
      offset={72}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

