import { describe, expect, it } from "vitest";
import { createComputePayload } from "./computePayload";
import { parseConstraint } from "./constraintExpression";
import { getIntegralExample } from "./examples";
import { buildPlotSpec } from "../visualization/plotSpec";
import { clipTriangleSoup } from "../visualization/clipTriangleSoup";
import { convertBoundsToConstraintRegion, convertLineParameter, convertSurfaceParameter } from "./BoundsEditor";

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
    expect(convertSurfaceParameter(surface)?.ranges[2]).toEqual({
      variable: "z",
      lower: "-0.5",
      upper: "4.5",
    });
  });

  it("does not invent fixed scan ranges when nested bounds depend on outer variables", () => {
    const dependent = getIntegralExample("double");
    if (dependent.type !== "double") throw new Error("unexpected example type");
    expect(convertBoundsToConstraintRegion(dependent.bounds)).toBeNull();

    dependent.bounds[0] = { ...dependent.bounds[0], upper: "xy" };
    expect(convertBoundsToConstraintRegion(dependent.bounds)).toBeNull();

    dependent.bounds = dependent.bounds.map((bound) => ({ ...bound, lower: "0", upper: "2" }));
    expect(convertBoundsToConstraintRegion(dependent.bounds)?.ranges).toEqual([
      { variable: "x", lower: "0", upper: "2" },
      { variable: "y", lower: "0", upper: "2" },
    ]);
  });

  it("only offers parameter conversion when the implicit region is equivalent", () => {
    const line = getIntegralExample("line");
    const surface = getIntegralExample("surface");
    if (line.type !== "line" || surface.type !== "surface") throw new Error("unexpected example type");

    line.parameter.upper = "\\frac{\\pi}{2}";
    expect(convertLineParameter(line)).toBeNull();

    surface.parameters[1].upper = "\\pi";
    expect(convertSurfaceParameter(surface)).toBeNull();

    surface.parameters[1].upper = "2\\pi";
    surface.parameters[0].lower = "1";
    expect(convertSurfaceParameter(surface)?.constraints).toEqual([
      "z=4-(x^2+y^2)",
      "x^2+y^2\\le(2)^2",
      "x^2+y^2\\ge(1)^2",
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

  it("builds a continuous two-dimensional field for a disk", async () => {
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
    expect(plot.data).toHaveLength(2);
    expect(plot.data[0].type).toBe("contour");
    const violations = (plot.data[0].z as number[][]).flat();
    expect(violations.some((value) => value < 0)).toBe(true);
    expect(violations.some((value) => value > 0)).toBe(true);
    expect(new Set(violations).size).toBeGreaterThan(100);
    expect(plot.data[0].contours).toMatchObject({
      type: "constraint",
      operation: ">",
      value: 0,
      coloring: "fill",
    });
    expect(plot.data[1].contours).toMatchObject({ start: 0, end: 0, coloring: "lines" });
  });

  it("fills only the valid triangle instead of the entire scan rectangle", async () => {
    const spec = getIntegralExample("double");
    if (spec.type !== "double") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["y\\ge 0", "y\\le 1", "x\\ge 0", "x\\le y"],
      ranges: [
        { variable: "x", lower: "-3", upper: "3" },
        { variable: "y", lower: "-3", upper: "3" },
      ],
    };

    const plot = await buildPlotSpec(spec);
    expect(plot.data[0]).toMatchObject({
      type: "contour",
      contours: { type: "constraint", operation: ">", value: 0, coloring: "fill" },
    });
    const field = plot.data[0].z as number[][];
    const centerIndex = 150;
    const insideIndex = 175;
    expect(field[insideIndex][centerIndex]).toBeLessThanOrEqual(0);
    expect(field[0][0]).toBeGreaterThan(0);
    expect(field.at(-1)?.at(-1)).toBeGreaterThan(0);
  });

  it("rejects equality constraints that cannot define area or volume", async () => {
    for (const type of ["double", "triple"] as const) {
      const spec = getIntegralExample(type);
      if (spec.type !== type) throw new Error("unexpected example type");
      spec.regionMode = "constraints";
      spec.constraintRegion = {
        constraints: [type === "double" ? "x^2+y^2=1" : "x^2+y^2+z^2=1"],
        ranges: (type === "double" ? ["x", "y"] : ["x", "y", "z"]).map((variable) => ({
          variable,
          lower: "-2",
          upper: "2",
        })),
      };
      await expect(buildPlotSpec(spec)).rejects.toThrow("零测集");
      expect(() => createComputePayload(spec)).toThrow("零测集");
    }
  });

  it("treats nonfinite constraint samples as outside instead of failing the whole region", async () => {
    const spec = getIntegralExample("double");
    if (spec.type !== "double") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["y\\ge0", "y\\le\\sqrt{x}", "x\\le1"],
      ranges: [
        { variable: "x", lower: "-1", upper: "1" },
        { variable: "y", lower: "-1", upper: "1" },
      ],
    };
    const plot = await buildPlotSpec(spec);
    const field = (plot.data[0].z as number[][]).flat();
    expect(field.every(Number.isFinite)).toBe(true);
    expect(field.some((value) => value <= 0)).toBe(true);
    expect(field.some((value) => value > 0)).toBe(true);
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
    expect(plot.data[0].mode).toBe("lines");
    expect(plot.threeCurve?.paths).toHaveLength(1);
    expect(plot.threeCurve?.paths[0].closed).toBe(true);
    expect(plot.threeCurve?.paths[0].points.length).toBeGreaterThan(150);
    const path = plot.threeCurve!.paths[0];
    const { CatmullRomCurve3, TubeGeometry, Vector3 } = await import("three");
    const curve = new CatmullRomCurve3(
      path.points.map((point) => new Vector3(...point)),
      path.closed,
      "centripetal",
      0.35,
    );
    const tube = new TubeGeometry(curve, path.points.length * 2, plot.threeCurve!.tubeRadius, 14, path.closed);
    expect(tube.getAttribute("position").count).toBeGreaterThan(3000);
    expect(Array.from(tube.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    tube.dispose();
  });

  it("reverses an implicit curve without changing its geometry", async () => {
    const spec = getIntegralExample("line");
    if (spec.type !== "line") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2+z^2=1", "x+y+z=1"],
      ranges: ["x", "y", "z"].map((variable) => ({ variable, lower: "-3", upper: "3" })),
    };
    spec.orientation = 1;
    const positive = await buildPlotSpec(spec);
    spec.orientation = -1;
    const negative = await buildPlotSpec(spec);
    const positivePoints = positive.threeCurve?.paths[0].points;
    const negativePoints = negative.threeCurve?.paths[0].points;
    expect(positivePoints).toBeDefined();
    expect(negativePoints).toEqual([...positivePoints!].reverse());
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
    expect(plot.threeField?.clipFields).toHaveLength(1);
    expect(plot.threeField?.clipFields?.[0].some((value) => value <= 0)).toBe(true);
    expect(plot.threeField?.clipFields?.[0].some((value) => value > 0)).toBe(true);
  });

  it("clips a cylinder to smooth open rings instead of jagged triangle rows", async () => {
    const spec = getIntegralExample("surface");
    if (spec.type !== "surface") throw new Error("unexpected example type");
    spec.regionMode = "constraints";
    spec.constraintRegion = {
      constraints: ["x^2+y^2=1", "z≥-0.5", "z≤0.5"],
      ranges: [
        { variable: "x", lower: "-1.3", upper: "1.3" },
        { variable: "y", lower: "-1.3", upper: "1.3" },
        { variable: "z", lower: "-1", upper: "1" },
      ],
    };
    const plot = await buildPlotSpec(spec);
    const field = plot.threeField;
    if (!field?.clipFields) throw new Error("missing continuous clip fields");
    const [{ MeshStandardMaterial }, { MarchingCubes }] = await Promise.all([
      import("three"),
      import("three/addons/objects/MarchingCubes.js"),
    ]);
    const material = new MeshStandardMaterial();
    const marching = new MarchingCubes(field.resolution, material, false, false, 120000);
    marching.isolation = field.isoLevel;
    marching.field.set(field.values);
    marching.update();
    const clipped = clipTriangleSoup(
      marching.geometry.getAttribute("position").array,
      marching.geometry.getAttribute("normal").array,
      marching.geometry.drawRange.count,
      field.resolution,
      field.clipFields,
    );
    const zRange = field.ranges[2];
    const zSpan = zRange.upper - zRange.lower;
    const zValues = Array.from(clipped.positions)
      .filter((_value, index) => index % 3 === 2)
      .map((normalized) =>
        zRange.lower + (zSpan * ((normalized + 1) * field.resolution)) / (2 * (field.resolution - 1)),
      );
    expect(Math.min(...zValues)).toBeCloseTo(-0.5, 5);
    expect(Math.max(...zValues)).toBeCloseTo(0.5, 5);
    const zNormals = Array.from(clipped.normals).filter((_value, index) => index % 3 === 2);
    expect(Math.max(...zNormals.map(Math.abs))).toBeLessThan(0.05);
    marching.geometry.dispose();
    material.dispose();
  });

  it("routes a clipped explicit surface through continuous Three.js geometry", async () => {
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
    expect(plot.data[0].type).toBe("isosurface");
    expect(plot.threeField?.clipFields).toHaveLength(1);
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
    expect(plot.data[0].type).toBe("isosurface");
    expect(plot.threeField?.clipFields).toHaveLength(4);
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

  it("serializes the selected line direction for parameterized work integrals", () => {
    const spec = getIntegralExample("line");
    if (spec.type !== "line") throw new Error("unexpected example type");
    spec.orientation = -1;
    expect(createComputePayload(spec).orientation).toBe(-1);
  });
});
