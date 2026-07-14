import { integralExamples, DEFAULT_INTEGRAL_TYPE } from "./examples";
import { regenerateFormula } from "./formula";
import type {
  ConstraintRegion,
  IntegralSpec,
  IntegralType,
  LineIntegralSpec,
  OrdinaryIntegralSpec,
  SurfaceIntegralSpec,
  VariableBound,
} from "./types";

export const CALCULATOR_STORAGE_VERSION = 3;
export const CALCULATOR_STORAGE_KEY = "integral-visualizer:calculator:v3";
const LEGACY_STORAGE_KEYS = ["integral-visualizer:calculator:v2"] as const;
const integralTypes = ["ordinary", "double", "triple", "line", "surface"] as const;

export type CalculatorSpecs = {
  [T in IntegralType]: Extract<IntegralSpec, { type: T }>;
};

export interface CalculatorState {
  activeType: IntegralType;
  specs: CalculatorSpecs;
}

interface PersistedCalculatorState extends CalculatorState {
  version: typeof CALCULATOR_STORAGE_VERSION;
}

export interface CalculatorStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

type UnknownRecord = Record<string, unknown>;
type MultipleSpec = Extract<IntegralSpec, { type: "double" | "triple" }>;

interface MergedBase {
  exampleName: string;
  integrand: string;
  latex: string;
  preferredComputeMode?: "exact" | "numeric";
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOr = (value: unknown, fallback: string) => typeof value === "string" ? value : fallback;

function isIntegralType(value: unknown): value is IntegralType {
  return typeof value === "string" && (integralTypes as readonly string[]).includes(value);
}

function mergeBound(value: unknown, fallback: VariableBound): VariableBound {
  if (!isRecord(value)) return structuredClone(fallback);
  return {
    variable: stringOr(value.variable, fallback.variable),
    lower: stringOr(value.lower, fallback.lower),
    upper: stringOr(value.upper, fallback.upper),
    label: stringOr(value.label, fallback.label),
  };
}

function mergeConstraintRegion(value: unknown, fallbackVariables: string[]): ConstraintRegion | null {
  if (!isRecord(value) || !Array.isArray(value.constraints) || !Array.isArray(value.ranges)) return null;
  if (!value.constraints.every((constraint) => typeof constraint === "string")) return null;
  if (value.ranges.length !== fallbackVariables.length) return null;
  const ranges = value.ranges.map((range, index) => {
    const fallback = { variable: fallbackVariables[index], lower: "-5", upper: "5" };
    if (!isRecord(range)) return fallback;
    return {
      variable: stringOr(range.variable, fallback.variable),
      lower: stringOr(range.lower, fallback.lower),
      upper: stringOr(range.upper, fallback.upper),
    };
  });
  return { constraints: [...value.constraints], ranges };
}

function mergeBase<T extends IntegralSpec>(value: UnknownRecord, fallback: T): MergedBase {
  const preferredComputeMode = value.preferredComputeMode === "exact" || value.preferredComputeMode === "numeric"
    ? value.preferredComputeMode
    : fallback.preferredComputeMode;
  return {
    exampleName: stringOr(value.exampleName, fallback.exampleName),
    integrand: stringOr(value.integrand, fallback.integrand),
    latex: stringOr(value.latex, fallback.latex),
    ...(preferredComputeMode ? { preferredComputeMode } : {}),
  };
}

function mergeOrdinary(value: UnknownRecord, fallback: OrdinaryIntegralSpec): OrdinaryIntegralSpec {
  const next: OrdinaryIntegralSpec = {
    ...fallback,
    ...mergeBase(value, fallback),
    definite: typeof value.definite === "boolean" ? value.definite : fallback.definite,
    bound: mergeBound(value.bound, fallback.bound),
  };
  return regenerateFormula(next);
}

function mergeMultiple(
  value: UnknownRecord,
  fallback: MultipleSpec,
): MultipleSpec {
  const expectedLength = fallback.type === "double" ? 2 : 3;
  const storedBounds = Array.isArray(value.bounds) && value.bounds.length === expectedLength ? value.bounds : [];
  const bounds = fallback.bounds.map((bound, index) => mergeBound(storedBounds[index], bound));
  const constraintRegion = mergeConstraintRegion(
    value.constraintRegion,
    [...bounds].reverse().map((bound) => bound.variable),
  );
  const regionMode = value.regionMode === "constraints" && constraintRegion
    ? "constraints"
    : value.regionMode === "bounds"
      ? "bounds"
      : fallback.regionMode;
  const next = {
    ...fallback,
    ...mergeBase(value, fallback),
    bounds,
    regionMode,
    ...(constraintRegion ? { constraintRegion } : {}),
  } as MultipleSpec;
  return regenerateFormula(next);
}

function mergeLine(value: UnknownRecord, fallback: LineIntegralSpec): LineIntegralSpec {
  const path = isRecord(value.path) ? value.path : {};
  const vectorField = isRecord(value.vectorField) ? value.vectorField : {};
  const constraintRegion = mergeConstraintRegion(value.constraintRegion, ["x", "y", "z"]);
  const regionMode = value.regionMode === "constraints" && constraintRegion
    ? "constraints"
    : value.regionMode === "parameter"
      ? "parameter"
      : fallback.regionMode;
  const next: LineIntegralSpec = {
    ...fallback,
    ...mergeBase(value, fallback),
    mode: value.mode === "work" || value.mode === "scalar" ? value.mode : fallback.mode,
    orientation: value.orientation === -1 ? -1 : 1,
    parameter: mergeBound(value.parameter, fallback.parameter),
    path: {
      x: stringOr(path.x, fallback.path.x),
      y: stringOr(path.y, fallback.path.y),
      z: stringOr(path.z, fallback.path.z),
    },
    vectorField: {
      p: stringOr(vectorField.p, fallback.vectorField.p),
      q: stringOr(vectorField.q, fallback.vectorField.q),
      r: stringOr(vectorField.r, fallback.vectorField.r),
    },
    regionMode,
    ...(constraintRegion ? { constraintRegion } : {}),
  };
  return regenerateFormula(next);
}

function mergeSurface(value: UnknownRecord, fallback: SurfaceIntegralSpec): SurfaceIntegralSpec {
  const surface = isRecord(value.surface) ? value.surface : {};
  const vectorField = isRecord(value.vectorField) ? value.vectorField : {};
  const storedParameters = Array.isArray(value.parameters) && value.parameters.length === 2 ? value.parameters : [];
  const constraintRegion = mergeConstraintRegion(value.constraintRegion, ["x", "y", "z"]);
  const regionMode = value.regionMode === "constraints" && constraintRegion
    ? "constraints"
    : value.regionMode === "parameter"
      ? "parameter"
      : fallback.regionMode;
  const next: SurfaceIntegralSpec = {
    ...fallback,
    ...mergeBase(value, fallback),
    mode: value.mode === "flux" || value.mode === "scalar" ? value.mode : fallback.mode,
    orientation: value.orientation === -1 ? -1 : 1,
    parameters: [
      mergeBound(storedParameters[0], fallback.parameters[0]),
      mergeBound(storedParameters[1], fallback.parameters[1]),
    ],
    surface: {
      x: stringOr(surface.x, fallback.surface.x),
      y: stringOr(surface.y, fallback.surface.y),
      z: stringOr(surface.z, fallback.surface.z),
    },
    vectorField: {
      p: stringOr(vectorField.p, fallback.vectorField.p),
      q: stringOr(vectorField.q, fallback.vectorField.q),
      r: stringOr(vectorField.r, fallback.vectorField.r),
    },
    regionMode,
    ...(constraintRegion ? { constraintRegion } : {}),
  };
  return regenerateFormula(next);
}

function mergeSpec<T extends IntegralSpec>(value: unknown, fallback: T): T {
  if (!isRecord(value) || value.type !== fallback.type) return structuredClone(fallback);
  if (fallback.type === "ordinary") return mergeOrdinary(value, fallback) as T;
  if (fallback.type === "double" || fallback.type === "triple") {
    return mergeMultiple(value, fallback) as T;
  }
  if (fallback.type === "line") return mergeLine(value, fallback) as T;
  return mergeSurface(value, fallback as SurfaceIntegralSpec) as T;
}

export function createDefaultCalculatorState(): CalculatorState {
  return {
    activeType: DEFAULT_INTEGRAL_TYPE,
    specs: structuredClone(integralExamples) as CalculatorSpecs,
  };
}

function hydrateCalculatorState(value: unknown, requireVersion: boolean): CalculatorState | null {
  if (!isRecord(value) || !isRecord(value.specs)) return null;
  if (requireVersion && value.version !== CALCULATOR_STORAGE_VERSION) return null;
  const fallback = createDefaultCalculatorState();
  const specs: CalculatorSpecs = {
    ordinary: mergeSpec(value.specs.ordinary, fallback.specs.ordinary),
    double: mergeSpec(value.specs.double, fallback.specs.double),
    triple: mergeSpec(value.specs.triple, fallback.specs.triple),
    line: mergeSpec(value.specs.line, fallback.specs.line),
    surface: mergeSpec(value.specs.surface, fallback.specs.surface),
  };
  return {
    activeType: isIntegralType(value.activeType) ? value.activeType : fallback.activeType,
    specs,
  };
}

function browserStorage(): CalculatorStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadCalculatorState(storage: CalculatorStorage | undefined = browserStorage()): CalculatorState {
  const fallback = createDefaultCalculatorState();
  if (!storage) return fallback;
  const candidates: Array<{ key: string; requireVersion: boolean }> = [
    { key: CALCULATOR_STORAGE_KEY, requireVersion: true },
    ...LEGACY_STORAGE_KEYS.map((key) => ({ key, requireVersion: false })),
  ];
  for (const candidate of candidates) {
    try {
      const serialized = storage.getItem(candidate.key);
      if (!serialized) continue;
      const hydrated = hydrateCalculatorState(JSON.parse(serialized), candidate.requireVersion);
      if (hydrated) return hydrated;
    } catch {
      // Ignore an unreadable candidate and continue to legacy/default state.
    }
  }
  return fallback;
}

export function saveCalculatorState(
  state: CalculatorState,
  storage: CalculatorStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  const persisted: PersistedCalculatorState = {
    version: CALCULATOR_STORAGE_VERSION,
    ...state,
  };
  try {
    storage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return false;
  }
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      storage.removeItem?.(key);
    } catch {
      // The current state was stored successfully; legacy cleanup is best effort.
    }
  }
  return true;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function specFingerprint(spec: IntegralSpec): string {
  return JSON.stringify(canonicalize(spec));
}
