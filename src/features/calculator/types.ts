export type IntegralType = "ordinary" | "double" | "triple" | "line" | "surface";

export interface VariableBound {
  variable: string;
  lower: string;
  upper: string;
  label: string;
}

interface BaseIntegralSpec {
  type: IntegralType;
  integrand: string;
  latex: string;
  exampleName: string;
}

export interface OrdinaryIntegralSpec extends BaseIntegralSpec {
  type: "ordinary";
  bound: VariableBound;
  definite: boolean;
}

export interface MultipleIntegralSpec<T extends "double" | "triple" = "double" | "triple">
  extends BaseIntegralSpec {
  type: T;
  /** Bounds are stored inner-most first so symbolic integration is deterministic. */
  bounds: VariableBound[];
}

export interface LineIntegralSpec extends BaseIntegralSpec {
  type: "line";
  mode: "scalar" | "work";
  parameter: VariableBound;
  path: { x: string; y: string; z: string };
  vectorField: { p: string; q: string; r: string };
}

export interface SurfaceIntegralSpec extends BaseIntegralSpec {
  type: "surface";
  mode: "scalar" | "flux";
  parameters: [VariableBound, VariableBound];
  surface: { x: string; y: string; z: string };
  vectorField: { p: string; q: string; r: string };
  orientation: 1 | -1;
}

export type IntegralSpec =
  | OrdinaryIntegralSpec
  | MultipleIntegralSpec<"double">
  | MultipleIntegralSpec<"triple">
  | LineIntegralSpec
  | SurfaceIntegralSpec;

export interface ComputeResult {
  status: "exact" | "numeric";
  exactLatex: string | null;
  numericValue: string;
  errorEstimate?: string;
  steps: Array<{ label: string; latex: string }>;
  elapsedMs: number;
}

export type ComputeStatus =
  | "idle"
  | "loading-python"
  | "loading-symbolics"
  | "computing"
  | "loading-numerics"
  | "complete"
  | "error";
