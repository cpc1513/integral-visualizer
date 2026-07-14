import { describe, expect, it } from "vitest";
import { getIntegralExample } from "../calculator/examples";
import { buildPlotSpec } from "./plotSpec";

describe("plot specification", () => {
  it("builds a filled ordinary integral plot", async () => {
    const plot = await buildPlotSpec(getIntegralExample("ordinary"));
    expect(plot.dimension).toBe("2d");
    expect(plot.data[0].fill).toBe("tozeroy");
  });

  it("keeps isolated domain failures as gaps in an otherwise usable curve", async () => {
    const spec = getIntegralExample("ordinary");
    if (spec.type !== "ordinary") throw new Error("unexpected example type");
    spec.integrand = "sqrt(x)";
    spec.bound = { ...spec.bound, lower: "-1", upper: "1" };
    const plot = await buildPlotSpec(spec);
    const values = plot.data[0].y as Array<number | null>;
    expect(values.some((value) => value === null)).toBe(true);
    expect(values.some((value) => typeof value === "number" && Number.isFinite(value))).toBe(true);
  });

  it("rejects an expression only when all sampled values are unusable", async () => {
    const spec = getIntegralExample("ordinary");
    if (spec.type !== "ordinary") throw new Error("unexpected example type");
    spec.integrand = "sqrt(-1)";
    await expect(buildPlotSpec(spec)).rejects.toThrow("没有有限实值");
  });

  it("builds the non-degenerate boundary surfaces for a triple integral", async () => {
    const plot = await buildPlotSpec(getIntegralExample("triple"));
    expect(plot.dimension).toBe("3d");
    expect(plot.data).toHaveLength(2);
    expect(plot.data.every((trace) => trace.type === "surface")).toBe(true);
    expect(plot.data.map((trace) => (trace.meta as { boundaryKind?: string })?.boundaryKind)).toEqual([
      "inner-upper",
      "inner-lower",
    ]);
    const z = plot.data[0].z as Array<Array<number | null>>;
    expect(new Set(z.map((row) => row.length))).toEqual(new Set([48]));
  });

  it("closes a cylindrical triple-integral region with smooth side walls", async () => {
    const spec = getIntegralExample("triple");
    spec.integrand = "1";
    spec.bounds = [
      { variable: "z", lower: "0", upper: "1", label: "内层" },
      { variable: "y", lower: "-\\sqrt{1-x^2}", upper: "\\sqrt{1-x^2}", label: "中层" },
      { variable: "x", lower: "-1", upper: "1", label: "外层" },
    ];

    const plot = await buildPlotSpec(spec);
    const boundaryKinds = plot.data.map(
      (trace) => (trace.meta as { boundaryKind?: string })?.boundaryKind,
    );
    expect(boundaryKinds).toEqual([
      "inner-upper",
      "inner-lower",
      "middle-upper",
      "middle-lower",
    ]);

    const side = plot.data.find(
      (trace) => (trace.meta as { boundaryKind?: string })?.boundaryKind === "middle-upper",
    );
    if (!side) throw new Error("missing cylindrical side wall");
    const x = (side.x as number[][]).flat();
    const y = (side.y as number[][]).flat();
    const z = (side.z as number[][]).flat();
    expect(x.every((value, index) => Math.abs(value ** 2 + y[index] ** 2 - 1) < 1e-8)).toBe(true);
    expect(Math.min(...z)).toBeCloseTo(0);
    expect(Math.max(...z)).toBeCloseTo(1);
  });

  it("builds all six faces for a rectangular triple-integral region", async () => {
    const spec = getIntegralExample("triple");
    spec.integrand = "1";
    spec.bounds = [
      { variable: "z", lower: "0", upper: "1", label: "内层" },
      { variable: "y", lower: "0", upper: "1", label: "中层" },
      { variable: "x", lower: "0", upper: "1", label: "外层" },
    ];

    const plot = await buildPlotSpec(spec);
    expect(new Set(plot.data.map(
      (trace) => (trace.meta as { boundaryKind?: string })?.boundaryKind,
    ))).toEqual(new Set([
      "inner-upper",
      "inner-lower",
      "middle-upper",
      "middle-lower",
      "outer-upper",
      "outer-lower",
    ]));
  });

  it("builds a filled double-integral region", async () => {
    const plot = await buildPlotSpec(getIntegralExample("double"));
    expect(plot.dimension).toBe("2d");
    expect(plot.data[0].fill).toBe("toself");
  });

  it("builds a parameterized line-integral curve", async () => {
    const plot = await buildPlotSpec(getIntegralExample("line"));
    expect(plot.dimension).toBe("2d");
    expect(plot.data.some((trace) => trace.type === "scatter")).toBe(true);
  });

  it("splits a parameterized curve around nonfinite samples", async () => {
    const spec = getIntegralExample("line");
    if (spec.type !== "line") throw new Error("unexpected example type");
    spec.parameter = { ...spec.parameter, lower: "-1", upper: "1" };
    spec.path = { x: "t", y: "sqrt(t)", z: "0" };
    const plot = await buildPlotSpec(spec);
    expect((plot.data[0].y as Array<number | null>).some((value) => value === null)).toBe(true);
  });

  it("builds a parametric surface containing finite samples", async () => {
    const plot = await buildPlotSpec(getIntegralExample("surface"));
    const z = plot.data[0].z as number[][];
    expect(plot.dimension).toBe("3d");
    expect(z.flat().every(Number.isFinite)).toBe(true);
  });

  it("renders a parametric surface with domain holes", async () => {
    const spec = getIntegralExample("surface");
    if (spec.type !== "surface") throw new Error("unexpected example type");
    spec.parameters[0] = { ...spec.parameters[0], lower: "-1", upper: "1" };
    spec.surface = { x: "u", y: "v", z: "sqrt(u)" };
    const plot = await buildPlotSpec(spec);
    const z = (plot.data[0].z as Array<Array<number | null>>).flat();
    expect(z.some((value) => value === null)).toBe(true);
    expect(z.some((value) => typeof value === "number" && Number.isFinite(value))).toBe(true);
  });

  it("clips implicit triangles next to an undefined-domain sample", async () => {
    const spec = getIntegralExample("surface");
    if (spec.type !== "surface") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2+(\\sqrt{x}-z)^2=1"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-2", upper: "2" })),
    };
    const plot = await buildPlotSpec(spec);
    const validityClip = plot.threeField?.clipFields?.at(-1);
    expect(validityClip?.some((value) => value > 0)).toBe(true);
    expect(validityClip?.some((value) => value < 0)).toBe(true);
  });
});
