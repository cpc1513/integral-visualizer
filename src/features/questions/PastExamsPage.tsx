import { Filter, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { IntegralType } from "../calculator/types";
import type { RichTextBlock, VisualizableExamQuestion } from "./types";
import { visualizableDataset as dataset } from "./visualizableQuestions";
import { QuestionCard, typeLabels } from "./QuestionCard";

function blocksToText(blocks: RichTextBlock[]) {
  return blocks.flatMap((block) => block.map((segment) => segment.value)).join(" ");
}

const searchIndex = new Map(
  dataset.questions.map((question) => [
    question.id,
    [
      question.academicYear,
      question.sourceLabel,
      question.knowledge,
      blocksToText(question.prompt),
      blocksToText(question.solution),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN"),
  ]),
);

function QuestionItem({ question }: { question: VisualizableExamQuestion }) {
  return (
    <QuestionCard
      ordinal={question.ordinal}
      meta={[question.academicYear, question.sourceLabel, ...(question.score ? [`${question.score} 分`] : [])]}
      title={question.knowledge || "来源汇总说明"}
      integralType={question.integralType}
      prompt={question.prompt}
      solution={question.solution}
      warnings={question.warnings}
      visualizationSpec={question.visualizationSpec}
    />
  );
}

export function PastExamsPage() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [type, setType] = useState<IntegralType | "all">("all");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));
  const years = [...Object.keys(dataset.meta.countsByAcademicYear)].sort((a, b) => b.localeCompare(a));

  const filteredQuestions = useMemo(
    () =>
      dataset.questions.filter((question) => {
        if (year !== "all" && question.academicYear !== year) return false;
        if (type !== "all" && question.integralType !== type) return false;
        if (deferredQuery && !searchIndex.get(question.id)?.includes(deferredQuery)) return false;
        return true;
      }),
    [deferredQuery, type, year],
  );

  return (
    <div className="exams-page">
      <header className="exams-header">
        <div>
          <h1>往年真题</h1>
          <p>
            共收录 {dataset.meta.extractedCount} 道可视化真题、{dataset.meta.formulaCount} 个公式；每题均已通过积分区域校验。
          </p>
        </div>
        <span className="question-count">当前显示 {filteredQuestions.length} 道</span>
      </header>

      <div className="exam-filters" aria-label="真题筛选">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">搜索题目</span>
          <input
            type="search"
            placeholder="搜索年份、知识点或公式"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="select-field">
          <Filter size={16} aria-hidden="true" />
          <span className="sr-only">按学年筛选</span>
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">全部学年</option>
            {years.map((item) => (
              <option value={item} key={item}>
                {item} 学年
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span className="sr-only">按积分类型筛选</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="all">全部类型</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="question-list" aria-label="历年真题列表">
        {filteredQuestions.length ? (
          filteredQuestions.map((question) => <QuestionItem key={question.id} question={question} />)
        ) : (
          <div className="empty-results">
            <Search size={23} aria-hidden="true" />
            <strong>没有匹配的题目</strong>
            <span>请调整关键词或筛选条件。</span>
          </div>
        )}
      </section>
    </div>
  );
}
