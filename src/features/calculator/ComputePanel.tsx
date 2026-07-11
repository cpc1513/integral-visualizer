import { Calculator, CheckCircle2, ChevronRight, FastForward, LoaderCircle, Square, TriangleAlert } from "lucide-react";
import { MathExpression } from "../../components/math/MathExpression";
import type { ComputeResult, ComputeStatus } from "./types";

const statusLabels: Record<ComputeStatus, string> = {
  idle: "Python · SymPy",
  "loading-python": "正在加载 Python",
  "loading-symbolics": "正在加载 SymPy",
  computing: "正在进行符号计算",
  "loading-numerics": "正在加载 SciPy 数值回退",
  complete: "Python · SymPy",
  stopped: "已由用户停止",
  error: "计算未完成",
};

interface ComputePanelProps {
  status: ComputeStatus;
  result: ComputeResult | null;
  error: string;
  onCompute: () => void;
  onStop: () => void;
  onUseNumeric: () => void;
  elapsedMs: number;
  showNumericSwitch: boolean;
}

export function ComputePanel({
  status,
  result,
  error,
  onCompute,
  onStop,
  onUseNumeric,
  elapsedMs,
  showNumericSwitch,
}: ComputePanelProps) {
  const busy = ["loading-python", "loading-symbolics", "computing", "loading-numerics"].includes(status);
  const statusLabel = status === "complete" && result?.status === "numeric" ? "Python · SciPy" : statusLabels[status];
  return (
    <>
      <div className="compute-actions">
      <button className={`compute-button${busy ? " is-stopping" : ""}`} type="button" onClick={busy ? onStop : onCompute}>
        {busy ? (
          <Square aria-hidden="true" size={16} />
        ) : (
          <Calculator aria-hidden="true" size={18} />
        )}
        {busy ? `停止计算 · ${(elapsedMs / 1000).toFixed(1)}s` : "计算并可视化"}
      </button>
      {showNumericSwitch ? (
        <button type="button" className="numeric-switch-button" onClick={onUseNumeric}>
          <FastForward size={15} aria-hidden="true" />
          转为数值计算
        </button>
      ) : null}
      </div>

      <section className="result-panel" aria-labelledby="result-title" aria-live="polite">
        <div className="result-header">
          <h2 id="result-title">计算结果</h2>
          <span className={`runtime-status status-${status}`}>
            {busy ? <LoaderCircle className="spin" size={14} /> : <CheckCircle2 size={14} />}
            {statusLabel}{busy ? ` · ${(elapsedMs / 1000).toFixed(1)}s` : ""}
          </span>
        </div>
        {error ? (
          <div className="result-error" role="alert">
            <TriangleAlert size={17} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
        <div className="result-grid">
          <span className="result-label">精确值</span>
          <div className={`result-value${result?.exactLatex ? " is-success" : ""}`}>
            {result?.exactLatex ? (
              <MathExpression latex={result.exactLatex} display />
            ) : (
              <span className="result-placeholder">等待符号结果</span>
            )}
          </div>
          <span className="result-label">数值近似</span>
          <div className={`result-value${result ? " is-success" : ""}`}>
            {result?.numericValue ?? <span className="result-placeholder">—</span>}
            {result?.errorEstimate ? <small>误差约 {result.errorEstimate}</small> : null}
          </div>
        </div>
        <details className="steps-disclosure">
          <summary aria-disabled={!result}>
            <span>计算步骤</span>
            {result ? <small>{result.elapsedMs} ms</small> : null}
            <ChevronRight className="disclosure-chevron" size={17} aria-hidden="true" />
          </summary>
          {result ? (
            <ol className="calculation-steps">
              {result.steps.map((step, index) => (
                <li key={`${step.label}-${index}`}>
                  <span>{step.label}</span>
                  <MathExpression latex={step.latex} display />
                </li>
              ))}
            </ol>
          ) : null}
        </details>
      </section>
    </>
  );
}
