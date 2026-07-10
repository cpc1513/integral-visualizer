import type { MathfieldElement } from "mathlive";
import { MathExpression } from "../../components/math/MathExpression";

const symbols = [
  { label: "积分", latex: "\\int" },
  { label: "二重积分", latex: "\\iint" },
  { label: "三重积分", latex: "\\iiint" },
  { label: "闭合积分", latex: "\\oint" },
  { label: "根号", latex: "\\sqrt{#0}" },
  { label: "圆周率", latex: "\\pi" },
  { label: "角度变量 theta", latex: "\\theta" },
  { label: "变量 x", latex: "x" },
  { label: "变量 y", latex: "y" },
  { label: "变量 z", latex: "z" },
  { label: "小于等于", latex: "\\le" },
  { label: "大于等于", latex: "\\ge" },
  { label: "正弦", latex: "\\sin" },
  { label: "余弦", latex: "\\cos" },
] as const;

interface SymbolKeyboardProps {
  mathfield: MathfieldElement | null;
}

export function SymbolKeyboard({ mathfield }: SymbolKeyboardProps) {
  const insert = (latex: string) => {
    if (!mathfield) return;
    mathfield.focus();
    mathfield.insert(latex, { selectionMode: "placeholder", focus: true });
  };

  return (
    <div className="symbol-keyboard" aria-label="数学符号键盘">
      {symbols.map((symbol) => (
        <button
          className="symbol-key"
          type="button"
          key={symbol.label}
          aria-label={symbol.label}
          onClick={() => insert(symbol.latex)}
        >
          <MathExpression latex={symbol.latex.replace("#0", "x")} />
        </button>
      ))}
    </div>
  );
}
