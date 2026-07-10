import { describe, expect, it } from "vitest";
import questionData from "../../data/questions.generated.json";
import type { QuestionDataset } from "./types";

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
});
