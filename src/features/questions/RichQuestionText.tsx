import { Fragment } from "react";
import { MathExpression } from "../../components/math/MathExpression";
import type { RichTextBlock } from "./types";

export function RichQuestionText({ blocks }: { blocks: RichTextBlock[] }) {
  return (
    <div className="rich-question-text">
      {blocks.map((block, blockIndex) => (
        <div className="rich-question-block" key={blockIndex}>
          {block.map((segment, segmentIndex) => (
            <Fragment key={`${segment.type}-${segmentIndex}`}>
              {segment.type === "text" ? (
                segment.value
              ) : (
                <MathExpression
                  latex={segment.value}
                  display={segment.display}
                  className={segment.display ? "question-display-math" : "question-inline-math"}
                />
              )}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
