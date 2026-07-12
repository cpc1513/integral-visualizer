import { Filter, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { computerExamDataset as dataset } from "./computerExamQuestions";
import { QuestionCard } from "./QuestionCard";

const textOf = (blocks: typeof dataset.questions[number]["prompt"]) => blocks.flat().map((segment) => segment.value).join(" ");
const searchIndex = new Map(dataset.questions.map((question) => [question.id, [question.topic, textOf(question.prompt), textOf(question.region), textOf(question.solution)].join(" ").toLocaleLowerCase("zh-CN")]));

export function ComputerExamsPage() {
  const topics = Object.keys(dataset.meta.topicCounts).sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("zh-CN"));
  const filtered = useMemo(() => dataset.questions.filter((question) =>
    (topic === "all" || question.topic === topic) && (!deferredQuery || searchIndex.get(question.id)?.includes(deferredQuery)),
  ), [deferredQuery, topic]);

  return (
    <div className="exams-page computer-exams-page">
      <header className="exams-header">
        <div><h1>机考题库</h1><p>按课程专题整理，共收录 {dataset.meta.importedCount} 道无需补充参数、可直接展示积分区域的题目。</p></div>
        <span className="question-count">当前显示 {filtered.length} 道</span>
      </header>
      <div className="exam-filters computer-mobile-filters">
        <label className="search-field"><Search size={17} /><span className="sr-only">搜索机考题</span><input type="search" placeholder="搜索专题、题干或区域" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="select-field"><Filter size={16} /><span className="sr-only">选择专题</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">全部专题</option>{topics.map((item) => <option key={item} value={item}>{item}（{dataset.meta.topicCounts[item]}）</option>)}</select></label>
      </div>
      <div className="computer-library-layout">
        <aside className="topic-sidebar" aria-label="机考专题">
          <button className={topic === "all" ? "is-active" : ""} onClick={() => setTopic("all")}><span>全部专题</span><b>{dataset.meta.importedCount}</b></button>
          {topics.map((item) => <button key={item} className={topic === item ? "is-active" : ""} onClick={() => setTopic(item)}><span>{item}</span><b>{dataset.meta.topicCounts[item]}</b></button>)}
        </aside>
        <section className="question-list" aria-label="机考题列表">
          {filtered.length ? filtered.map((question) => <QuestionCard key={question.id} ordinal={question.ordinal} meta={[question.topicCode, `第 ${question.page} 页`, `题号 ${question.ordinal}`]} title={question.topic} integralType={question.integralType} prompt={question.prompt} region={question.region} answer={question.answer} solution={question.solution} visualizationSpec={question.visualizationSpec} />) : <div className="empty-results"><Search size={23} /><strong>没有匹配的题目</strong><span>请调整关键词或专题。</span></div>}
        </section>
      </div>
    </div>
  );
}
