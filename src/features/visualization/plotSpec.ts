import type { Config, Layout } from "plotly.js";
import { latexToExpression } from "../calculator/expression";
import { constraintViolation, parseConstraint } from "../calculator/constraintExpression";
import type { IntegralSpec, VariableBound } from "../calculator/types";
import { traceImplicitCurves, type Point3 } from "./implicitCurveTracer";

export interface IntegralPlotSpec {
  data: Array<Record<string, unknown>>;
  layout: Partial<Layout>;
  config: Partial<Config>;
  dimension: "2d" | "3d";
  summary: string;
  threeField?: ThreeScalarField;
  threeCurve?: ThreeCurveSpec;
}

export interface ThreeScalarField {
  resolution: number;
  values: number[];
  clipFields?: number[][];
  isoLevel: number;
  ranges: [ThreeScalarFieldRange, ThreeScalarFieldRange, ThreeScalarFieldRange];
}

export interface ThreeScalarFieldRange {
  variable: string;
  lower: number;
  upper: number;
}

export interface ThreeCurveSpec {
  paths: Array<{ points: Point3[]; closed: boolean }>;
  ranges: [ThreeScalarFieldRange, ThreeScalarFieldRange, ThreeScalarFieldRange];
  tubeRadius: number;
  direction: 1 | -1;
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

async function constraintRegionPlot(
  spec: Extract<IntegralSpec, { type: "double" | "triple" }>,
): Promise<IntegralPlotSpec> {
  const region = spec.constraintRegion;
  const dimensionCount = spec.type === "double" ? 2 : 3;
  if (!region || region.constraints.length === 0) throw new Error("请至少输入一条积分区域约束");
  if (region.ranges.length !== dimensionCount) throw new Error(`当前区域需要 ${dimensionCount} 个扫描范围`);
  const parsed = region.constraints.map(parseConstraint);
  const evaluators = await Promise.all(
    parsed.map(async (constraint) => ({
      constraint,
      left: await createEvaluator(constraint.left),
      right: await createEvaluator(constraint.right),
    })),
  );
  const ranges = await Promise.all(
    region.ranges.map(async (range) => {
      const [lower, upper] = await evaluateBound(range);
      if (lower >= upper) throw new Error(`${range.variable} 的扫描范围下限必须小于上限`);
      return { ...range, lowerValue: lower, upperValue: upper };
    }),
  );
  const maxSpan = Math.max(...ranges.map((range) => range.upperValue - range.lowerValue));
  const tolerance = maxSpan * 0.006;
  const violationAt = (scope: Record<string, number>) =>
    Math.max(
      ...evaluators.map(({ constraint, left, right }) =>
        constraintViolation(constraint, left(scope), right(scope), tolerance),
      ),
    );

  if (spec.type === "double") {
    const [xRange, yRange] = ranges;
    const x = linspace(xRange.lowerValue, xRange.upperValue, 300);
    const y = linspace(yRange.lowerValue, yRange.upperValue, 300);
    let validCount = 0;
    const violationField = y.map((yValue) =>
      x.map((xValue) => {
        const violation = violationAt({ [xRange.variable]: xValue, [yRange.variable]: yValue });
        const valid = violation <= 0;
        if (valid) validCount += 1;
        return violation;
      }),
    );
    if (validCount === 0) throw new Error("当前扫描范围内没有满足全部约束的区域");
    return {
      data: [
        {
          type: "contour",
          x,
          y,
          z: violationField,
          showscale: false,
          autocontour: false,
          contours: {
            type: "constraint",
            operation: "<=",
            value: 0,
            coloring: "fill",
            showlines: false,
          },
          fillcolor: "rgba(37,99,235,.30)",
          hovertemplate: `${xRange.variable}=%{x:.4g}<br>${yRange.variable}=%{y:.4g}<extra>区域内</extra>`,
        },
        {
          type: "contour",
          x,
          y,
          z: violationField,
          showscale: false,
          autocontour: false,
          contours: { start: 0, end: 0, size: 1, coloring: "lines", showlines: true },
          line: { color: BLUE, width: 2.2, smoothing: 1.3 },
          hoverinfo: "skip",
        },
      ],
      layout: {
        ...commonLayout,
        xaxis: { title: { text: xRange.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0" },
        yaxis: { title: { text: yRange.variable }, gridcolor: GRID, zerolinecolor: "#aebbd0", scaleanchor: "x", scaleratio: 1 },
      },
      config: commonConfig,
      dimension: "2d",
      summary: `显示满足 ${region.constraints.join("，")} 的二维积分区域。`,
    };
  }

  const [xRange, yRange, zRange] = ranges;
  const coarseResolution = 19;
  const coarseAxes = [xRange, yRange, zRange].map((range) =>
    linspace(range.lowerValue, range.upperValue, coarseResolution),
  ) as [number[], number[], number[]];
  const minimumInside = [coarseResolution, coarseResolution, coarseResolution];
  const maximumInside = [-1, -1, -1];
  let coarseInsideCount = 0;
  for (let zIndex = 0; zIndex < coarseResolution; zIndex += 1) {
    for (let yIndex = 0; yIndex < coarseResolution; yIndex += 1) {
      for (let xIndex = 0; xIndex < coarseResolution; xIndex += 1) {
        const violation = violationAt({
          [xRange.variable]: coarseAxes[0][xIndex],
          [yRange.variable]: coarseAxes[1][yIndex],
          [zRange.variable]: coarseAxes[2][zIndex],
        });
        if (violation > 0) continue;
        coarseInsideCount += 1;
        minimumInside[0] = Math.min(minimumInside[0], xIndex);
        minimumInside[1] = Math.min(minimumInside[1], yIndex);
        minimumInside[2] = Math.min(minimumInside[2], zIndex);
        maximumInside[0] = Math.max(maximumInside[0], xIndex);
        maximumInside[1] = Math.max(maximumInside[1], yIndex);
        maximumInside[2] = Math.max(maximumInside[2], zIndex);
      }
    }
  }

  const renderRanges = [xRange, yRange, zRange].map((range, axis) => {
    if (coarseInsideCount === 0) return { lower: range.lowerValue, upper: range.upperValue };
    const lowerIndex = Math.max(0, minimumInside[axis] - 1);
    const upperIndex = Math.min(coarseResolution - 1, maximumInside[axis] + 1);
    return { lower: coarseAxes[axis][lowerIndex], upper: coarseAxes[axis][upperIndex] };
  }) as [{ lower: number; upper: number }, { lower: number; upper: number }, { lower: number; upper: number }];

  const resolution = 48;
  const xValues = linspace(renderRanges[0].lower, renderRanges[0].upper, resolution);
  const yValues = linspace(renderRanges[1].lower, renderRanges[1].upper, resolution);
  const zValues = linspace(renderRanges[2].lower, renderRanges[2].upper, resolution);
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  const value: number[] = [];
  let insideCount = 0;
  for (const zValue of zValues) {
    for (const yValue of yValues) {
      for (const xValue of xValues) {
        const violation = violationAt({
          [xRange.variable]: xValue,
          [yRange.variable]: yValue,
          [zRange.variable]: zValue,
        });
        x.push(xValue);
        y.push(yValue);
        z.push(zValue);
        value.push(violation);
        if (violation <= 0) insideCount += 1;
      }
    }
  }
  if (insideCount === 0) throw new Error("当前扫描范围内没有满足全部约束的立体区域");
  return {
    data: [
      {
        type: "isosurface",
        x,
        y,
        z,
        value,
        isomin: -tolerance * 0.5,
        isomax: tolerance * 0.5,
        surface: { count: 1, fill: 1 },
        caps: { x: { show: false }, y: { show: false }, z: { show: false } },
        colorscale: [[0, "#8fb2ff"], [1, BLUE]],
        showscale: false,
        opacity: 1,
        flatshading: false,
        lighting: { ambient: 0.9, diffuse: 0.45, roughness: 0.9, specular: 0.08, fresnel: 0.04 },
        hovertemplate: `${xRange.variable}=%{x:.3g}<br>${yRange.variable}=%{y:.3g}<br>${zRange.variable}=%{z:.3g}<extra></extra>`,
      },
    ],
    layout: {
      ...commonLayout,
      margin: { l: 8, r: 8, t: 12, b: 8 },
      scene: {
        xaxis: { title: { text: xRange.variable }, gridcolor: GRID },
        yaxis: { title: { text: yRange.variable }, gridcolor: GRID },
        zaxis: { title: { text: zRange.variable }, gridcolor: GRID },
        bgcolor: "#f8fafc",
        aspectmode: "cube",
        camera: { eye: { x: 1.55, y: 1.55, z: 1.15 } },
      },
    },
    config: commonConfig,
    dimension: "3d",
    summary: `显示满足 ${region.constraints.join("，")} 的三维积分区域，可拖动旋转。`,
    threeField: {
      resolution,
      values: value,
      isoLevel: 0,
      ranges: [
        { variable: xRange.variable, lower: renderRanges[0].lower, upper: renderRanges[0].upper },
        { variable: yRange.variable, lower: renderRanges[1].lower, upper: renderRanges[1].upper },
        { variable: zRange.variable, lower: renderRanges[2].lower, upper: renderRanges[2].upper },
      ],
    },
  };
}

function curveRanges(points: Point3[]): [ThreeScalarFieldRange, ThreeScalarFieldRange, ThreeScalarFieldRange] {
  const variables = ["x", "y", "z"];
  const minimums = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])));
  const maximums = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])));
  const maxSpan = Math.max(...maximums.map((maximum, axis) => maximum - minimums[axis]), 1);
  return variables.map((variable, axis) => {
    const span = maximums[axis] - minimums[axis];
    const padding = Math.max(span * 0.12, maxSpan * 0.08);
    return { variable, lower: minimums[axis] - padding, upper: maximums[axis] + padding };
  }) as [ThreeScalarFieldRange, ThreeScalarFieldRange, ThreeScalarFieldRange];
}

