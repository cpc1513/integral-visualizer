import type { MathfieldElement } from "mathlive";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { BoundsEditor } from "./BoundsEditor";
import { ComputePanel } from "./ComputePanel";
import { integralExamples, DEFAULT_INTEGRAL_TYPE } from "./examples";
import { FormulaEditor } from "./FormulaEditor";
import { regenerateFormula, synchronizeFormula } from "./formula";
import { IntegralTypeSelector } from "./IntegralTypeSelector";
import { SymbolKeyboard } from "./SymbolKeyboard";
import type { ComputeResult, ComputeStatus, IntegralSpec, IntegralType } from "./types";
import { VisualizationCanvas } from "../visualization/VisualizationCanvas";

const STORAGE_KEY = "integral-visualizer:calculator:v1";

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
  const [mathfield, setMathfield] = useState<MathfieldElement | null>(null);
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
  const activeSpec = calculator.specs[calculator.activeType];

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

  const compute = async () => {
    setError("");
    setStatus("loading-python");
    const requestedType = activeSpec.type;
    try {
      const { computeIntegral } = await import("./computeClient");
      const result = await computeIntegral(activeSpec, setStatus);
      setResults((current) => ({ ...current, [requestedType]: result }));
      setStatus("complete");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  };

  const formulaValue = useMemo(() => activeSpec.latex, [activeSpec.latex]);

  return (
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
              onReady={setMathfield}
              onChange={(latex) => updateActiveSpec(synchronizeFormula(activeSpec, latex), true)}
            />
            <SymbolKeyboard mathfield={mathfield} />
          </section>

          <section className="control-section bounds-section">
            <h2>参数与边界</h2>
            <BoundsEditor spec={activeSpec} onChange={updateActiveSpec} />
          </section>
          <ComputePanel
            status={status}
            result={results[calculator.activeType]}
            error={error}
            onCompute={compute}
          />
        </div>
      </section>
      <VisualizationCanvas spec={activeSpec} />
    </div>
  );
}
