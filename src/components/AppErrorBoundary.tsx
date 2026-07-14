import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Integral visualizer render failed", error, info);
  }

  private reload = () => window.location.reload();

  private resetLocalState = () => {
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith("integral-visualizer:")) localStorage.removeItem(key);
      }
    } catch {
      // Reload still gives the application a chance to recover when storage is unavailable.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error-card">
          <span>积分视界</span>
          <h1>页面暂时没有正常启动</h1>
          <p>可以先重新加载；如果问题来自旧版缓存，恢复默认设置即可继续使用。</p>
          <div>
            <button type="button" className="secondary-button" onClick={this.reload}>重新加载</button>
            <button type="button" className="compute-button" onClick={this.resetLocalState}>恢复默认设置</button>
          </div>
        </div>
      </main>
    );
  }
}
