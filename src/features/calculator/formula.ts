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
    if (spec.regionMode === "constraints") {
      const sign = spec.type === "double" ? "\\iint_D" : "\\iiint_\\Omega";
      const measures = spec.type === "double" ? "\\,dA" : "\\,dV";
      return `${sign} ${spec.integrand}${measures}`;
    }
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

export type FormulaSynchronizationResult =
  | { ok: true; spec: IntegralSpec }
  | { ok: false; error: string };

const synchronized = (spec: IntegralSpec): FormulaSynchronizationResult => ({ ok: true, spec });
const invalid = (label: string, example: string): FormulaSynchronizationResult => ({
  ok: false,
  error: `无法识别${label}。请按“${example}”的形式补全公式。`,
});

function parseRegionIntegrand(latex: string, type: "double" | "triple") {
  const cleaned = latex.replace(/\\left|\\right/g, "").trim();
  const match = type === "double"
    ? cleaned.match(/^\\iint(?:_\{?D\}?)?\s*([\s\S]+?)(?:\\,|\s)*dA\s*$/)
    : cleaned.match(/^\\iiint(?:_\{?\\Omega\}?)?\s*([\s\S]+?)(?:\\,|\s)*dV\s*$/);
  return match?.[1]?.trim() || null;
}

export function synchronizeFormula(spec: IntegralSpec, latex: string): FormulaSynchronizationResult {
  if (spec.type === "ordinary" && spec.definite) {
    const parsed = parseNestedIntegrals(latex, 1);
    if (!parsed) return invalid("定积分公式", "\\int_{下限}^{上限} f(x)\\,dx");
    const next: OrdinaryIntegralSpec = {
      ...spec,
      latex,
      integrand: parsed.integrand,
      bound: { ...spec.bound, ...parsed.bounds[0], label: spec.bound.label },
    };
    return synchronized(next);
  }
  if (spec.type === "ordinary") {
    const cleaned = latex.replace(/\\left|\\right/g, "").trim();
    const match = cleaned.match(/^\\int(?!_)\s*([\s\S]+?)(?:\\,|\s)*d([A-Za-z])\s*$/);
    const integrand = match?.[1]?.trim();
    if (!integrand || !match?.[2]) return invalid("不定积分公式", "\\int f(x)\\,dx");
    return synchronized({
      ...spec,
      latex,
      integrand,
      bound: { ...spec.bound, variable: match[2] },
    });
  }
  if (spec.type === "double" || spec.type === "triple") {
    if (spec.regionMode === "constraints") {
      const integrand = parseRegionIntegrand(latex, spec.type);
      if (!integrand) {
        return invalid(
          spec.type === "double" ? "二重积分公式" : "三重积分公式",
          spec.type === "double" ? "\\iint_D f(x,y)\\,dA" : "\\iiint_\\Omega f(x,y,z)\\,dV",
        );
      }
      return synchronized({ ...spec, latex, integrand });
    }
    const count = spec.type === "double" ? 2 : 3;
    const parsed = parseNestedIntegrals(latex, count);
    if (!parsed) {
      return invalid(
        spec.type === "double" ? "二重积分公式" : "三重积分公式",
        `${"\\int_{下限}^{上限}".repeat(count)} f${"\\,d变量".repeat(count)}`,
      );
    }
    const next: MultipleIntegralSpec = { ...spec, latex, ...parsed };
    return synchronized(next);
  }
  if (spec.type === "line" && spec.mode === "scalar") {
    const match = latex.match(/^\\int_?\{?C\}?\s*(.+?)(?:\\,)?ds\s*$/);
    const integrand = match?.[1]?.trim();
    if (!integrand) return invalid("第一类曲线积分公式", "\\int_C f(x,y,z)\\,ds");
    const next: LineIntegralSpec = { ...spec, latex, integrand };
    return synchronized(next);
  }
  if (spec.type === "line") {
    const match = latex.match(
      /^\\int_?\{?C\}?\s*([\s\S]+?)(?:\\,)?dx\s*\+\s*([\s\S]+?)(?:\\,)?dy\s*\+\s*([\s\S]+?)(?:\\,)?dz\s*$/,
    );
    const components = match?.slice(1, 4).map((value) => value.trim());
    if (!components?.every(Boolean)) {
      return invalid("第二类曲线积分公式", "\\int_C P\\,dx+Q\\,dy+R\\,dz");
    }
    const next: LineIntegralSpec = {
      ...spec,
      latex,
      vectorField: { p: components[0], q: components[1], r: components[2] },
    };
    return synchronized(next);
  }
  if (spec.type === "surface" && spec.mode === "scalar") {
    const match = latex.match(/^\\iint_?\{?\\Sigma\}?\s*(.+?)(?:\\,)?dS\s*$/);
    const integrand = match?.[1]?.trim();
    if (!integrand) return invalid("第一类曲面积分公式", "\\iint_\\Sigma f(x,y,z)\\,dS");
    const next: SurfaceIntegralSpec = { ...spec, latex, integrand };
    return synchronized(next);
  }
  const match = latex.match(
    /^\\iint_?\{?\\Sigma\}?\s*([\s\S]+?)(?:\\,)?dy(?:\\,)?dz\s*\+\s*([\s\S]+?)(?:\\,)?dz(?:\\,)?dx\s*\+\s*([\s\S]+?)(?:\\,)?dx(?:\\,)?dy\s*$/,
  );
  const components = match?.slice(1, 4).map((value) => value.trim());
  if (!components?.every(Boolean)) {
    return invalid("第二类曲面积分公式", "\\iint_\\Sigma P\\,dy\\,dz+Q\\,dz\\,dx+R\\,dx\\,dy");
  }
  return synchronized({
    ...spec,
    latex,
    vectorField: { p: components[0], q: components[1], r: components[2] },
  });
}

export function regenerateFormula<T extends IntegralSpec>(spec: T): T {
  return { ...spec, latex: generateFormulaLatex(spec) };
}
