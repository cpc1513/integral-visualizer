type Vector3Tuple = [number, number, number];

interface ClipVertex {
  position: Vector3Tuple;
  normal: Vector3Tuple;
  clipValues: number[];
}

export interface ClippedTriangleSoup {
  positions: Float32Array;
  normals: Float32Array;
  triangleCount: number;
}

const INSIDE_EPSILON = 1e-7;
const AREA_EPSILON = 1e-14;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function normalize(vector: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= Number.EPSILON) return [0, 0, 1];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function sampleScalarField(
  values: ArrayLike<number>,
  resolution: number,
  position: Vector3Tuple,
) {
  const gridX = clamp(((position[0] + 1) * resolution) / 2, 0, resolution - 1);
  const gridY = clamp(((position[1] + 1) * resolution) / 2, 0, resolution - 1);
  const gridZ = clamp(((position[2] + 1) * resolution) / 2, 0, resolution - 1);
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(x0 + 1, resolution - 1);
  const y1 = Math.min(y0 + 1, resolution - 1);
  const z1 = Math.min(z0 + 1, resolution - 1);
  const tx = gridX - x0;
  const ty = gridY - y0;
  const tz = gridZ - z0;
  const index = (x: number, y: number, z: number) => x + y * resolution + z * resolution * resolution;
  const c00 = mix(values[index(x0, y0, z0)], values[index(x1, y0, z0)], tx);
  const c10 = mix(values[index(x0, y1, z0)], values[index(x1, y1, z0)], tx);
  const c01 = mix(values[index(x0, y0, z1)], values[index(x1, y0, z1)], tx);
  const c11 = mix(values[index(x0, y1, z1)], values[index(x1, y1, z1)], tx);
  return mix(mix(c00, c10, ty), mix(c01, c11, ty), tz);
}

function interpolateVertex(start: ClipVertex, end: ClipVertex, fieldIndex: number): ClipVertex {
  const startValue = start.clipValues[fieldIndex];
  const endValue = end.clipValues[fieldIndex];
  const denominator = startValue - endValue;
  const amount = Math.abs(denominator) <= Number.EPSILON ? 0.5 : clamp(startValue / denominator, 0, 1);
  return {
    position: [
      mix(start.position[0], end.position[0], amount),
      mix(start.position[1], end.position[1], amount),
      mix(start.position[2], end.position[2], amount),
    ],
    normal: normalize([
      mix(start.normal[0], end.normal[0], amount),
      mix(start.normal[1], end.normal[1], amount),
      mix(start.normal[2], end.normal[2], amount),
    ]),
    clipValues: start.clipValues.map((value, index) => mix(value, end.clipValues[index], amount)),
  };
}

function clipPolygon(vertices: ClipVertex[], fieldIndex: number) {
  if (vertices.length === 0) return vertices;
  const result: ClipVertex[] = [];
  let previous = vertices[vertices.length - 1];
  let previousInside = previous.clipValues[fieldIndex] <= INSIDE_EPSILON;
  for (const current of vertices) {
    const currentInside = current.clipValues[fieldIndex] <= INSIDE_EPSILON;
    if (previousInside !== currentInside) result.push(interpolateVertex(previous, current, fieldIndex));
    if (currentInside) result.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return result;
}

function hasVisibleArea(a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as Vector3Tuple;
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as Vector3Tuple;
  const crossX = ab[1] * ac[2] - ab[2] * ac[1];
  const crossY = ab[2] * ac[0] - ab[0] * ac[2];
  const crossZ = ab[0] * ac[1] - ab[1] * ac[0];
  return crossX * crossX + crossY * crossY + crossZ * crossZ > AREA_EPSILON;
}

export function clipTriangleSoup(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  vertexCount: number,
  resolution: number,
  clipFields: ReadonlyArray<ArrayLike<number>>,
): ClippedTriangleSoup {
  const expectedFieldLength = resolution ** 3;
  if (clipFields.some((field) => field.length !== expectedFieldLength)) {
    throw new Error("三维裁剪场尺寸与采样分辨率不一致");
  }
  const outputPositions: number[] = [];
  const outputNormals: number[] = [];
  for (let vertexIndex = 0; vertexIndex + 2 < vertexCount; vertexIndex += 3) {
    let polygon: ClipVertex[] = [0, 1, 2].map((offset) => {
      const index = vertexIndex + offset;
      const position: Vector3Tuple = [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
      return {
        position,
        normal: normalize([normals[index * 3], normals[index * 3 + 1], normals[index * 3 + 2]]),
        clipValues: clipFields.map((field) => sampleScalarField(field, resolution, position)),
      };
    });
    for (let fieldIndex = 0; fieldIndex < clipFields.length && polygon.length > 0; fieldIndex += 1) {
      polygon = clipPolygon(polygon, fieldIndex);
    }
    for (let index = 1; index + 1 < polygon.length; index += 1) {
      const triangle = [polygon[0], polygon[index], polygon[index + 1]];
      if (!hasVisibleArea(triangle[0].position, triangle[1].position, triangle[2].position)) continue;
      for (const vertex of triangle) {
        outputPositions.push(...vertex.position);
        outputNormals.push(...vertex.normal);
      }
    }
  }
  return {
    positions: new Float32Array(outputPositions),
    normals: new Float32Array(outputNormals),
    triangleCount: outputPositions.length / 9,
  };
}

