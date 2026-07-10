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
    expect(synchronized.type).toBe("ordinary");
    if (synchronized.type !== "ordinary") throw new Error("Expected ordinary integral");
    expect(synchronized.integrand).toBe("x^3");
    expect(synchronized.bound).toMatchObject({ variable: "x", lower: "1", upper: "3" });
  });

  it("normalizes common LaTeX into a parser-friendly expression", () => {
    expect(latexToExpression("4-x^2-\\sqrt{y}+2\\pi")).toBe("4-x^2-sqrt(y)+2*pi");
    expect(latexToExpression("\\frac{\\sqrt{5}-1}{2}")).toBe("((sqrt(5)-1)/(2))");
    expect(latexToExpression("\\left|x-y\\right|")).toBe("abs(x-y)");
    expect(latexToExpression("\\arcsin x+\\sinh y")).toBe("asin(x)+sinh(y)");
  });
});
