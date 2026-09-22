import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * 한 화면이 터져도 앱 전체가 하얗게 되지 않도록 막습니다.
 *
 * 이 앱은 작업 중인 프로젝트를 화면에 들고 있는 시간이 깁니다. 어딘가에서
 * 오류 하나가 나서 통째로 빈 화면이 되면 그때까지 넣은 것이 다 사라진
 * 것처럼 보입니다. 실제로는 저장돼 있어도 사람은 그렇게 못 느낍니다.
 */
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("화면에서 오류가 났습니다", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-10">
        <div
          className="max-w-lg rounded-xl p-6"
          style={{ background: "oklch(0.15 0.01 265)", border: "1px solid oklch(0.62 0.2 25 / 35%)" }}
        >
          <h1 className="text-base font-semibold text-white">화면을 그리다 멈췄습니다</h1>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "oklch(0.60 0.01 265)" }}>
            작업하던 내용은 폴더에 저장돼 있습니다. 창을 다시 열면 이어서 할 수 있습니다.
          </p>
          <pre
            className="mt-3 max-h-40 overflow-auto rounded-md p-2 text-[10px]"
            style={{ background: "oklch(0.10 0.006 265)", color: "oklch(0.62 0.14 25)" }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold text-white gradient-primary"
          >
            다시 그려 보기
          </button>
        </div>
      </div>
    );
  }
}
