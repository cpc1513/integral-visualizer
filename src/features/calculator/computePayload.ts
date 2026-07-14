import { latexToExpression } from "./expression";
import { parseConstraint, type ConstraintOperator } from "./constraintExpression";
import type { IntegralSpec, VariableBound } from "./types";

export interface ComputePayload {
  type: IntegralSpec["type"];
  integrand: string;
  definite?: boolean;
  bounds?: Array<Pick<VariableBound, "variable" | "lower" | "upper">>;
  mode?: "scalar" | "work" | "flux";
  path?: Record<"x" | "y" | "z", string>;
  surface?: Record<"x" | "y" | "z", string>;
  vectorField?: Record<"p" | "q" | "r", string>;
  orientation?: 1 | -1;
  constraintRegion?: {
    constraints: Array<{ left: string; right: string; operator: ConstraintOperator }>;
    ranges: Array<{ variable: string; lower: string; upper: string }>;
  };
}

const normalizeBound = (bound: VariableBound) => ({
  variable: bound.variable.trim(),
  lower: latexToExpression(bound.lower),
  upper: latexToExpression(bound.upper),
});

export function createComputePayload(spec: IntegralSpec): ComputePayload {
  const base = { type: spec.type, integrand: latexToExpression(spec.integrand) } as const;
  if (spec.type === "ordinary") {
    return {
      ...base,
      definite: spec.definite,
      bounds: [normalizeBound(spec.bound)],
    };
  }
  if (spec.type === "double" || spec.type === "triple") {
    if (spec.regionMode === "constraints" && spec.constraintRegion) {
      const constraints = spec.constraintRegion.constraints.map(parseConstraint);
      if (constraints.some((constraint) => constraint.operator === "=")) {
        throw new Error("二重、三重积分区域必须由不等式围成；单独等式是零测集，不能表示面积或体积");
      }
      return {
        ...base,
        constraintRegion: {
          constraints: constraints.map(({ left, right, operator }) => ({ left, right, operator })),
          ranges: spec.constraintRegion.ranges.map((range) => ({
            variable: range.variable,
            lower: latexToExpression(range.lower),
            upper: latexToExpression(range.upper),
          })),
        },
      };
    }
    return { ...base, bounds: spec.bounds.map(normalizeBound) };
  }
  if (spec.type === "line") {
    return {
      ...base,
      mode: spec.mode,
      bounds: [normalizeBound(spec.parameter)],
      path: {
        x: latexToExpression(spec.path.x),
        y: latexToExpression(spec.path.y),
        z: latexToExpression(spec.path.z),
      },
      vectorField: {
        p: latexToExpression(spec.vectorField.p),
        q: latexToExpression(spec.vectorField.q),
        r: latexToExpression(spec.vectorField.r),
      },
      orientation: spec.orientation ?? 1,
    };
  }
  return {
    ...base,
    mode: spec.mode,
    bounds: spec.parameters.map(normalizeBound),
    surface: {
      x: latexToExpression(spec.surface.x),
      y: latexToExpression(spec.surface.y),
      z: latexToExpression(spec.surface.z),
    },
    vectorField: {
      p: latexToExpression(spec.vectorField.p),
      q: latexToExpression(spec.vectorField.q),
      r: latexToExpression(spec.vectorField.r),
    },
    orientation: spec.orientation,
  };
}
