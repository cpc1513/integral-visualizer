import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { BoundsEditor } from "./BoundsEditor";
import { ComputePanel } from "./ComputePanel";
import { integralExamples, DEFAULT_INTEGRAL_TYPE } from "./examples";
import { FormulaEditor } from "./FormulaEditor";
import { regenerateFormula, synchronizeFormula } from "./formula";
import { IntegralTypeSelector } from "./IntegralTypeSelector";
import { SymbolKeyboard } from "./SymbolKeyboard";
import { MathfieldFocusProvider } from "./MathfieldFocusContext";
import type { ComputeMethod, ComputeResult, ComputeStatus, IntegralSpec, IntegralType } from "./types";
import { VisualizationCanvas } from "../visualization/VisualizationCanvas";

const STORAGE_KEY = "integral-visualizer:calculator:v2";

const seededResults: Record<IntegralType, ComputeResult> = {
  ordinary: {
    status: "exact",
    exactLatex: "\\frac{8}{3}",
    numericValue: "2.66666666667",
    elapsedMs: 0,
    steps: [{ label: "示例结果", latex: "\\int_0^2 x^2\\,dx=\\frac{8}{3}" }],
  },
  double: {
    status: "exact",
    exactLatex: "\\frac{1}{3}",
    numericValue: "0.333333333333",
    elapsedMs: 0,
    steps: [{ label: "示例结果", latex: "\\int_0^1\\int_0^x(x^2+y^2)\\,dy\\,dx=\\frac13" }],
  },
  triple: {
    status: "exact",
    exactLatex: "\\frac{32\\pi}{3}",
    numericValue: "33.5103216383",
    elapsedMs: 0,
    steps: [
      {
        label: "示例结果",
        latex: "\\iiint_{\\Omega}z\\,dV=\\frac{32\\pi}{3}",
      },
    ],
  },
  line: {
    status: "exact",
    exactLatex: "2\\pi",
    numericValue: "6.28318530718",
    elapsedMs: 0,
    steps: [{ label: "示例结果", latex: "\\int_C1\\,ds=2\\pi" }],
  },
  surface: {
    status: "exact",
    exactLatex: "\\frac{\\pi}{6}(17\\sqrt{17}-1)",
    numericValue: "36.1769031974",
    elapsedMs: 0,
    steps: [{ label: "示例结果", latex: "\\iint_\\Sigma1\\,dS=\\frac{\\pi}{6}(17\\sqrt{17}-1)" }],
  },
};

interface StoredCalculatorState {
  activeType: IntegralType;
  specs: Record<IntegralType, IntegralSpec>;
}

