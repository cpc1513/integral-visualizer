import questionData from "../../data/questions.generated.json";
import { examVisualizations } from "../../data/examVisualizations";
import type {
  QuestionDataset,
  VisualizableExamQuestion,
  VisualizableQuestionDataset,
} from "./types";

const sourceDataset = questionData as QuestionDataset;

export const visualizableQuestions: VisualizableExamQuestion[] = sourceDataset.questions.flatMap(
  (question) => {
    const entry = examVisualizations.get(question.id);
    if (!entry) return [];
    return [
      {
        ...question,
        integralType: entry.spec.type,
        visualizationSpec: structuredClone(entry.spec),
        visualizationSource: entry.source,
      },
    ];
  },
);

const formulaCount = visualizableQuestions.reduce(
  (total, question) =>
    total +
    [...question.prompt, ...question.solution]
      .flat()
      .filter((segment) => segment.type === "math").length,
  0,
);

const countsByAcademicYear = visualizableQuestions.reduce<Record<string, number>>(
  (counts, question) => {
    counts[question.academicYear] = (counts[question.academicYear] ?? 0) + 1;
    return counts;
  },
  {},
);

export const visualizableDataset: VisualizableQuestionDataset = {
  meta: {
    ...sourceDataset.meta,
    extractedCount: visualizableQuestions.length,
    formulaCount,
    countsByAcademicYear,
  },
  questions: visualizableQuestions,
};
