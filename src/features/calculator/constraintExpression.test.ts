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
    expect(plot.data[0].type).toBe("contour");
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
    expect(plot.data[0].surface).toEqual({ count: 1, fill: 1 });
    expect(plot.data[0].opacity).toBe(1);
    expect((plot.data[0].value as number[]).every(Number.isFinite)).toBe(true);
    expect(plot.threeField?.resolution).toBe(48);
    expect(plot.threeField?.values).toHaveLength(48 ** 3);
    expect(plot.threeField?.values.some((value) => value < 0)).toBe(true);
    expect(plot.threeField?.values.some((value) => value > 0)).toBe(true);
  });

  it("turns the sphere scalar field into a Three.js mesh with smooth normals", async () => {
    const spec = getIntegralExample("triple");
    if (spec.type !== "triple") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2+z^2\\le 1"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-3", upper: "3" })),
    };
    const plot = await buildPlotSpec(spec);
    const field = plot.threeField;
    if (!field) throw new Error("missing Three.js scalar field");
    const [{ MeshStandardMaterial }, { MarchingCubes }] = await Promise.all([
      import("three"),
      import("three/addons/objects/MarchingCubes.js"),
    ]);
    const material = new MeshStandardMaterial();
    const mesh = new MarchingCubes(field.resolution, material, false, false, 120000);
    mesh.isolation = field.isoLevel;
    mesh.field.set(field.values);
    mesh.update();
    expect(mesh.geometry.drawRange.count).toBeGreaterThan(1000);
    const normals = mesh.geometry.getAttribute("normal");
    expect(normals.count).toBeGreaterThan(1000);
    expect(Math.hypot(normals.getX(0), normals.getY(0), normals.getZ(0))).toBeGreaterThan(0);
    mesh.geometry.dispose();
    material.dispose();
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
    expect(plot.data[0].surface).toEqual({ count: 1, fill: 1 });
    expect(plot.data[0].opacity).toBe(1);
    expect((plot.data[0].value as Array<number | null>).some((value) => value === null)).toBe(true);
    expect(plot.threeField?.resolution).toBe(48);
    expect(plot.threeField?.mask?.some(Boolean)).toBe(true);
    expect(plot.threeField?.mask?.some((value) => !value)).toBe(true);
  });

  it("renders an explicitly solvable implicit surface as a smooth surface grid", async () => {
    const spec = getIntegralExample("surface");
    if (spec.type !== "surface") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["z=1-(x^2+y^2)", "x^2+y^2\\le1"],
      ranges: [
        { variable: "x", lower: "-1", upper: "1" },
        { variable: "y", lower: "-1", upper: "1" },
        { variable: "z", lower: "-1", upper: "1" },
      ],
    };
    const plot = await buildPlotSpec(spec);
    expect(plot.data[0].type).toBe("surface");
    const z = plot.data[0].z as Array<Array<number | null>>;
    expect(z).toHaveLength(72);
    expect(z.flat().filter((value) => value !== null).length).toBeGreaterThan(3000);
  });

  it("renders a clipped plane without isosurface artifacts", async () => {
    const spec = getIntegralExample("surface");
    if (spec.type !== "surface") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x\\ge0", "x\\le3", "y\\ge0", "y\\le3", "z=0"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-4", upper: "4" })),
    };
    const plot = await buildPlotSpec(spec);
    expect(plot.data[0].type).toBe("surface");
    const nonNullZ = (plot.data[0].z as Array<Array<number | null>>).flat().filter((value) => value !== null);
    expect(nonNullZ.length).toBeGreaterThan(400);
    expect(nonNullZ.every((value) => value === 0)).toBe(true);
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
