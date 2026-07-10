import { describe, expect, it } from "vitest";
import { getIntegralExample } from "../calculator/examples";
import { buildPlotSpec } from "./plotSpec";

describe("plot specification", () => {
  it("builds a filled ordinary integral plot", async () => {
    const plot = await buildPlotSpec(getIntegralExample("ordinary"));
    expect(plot.dimension).toBe("2d");
    expect(plot.data[0].fill).toBe("tozeroy");
  });

  it("builds upper and lower surfaces for a triple integral", async () => {
    const plot = await buildPlotSpec(getIntegralExample("triple"));
    expect(plot.dimension).toBe("3d");
    expect(plot.data).toHaveLength(2);
    expect(plot.data.every((trace) => trace.type === "surface")).toBe(true);
    const z = plot.data[0].z as number[][];
    expect(new Set(z.map((row) => row.length))).toEqual(new Set([34]));
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

  it("builds a parametric surface containing finite samples", async () => {
    const plot = await buildPlotSpec(getIntegralExample("surface"));
    const z = plot.data[0].z as number[][];
    expect(plot.dimension).toBe("3d");
    expect(z.flat().every(Number.isFinite)).toBe(true);
  });
});
