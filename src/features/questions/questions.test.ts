import { describe, expect, it } from "vitest";
import questionData from "../../data/questions.generated.json";
import { examVisualizations } from "../../data/examVisualizations";
import { latexToExpression } from "../calculator/expression";
import { buildPlotSpec } from "../visualization/plotSpec";
import type { QuestionDataset } from "./types";
import { visualizableDataset } from "./visualizableQuestions";

const dataset = questionData as QuestionDataset;

describe("generated exam dataset", () => {
  it("contains all 85 source entries and 726 formulas", () => {
    expect(dataset.meta.extractedCount).toBe(85);
    expect(dataset.meta.formulaCount).toBe(726);
    expect(dataset.questions).toHaveLength(85);
  });

  it("uses stable unique ids and preserves source warnings", () => {
    const ids = new Set(dataset.questions.map((question) => question.id));
    expect(ids.size).toBe(dataset.questions.length);
    expect(dataset.questions.filter((question) => question.warnings.length > 0)).toHaveLength(7);
  });

  it("keeps formulas as explicit rich-text segments", () => {
    const firstQuestion = dataset.questions[0];
    const mathSegments = firstQuestion.prompt.flat().filter((segment) => segment.type === "math");
    expect(mathSegments.length).toBeGreaterThan(0);
    expect(mathSegments.at(-1)?.value).toContain("\\iint");
  });

  it("publishes only the 37 questions with curated visualization specs", () => {
    expect(examVisualizations.size).toBe(37);
    expect(visualizableDataset.questions).toHaveLength(37);
    expect(
      visualizableDataset.questions.every((question) => question.visualizationSpec.type === question.integralType),
    ).toBe(true);
  });

  it("builds a finite plot for every published exam question", async () => {
    for (const question of visualizableDataset.questions) {
      const plot = await buildPlotSpec(question.visualizationSpec);
      expect(["2d", "3d"], question.id).toContain(plot.dimension);
      expect(plot.data.length, question.id).toBeGreaterThan(0);
    }
  });

  it("compiles every retained integrand, bound and parameter expression", async () => {
    const { compile } = await import("mathjs");
    for (const question of visualizableDataset.questions) {
      const spec = question.visualizationSpec;
      const expressions = [spec.integrand];
      if (spec.type === "ordinary") expressions.push(spec.bound.lower, spec.bound.upper);
      if (spec.type === "double" || spec.type === "triple") {
        expressions.push(...spec.bounds.flatMap((bound) => [bound.lower, bound.upper]));
      }
      if (spec.type === "line") {
        expressions.push(
          spec.parameter.lower,
          spec.parameter.upper,
          ...Object.values(spec.path),
          ...Object.values(spec.vectorField),
        );
      }
      if (spec.type === "surface") {
        expressions.push(
          ...spec.parameters.flatMap((bound) => [bound.lower, bound.upper]),
          ...Object.values(spec.surface),
          ...Object.values(spec.vectorField),
        );
      }
      for (const expression of expressions) {
        expect(() => compile(latexToExpression(expression)), `${question.id}: ${expression}`).not.toThrow();
      }
    }
  });
});