function loadCalculatorState(): StoredCalculatorState {
  const fallback = {
    activeType: DEFAULT_INTEGRAL_TYPE,
    specs: structuredClone(integralExamples),
  };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as StoredCalculatorState;
    if (!parsed.specs || !parsed.activeType) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function CalculatorPage() {
  const location = useLocation();
  const [calculator, setCalculator] = useState(loadCalculatorState);
  const [results, setResults] = useState<Record<IntegralType, ComputeResult | null>>(() =>
    Object.fromEntries(
      (Object.keys(integralExamples) as IntegralType[]).map((type) => [
        type,
        calculator.specs[type].latex === integralExamples[type].latex ? seededResults[type] : null,
      ]),
    ) as Record<IntegralType, ComputeResult | null>,
  );
  const [status, setStatus] = useState<ComputeStatus>("idle");
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [activeMethod, setActiveMethod] = useState<ComputeMethod>("auto");
  const requestVersionRef = useRef(0);
  const activeSpec = calculator.specs[calculator.activeType];
  const busy = ["loading-python", "loading-symbolics", "computing", "loading-numerics"].includes(status);

  useEffect(() => {
    if (!busy || startedAt === null) return;
    const update = () => setElapsedMs(Date.now() - startedAt);
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [busy, startedAt]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculator));
  }, [calculator]);

  useEffect(() => {
    const incoming = location.state as { visualizationSpec?: IntegralSpec } | null;
    const spec = incoming?.visualizationSpec;
    if (!spec || !["ordinary", "double", "triple", "line", "surface"].includes(spec.type)) return;
    const nextSpec = structuredClone(spec);
    setCalculator((current) => ({
      activeType: nextSpec.type,
      specs: { ...current.specs, [nextSpec.type]: nextSpec },
    }));
    setResults((current) => ({ ...current, [nextSpec.type]: null }));
    setStatus("idle");
    setError("");
  }, [location.state]);

  const setActiveType = (activeType: IntegralType) => {
    setCalculator((current) => ({ ...current, activeType }));
    setStatus("idle");
    setError("");
  };

  const updateActiveSpec = useCallback((nextSpec: IntegralSpec, preserveLatex = false) => {
    setCalculator((current) => ({
      ...current,
      specs: {
        ...current.specs,
        [nextSpec.type]: preserveLatex ? nextSpec : regenerateFormula(nextSpec),
      },
    }));
    setResults((current) => ({ ...current, [nextSpec.type]: null }));
    setStatus("idle");
    setError("");
  }, []);

  const compute = async (method: ComputeMethod = "auto") => {
    if ((activeSpec.type === "line" || activeSpec.type === "surface") && activeSpec.regionMode === "constraints") {
      setStatus("error");
      setError("区域已可视化；当前隐式条件需要参数方程后才能计算。切换回参数形式即可继续求值。");
      return;
    }
    const requestVersion = ++requestVersionRef.current;
    const resolvedMethod: ComputeMethod =
      (activeSpec.type === "double" || activeSpec.type === "triple") && activeSpec.regionMode === "constraints"
        ? "numeric"
        : method === "auto"
          ? activeSpec.preferredComputeMode ?? "exact"
          : method;
    setError("");
    setStatus("loading-python");
    setElapsedMs(0);
    setStartedAt(Date.now());
    setActiveMethod(resolvedMethod);
    const requestedType = activeSpec.type;
    try {
      const { cancelActiveComputation, computeIntegral } = await import("./computeClient");
      cancelActiveComputation();
      const result = await computeIntegral(
        activeSpec,
        (nextStatus) => {
          if (requestVersion === requestVersionRef.current) setStatus(nextStatus);
        },
        resolvedMethod,
      );
      if (requestVersion !== requestVersionRef.current) return;
      setResults((current) => ({ ...current, [requestedType]: result }));
      setStatus("complete");
    } catch (reason) {
      if (requestVersion !== requestVersionRef.current) return;
      const { ComputationCancelledError } = await import("./computeClient");
      if (reason instanceof ComputationCancelledError) {
        setStatus("stopped");
        setError("");
        return;
      }
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    } finally {
      if (requestVersion === requestVersionRef.current) setStartedAt(null);
    }
  };

  const stopCompute = async () => {
    const { cancelActiveComputation } = await import("./computeClient");
    cancelActiveComputation();
  };

  const useNumericCompute = async () => {
    requestVersionRef.current += 1;
    const { cancelActiveComputation } = await import("./computeClient");
    cancelActiveComputation();
    void compute("numeric");
  };

  const formulaValue = useMemo(() => activeSpec.latex, [activeSpec.latex]);

  return (
    <MathfieldFocusProvider>
    <div className="calculator-page">
      <section className="calculator-rail" aria-label="积分计算台">
        <div className="calculator-scroll">
          <section className="control-section">
            <h2>选择积分类型</h2>
            <IntegralTypeSelector value={activeSpec.type} onChange={setActiveType} />
          </section>

          <section className="control-section">
            <h2>输入完整公式</h2>
            <FormulaEditor
              value={formulaValue}
              onChange={(latex) => updateActiveSpec(synchronizeFormula(activeSpec, latex), true)}
            />
            <SymbolKeyboard />
          </section>

          <section className="control-section bounds-section">
            <h2>参数与边界</h2>
            <BoundsEditor spec={activeSpec} onChange={updateActiveSpec} />
          </section>
          <ComputePanel
            status={status}
            result={results[calculator.activeType]}
            error={error}
            onCompute={() => void compute("auto")}
            onStop={() => void stopCompute()}
            onUseNumeric={() => void useNumericCompute()}
            elapsedMs={elapsedMs}
            showNumericSwitch={status === "computing" && elapsedMs >= 12_000 && activeMethod !== "numeric"}
          />
        </div>
      </section>
      <VisualizationCanvas spec={activeSpec} />
    </div>
    </MathfieldFocusProvider>
  );
}
