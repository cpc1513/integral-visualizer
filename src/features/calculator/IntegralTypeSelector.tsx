import { MathExpression } from "../../components/math/MathExpression";
import type { IntegralType } from "./types";

const integralTypes: Array<{ type: IntegralType; label: string; symbol: string }> = [
  { type: "ordinary", label: "普通积分", symbol: "\\int" },
  { type: "double", label: "二重积分", symbol: "\\iint" },
  { type: "triple", label: "三重积分", symbol: "\\iiint" },
  { type: "line", label: "曲线积分", symbol: "\\oint" },
  { type: "surface", label: "曲面积分", symbol: "\\iint_{\\Sigma}" },
];

interface IntegralTypeSelectorProps {
  value: IntegralType;
  onChange: (type: IntegralType) => void;
}

export function IntegralTypeSelector({ value, onChange }: IntegralTypeSelectorProps) {
  return (
    <div className="integral-type-grid" role="radiogroup" aria-label="选择积分类型">
      {integralTypes.map((item) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === item.type}
          className={`integral-type-button${value === item.type ? " is-selected" : ""}`}
          key={item.type}
          onClick={() => onChange(item.type)}
        >
          <span>{item.label}</span>
          <MathExpression latex={item.symbol} className="integral-type-symbol" />
        </button>
      ))}
    </div>
  );
}
