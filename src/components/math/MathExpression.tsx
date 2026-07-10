import katex from "katex";
import { memo, useMemo } from "react";

interface MathExpressionProps {
  latex: string;
  display?: boolean;
  className?: string;
  label?: string;
}

export const MathExpression = memo(function MathExpression({
  latex,
  display = false,
  className = "",
  label,
}: MathExpressionProps) {
  const markup = useMemo(
    () =>
      katex.renderToString((latex || "\\square").replace(/[\u2000-\u200b]/g, " "), {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
        trust: false,
        output: "htmlAndMathml",
      }),
    [display, latex],
  );

  const Tag = display ? "div" : "span";
  return (
    <Tag
      className={`math-expression ${className}`.trim()}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
});
