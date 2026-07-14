import { describe, expect, it } from "vitest";
import { getIntegralExample } from "./examples";
import {
  CALCULATOR_STORAGE_KEY,
  CALCULATOR_STORAGE_VERSION,
  createDefaultCalculatorState,
  loadCalculatorState,
  saveCalculatorState,
  specFingerprint,
  type CalculatorStorage,
} from "./calculatorState";

function memoryStorage(initial: Record<string, string> = {}): CalculatorStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe("calculator persistence", () => {
  it("merges a legacy partial state with safe defaults", () => {
    const ordinary = getIntegralExample("ordinary");
    ordinary.integrand = "x^4";
    const storage = memoryStorage({
      "integral-visualizer:calculator:v2": JSON.stringify({
        activeType: "ordinary",
        specs: { ordinary },
      }),
    });

    const loaded = loadCalculatorState(storage);
    expect(loaded.activeType).toBe("ordinary");
    expect(loaded.specs.ordinary.integrand).toBe("x^4");
    expect(loaded.specs.triple.type).toBe("triple");
  });

  it("falls back per spec when persisted data is malformed", () => {
    const storage = memoryStorage({
      [CALCULATOR_STORAGE_KEY]: JSON.stringify({
        version: CALCULATOR_STORAGE_VERSION,
        activeType: "not-a-type",
        specs: { ordinary: { type: "ordinary", integrand: 42 } },
      }),
    });

    const loaded = loadCalculatorState(storage);
    const fallback = createDefaultCalculatorState();
    expect(loaded.activeType).toBe(fallback.activeType);
    expect(loaded.specs).toEqual(fallback.specs);
  });

  it("survives storage access and quota failures", () => {
    const failingRead: CalculatorStorage = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: () => undefined,
    };
    expect(loadCalculatorState(failingRead)).toEqual(createDefaultCalculatorState());

    const failingWrite: CalculatorStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
    };
    expect(saveCalculatorState(createDefaultCalculatorState(), failingWrite)).toBe(false);
  });

  it("fingerprints the full spec rather than only its display formula", () => {
    const first = getIntegralExample("line");
    const second = getIntegralExample("line");
    second.path.x = "2\\cos t";
    expect(second.latex).toBe(first.latex);
    expect(specFingerprint(second)).not.toBe(specFingerprint(first));
  });

  it("writes an explicit schema version", () => {
    const storage = memoryStorage();
    expect(saveCalculatorState(createDefaultCalculatorState(), storage)).toBe(true);
    expect(JSON.parse(storage.values.get(CALCULATOR_STORAGE_KEY) ?? "{}")).toMatchObject({
      version: CALCULATOR_STORAGE_VERSION,
    });
  });

  it("round-trips default specs without changing their full fingerprints", () => {
    const storage = memoryStorage();
    const original = createDefaultCalculatorState();
    saveCalculatorState(original, storage);
    const loaded = loadCalculatorState(storage);
    for (const type of ["ordinary", "double", "triple", "line", "surface"] as const) {
      expect(specFingerprint(loaded.specs[type])).toBe(specFingerprint(original.specs[type]));
    }
  });
});
