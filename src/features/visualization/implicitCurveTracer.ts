export type Point3 = [number, number, number];

export interface CurveTraceRange {
  lower: number;
  upper: number;
}

export interface TracedCurve {
  points: Point3[];
  closed: boolean;
}

export interface ImplicitCurveTraceOptions {
  equations: [(point: Point3) => number, (point: Point3) => number];
  inequalities?: Array<(point: Point3) => number>;
  ranges: [CurveTraceRange, CurveTraceRange, CurveTraceRange];
  seedResolution?: number;
  maxCurves?: number;
}

const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (point: Point3, amount: number): Point3 => [point[0] * amount, point[1] * amount, point[2] * amount];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (point: Point3) => Math.hypot(point[0], point[1], point[2]);
const distance = (a: Point3, b: Point3) => length(subtract(a, b));
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function normalize(point: Point3): Point3 | null {
  const magnitude = length(point);
  return magnitude > 1e-12 ? scale(point, 1 / magnitude) : null;
}

function solveTwoByTwo(a: number, b: number, d: number, first: number, second: number) {
  const determinant = a * d - b * b;
  if (Math.abs(determinant) < 1e-16) return null;
  return [(first * d - b * second) / determinant, (a * second - b * first) / determinant] as const;
}

function solveThreeByThree(matrix: number[][], values: Point3): Point3 | null {
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-13) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let entry = column; entry < 4; entry += 1) augmented[column][entry] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry < 4; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

