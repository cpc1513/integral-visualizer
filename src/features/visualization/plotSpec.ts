import type { Config, Layout } from "plotly.js";
import { latexToExpression } from "../calculator/expression";
import type { IntegralSpec, VariableBound } from "../calculator/types";

export interface IntegralPlotSpec {
  data: Array<Record<string, unknown>>;
  layout: Partial<Layout>;
  config: Partial<Config>;
  dimension: "2d" | "3d";
  summary: string;
}

type Evaluator = (scope?: Record<string, number>) => number;

const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37, 99, 235, 0.28)";
const NAVY = "#102a4c";
const GRID = "#dce4ef";

function linspace(start: number, end: number, count: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("积分上下限必须是有限实数");
  if (start === end) return Array.from({ length: count }, () => start);
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

async function createEvaluator(expression: string): Promise<Evaluator> {
  const { compile } = await import("mathjs");
  const compiled = compile(latexToExpression(expression));
  return (scope = {}) => {
    const value = Number(compiled.evaluate(scope));
    if (!Number.isFinite(value)) throw new Error(`表达式在当前区域没有有限实值：${expression}`);
    return value;
  };
}

async function evaluateBound(bound: Pick<VariableBound, "lower" | "upper">, scope = {}) {
  const [lower, upper] = await Promise.all([
    createEvaluator(bound.lower),
    createEvaluator(bound.upper),
  ]);
  return [lower(scope), upper(scope)] as const;
}

const commonLayout: Partial<Layout> = {
  autosize: true,
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "#f8fafc",
  font: { family: 'Inter, "Microsoft YaHei", sans-serif', color: NAVY, size: 12 },
  margin: { l: 56, r: 24, t: 20, b: 48 },
  showlegend: false,
  hoverlabel: { bgcolor: "#ffffff", bordercolor: GRID, font: { color: NAVY } },
};

const commonConfig: Partial<Config> = {
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "sendDataToCloud"],
  toImageButtonOptions: { format: "png", filename: "积分区域" },
};

