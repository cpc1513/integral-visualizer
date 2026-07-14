import { describe, expect, it } from "vitest";
import { traceImplicitCurves, type CurveTraceRange, type Point3 } from "./implicitCurveTracer";

const cube = (lower: number, upper: number): [CurveTraceRange, CurveTraceRange, CurveTraceRange] => [
  { lower, upper },
  { lower, upper },
  { lower, upper },
];

function maximumResidual(points: Point3[], evaluate: (point: Point3) => number) {
  return Math.max(...points.map((point) => Math.abs(evaluate(point))));
}

describe("implicit curve continuation", () => {
  it("traces the closed Stokes circle cut from a sphere by a plane", () => {
    const sphere = ([x, y, z]: Point3) => x * x + y * y + z * z - 1;
    const plane = ([x, y, z]: Point3) => x + y + z - 1;
    const curves = traceImplicitCurves({ equations: [sphere, plane], ranges: cube(-3, 3) });
    expect(curves).toHaveLength(1);
    expect(curves[0].closed).toBe(true);
    expect(curves[0].points.length).toBeGreaterThan(150);
    expect(maximumResidual(curves[0].points, sphere)).toBeLessThan(1e-5);
    expect(maximumResidual(curves[0].points, plane)).toBeLessThan(1e-5);
  });

  it("traces a cylinder-plane intersection as one ordered loop", () => {
    const cylinder = ([x, y]: Point3) => x * x + y * y - 1;
    const plane = ([_x, y, z]: Point3) => y + z - 2;
    const curves = traceImplicitCurves({ equations: [cylinder, plane], ranges: cube(-3, 3) });
    expect(curves).toHaveLength(1);
    expect(curves[0].closed).toBe(true);
    expect(maximumResidual(curves[0].points, cylinder)).toBeLessThan(1e-5);
    expect(maximumResidual(curves[0].points, plane)).toBeLessThan(1e-5);
  });

  it("traces the sphere-paraboloid loop used by the Stokes question bank", () => {
    const sphere = ([x, y, z]: Point3) => x * x + y * y + z * z - 5;
    const paraboloid = ([x, y, z]: Point3) => z - x * x - y * y - 1;
    const curves = traceImplicitCurves({ equations: [sphere, paraboloid], ranges: cube(-6, 6) });
    expect(curves).toHaveLength(1);
    expect(curves[0].closed).toBe(true);
    expect(maximumResidual(curves[0].points, sphere)).toBeLessThan(1e-5);
    expect(maximumResidual(curves[0].points, paraboloid)).toBeLessThan(1e-5);
  });

  it("stops at an inequality boundary without inventing a closing segment", () => {
    const sphere = ([x, y, z]: Point3) => x * x + y * y + z * z - 1;
    const plane = ([_x, _y, z]: Point3) => z;
    const halfSpace = ([x]: Point3) => -x;
    const curves = traceImplicitCurves({
      equations: [sphere, plane],
      inequalities: [halfSpace],
      ranges: cube(-1.5, 1.5),
    });
    expect(curves).toHaveLength(1);
    expect(curves[0].closed).toBe(false);
    expect(curves[0].points.every(([x]) => x >= -1e-5)).toBe(true);
  });
});
