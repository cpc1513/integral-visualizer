import { AlertCircle, ArrowUpRight, BookOpenText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MathExpression } from "../../components/math/MathExpression";
import type { IntegralSpec, IntegralType } from "../calculator/types";
import { RichQuestionText } from "./RichQuestionText";
import type { RichTextBlock } from "./types";

export const typeLabels: Record<IntegralType, string> = {
  ordinary: "普通积分", double: "二重积分", triple: "三重积分", line: "曲线积分", surface: "曲面积分",
};

interface QuestionCardProps {
  ordinal: number;
  meta: string[];
  title: string;
  integralType: IntegralType;
  prompt: RichTextBlock[];
  solution: RichTextBlock[];
  visualizationSpec: IntegralSpec;
  warnings?: string[];
  answer?: string;
  region?: RichTextBlock[];
}

export function QuestionCard(props: QuestionCardProps) {
  const navigate = useNavigate();
  return (
    <article className="question-row">
      <div className="question-index" aria-hidden="true">{String(props.ordinal).padStart(2, "0")}</div>
      <div className="question-body">
        <div className="question-meta">
          {props.meta.map((item) => <span key={item}>{item}</span>)}
          <span className="question-type">{typeLabels[props.integralType]}</span>
        </div>
        <h2>{props.title}</h2>
        <RichQuestionText blocks={props.prompt} />
        {props.region?.length ? <div className="question-region"><strong>积分区域</strong><RichQuestionText blocks={props.region} /></div> : null}
        {props.warnings?.length ? <div className="source-warning"><AlertCircle size={16} /><span>来源提示：{props.warnings.join("、")}</span></div> : null}
        <div className="question-actions">
          <details className="solution-disclosure">
            <summary><BookOpenText size={16} />查看答案与解析</summary>
            <div className="solution-content">
              {props.answer ? (
                <p className="computer-answer">
                  <strong>答案：</strong>
                  {/^[A-D]$/.test(props.answer.trim()) ? (
                    props.answer.trim()
                  ) : (
                    <MathExpression
                      latex={props.answer
                        .trim()
                        .replace(/^\$\$?|\$\$?$/g, "")
                        .replace(/\\\\(?=[A-Za-z])/g, "\\")}
                      label={`答案 ${props.answer}`}
                    />
                  )}
                </p>
              ) : null}
              {props.solution.length ? <RichQuestionText blocks={props.solution} /> : <p>原文未提供解析。</p>}
            </div>
          </details>
          <button type="button" className="load-calculator-button" onClick={() => navigate("/", { state: { visualizationSpec: props.visualizationSpec } })}>
            一键在计算台可视化 <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
