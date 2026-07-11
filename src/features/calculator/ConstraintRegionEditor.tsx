import { Plus, Trash2 } from "lucide-react";
import { ExpressionField } from "./ExpressionField";
import type { ConstraintRegion } from "./types";

interface ConstraintRegionEditorProps {
  region: ConstraintRegion;
  onChange: (region: ConstraintRegion) => void;
  onConvert?: () => void;
  convertLabel?: string;
  hint: string;
}

export function ConstraintRegionEditor({
  region,
  onChange,
  onConvert,
  convertLabel,
  hint,
}: ConstraintRegionEditorProps) {
  const update = (mutate: (next: ConstraintRegion) => void) => {
    const next = structuredClone(region);
    mutate(next);
    onChange(next);
  };

  return (
    <div className="constraint-editor">
      <div className="constraint-editor-intro">
        <p>{region.constraints.length === 0 ? hint : "等式定义对象，不等式用于截取范围。"}</p>
        {onConvert ? (
          <button type="button" className="convert-region-button" onClick={onConvert}>
            {convertLabel ?? "从当前参数转换"}
          </button>
        ) : null}
      </div>
      {region.constraints.map((constraint, index) => (
        <div className="constraint-row" key={`constraint-${index}`}>
          <ExpressionField
            label={`约束 ${index + 1}`}
            value={constraint}
            onChange={(value) => update((next) => { next.constraints[index] = value; })}
          />
          <button
            type="button"
            className="icon-button constraint-delete"
            aria-label={`删除约束 ${index + 1}`}
            onClick={() => update((next) => { next.constraints.splice(index, 1); })}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="add-constraint-button"
        onClick={() => update((next) => { next.constraints.push(""); })}
      >
        <Plus size={14} aria-hidden="true" />
        添加条件
      </button>
      <div className="constraint-ranges">
        {region.ranges.map((range, index) => (
          <div className="range-row" key={`${range.variable}-${index}`}>
            <span>{range.variable} 扫描范围</span>
            <ExpressionField
              label="最小值"
              value={range.lower}
              onChange={(lower) => update((next) => { next.ranges[index].lower = lower; })}
            />
            <ExpressionField
              label="最大值"
              value={range.upper}
              onChange={(upper) => update((next) => { next.ranges[index].upper = upper; })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
