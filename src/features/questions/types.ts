import type { IntegralSpec, IntegralType } from "../calculator/types";

export interface RichTextSegment {
  type: "text" | "math";
  value: string;
  display?: boolean;
}

export type RichTextBlock = RichTextSegment[];

export interface ExamQuestion {
  id: string;
  academicYear: string;
  ordinal: number;
  sourceLabel: string;
  score: number | null;
  knowledge: string;
  integralType: IntegralType | "other" | "summary";
  prompt: RichTextBlock[];
  solution: RichTextBlock[];
  warnings: string[];
  quality: string[];
}

export interface VisualizableExamQuestion extends ExamQuestion {
  integralType: IntegralType;
  visualizationSpec: IntegralSpec;
  visualizationSource: "题面显式积分" | "解答累次积分" | "题面几何边界" | "题面参数方程";
}

export interface QuestionDataset {
  meta: {
    title: string;
    sourceFile: string;
    extractedCount: number;
    formulaCount: number;
    countsByAcademicYear: Record<string, number>;
  };
  questions: ExamQuestion[];
}

export interface VisualizableQuestionDataset extends Omit<QuestionDataset, "questions"> {
  questions: VisualizableExamQuestion[];
}

export interface ComputerExamQuestion {
  id: string;
  topic: string;
  topicCode: string;
  ordinal: number;
  page: number;
  integralType: IntegralType;
  prompt: RichTextBlock[];
  region: RichTextBlock[];
  answer: string;
  solution: RichTextBlock[];
  visualizationSpec: IntegralSpec;
}

export interface ComputerExamDataset {
  meta: {
    title: string;
    sourceFile: string;
    sourceCount: number;
    importedCount: number;
    excludedCount: number;
    topicCounts: Record<string, number>;
    exclusions: Record<string, number>;
  };
  questions: ComputerExamQuestion[];
}
