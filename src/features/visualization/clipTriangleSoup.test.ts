import { describe, expect, it } from "vitest";
import { clipTriangleSoup, sampleScalarField } from "./clipTriangleSoup";

function scalarField(resolution: number, evaluate: (x: number, y: number, z: number) => number) {
  const values: number[] = [];
  for (let z = 0; z < resolution; z += 1) {
    for (let y = 0; y < resolution; y += 1) {
      for (let x = 0; x < resolution; x += 1) {
        values.push(evaluate((x * 2) / resolution - 1, (y * 2) / resolution - 1, (z * 2) / resolution - 1));
      }
    }
  }
  return values;
}

describe("continuous triangle clipping", () => {
  it("samples a linear scalar field without turning it into a boolean mask", () => {
    const resolution = 8;
    const field = scalarField(resolution, (_x, _y, z) => z - 0.2);
    expect(sampleScalarField(field, resolution, [0.13, -0.27, 0.2])).toBeCloseTo(0, 6);
    expect(sampleScalarField(field, resolution, [0, 0, -0.4])).toBeCloseTo(-0.6, 6);
  });

  it("cuts a triangle exactly along the zero boundary and keeps smooth normals", () => {
    const resolution = 8;
    const upperBound = scalarField(resolution, (_x, _y, z) => z);
    const positions = new Float32Array([
      -0.8, -0.6, -0.5,
      0.8, -0.6, 0.5,
      0, 0.8, -0.5,
    ]);
    const normals = new Float32Array([
      1, 0, 1,
      1, 0, 1,
      1, 0, 1,
    ]);
    const clipped = clipTriangleSoup(positions, normals, 3, resolution, [upperBound]);
    expect(clipped.triangleCount).toBe(2);
    const zValues = Array.from(clipped.positions).filter((_value, index) => index % 3 === 2);
    expect(Math.max(...zValues)).toBeCloseTo(0, 6);
    expect(zValues.filter((value) => Math.abs(value) < 1e-6)).toHaveLength(3);
    for (let index = 0; index < clipped.normals.length; index += 3) {
      expect(Math.hypot(clipped.normals[index], clipped.normals[index + 1], clipped.normals[index + 2])).toBeCloseTo(1, 6);
    }
  });

  it("applies multiple bounds without adding a cap", () => {
    const resolution = 8;
    const lowerBound = scalarField(resolution, (_x, _y, z) => -z - 0.25);
    const upperBound = scalarField(resolution, (_x, _y, z) => z - 0.25);
    const positions = new Float32Array([
      -0.6, -0.6, -0.6,
      0.6, -0.6, 0.6,
      0, 0.6, -0.6,
    ]);
    const normals = new Float32Array(9).fill(1);
    const clipped = clipTriangleSoup(positions, normals, 3, resolution, [lowerBound, upperBound]);
    expect(clipped.triangleCount).toBeGreaterThan(0);
    const zValues = Array.from(clipped.positions).filter((_value, index) => index % 3 === 2);
    expect(Math.min(...zValues)).toBeGreaterThanOrEqual(-0.250001);
    expect(Math.max(...zValues)).toBeLessThanOrEqual(0.250001);
  });
});
