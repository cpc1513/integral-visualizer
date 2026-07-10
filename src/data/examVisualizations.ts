import { regenerateFormula } from "../features/calculator/formula";
import type {
  IntegralSpec,
  LineIntegralSpec,
  MultipleIntegralSpec,
  OrdinaryIntegralSpec,
  SurfaceIntegralSpec,
  VariableBound,
} from "../features/calculator/types";

export interface ExamVisualizationEntry {
  spec: IntegralSpec;
  source: "题面显式积分" | "解答累次积分" | "题面几何边界" | "题面参数方程";
}

const b = (variable: string, lower: string, upper: string, label: string): VariableBound => ({
  variable,
  lower,
  upper,
  label,
});

const ordinary = (
  id: string,
  integrand: string,
  variable: string,
  lower: string,
  upper: string,
): [string, ExamVisualizationEntry] => [
  id,
  {
    source: "题面显式积分",
    spec: regenerateFormula<OrdinaryIntegralSpec>({
      type: "ordinary",
      exampleName: `${id} 真题`,
      integrand,
      definite: true,
      bound: b(variable, lower, upper, "积分区间"),
      latex: "",
    }),
  },
];

const multiple = (
  id: string,
  type: "double" | "triple",
  integrand: string,
  bounds: VariableBound[],
  source: ExamVisualizationEntry["source"] = "解答累次积分",
): [string, ExamVisualizationEntry] => [
  id,
  {
    source,
    spec: regenerateFormula<MultipleIntegralSpec>({
      type,
      exampleName: `${id} 真题`,
      integrand,
      bounds,
      latex: "",
    }),
  },
];

const line = (
  id: string,
  input: Omit<LineIntegralSpec, "type" | "latex" | "exampleName">,
): [string, ExamVisualizationEntry] => [
  id,
  {
    source: "题面参数方程",
    spec: regenerateFormula<LineIntegralSpec>({
      type: "line",
      exampleName: `${id} 真题`,
      latex: "",
      ...input,
    }),
  },
];

const surface = (
  id: string,
  input: Omit<SurfaceIntegralSpec, "type" | "latex" | "exampleName">,
): [string, ExamVisualizationEntry] => [
  id,
  {
    source: "题面几何边界",
    spec: regenerateFormula<SurfaceIntegralSpec>({
      type: "surface",
      exampleName: `${id} 真题`,
      latex: "",
      ...input,
    }),
  },
];

const diskBounds = (radius: string): VariableBound[] => [
  b("y", `-\\sqrt{${radius}^2-x^2}`, `\\sqrt{${radius}^2-x^2}`, "内层"),
  b("x", `-${radius}`, radius, "外层"),
];

const zeroField = { p: "0", q: "0", r: "0" };
const fullTurn = b("v", "0", "2\\pi", "角参数");

