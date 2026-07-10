import { generateFormulaLatex } from "./formula";
import type { IntegralSpec, IntegralType } from "./types";

type SpecFor<T extends IntegralType> = Extract<IntegralSpec, { type: T }>;
type ExampleInputs = {
  [T in IntegralType]: Omit<SpecFor<T>, "latex">;
};

const examplesWithoutFormula: ExampleInputs = {
  ordinary: {
    type: "ordinary",
    exampleName: "抛物线下的面积",
    definite: true,
    integrand: "x^2",
    bound: { variable: "x", lower: "0", upper: "2", label: "积分区间" },
  },
  double: {
    type: "double",
    exampleName: "三角形区域上的二重积分",
    integrand: "x^2+y^2",
    bounds: [
      { variable: "y", lower: "0", upper: "x", label: "内层" },
      { variable: "x", lower: "0", upper: "1", label: "外层" },
    ],
  },
  triple: {
    type: "triple",
    exampleName: "旋转抛物面围成的立体",
    integrand: "z",
    bounds: [
      { variable: "z", lower: "0", upper: "4-x^2-y^2", label: "内层" },
      { variable: "y", lower: "-\\sqrt{4-x^2}", upper: "\\sqrt{4-x^2}", label: "中层" },
      { variable: "x", lower: "-2", upper: "2", label: "外层" },
    ],
  },
  line: {
    type: "line",
    exampleName: "单位圆周长度",
    mode: "scalar",
    integrand: "1",
    parameter: { variable: "t", lower: "0", upper: "2\\pi", label: "参数范围" },
    path: { x: "\\cos t", y: "\\sin t", z: "0" },
    vectorField: { p: "-y", q: "x", r: "0" },
  },
  surface: {
    type: "surface",
    exampleName: "旋转抛物面面积",
    mode: "scalar",
    integrand: "1",
    parameters: [
      { variable: "u", lower: "0", upper: "2", label: "径向参数" },
      { variable: "v", lower: "0", upper: "2\\pi", label: "角参数" },
    ],
    surface: {
      x: "u\\cos v",
      y: "u\\sin v",
      z: "4-u^2",
    },
    vectorField: { p: "x", q: "y", r: "z" },
    orientation: 1,
  },
};

function materialize<T extends IntegralType>(type: T): SpecFor<T> {
  const spec = structuredClone(examplesWithoutFormula[type]) as unknown as SpecFor<T>;
  return { ...spec, latex: generateFormulaLatex(spec) } as SpecFor<T>;
}

export const integralExamples: Record<IntegralType, IntegralSpec> = {
  ordinary: materialize("ordinary"),
  double: materialize("double"),
  triple: materialize("triple"),
  line: materialize("line"),
  surface: materialize("surface"),
};

export const DEFAULT_INTEGRAL_TYPE: IntegralType = "triple";

export function getIntegralExample(type: IntegralType): IntegralSpec {
  return structuredClone(integralExamples[type]);
}
