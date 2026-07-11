import { MathInputField } from "./MathInputField";

interface ExpressionFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function ExpressionField({ label, value, onChange, compact = false }: ExpressionFieldProps) {
  return <MathInputField label={label} value={value} onChange={onChange} compact={compact} />;
}