export const examVisualizations = new Map<string, ExamVisualizationEntry>([
  ordinary("2016-2017-q08", "\\frac{1}{x^2\\sqrt{1+x^2}}", "x", "1", "\\sqrt{3}"),

  multiple("2023-2024-q01", "double", "x\\sin\\frac{y}{x}", [
    b("y", "0", "x", "内层"),
    b("x", "0", "1", "外层"),
  ]),
  multiple("2022-2023-q03", "double", "x\\sqrt{y}", [
    b("y", "x^2", "\\sqrt{x}", "内层"),
    b("x", "0", "1", "外层"),
  ]),
  multiple("2022-2023-q04", "double", "\\frac{xy}{\\sqrt{1+y^3}}", [
    b("y", "x^2", "1", "内层"),
    b("x", "0", "1", "外层"),
  ], "题面显式积分"),
  multiple("2020-2021-q05", "double", "\\sin(x^2)\\cos(y^2)+\\sin(x-y)", diskBounds("1"), "题面几何边界"),
  multiple("2018-2019-q01", "double", "\\sqrt[3]{x^2+y^2}", [
    b("y", "0", "\\sqrt{1-x^2}", "内层"),
    b("x", "0", "1", "外层"),
  ], "题面显式积分"),
  multiple("2017-2018-q02", "double", "x^2+5y^2-3xy+2x-y", diskBounds("2"), "题面几何边界"),
  multiple("2017-2018-q03", "double", "\\frac{\\sin x}{x}", [
    b("y", "0", "x", "内层"),
    b("x", "0", "1", "外层"),
  ]),
  multiple("2017-2018-q08", "double", "x^2+5y^2", diskBounds("2"), "题面几何边界"),
  multiple("2017-2018-q09", "double", "\\frac{\\sin x}{x}", [
    b("y", "0", "x", "内层"),
    b("x", "0", "1", "外层"),
  ]),
  multiple("2016-2017-q01", "double", "(x^2+y^2)^{\\frac{3}{2}}", diskBounds("2"), "题面几何边界"),
  multiple("2016-2017-q02", "double", "\\exp(-y^2)", [
    b("y", "x", "1", "内层"),
    b("x", "0", "1", "外层"),
  ], "题面显式积分"),
  multiple("2015-2016-q01", "double", "\\frac{xy}{\\sqrt{1+y^3}}", [
    b("y", "x^2", "1", "内层"),
    b("x", "0", "1", "外层"),
  ], "题面显式积分"),
  multiple("2015-2016-q05", "double", "|x-y|", [
    b("y", "-\\sqrt{1-x^2}", "\\sqrt{1-x^2}", "内层"),
    b("x", "0", "1", "外层"),
  ], "题面几何边界"),
  multiple("2014-2015-q01", "double", "x^2+y^2-7x+32y+1", diskBounds("3"), "题面几何边界"),
  multiple("2013-2014-q02", "double", "f(x,y)", [
    b("y", "x^2", "x", "内层"),
    b("x", "0", "\\frac{1}{2}", "外层"),
  ]),
  multiple("2012-2013-q05", "double", "y^2", [
    b("y", "2-x", "2", "内层"),
    b("x", "0", "2", "外层"),
  ], "题面几何边界"),

  multiple("2020-2021-q06", "triple", "z", [
    b("z", "\\sqrt{x^2+y^2}", "2-x^2-y^2", "内层"),
    b("y", "-\\sqrt{1-x^2}", "\\sqrt{1-x^2}", "中层"),
    b("x", "-1", "1", "外层"),
  ], "题面几何边界"),
  multiple("2017-2018-q05", "triple", "z^2+2x-3y", [
    b("z", "x^2+y^2", "\\sqrt{1-x^2-y^2}", "内层"),
    b("y", "-\\sqrt{a-x^2}", "\\sqrt{a-x^2}", "中层"),
    b("x", "-\\sqrt{a}", "\\sqrt{a}", "外层"),
  ], "题面几何边界"),
  multiple("2017-2018-q11", "triple", "z^2+2x-3y", [
    b("z", "x^2+y^2", "\\sqrt{1-x^2-y^2}", "内层"),
    b("y", "-\\sqrt{a-x^2}", "\\sqrt{a-x^2}", "中层"),
    b("x", "-\\sqrt{a}", "\\sqrt{a}", "外层"),
  ], "题面几何边界"),
  multiple("2015-2016-q04", "triple", "z\\sqrt{x^2+y^2+z^2}", [
    b("z", "\\sqrt{3(x^2+y^2)}", "\\sqrt{4-x^2-y^2}", "内层"),
    b("y", "-\\sqrt{1-x^2}", "\\sqrt{1-x^2}", "中层"),
    b("x", "-1", "1", "外层"),
  ], "题面几何边界"),
  multiple("2012-2013-q06", "triple", "x^2+y^2", [
    b("z", "\\frac{x^2+y^2}{2}", "8", "内层"),
    b("y", "-\\sqrt{16-x^2}", "\\sqrt{16-x^2}", "中层"),
    b("x", "-4", "4", "外层"),
  ], "题面几何边界"),

  line("2018-2019-q02", {
    mode: "scalar",
    integrand: "(x+y)^2",
    parameter: b("t", "0", "1", "参数范围"),
    path: { x: "t", y: "1-t", z: "0" },
    vectorField: zeroField,
  }),
  line("2017-2018-q04", {
    mode: "scalar",
    integrand: "y",
    parameter: b("t", "0", "1", "参数范围"),
    path: { x: "t", y: "t^3", z: "0" },
    vectorField: zeroField,
  }),
  line("2017-2018-q10", {
    mode: "scalar",
    integrand: "y",
    parameter: b("t", "0", "1", "参数范围"),
    path: { x: "t", y: "t^3", z: "0" },
    vectorField: zeroField,
  }),
  line("2016-2017-q04", {
    mode: "scalar",
    integrand: "y^2+xy",
    parameter: b("t", "0", "2\\pi", "参数范围"),
    path: { x: "\\cos t", y: "\\sin t", z: "0" },
    vectorField: zeroField,
  }),
  line("2020-2021-q07", {
    mode: "work",
    integrand: "1",
    parameter: b("t", "-1", "1", "参数范围"),
    path: { x: "t", y: "2t^2-1", z: "0" },
    vectorField: {
      p: "\\frac{x-y}{x^2+y^2}",
      q: "\\frac{x+y}{x^2+y^2}",
      r: "0",
    },
  }),
  line("2017-2018-q06", {
    mode: "work",
    integrand: "1",
    parameter: b("t", "0", "1", "参数范围"),
    path: { x: "\\frac{\\pi}{2}t^2", y: "t", z: "0" },
    vectorField: {
      p: "2xy^3-y^2\\cos x",
      q: "1-2y\\sin x+3x^2y^2",
      r: "0",
    },
  }),

  surface("2023-2024-q03", {
    mode: "scalar",
    integrand: "x+y+z",
    parameters: [b("u", "0", "2", "径向参数"), fullTurn],
    surface: { x: "u\\cos v", y: "u\\sin v", z: "u" },
    vectorField: zeroField,
    orientation: 1,
  }),
  surface("2022-2023-q06", {
    mode: "flux",
    integrand: "1",
    parameters: [b("u", "0", "1", "径向参数"), fullTurn],
    surface: { x: "u\\cos v", y: "u\\sin v", z: "1-u^2" },
    vectorField: { p: "2x^3", q: "2y^3", r: "3(z^2-1)" },
    orientation: 1,
  }),
  surface("2018-2019-q03", {
    mode: "scalar",
    integrand: "x+y+z",
    parameters: [b("u", "0", "\\frac{\\pi}{2}", "极角"), fullTurn],
    surface: { x: "\\sin u\\cos v", y: "\\sin u\\sin v", z: "\\cos u" },
    vectorField: zeroField,
    orientation: 1,
  }),
  surface("2017-2018-q07", {
    mode: "flux",
    integrand: "1",
    parameters: [b("u", "0", "\\frac{\\pi}{2}", "极角"), fullTurn],
    surface: { x: "2\\sin u\\cos v", y: "2\\sin u\\sin v", z: "\\cos u" },
    vectorField: { p: "x^2-y^2", q: "y^2-z^2", r: "z^2-x^2" },
    orientation: 1,
  }),
  surface("2016-2017-q05", {
    mode: "flux",
    integrand: "1",
    parameters: [b("u", "1", "2", "径向参数"), fullTurn],
    surface: { x: "u\\cos v", y: "u\\sin v", z: "u" },
    vectorField: { p: "0", q: "0", r: "\\frac{\\exp z}{\\sqrt{x^2+y^2}}" },
    orientation: -1,
  }),
  surface("2016-2017-q07", {
    mode: "flux",
    integrand: "1",
    parameters: [b("u", "\\frac{\\pi}{2}", "\\pi", "极角"), fullTurn],
    surface: { x: "\\sin u\\cos v", y: "\\sin u\\sin v", z: "\\cos u" },
    vectorField: { p: "x", q: "0", r: "(z+1)^2" },
    orientation: 1,
  }),
  surface("2015-2016-q06", {
    mode: "flux",
    integrand: "1",
    parameters: [b("u", "1", "\\sqrt{2}", "径向参数"), fullTurn],
    surface: { x: "u\\cos v", y: "u\\sin v", z: "u^2" },
    vectorField: { p: "z^2+x", q: "0", r: "z^2-z" },
    orientation: -1,
  }),
  surface("2013-2014-q04", {
    mode: "scalar",
    integrand: "\\frac{1}{z}",
    parameters: [b("u", "0", "\\frac{\\pi}{4}", "极角"), fullTurn],
    surface: {
      x: "\\sqrt{2}\\sin u\\cos v",
      y: "\\sqrt{2}\\sin u\\sin v",
      z: "\\sqrt{2}\\cos u",
    },
    vectorField: zeroField,
    orientation: 1,
  }),
  surface("2013-2014-q06", {
    mode: "flux",
    integrand: "1",
    parameters: [b("u", "0", "1", "径向参数"), fullTurn],
    surface: { x: "u\\cos v", y: "u\\sin v", z: "1-u^2" },
    vectorField: { p: "2x^3", q: "2y^3", r: "3(z^2-1)" },
    orientation: 1,
  }),
]);

// The sphere/paraboloid intersection radius squared: r^2 = (sqrt(5)-1)/2.
const sphereParaboloidRadiusSquared = "\\frac{\\sqrt{5}-1}{2}";
for (const id of ["2017-2018-q05", "2017-2018-q11"]) {
  const entry = examVisualizations.get(id);
  if (!entry || entry.spec.type !== "triple") continue;
  entry.spec.bounds = entry.spec.bounds.map((bound) => ({
    ...bound,
    lower: bound.lower.replaceAll("a", sphereParaboloidRadiusSquared),
    upper: bound.upper.replaceAll("a", sphereParaboloidRadiusSquared),
  }));
  entry.spec = regenerateFormula(entry.spec);
}
