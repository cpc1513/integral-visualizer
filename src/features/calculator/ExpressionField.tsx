import { useId } from "react";

interface ExpressionFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function ExpressionField({ label, value, onChange, compact = false }: ExpressionFieldProps) {
  const id = useId();
  return (
    <label className={`expression-field${compact ? " is-compact" : ""}`} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
