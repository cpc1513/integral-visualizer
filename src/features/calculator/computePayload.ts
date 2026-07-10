import { latexToExpression } from "./expression";
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