async function ordinaryPlot(spec: Extract<IntegralSpec, { type: "ordinary" }>) {
  const evaluate = await createEvaluator(spec.integrand);
  const [lower, upper] = await evaluateBound(spec.bound);
  const x = linspace(lower, upper, 180);
  const y = x.map((value) => evaluate({ [spec.bound.variable]: value }));
  return {
    data: [
      {
        type: "scatter",
        mode: "lines",
        x,
        y,
        fill: spec.definite ? "tozeroy" : "none",
        fillcolor: BLUE_SOFT,
        line: { color: BLUE, width: 3 },
        hovertemplate: `${spec.bound.variable}=%{x:.4g}<br>f=%{y:.4g}<extra></extra>`,
      },
    ],
    layout: {
      ...commonLayout,
      xaxis: { title: { text: spec.bound.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
      yaxis: { title: { text: `f(${spec.bound.variable})` }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
    },
    config: commonConfig,
    dimension: "2d",
    summary: `绘制 ${spec.integrand} 在 ${spec.bound.lower} 到 ${spec.bound.upper} 之间的曲线与积分区域。`,
  } satisfies IntegralPlotSpec;
}

async function doublePlot(spec: Extract<IntegralSpec, { type: "double" }>) {
  const [inner, outer] = spec.bounds;
  const [outerLower, outerUpper] = await evaluateBound(outer);
  const [lowerEvaluator, upperEvaluator] = await Promise.all([
    createEvaluator(inner.lower),
    createEvaluator(inner.upper),
  ]);
  const x = linspace(outerLower, outerUpper, 120);
  const lower = x.map((value) => lowerEvaluator({ [outer.variable]: value }));
  const upper = x.map((value) => upperEvaluator({ [outer.variable]: value }));
  const polygonX = [...x, ...[...x].reverse()];
  const polygonY = [...upper, ...[...lower].reverse()];
  return {
    data: [
      {
        type: "scatter",
        mode: "lines",
        x: polygonX,
        y: polygonY,
        fill: "toself",
        fillcolor: BLUE_SOFT,
        line: { color: BLUE, width: 2.5 },
        hovertemplate: `${outer.variable}=%{x:.4g}<br>${inner.variable}=%{y:.4g}<extra></extra>`,
      },
    ],
    layout: {
      ...commonLayout,
      xaxis: {
        title: { text: outer.variable },
        gridcolor: GRID,
        zerolinecolor: "#aebbd0",
        scaleanchor: "y",
        scaleratio: 1,
      },
      yaxis: { title: { text: inner.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
    },
    config: commonConfig,
    dimension: "2d",
    summary: `填充由 ${inner.variable}=${inner.lower} 与 ${inner.variable}=${inner.upper} 围成的二重积分区域。`,
  } satisfies IntegralPlotSpec;
}

async function triplePlot(spec: Extract<IntegralSpec, { type: "triple" }>) {
  const [inner, middle, outer] = spec.bounds;
  const [outerLower, outerUpper] = await evaluateBound(outer);
  const [middleLower, middleUpper, innerLower, innerUpper] = await Promise.all([
    createEvaluator(middle.lower),
    createEvaluator(middle.upper),
    createEvaluator(inner.lower),
    createEvaluator(inner.upper),
  ]);
  const xValues = linspace(outerLower, outerUpper, 36);
  const xGrid: number[][] = [];
  const yGrid: number[][] = [];
  const lowerGrid: number[][] = [];
  const upperGrid: number[][] = [];

  for (const outerValue of xValues) {
    const outerScope = { [outer.variable]: outerValue };
    const low = middleLower(outerScope);
    const high = middleUpper(outerScope);
    const middleValues = linspace(low, high, 34);
    xGrid.push(middleValues.map(() => outerValue));
    yGrid.push(middleValues);
    lowerGrid.push(
      middleValues.map((middleValue) =>
        innerLower({ ...outerScope, [middle.variable]: middleValue }),
      ),
    );
    upperGrid.push(
      middleValues.map((middleValue) =>
        innerUpper({ ...outerScope, [middle.variable]: middleValue }),
      ),
    );
  }

  const surfaceBase = {
    type: "surface" as const,
    x: xGrid,
    y: yGrid,
    showscale: false,
    hovertemplate: `${outer.variable}=%{x:.3g}<br>${middle.variable}=%{y:.3g}<br>${inner.variable}=%{z:.3g}<extra></extra>`,
  };
  return {
    data: [
      {
        ...surfaceBase,
        z: upperGrid,
        opacity: 0.72,
        colorscale: [
          [0, "#8fb2ff"],
          [1, BLUE],
        ],
        contours: { z: { show: true, color: "rgba(16,42,76,.24)", width: 1 } },
      },
      {
        ...surfaceBase,
        z: lowerGrid,
        opacity: 0.35,
        colorscale: [
          [0, "#dbe8ff"],
          [1, "#76a1ff"],
        ],
      },
    ],
    layout: {
      ...commonLayout,
      margin: { l: 8, r: 8, t: 12, b: 8 },
      scene: {
        xaxis: { title: { text: outer.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
        yaxis: { title: { text: middle.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
        zaxis: { title: { text: inner.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
        bgcolor: "#f8fafc",
        aspectmode: "cube",
        camera: { eye: { x: 1.55, y: 1.55, z: 1.15 } },
      },
    },
    config: commonConfig,
    dimension: "3d",
    summary: `显示 ${inner.variable} 从 ${inner.lower} 到 ${inner.upper} 之间的三维积分立体，可拖动旋转。`,
  } satisfies IntegralPlotSpec;
}

async function linePlot(spec: Extract<IntegralSpec, { type: "line" }>) {
  const [lower, upper] = await evaluateBound(spec.parameter);
  const [xEval, yEval, zEval] = await Promise.all([
    createEvaluator(spec.path.x),
    createEvaluator(spec.path.y),
    createEvaluator(spec.path.z),
  ]);
  const parameterValues = linspace(lower, upper, 220);
  const x = parameterValues.map((value) => xEval({ [spec.parameter.variable]: value }));
  const y = parameterValues.map((value) => yEval({ [spec.parameter.variable]: value }));
  const z = parameterValues.map((value) => zEval({ [spec.parameter.variable]: value }));
  const isPlanar = z.every((value) => Math.abs(value) < 1e-10);
  const endpointTrace: Record<string, unknown> = isPlanar
    ? {
        type: "scatter",
        mode: "markers+text",
        x: [x[0], x.at(-1)!],
        y: [y[0], y.at(-1)!],
        text: ["起点", "终点"],
        textposition: "top center",
        marker: { color: ["#229a5b", BLUE], size: 9 },
      }
    : {
        type: "scatter3d",
        mode: "markers+text",
        x: [x[0], x.at(-1)!],
        y: [y[0], y.at(-1)!],
        z: [z[0], z.at(-1)!],
        text: ["起点", "终点"],
        marker: { color: ["#229a5b", BLUE], size: 5 },
      };
  const curveTrace: Record<string, unknown> = isPlanar
    ? { type: "scatter", mode: "lines", x, y, line: { color: BLUE, width: 4 } }
    : { type: "scatter3d", mode: "lines", x, y, z, line: { color: BLUE, width: 7 } };

  return {
    data: [curveTrace, endpointTrace],
    layout: isPlanar
      ? {
          ...commonLayout,
          xaxis: { title: { text: "x" }, gridcolor: GRID, scaleanchor: "y", scaleratio: 1 },
          yaxis: { title: { text: "y" }, gridcolor: GRID },
        }
      : {
          ...commonLayout,
          margin: { l: 8, r: 8, t: 12, b: 8 },
          scene: {
            xaxis: { title: { text: "x" }, gridcolor: GRID },
            yaxis: { title: { text: "y" }, gridcolor: GRID },
            zaxis: { title: { text: "z" }, gridcolor: GRID },
            bgcolor: "#f8fafc",
            aspectmode: "data",
          },
        },
    config: commonConfig,
    dimension: isPlanar ? "2d" : "3d",
    summary: `绘制参数 ${spec.parameter.variable} 从 ${spec.parameter.lower} 到 ${spec.parameter.upper} 的有向曲线。`,
  } satisfies IntegralPlotSpec;
}

async function surfacePlot(spec: Extract<IntegralSpec, { type: "surface" }>) {
  const [uBound, vBound] = spec.parameters;
  const [[uLower, uUpper], [vLower, vUpper], xEval, yEval, zEval] = await Promise.all([
    evaluateBound(uBound),
    evaluateBound(vBound),
    createEvaluator(spec.surface.x),
    createEvaluator(spec.surface.y),
    createEvaluator(spec.surface.z),
  ]);
  const uValues = linspace(uLower, uUpper, 38);
  const vValues = linspace(vLower, vUpper, 42);
  const xGrid: number[][] = [];
  const yGrid: number[][] = [];
  const zGrid: number[][] = [];
  for (const v of vValues) {
    const scopes = uValues.map((u) => ({ [uBound.variable]: u, [vBound.variable]: v }));
    xGrid.push(scopes.map(xEval));
    yGrid.push(scopes.map(yEval));
    zGrid.push(scopes.map(zEval));
  }
  return {
    data: [
      {
        type: "surface",
        x: xGrid,
        y: yGrid,
        z: zGrid,
        opacity: 0.82,
        showscale: false,
        colorscale: [
          [0, "#b7ceff"],
          [1, BLUE],
        ],
        contours: {
          x: { show: true, color: "rgba(16,42,76,.18)", width: 1 },
          y: { show: true, color: "rgba(16,42,76,.18)", width: 1 },
        },
        hovertemplate: "x=%{x:.3g}<br>y=%{y:.3g}<br>z=%{z:.3g}<extra></extra>",
      },
    ],
    layout: {
      ...commonLayout,
      margin: { l: 8, r: 8, t: 12, b: 8 },
      scene: {
        xaxis: { title: { text: "x" }, gridcolor: GRID },
        yaxis: { title: { text: "y" }, gridcolor: GRID },
        zaxis: { title: { text: "z" }, gridcolor: GRID },
        bgcolor: "#f8fafc",
        aspectmode: "data",
        camera: { eye: { x: 1.45, y: 1.5, z: 1.1 } },
      },
    },
    config: commonConfig,
    dimension: "3d",
    summary: `显示由参数 ${uBound.variable}、${vBound.variable} 描述的曲面，可拖动旋转。`,
  } satisfies IntegralPlotSpec;
}

export async function buildPlotSpec(spec: IntegralSpec): Promise<IntegralPlotSpec> {
  if (spec.type === "ordinary") return ordinaryPlot(spec);
  if (spec.type === "double") return doublePlot(spec);
  if (spec.type === "triple") return triplePlot(spec);
  if (spec.type === "line") return linePlot(spec);
  return surfacePlot(spec);
}
