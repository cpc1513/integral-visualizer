import { describe, expect, it } from "vitest";
import { getIntegralExample } from "./examples";
import { latexToExpression } from "./expression";
import { generateFormulaLatex, synchronizeFormula } from "./formula";

describe("integral formula model", () => {
  it("generates nested bounds in mathematical order", () => {
    const spec = getIntegralExample("triple");
    expect(generateFormulaLatex(spec)).toBe(
      "\\int_{-2}^{2}\\int_{-\\sqrt{4-x^2}}^{\\sqrt{4-x^2}}\\int_{0}^{4-x^2-y^2} z\\,dz\\,dy\\,dx",
    );
  });

  it("synchronizes a manually edited definite integral", () => {
    const spec = getIntegralExample("ordinary");
    const synchronized = synchronizeFormula(spec, "\\int_{1}^{3} x^3\\,dx");
    expect(synchronized.ok).toBe(true);
    if (!synchronized.ok || synchronized.spec.type !== "ordinary") throw new Error("Expected ordinary integral");
    expect(synchronized.spec.integrand).toBe("x^3");
    expect(synchronized.spec.bound).toMatchObject({ variable: "x", lower: "1", upper: "3" });
  });

  it("updates the integrand for a constraint-defined multiple integral", () => {
    const spec = getIntegralExample("double");
    spec.regionMode = "constraints";
    const synchronized = synchronizeFormula(spec, "\\iint_D 2x+y\\,dA");
    expect(synchronized).toMatchObject({ ok: true, spec: { integrand: "2x+y" } });
  });

  it("updates every component of work and flux formulas", () => {
    const line = getIntegralExample("line");
    line.mode = "work";
    const work = synchronizeFormula(line, "\\int_C y\\,dx+x^2\\,dy+z\\,dz");
    expect(work).toMatchObject({
      ok: true,
      spec: { vectorField: { p: "y", q: "x^2", r: "z" } },
    });

    const surface = getIntegralExample("surface");
    surface.mode = "flux";
    const flux = synchronizeFormula(
      surface,
      "\\iint_\\Sigma x\\,dy\\,dz+y\\,dz\\,dx+z^2\\,dx\\,dy",
    );
    expect(flux).toMatchObject({
      ok: true,
      spec: { vectorField: { p: "x", q: "y", r: "z^2" } },
    });
  });

  it("returns an explicit error instead of retaining stale model fields", () => {
    const spec = getIntegralExample("triple");
    const synchronized = synchronizeFormula(spec, "\\iiint broken");
    expect(synchronized.ok).toBe(false);
    if (synchronized.ok) throw new Error("Expected an invalid formula");
    expect(synchronized.error).toContain("三重积分");
  });

  it("rejects unrelated prefixes before line and surface formulas", () => {
    const line = getIntegralExample("line");
    const surface = getIntegralExample("surface");
    expect(synchronizeFormula(line, `junk+${line.latex}`).ok).toBe(false);
    expect(synchronizeFormula(surface, `junk+${surface.latex}`).ok).toBe(false);
  });

  it("normalizes common LaTeX into a parser-friendly expression", () => {
    expect(latexToExpression("4-x^2-\\sqrt{y}+2\\pi")).toBe("4-x^2-sqrt(y)+2*pi");
    expect(latexToExpression("\\frac{\\sqrt{5}-1}{2}")).toBe("((sqrt(5)-1)/(2))");
    expect(latexToExpression("\\left|x-y\\right|")).toBe("abs(x-y)");
    expect(latexToExpression("\\arcsin x+\\sinh y")).toBe("asin(x)+sinh(y)");
  });
});
