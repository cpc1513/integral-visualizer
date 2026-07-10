import type { IntegralType } from "../calculator/types";

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