export function traceImplicitCurves({
  equations,
  inequalities = [],
  ranges,
  seedResolution = 15,
  maxCurves = 6,
}: ImplicitCurveTraceOptions): TracedCurve[] {
  const spans = ranges.map((range) => range.upper - range.lower) as Point3;
  const maxSpan = Math.max(...spans);
  if (!Number.isFinite(maxSpan) || maxSpan <= 0) throw new Error("隐式曲线扫描范围无效");
  const gradientSteps = spans.map((span) => Math.max(span * 1e-5, maxSpan * 1e-7)) as Point3;
  const equationTolerance = maxSpan * 2e-7;
  const stepSize = maxSpan / 400;
  const rangeMargin = stepSize * 1.5;

  const gradient = (evaluate: (point: Point3) => number, point: Point3): Point3 =>
    ([0, 1, 2].map((axis) => {
      const before = [...point] as Point3;
      const after = [...point] as Point3;
      before[axis] -= gradientSteps[axis];
      after[axis] += gradientSteps[axis];
      return (evaluate(after) - evaluate(before)) / (2 * gradientSteps[axis]);
    }) as Point3);

  const residualDistance = (point: Point3) => {
    const firstGradient = gradient(equations[0], point);
    const secondGradient = gradient(equations[1], point);
    return Math.abs(equations[0](point)) / Math.max(length(firstGradient), 1e-9)
      + Math.abs(equations[1](point)) / Math.max(length(secondGradient), 1e-9);
  };

  const withinRanges = (point: Point3, margin = 0) => ranges.every((range, axis) =>
    point[axis] >= range.lower - margin && point[axis] <= range.upper + margin,
  );
  const allowed = (point: Point3) => inequalities.every((evaluate) => evaluate(point) <= equationTolerance);

  const projectSeed = (initial: Point3) => {
    let point = [...initial] as Point3;
    for (let iteration = 0; iteration < 24; iteration += 1) {
      const firstValue = equations[0](point);
      const secondValue = equations[1](point);
      const firstGradient = gradient(equations[0], point);
      const secondGradient = gradient(equations[1], point);
      const coefficients = solveTwoByTwo(
        dot(firstGradient, firstGradient),
        dot(firstGradient, secondGradient),
        dot(secondGradient, secondGradient),
        -firstValue,
        -secondValue,
      );
      if (!coefficients) return null;
      let correction = add(scale(firstGradient, coefficients[0]), scale(secondGradient, coefficients[1]));
      const correctionLength = length(correction);
      if (correctionLength > maxSpan * 0.2) correction = scale(correction, (maxSpan * 0.2) / correctionLength);
      point = add(point, correction);
      if (!withinRanges(point, rangeMargin * 3)) return null;
      if (length(correction) < equationTolerance && residualDistance(point) < equationTolerance * 4) break;
    }
    return withinRanges(point, rangeMargin) && allowed(point) && residualDistance(point) < equationTolerance * 8
      ? point
      : null;
  };

  const tangentAt = (point: Point3) => normalize(cross(gradient(equations[0], point), gradient(equations[1], point)));

  const correctPrediction = (prediction: Point3, tangent: Point3) => {
    let point = [...prediction] as Point3;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const firstGradient = gradient(equations[0], point);
      const secondGradient = gradient(equations[1], point);
      const correction = solveThreeByThree(
        [firstGradient, secondGradient, tangent],
        [
          -equations[0](point),
          -equations[1](point),
          -dot(subtract(point, prediction), tangent),
        ],
      );
      if (!correction || length(correction) > stepSize * 2.5) return null;
      point = add(point, correction);
      if (length(correction) < equationTolerance) break;
    }
    return residualDistance(point) < equationTolerance * 8 ? point : null;
  };

  const traceDirection = (seed: Point3, sign: 1 | -1) => {
    const initialTangent = tangentAt(seed);
    if (!initialTangent) return { points: [seed], closed: false };
    let previousTangent = scale(initialTangent, sign);
    const points = [seed];
    for (let iteration = 0; iteration < 1600; iteration += 1) {
      const current = points[points.length - 1];
      const prediction = add(current, scale(previousTangent, stepSize));
      const next = correctPrediction(prediction, previousTangent);
      if (!next || !withinRanges(next, rangeMargin) || !allowed(next) || distance(current, next) < stepSize * 0.2) {
        return { points, closed: false };
      }
      const nextTangentRaw = tangentAt(next);
      if (!nextTangentRaw) return { points, closed: false };
      const nextTangent = dot(nextTangentRaw, previousTangent) < 0 ? scale(nextTangentRaw, -1) : nextTangentRaw;
      if (
        points.length > 30
        && distance(next, seed) < stepSize * 1.35
        && dot(nextTangent, scale(initialTangent, sign)) > 0.65
      ) {
        return { points, closed: true };
      }
      points.push(next);
      previousTangent = nextTangent;
    }
    return { points, closed: false };
  };

  const sampleCandidates: Array<{ point: Point3; first: number; second: number }> = [];
  let firstScaleSquared = 0;
  let secondScaleSquared = 0;
  for (let zIndex = 0; zIndex < seedResolution; zIndex += 1) {
    for (let yIndex = 0; yIndex < seedResolution; yIndex += 1) {
      for (let xIndex = 0; xIndex < seedResolution; xIndex += 1) {
        const indices = [xIndex, yIndex, zIndex];
        const point = ranges.map((range, axis) =>
          range.lower + ((range.upper - range.lower) * indices[axis]) / (seedResolution - 1),
        ) as Point3;
        const first = equations[0](point);
        const second = equations[1](point);
        if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
        firstScaleSquared += first * first;
        secondScaleSquared += second * second;
        sampleCandidates.push({ point, first, second });
      }
    }
  }
  const sampleCount = Math.max(sampleCandidates.length, 1);
  const firstScale = Math.max(Math.sqrt(firstScaleSquared / sampleCount), 1e-9);
  const secondScale = Math.max(Math.sqrt(secondScaleSquared / sampleCount), 1e-9);
  sampleCandidates.sort((a, b) =>
    Math.abs(a.first) / firstScale + Math.abs(a.second) / secondScale
    - Math.abs(b.first) / firstScale - Math.abs(b.second) / secondScale,
  );

  const cellDiagonal = Math.hypot(...spans.map((span) => span / (seedResolution - 1)));
  const initialCandidates: Point3[] = [];
  for (const candidate of sampleCandidates) {
    if (initialCandidates.every((point) => distance(point, candidate.point) > cellDiagonal * 0.9)) {
      initialCandidates.push(candidate.point);
    }
    if (initialCandidates.length >= 64) break;
  }

  const seeds: Point3[] = [];
  for (const candidate of initialCandidates) {
    const seed = projectSeed(candidate);
    if (seed && seeds.every((existing) => distance(existing, seed) > stepSize * 3)) seeds.push(seed);
  }

  const curves: TracedCurve[] = [];
  const nearExistingCurve = (point: Point3) => curves.some((curve) =>
    curve.points.some((existing) => distance(existing, point) < stepSize * 2.5),
  );
  for (const seed of seeds) {
    if (nearExistingCurve(seed)) continue;
    const forward = traceDirection(seed, 1);
    if (forward.closed && forward.points.length >= 12) {
      curves.push(forward);
    } else {
      const backward = traceDirection(seed, -1);
      const combined = [...backward.points.slice(1).reverse(), ...forward.points];
      if (combined.length >= 8) curves.push({ points: combined, closed: false });
    }
    if (curves.length >= maxCurves) break;
  }
  if (curves.length === 0) throw new Error("未能追踪到连续交线，请缩小扫描范围或检查两个等式");
  return curves;
}

