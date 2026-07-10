import type {
  IntegralSpec,
  LineIntegralSpec,
  MultipleIntegralSpec,
  OrdinaryIntegralSpec,
  SurfaceIntegralSpec,
  VariableBound,
} from "./types";

const differential = (variable: string) => `\\,d${variable}`;
const boundedIntegral = (bound: VariableBound) =>
  `\\int_{${bound.lower}}^{${bound.upper}}`;

export function generateFormulaLatex(spec: IntegralSpec): string {
  if (spec.type === "ordinary") {
    if (!spec.definite) return `\\int ${spec.integrand}${differential(spec.bound.variable)}`;
    return `${boundedIntegral(spec.bound)} ${spec.integrand}${differential(spec.bound.variable)}`;
  }

  if (spec.type === "double" || spec.type === "triple") {
    const signs = [...spec.bounds].reverse().map(boundedIntegral).join("");
    const measures = spec.bounds.map((bound) => differential(bound.variable)).join("");
    return `${signs} ${spec.integrand}${measures}`;
  }

  if (spec.type === "line") {
    if (spec.mode === "work") {
      const { p, q, r } = spec.vectorField;
      return `\\int_C ${p}\\,dx+${q}\\,dy+${r}\\,dz`;
    }
    return `\\int_C ${spec.integrand}\\,ds`;
  }

  if (spec.mode === "flux") {
    const { p, q, r } = spec.vectorField;
    return `\\iint_\\Sigma ${p}\\,dy\\,dz+${q}\\,dz\\,dx+${r}\\,dx\\,dy`;
  }
  return `\\iint_\\Sigma ${spec.integrand}\\,dS`;
}

function readGroup(source: string, index: number): { value: string; next: number } | null {
  if (source[index] !== "{") return null;
  let depth = 0;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return { value: source.slice(index + 1, cursor), next: cursor + 1 };
  }
  return null;
}

function readBound(source: string, index: number, marker: "_" | "^") {
  if (source[index] !== marker) return null;
  const start = index + 1;
  if (source[start] === "{") return readGroup(source, start);
  return { value: source[start] ?? "", next: start + 1 };
}

function parseNestedIntegrals(latex: string, count: number) {
  const cleaned = latex.replace(/\\left|\\right/g, "").trim();
  const parsedBounds: Array<{ lower: string; upper: string }> = [];
  let cursor = 0;
  for (let integralIndex = 0; integralIndex < count; integralIndex += 1) {
    while (/\s/.test(cleaned[cursor] ?? "")) cursor += 1;
    if (!cleaned.startsWith("\\int", cursor)) return null;
    cursor += 4;
    const lower = readBound(cleaned, cursor, "_");
    if (!lower) return null;
    cursor = lower.next;
    const upper = readBound(cleaned, cursor, "^");
    if (!upper) return null;
    cursor = upper.next;
    parsedBounds.push({ lower: lower.value, upper: upper.value });
  }

  const remainder = cleaned.slice(cursor).trim();
  const differentialPattern = /(?:\\,|\s)*d([A-Za-z])\s*$/;
  const variables: string[] = [];
  let body = remainder;
  for (let index = 0; index < count; index += 1) {
    const match = body.match(differentialPattern);
    if (!match || match.index === undefined) return null;
    variables.unshift(match[1]);
    body = body.slice(0, match.index).trim();
  }
  if (!body) return null;

  const bounds = parsedBounds
    .reverse()
    .map((bound, index) => ({
      variable: variables[index],
      lower: bound.lower,
      upper: bound.upper,
      label: index === 0 ? "内层" : index === 1 ? "中层" : "外层",
    }));
  return { integrand: body, bounds };
}

export function synchronizeFormula(spec: IntegralSpec, latex: string): IntegralSpec {
  if (spec.type === "ordinary" && spec.definite) {
    const parsed = parseNestedIntegrals(latex, 1);
    if (!parsed) return { ...spec, latex };
    const next: OrdinaryIntegralSpec = {
      ...spec,
      latex,
      integrand: parsed.integrand,
      bound: { ...spec.bound, ...parsed.bounds[0], label: spec.bound.label },
    };
    return next;
  }
  if (spec.type === "double" || spec.type === "triple") {
    const count = spec.type === "double" ? 2 : 3;
    const parsed = parseNestedIntegrals(latex, count);
    if (!parsed) return { ...spec, latex };
    const next: MultipleIntegralSpec = { ...spec, latex, ...parsed };
    return next;
  }
  if (spec.type === "line" && spec.mode === "scalar") {
    const match = latex.match(/\\int_?\{?C\}?\s*(.+?)(?:\\,)?ds\s*$/);
    const next: LineIntegralSpec = { ...spec, latex, integrand: match?.[1]?.trim() || spec.integrand };
    return next;
  }
  if (spec.type === "surface" && spec.mode === "scalar") {
    const match = latex.match(/\\iint_?\{?\\Sigma\}?\s*(.+?)(?:\\,)?dS\s*$/);
    const next: SurfaceIntegralSpec = {
      ...spec,
      latex,
      integrand: match?.[1]?.trim() || spec.integrand,
    };
    return next;
  }
  return { ...spec, latex };
}

export function regenerateFormula<T extends IntegralSpec>(spec: T): T {
  return { ...spec, latex: generateFormulaLatex(spec) };
}
