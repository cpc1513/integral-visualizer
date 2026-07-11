import { describe, expect, it } from "vitest";
import { createComputePayload } from "./computePayload";
import { parseConstraint } from "./constraintExpression";
import { getIntegralExample } from "./examples";
import { buildPlotSpec } from "../visualization/plotSpec";
import { convertLineParameter, convertSurfaceParameter } from "./BoundsEditor";

describe("custom constraint regions", () => {
  it("safely converts recognized parameter examples", () => {
    const line = getIntegralExample("line");
    const surface = getIntegralExample("surface");
    if (line.type !== "line" || surface.type !== "surface") throw new Error("unexpected example type");
    expect(convertLineParameter(line)?.constraints).toEqual(["x^2+y^2=1", "z=0"]);
    expect(convertSurfaceParameter(surface)?.constraints).toEqual([
      "z=4-(x^2+y^2)",
      "x^2+y^2\\le(2)^2",
    ]);
  });

  it("parses LaTeX relations into evaluator expressions", () => {
    expect(parseConstraint("x^2+y^2\\le 4")).toEqual({
      source: "x^2+y^2\\le 4",
      left: "x^2+y^2",
      right: "4",
      operator: "<=",
    });
    expect(parseConstraint("z\\ge \\sqrt{x^2+y^2}").operator).toBe(">=");
    expect(() => parseConstraint("x^2+y^2")).toThrow("缺少关系符");
  });

  it("builds a two-dimensional mask for a disk", async () => {
    const spec = getIntegralExample("double");
    if (spec.type !== "double") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2\\le 1"],
      ranges: [
        { variable: "x", lower: "-1.2", upper: "1.2" },
        { variable: "y", lower: "-1.2", upper: "1.2" },
      ],
    };
    const plot = await buildPlotSpec(spec);
    expect(plot.dimension).toBe("2d");
    expect(plot.data[0].type).toBe("heatmap");
    expect((plot.data[0].z as Array<Array<number | null>>).flat()).toContain(1);
  });

  it("builds a rotatable implicit surface for a sphere", async () => {
    const spec = getIntegralExample("triple");
    if (spec.type !== "triple") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2+z^2\\le 1"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-1.2", upper: "1.2" })),
    };
    const plot = await buildPlotSpec(spec);
    expect(plot.dimension).toBe("3d");
    expect(plot.data[0].type).toBe("isosurface");
    expect(plot.data).toHaveLength(1);
    expect((plot.data[0].value as number[]).every(Number.isFinite)).toBe(true);
  });

  it("renders a curve from two implicit equations", async () => {
    const spec = getIntegralExample("line");
    if (spec.type !== "line") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2=1", "z=0"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-1.2", upper: "1.2" })),
    };
    const plot = await buildPlotSpec(spec);
    expect(plot.dimension).toBe("3d");
    expect(plot.data[0].type).toBe("scatter3d");
    expect((plot.data[0].x as number[]).length).toBeGreaterThan(10);
  });

  it("renders an implicitly defined and clipped surface", async () => {
    const spec = getIntegralExample("surface");
    if (spec.type !== "surface") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2+z^2=1", "z\\ge0"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-1.2", upper: "1.2" })),
    };
    const plot = await buildPlotSpec(spec);
    expect(plot.dimension).toBe("3d");
    expect(plot.data[0].type).toBe("isosurface");
    expect((plot.data[0].value as Array<number | null>).some((value) => value === null)).toBe(true);
  });

  it("serializes constraints for the Python numerical worker", () => {
    const spec = getIntegralExample("double");
    if (spec.type !== "double") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2\\le 4", "x\\ge 0"],
      ranges: [
        { variable: "x", lower: "-2", upper: "2" },
        { variable: "y", lower: "-2", upper: "2" },
      ],
    };
    const payload = createComputePayload(spec);
    expect(payload.constraintRegion?.constraints).toHaveLength(2);
    expect(payload.constraintRegion?.constraints[0].operator).toBe("<=");
  });
});
