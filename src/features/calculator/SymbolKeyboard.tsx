import type { MathfieldElement } from "mathlive";
import { useState } from "react";
import { MathExpression } from "../../components/math/MathExpression";
import { mathSymbolCategories, type SymbolCategoryId } from "./mathSymbols";

interface SymbolKeyboardProps {
  mathfield: MathfieldElement | null;
}

export function SymbolKeyboard({ mathfield }: SymbolKeyboardProps) {
  const [activeCategory, setActiveCategory] = useState<SymbolCategoryId>("common");
  const symbols =
    mathSymbolCategories.find((category) => category.id === activeCategory)?.symbols ??
    mathSymbolCategories[0].symbols;

  const insert = (latex: string) => {
    if (!mathfield) return;
    mathfield.focus();
    mathfield.insert(latex, { selectionMode: "placeholder", focus: true });
  };

  return (
    <div className="symbol-keyboard" aria-label="数学符号键盘">
      <div className="symbol-tabs" role="tablist" aria-label="数学符号分类">
        {mathSymbolCategories.map((category) => (
          <button
            className={category.id === activeCategory ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={category.id === activeCategory}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div className="symbol-grid" role="tabpanel">
        {symbols.map((symbol) => (
          <button
            className="symbol-key"
            type="button"
            key={symbol.label}
            aria-label={symbol.label}
            disabled={!mathfield}
            onClick={() => insert(symbol.latex)}
          >
            <MathExpression latex={symbol.preview ?? symbol.latex} />
          </button>
        ))}
      </div>
    </div>
  );
}
