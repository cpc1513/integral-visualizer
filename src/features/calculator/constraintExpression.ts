import { latexToExpression } from "./expression";

export type ConstraintOperator = "<=" | ">=" | "<" | ">" | "=";

export interface ParsedConstraint {
  source: string;
  left: string;
  right: string;
  operator: ConstraintOperator;
}

const relationPattern = /(\\leq?|\\geq?|≤|≥|<=|>=|<|>|=)/;

export function parseConstraint(source: string): ParsedConstraint {
  const match = source.match(relationPattern);
  if (!match || match.index === undefined) throw new Error(`约束缺少关系符：${source}`);
  const leftLatex = source.slice(0, match.index).trim();
  const rightLatex = source.slice(match.index + match[0].length).trim();
  if (!leftLatex || !rightLatex) throw new Error(`约束两侧不能为空：${source}`);
  const rawOperator = match[0];
  const operator: ConstraintOperator = rawOperator.includes("le") || rawOperator === "≤" || rawOperator === "<="
    ? "<="
    : rawOperator.includes("ge") || rawOperator === "≥" || rawOperator === ">="
      ? ">="
      : (rawOperator as ConstraintOperator);
  return {
    source,
    left: latexToExpression(leftLatex),
    right: latexToExpression(rightLatex),
    operator,
  };
}

export function constraintViolation(
  constraint: ParsedConstraint,
  left: number,
  right: number,
  equalityTolerance: number,
) {
  if (constraint.operator === "<=" || constraint.operator === "<") return left - right;
  if (constraint.operator === ">=" || constraint.operator === ">") return right - left;
  return Math.abs(left - right) - equalityTolerance;
}