function distance3(first: Point3, second: Point3) {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

async function implicitRegionPlot(
  spec: Extract<IntegralSpec, { type: "line" | "surface" }>,
): Promise<IntegralPlotSpec> {
  const region = spec.constraintRegion;
  if (!region || region.constraints.length === 0) {
    throw new Error(spec.type === "line" ? "请添加定义曲线的隐式条件" : "请添加定义曲面的隐式条件");
  }
  if (region.ranges.length !== 3) throw new Error("隐式曲线和曲面需要 x、y、z 三个扫描范围");
  const parsed = region.constraints.map(parseConstraint);
  const equalities = parsed.filter((constraint) => constraint.operator === "=");
  if (spec.type === "line" && equalities.length < 2) throw new Error("隐式曲线通常需要两个独立等式");
  if (spec.type === "surface" && equalities.length < 1) throw new Error("隐式曲面至少需要一个等式");
  const evaluators = await Promise.all(parsed.map(async (constraint) => ({
    constraint,
    left: await createEvaluator(constraint.left),
    right: await createEvaluator(constraint.right),
  })));
  const inequalityEvaluators = evaluators.filter(({ constraint }) => constraint.operator !== "=");
  const ranges = await Promise.all(region.ranges.map(async (range) => {
    const [lower, upper] = await evaluateBound(range);
    if (lower >= upper) throw new Error(`${range.variable} 的扫描范围下限必须小于上限`);
    return { ...range, lowerValue: lower, upperValue: upper };
  }));
  const [xRange, yRange, zRange] = ranges;
  const maxSpan = Math.max(...ranges.map((range) => range.upperValue - range.lowerValue));
  const equalityTolerance = maxSpan * (spec.type === "line" ? 0.035 : 0.008);
  const evaluateAll = (scope: Record<string, number>) => evaluators.map(({ constraint, left, right }) => ({
    constraint,
    left: left(scope),
    right: right(scope),
  }));
  const satisfiesInequalities = (values: ReturnType<typeof evaluateAll>) =>
    values.every(({ constraint, left, right }) =>
      constraint.operator === "=" || constraintViolation(constraint, left, right, equalityTolerance) <= 0,
    );

  if (spec.type === "surface") {
    const containsVariable = (expression: string, variable: string) => {
      const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`).test(expression);
    };
    const explicitIndex = evaluators.findIndex(({ constraint }) => {
      if (constraint.operator !== "=") return false;
      return ranges.some((range) => {
        const leftIsVariable = constraint.left.trim() === range.variable;
        const rightIsVariable = constraint.right.trim() === range.variable;
        return (
          (leftIsVariable && !containsVariable(constraint.right, range.variable))
          || (rightIsVariable && !containsVariable(constraint.left, range.variable))
        );
      });
    });

    if (explicitIndex >= 0 && inequalityEvaluators.length === 0) {
      const primary = evaluators[explicitIndex];
      const solvedRange = ranges.find((range) =>
        primary.constraint.left.trim() === range.variable || primary.constraint.right.trim() === range.variable,
      )!;
      const solvedEvaluator = primary.constraint.left.trim() === solvedRange.variable
        ? primary.right
        : primary.left;
      const independentRanges = ranges.filter((range) => range.variable !== solvedRange.variable);
      const [columnRange, rowRange] = independentRanges;
      const columnValues = linspace(columnRange.lowerValue, columnRange.upperValue, 72);
      const rowValues = linspace(rowRange.lowerValue, rowRange.upperValue, 72);
      const xGrid: Array<Array<number | null>> = [];
      const yGrid: Array<Array<number | null>> = [];
      const zGrid: Array<Array<number | null>> = [];
      let validCount = 0;

      for (const rowValue of rowValues) {
        const xRow: Array<number | null> = [];
        const yRow: Array<number | null> = [];
        const zRow: Array<number | null> = [];
        for (const columnValue of columnValues) {
          const scope: Record<string, number> = {
            [columnRange.variable]: columnValue,
            [rowRange.variable]: rowValue,
          };
          const solvedValue = solvedEvaluator(scope);
          scope[solvedRange.variable] = solvedValue;
          const withinSolvedRange = Number.isFinite(solvedValue)
            && solvedValue >= solvedRange.lowerValue - equalityTolerance
            && solvedValue <= solvedRange.upperValue + equalityTolerance;
          const values = withinSolvedRange ? evaluateAll(scope) : [];
          const valid = withinSolvedRange && values.every(({ constraint, left, right }, index) =>
            index === explicitIndex || constraintViolation(constraint, left, right, equalityTolerance) <= 0,
          );
          if (valid) validCount += 1;
          xRow.push(valid ? scope[xRange.variable] : null);
          yRow.push(valid ? scope[yRange.variable] : null);
          zRow.push(valid ? scope[zRange.variable] : null);
        }
        xGrid.push(xRow);
        yGrid.push(yRow);
        zGrid.push(zRow);
      }

      if (validCount > 0) {
        return {
          data: [{
            type: "surface",
            x: xGrid,
            y: yGrid,
            z: zGrid,
            connectgaps: false,
            colorscale: [[0, "#9bbcff"], [1, BLUE]],
            showscale: false,
            opacity: 0.96,
            contours: {
              x: { show: false },
              y: { show: false },
              z: { show: false },
            },
            lighting: { ambient: 0.82, diffuse: 0.7, roughness: 0.72, specular: 0.12, fresnel: 0.04 },
            lightposition: { x: 120, y: 160, z: 220 },
            hovertemplate: `${xRange.variable}=%{x:.3g}<br>${yRange.variable}=%{y:.3g}<br>${zRange.variable}=%{z:.3g}<extra></extra>`,
          }],
          layout: {
            ...commonLayout,
            margin: { l: 8, r: 8, t: 12, b: 8 },
            scene: {
              xaxis: { title: { text: xRange.variable }, gridcolor: GRID },
              yaxis: { title: { text: yRange.variable }, gridcolor: GRID },
              zaxis: { title: { text: zRange.variable }, gridcolor: GRID },
              bgcolor: "#f8fafc",
              aspectmode: "data",
              camera: { eye: { x: 1.45, y: 1.5, z: 1.1 } },
            },
          },
          config: commonConfig,
          dimension: "3d",
          summary: `显示满足 ${region.constraints.join("，")} 的平滑曲面，可拖动旋转。`,
        };
      }
    }

    const count = 48;
    const xValues = linspace(xRange.lowerValue, xRange.upperValue, count);
    const yValues = linspace(yRange.lowerValue, yRange.upperValue, count);
    const zValues = linspace(zRange.lowerValue, zRange.upperValue, count);
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    const value: Array<number | null> = [];
    const threeValues: number[] = [];
    const clipEvaluators = inequalityEvaluators;
    const clipFields = clipEvaluators.map(() => [] as number[]);
    let visibleSamples = 0;
    for (const zValue of zValues) for (const yValue of yValues) for (const xValue of xValues) {
      const values = evaluateAll({ [xRange.variable]: xValue, [yRange.variable]: yValue, [zRange.variable]: zValue });
      const primary = values.find(({ constraint }) => constraint.operator === "=")!;
      const allowed = satisfiesInequalities(values);
      const surfaceValue = primary.left - primary.right;
      x.push(xValue); y.push(yValue); z.push(zValue);
      value.push(allowed ? surfaceValue : null);
      threeValues.push(surfaceValue);
      clipEvaluators.forEach(({ constraint }, index) => {
        const evaluated = values.find((value) => value.constraint === constraint)!;
        clipFields[index].push(constraintViolation(constraint, evaluated.left, evaluated.right, equalityTolerance));
      });
      if (allowed && Math.abs(surfaceValue) <= equalityTolerance * 2) visibleSamples += 1;
    }
    if (visibleSamples === 0) throw new Error("当前扫描范围内没有找到满足条件的曲面");
    return {
      data: [{
        type: "isosurface", x, y, z, value, isomin: 0, isomax: 0,
        surface: { count: 1, fill: 1 },
        caps: { x: { show: false }, y: { show: false }, z: { show: false } },
        colorscale: [[0, "#9bbcff"], [1, BLUE]], showscale: false, opacity: 1,
        flatshading: false,
        lighting: { ambient: 0.9, diffuse: 0.45, roughness: 0.9, specular: 0.08, fresnel: 0.04 },
        hovertemplate: "x=%{x:.3g}<br>y=%{y:.3g}<br>z=%{z:.3g}<extra></extra>",
      }],
      layout: {
        ...commonLayout, margin: { l: 8, r: 8, t: 12, b: 8 },
        scene: {
          xaxis: { title: { text: xRange.variable }, gridcolor: GRID },
          yaxis: { title: { text: yRange.variable }, gridcolor: GRID },
          zaxis: { title: { text: zRange.variable }, gridcolor: GRID },
          bgcolor: "#f8fafc", aspectmode: "data",
          camera: { eye: { x: 1.45, y: 1.5, z: 1.1 } },
        },
      },
      config: commonConfig, dimension: "3d",
      summary: `显示满足 ${region.constraints.join("，")} 的隐式曲面，可拖动旋转。`,
      threeField: {
        resolution: count,
        values: threeValues,
        clipFields: clipFields.length > 0 ? clipFields : undefined,
        isoLevel: 0,
        ranges: [
          { variable: xRange.variable, lower: xRange.lowerValue, upper: xRange.upperValue },
          { variable: yRange.variable, lower: yRange.lowerValue, upper: yRange.upperValue },
          { variable: zRange.variable, lower: zRange.lowerValue, upper: zRange.upperValue },
        ],
      },
    };
  }

  const primaryEqualities = evaluators.filter(({ constraint }) => constraint.operator === "=").slice(0, 2);
  const remainingConstraints = evaluators.filter((evaluator) => !primaryEqualities.includes(evaluator));
  const pointScope = ([x, y, z]: Point3) => ({
    [xRange.variable]: x,
    [yRange.variable]: y,
    [zRange.variable]: z,
  });
  const equationFunctions = primaryEqualities.map(({ left, right }) => (point: Point3) => {
    const scope = pointScope(point);
    return left(scope) - right(scope);
  }) as [(point: Point3) => number, (point: Point3) => number];
  const inequalityFunctions = remainingConstraints.map(({ constraint, left, right }) => (point: Point3) => {
    const scope = pointScope(point);
    return constraintViolation(constraint, left(scope), right(scope), equalityTolerance);
  });
  try {
    const traced = traceImplicitCurves({
      equations: equationFunctions,
      inequalities: inequalityFunctions,
      ranges: [
        { lower: xRange.lowerValue, upper: xRange.upperValue },
        { lower: yRange.lowerValue, upper: yRange.upperValue },
        { lower: zRange.lowerValue, upper: zRange.upperValue },
      ],
    });
    const direction = spec.orientation ?? 1;
    const paths = traced.map((path) => ({
      closed: path.closed,
      points: direction === 1 ? path.points : [...path.points].reverse(),
    }));
    const displayRanges = curveRanges(paths.flatMap((path) => path.points));
    const displaySpan = Math.max(...displayRanges.map((range) => range.upper - range.lower));
    return {
      data: paths.map((path) => ({
        type: "scatter3d",
        mode: "lines",
        x: path.points.map((point) => point[0]),
        y: path.points.map((point) => point[1]),
        z: path.points.map((point) => point[2]),
        line: { color: BLUE, width: 7 },
        hovertemplate: "x=%{x:.3g}<br>y=%{y:.3g}<br>z=%{z:.3g}<extra></extra>",
      })),
      layout: {
        ...commonLayout, margin: { l: 8, r: 8, t: 12, b: 8 },
        scene: {
          xaxis: { title: { text: xRange.variable }, gridcolor: GRID },
          yaxis: { title: { text: yRange.variable }, gridcolor: GRID },
          zaxis: { title: { text: zRange.variable }, gridcolor: GRID },
          bgcolor: "#f8fafc", aspectmode: "data",
        },
      },
      config: commonConfig,
      dimension: "3d",
      summary: `显示满足 ${region.constraints.join("，")} 的连续隐式交线，可拖动旋转。`,
      threeCurve: {
        paths,
        ranges: displayRanges.map((range, axis) => ({
          ...range,
          variable: [xRange.variable, yRange.variable, zRange.variable][axis],
        })) as [ThreeScalarFieldRange, ThreeScalarFieldRange, ThreeScalarFieldRange],
        tubeRadius: displaySpan * 0.008,
        direction,
      },
    };
  } catch {
    const count = 45;
    const xValues = linspace(xRange.lowerValue, xRange.upperValue, count);
    const yValues = linspace(yRange.lowerValue, yRange.upperValue, count);
    const zValues = linspace(zRange.lowerValue, zRange.upperValue, count);
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    for (const zValue of zValues) for (const yValue of yValues) for (const xValue of xValues) {
      const values = evaluateAll({ [xRange.variable]: xValue, [yRange.variable]: yValue, [zRange.variable]: zValue });
      const equalityValues = values.filter(({ constraint }) => constraint.operator === "=");
      if (
        satisfiesInequalities(values)
        && equalityValues.every(({ left, right }) => Math.abs(left - right) <= equalityTolerance)
      ) {
        x.push(xValue); y.push(yValue); z.push(zValue);
      }
    }
    if (x.length === 0) throw new Error("当前扫描范围内没有找到两曲面的交线，请适当缩小范围");
    return {
      data: [{
        type: "scatter3d", mode: "markers", x, y, z,
        marker: { color: BLUE, size: 3.5, opacity: 0.9 },
        hovertemplate: "x=%{x:.3g}<br>y=%{y:.3g}<br>z=%{z:.3g}<extra></extra>",
      }],
      layout: {
        ...commonLayout, margin: { l: 8, r: 8, t: 12, b: 8 },
        scene: {
          xaxis: { title: { text: xRange.variable }, gridcolor: GRID },
          yaxis: { title: { text: yRange.variable }, gridcolor: GRID },
          zaxis: { title: { text: zRange.variable }, gridcolor: GRID },
          bgcolor: "#f8fafc", aspectmode: "data",
        },
      },
      config: commonConfig, dimension: "3d",
      summary: `显示满足 ${region.constraints.join("，")} 的隐式曲线（兼容点云模式）。`,
    };
  }
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
  const direction = spec.orientation ?? 1;
  const evaluatedPoints = parameterValues.map((value) => {
    const scope = { [spec.parameter.variable]: value };
    return [xEval(scope), yEval(scope), zEval(scope)] as Point3;
  });
  const points = direction === 1 ? evaluatedPoints : [...evaluatedPoints].reverse();
  const x = points.map((point) => point[0]);
  const y = points.map((point) => point[1]);
  const z = points.map((point) => point[2]);
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

  const ranges = curveRanges(points);
  const maxSpan = Math.max(...ranges.map((range) => range.upper - range.lower));
  const closed = distance3(points[0], points.at(-1)!) < maxSpan * 1e-4;
  const threePoints = closed ? points.slice(0, -1) : points;
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
    threeCurve: isPlanar ? undefined : {
      paths: [{ points: threePoints, closed }],
      ranges,
      tubeRadius: maxSpan * 0.0075,
      direction,
    },
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
  if ((spec.type === "double" || spec.type === "triple") && spec.regionMode === "constraints") {
    return constraintRegionPlot(spec);
  }
  if (spec.type === "double") return doublePlot(spec);
  if (spec.type === "triple") return triplePlot(spec);
  if ((spec.type === "line" || spec.type === "surface") && spec.regionMode === "constraints") {
    return implicitRegionPlot(spec);
  }
  if (spec.type === "line") return linePlot(spec);
  return surfacePlot(spec);
}
