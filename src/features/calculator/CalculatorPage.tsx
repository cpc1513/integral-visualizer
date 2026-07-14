import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { BoundsEditor } from "./BoundsEditor";
import {
  loadCalculatorState,
  saveCalculatorState,
  specFingerprint,
  type CalculatorSpecs,
} from "./calculatorState";
import { ComputePanel } from "./ComputePanel";
import { integralExamples } from "./examples";
import { FormulaEditor } from "./FormulaEditor";
import { regenerateFormula, synchronizeFormula } from "./formula";
import { IntegralTypeSelector } from "./IntegralTypeSelector";
import { SymbolKeyboard } from "./SymbolKeyboard";
import { MathfieldFocusProvider } from "./MathfieldFocusContext";
import type { ComputeMethod, ComputeResult, ComputeStatus, IntegralSpec, IntegralType } from "./types";
import { VisualizationCanvas } from "../visualization/VisualizationCanvas";

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

export function CalculatorPage() {
  const location = useLocation();
  const [calculator, setCalculator] = useState(loadCalculatorState);
  const activeSpec = calculator.specs[calculator.activeType];
  const [results, setResults] = useState<Record<IntegralType, ComputeResult | null>>(() =>
    Object.fromEntries(
      (Object.keys(integralExamples) as IntegralType[]).map((type) => [
        type,
        specFingerprint(calculator.specs[type]) === specFingerprint(integralExamples[type])
          ? seededResults[type]
          : null,
      ]),
    ) as Record<IntegralType, ComputeResult | null>,
  );
  const [status, setStatus] = useState<ComputeStatus>("idle");
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [activeMethod, setActiveMethod] = useState<ComputeMethod>("auto");
  const [formulaDraft, setFormulaDraft] = useState(activeSpec.latex);
  const [formulaError, setFormulaError] = useState("");
  const requestVersionRef = useRef(0);
  const computationActiveRef = useRef(false);
  const calculatorRef = useRef(calculator);
  calculatorRef.current = calculator;
  const busy = ["loading-python", "loading-symbolics", "computing", "loading-numerics"].includes(status);

  const invalidateComputation = useCallback(async () => {
    requestVersionRef.current += 1;
    const shouldCancel = computationActiveRef.current;
    computationActiveRef.current = false;
    setStartedAt(null);
    setStatus("idle");
    setError("");
    if (!shouldCancel) return;
    try {
      const { cancelActiveComputation } = await import("./computeClient");
      cancelActiveComputation();
    } catch {
      // A failed lazy import will be surfaced if the user starts another computation.
    }
  }, []);

  useEffect(() => {
    if (!busy || startedAt === null) return;
    const update = () => setElapsedMs(Date.now() - startedAt);
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [busy, startedAt]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveCalculatorState(calculator), 300);
    return () => window.clearTimeout(timer);
  }, [calculator]);

  useEffect(() => {
    setFormulaDraft(activeSpec.latex);
    setFormulaError("");
  }, [activeSpec.latex, calculator.activeType]);

  useEffect(() => {
    const incoming = location.state as { visualizationSpec?: IntegralSpec } | null;
    const spec = incoming?.visualizationSpec;
    if (!spec || !["ordinary", "double", "triple", "line", "surface"].includes(spec.type)) return;
    void invalidateComputation();
    const nextSpec = structuredClone(spec);
    setCalculator((current) => ({
      activeType: nextSpec.type,
      specs: { ...current.specs, [nextSpec.type]: nextSpec } as CalculatorSpecs,
    }));
    setResults((current) => ({ ...current, [nextSpec.type]: null }));
  }, [invalidateComputation, location.state]);

  useEffect(
    () => () => {
      saveCalculatorState(calculatorRef.current);
      requestVersionRef.current += 1;
      if (!computationActiveRef.current) return;
      computationActiveRef.current = false;
      void import("./computeClient")
        .then(({ cancelActiveComputation }) => cancelActiveComputation())
        .catch(() => undefined);
    },
    [],
  );

  const setActiveType = (activeType: IntegralType) => {
    void invalidateComputation();
    setCalculator((current) => ({ ...current, activeType }));
  };

  const updateActiveSpec = useCallback((nextSpec: IntegralSpec, preserveLatex = false) => {
    void invalidateComputation();
    setCalculator((current) => ({
      ...current,
      specs: {
        ...current.specs,
        [nextSpec.type]: preserveLatex ? nextSpec : regenerateFormula(nextSpec),
      } as CalculatorSpecs,
    }));
    setResults((current) => ({ ...current, [nextSpec.type]: null }));
  }, [invalidateComputation]);

  const updateFormula = (latex: string) => {
    setFormulaDraft(latex);
    void invalidateComputation();
    setResults((current) => ({ ...current, [activeSpec.type]: null }));
    const result = synchronizeFormula(activeSpec, latex);
    if (!result.ok) {
      setFormulaError(`${result.error} 当前草稿不会用于计算或可视化。`);
      return;
    }
    setFormulaError("");
    setCalculator((current) => ({
      ...current,
      specs: { ...current.specs, [result.spec.type]: result.spec } as CalculatorSpecs,
    }));
  };

  const compute = async (method: ComputeMethod = "auto") => {
    if (formulaError) {
      setStatus("error");
      setError(formulaError);
      return;
    }
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
    computationActiveRef.current = true;
    const requestedSpec = structuredClone(activeSpec);
    const requestedType = requestedSpec.type;
    const requestedFingerprint = specFingerprint(requestedSpec);
    const requestIsCurrent = () =>
      requestVersion === requestVersionRef.current
      && specFingerprint(calculatorRef.current.specs[requestedType]) === requestedFingerprint;
    try {
      const { cancelActiveComputation, computeIntegral } = await import("./computeClient");
      if (!requestIsCurrent()) return;
      cancelActiveComputation();
      const result = await computeIntegral(
        requestedSpec,
        (nextStatus) => {
          if (requestIsCurrent()) setStatus(nextStatus);
        },
        resolvedMethod,
      );
      if (!requestIsCurrent()) return;
      setResults((current) => ({ ...current, [requestedType]: result }));
      setStatus("complete");
    } catch (reason) {
      if (!requestIsCurrent()) return;
      if (reason instanceof Error && reason.name === "ComputationCancelledError") {
        setStatus("stopped");
        setError("");
        return;
      }
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    } finally {
      if (requestIsCurrent()) {
        computationActiveRef.current = false;
        setStartedAt(null);
      }
    }
  };

  const stopCompute = async () => {
    const { cancelActiveComputation } = await import("./computeClient");
    cancelActiveComputation();
  };

  const useNumericCompute = async () => {
    await invalidateComputation();
    void compute("numeric");
  };

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
              value={formulaDraft}
              error={formulaError}
              onChange={updateFormula}
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
            computeBlocked={Boolean(formulaError)}
          />
        </div>
      </section>
      <VisualizationCanvas spec={activeSpec} />
    </div>
    </MathfieldFocusProvider>
  );
}
