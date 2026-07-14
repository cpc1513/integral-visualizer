import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComputeResult, IntegralSpec, IntegralType } from "./types";

const computeMocks = vi.hoisted(() => ({
  computeIntegral: vi.fn(),
  cancelActiveComputation: vi.fn(() => true),
}));

vi.mock("./computeClient", () => ({
  ...computeMocks,
  ComputationCancelledError: class ComputationCancelledError extends Error {},
}));

vi.mock("./FormulaEditor", () => ({
  FormulaEditor: ({
    value,
    onChange,
    error,
  }: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
  }) => (
    <div>
      <input aria-label="完整积分公式" value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <span role="alert">{error}</span> : null}
    </div>
  ),
}));

vi.mock("./SymbolKeyboard", () => ({ SymbolKeyboard: () => null }));
vi.mock("./IntegralTypeSelector", () => ({
  IntegralTypeSelector: ({ onChange }: { onChange: (type: IntegralType) => void }) => (
    <button type="button" onClick={() => onChange("ordinary")}>切换类型</button>
  ),
}));
vi.mock("./BoundsEditor", () => ({
  BoundsEditor: ({ spec, onChange }: { spec: IntegralSpec; onChange: (spec: IntegralSpec) => void }) => (
    <button type="button" onClick={() => onChange({ ...spec, integrand: "2" })}>修改参数</button>
  ),
}));
vi.mock("./ComputePanel", () => ({
  ComputePanel: ({
    result,
    onCompute,
    computeBlocked,
  }: {
    result: ComputeResult | null;
    onCompute: () => void;
    computeBlocked?: boolean;
  }) => (
    <div>
      <button type="button" aria-label="执行计算" disabled={computeBlocked} onClick={onCompute}>计算</button>
      <output data-testid="result">{result?.numericValue ?? "none"}</output>
    </div>
  ),
}));
vi.mock("../visualization/VisualizationCanvas", () => ({
  VisualizationCanvas: ({ spec }: { spec: IntegralSpec }) => (
    <output data-testid="visualized-integrand">{spec.integrand}</output>
  ),
}));

import { CalculatorPage } from "./CalculatorPage";
import { createDefaultCalculatorState, saveCalculatorState } from "./calculatorState";

const computedResult: ComputeResult = {
  status: "exact",
  exactLatex: "9",
  numericValue: "9",
  elapsedMs: 1,
  steps: [],
};

describe("CalculatorPage state consistency", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    computeMocks.computeIntegral.mockReset();
    computeMocks.cancelActiveComputation.mockClear();
  });

  it("blocks compute and explains an invalid formula draft", () => {
    render(<MemoryRouter><CalculatorPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("完整积分公式"), { target: { value: "\\iiint broken" } });

    expect(screen.getByRole("alert")).toHaveTextContent("无法识别三重积分");
    expect(screen.getByRole("button", { name: "执行计算" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "执行计算" }));
    expect(computeMocks.computeIntegral).not.toHaveBeenCalled();
  });

  it("keeps the latest valid model during rapid valid and invalid formula edits", () => {
    render(<MemoryRouter><CalculatorPage /></MemoryRouter>);
    const editor = screen.getByLabelText("完整积分公式");
    fireEvent.change(editor, {
      target: {
        value: "\\int_{-2}^{2}\\int_{-\\sqrt{4-x^2}}^{\\sqrt{4-x^2}}\\int_{0}^{4-x^2-y^2} 2z\\,dz\\,dy\\,dx",
      },
    });
    fireEvent.change(editor, { target: { value: "\\iiint broken" } });

    expect(editor).toHaveValue("\\iiint broken");
    expect(screen.getByTestId("visualized-integrand")).toHaveTextContent("2z");
    expect(screen.getByRole("button", { name: "执行计算" })).toBeDisabled();
  });

  it("cancels and ignores an old result after the active spec changes", async () => {
    let resolveCompute!: (result: ComputeResult) => void;
    computeMocks.computeIntegral.mockReturnValue(new Promise<ComputeResult>((resolve) => {
      resolveCompute = resolve;
    }));
    render(<MemoryRouter><CalculatorPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "执行计算" }));
    await waitFor(() => expect(computeMocks.computeIntegral).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "修改参数" }));
    await waitFor(() => expect(computeMocks.cancelActiveComputation).toHaveBeenCalledTimes(2));

    await act(async () => { resolveCompute(computedResult); });
    expect(screen.getByTestId("result")).toHaveTextContent("none");
  });

  it("does not seed an answer when hidden geometry differs from the example", () => {
    const state = createDefaultCalculatorState();
    state.activeType = "line";
    state.specs.line.path.x = "2\\cos t";
    expect(state.specs.line.latex).toBe("\\int_C 1\\,ds");
    saveCalculatorState(state);

    render(<MemoryRouter><CalculatorPage /></MemoryRouter>);
    expect(screen.getByTestId("result")).toHaveTextContent("none");
  });
});
