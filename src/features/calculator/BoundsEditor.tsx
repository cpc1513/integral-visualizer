import { Plus, Trash2 } from "lucide-react";
import { ExpressionField } from "./ExpressionField";
import type {
  IntegralSpec,
  LineIntegralSpec,
  MultipleIntegralSpec,
  OrdinaryIntegralSpec,
  SurfaceIntegralSpec,
  VariableBound,
  ConstraintRegion,
} from "./types";

interface BoundsEditorProps {
  spec: IntegralSpec;
  onChange: (spec: IntegralSpec) => void;
}

function BoundRow({
  bound,
  onChange,
}: {
  bound: VariableBound;
  onChange: (bound: VariableBound) => void;
}) {
  return (
    <div className="bound-row">
      <span className="bound-row-label">{bound.label}</span>
      <ExpressionField
        label="变量"
        value={bound.variable}
        compact
        onChange={(variable) => onChange({ ...bound, variable })}
      />
      <ExpressionField
        label="下限"
        value={bound.lower}
        onChange={(lower) => onChange({ ...bound, lower })}
      />
      <ExpressionField
        label="上限"
        value={bound.upper}
        onChange={(upper) => onChange({ ...bound, upper })}
      />
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented-field">
      <span>{label}</span>
      <div className="segmented-control" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrdinaryBounds({
  spec,
  onChange,
}: {
  spec: OrdinaryIntegralSpec;
  onChange: (spec: OrdinaryIntegralSpec) => void;
}) {
  return (
    <div className="bounds-stack">
      <SegmentedControl
        label="积分形式"
        value={spec.definite ? "definite" : "indefinite"}
        options={[
          { value: "definite", label: "定积分" },
          { value: "indefinite", label: "不定积分" },
        ]}
        onChange={(value) => onChange({ ...spec, definite: value === "definite" })}
      />
      <ExpressionField
        label="被积函数"
        value={spec.integrand}
        onChange={(integrand) => onChange({ ...spec, integrand })}
      />
      {spec.definite ? (
        <BoundRow bound={spec.bound} onChange={(bound) => onChange({ ...spec, bound })} />
      ) : (
        <ExpressionField
          label="积分变量"
          value={spec.bound.variable}
          compact
          onChange={(variable) => onChange({ ...spec, bound: { ...spec.bound, variable } })}
        />
      )}
    </div>
  );
}

function MultipleBounds({
  spec,
  onChange,
}: {
  spec: MultipleIntegralSpec;
  onChange: (spec: MultipleIntegralSpec) => void;
}) {
  const defaultConstraintRegion = (): ConstraintRegion => {
    const ranges = [...spec.bounds].reverse().map((bound, index) => ({
      variable: bound.variable,
      lower: index === 0 ? bound.lower : "-5",
      upper: index === 0 ? bound.upper : "5",
    }));
    const constraints = spec.bounds.flatMap((bound) => [
      `${bound.variable}\\ge ${bound.lower}`,
      `${bound.variable}\\le ${bound.upper}`,
    ]);
    return { constraints, ranges };
  };

  const setRegionMode = (regionMode: "bounds" | "constraints") =>
    onChange({
      ...spec,
      regionMode,
      constraintRegion:
        regionMode === "constraints" ? spec.constraintRegion ?? defaultConstraintRegion() : spec.constraintRegion,
    });

  const updateConstraintRegion = (constraintRegion: ConstraintRegion) =>
    onChange({ ...spec, regionMode: "constraints", constraintRegion });

  return (
    <div className="bounds-stack">
      <ExpressionField
        label="被积函数"
        value={spec.integrand}
        onChange={(integrand) => onChange({ ...spec, integrand })}
      />
      <SegmentedControl
        label="积分区域输入"
        value={spec.regionMode === "constraints" ? "constraints" : "bounds"}
        options={[
          { value: "bounds", label: "累次上下界" },
          { value: "constraints", label: "条件区域" },
        ]}
        onChange={setRegionMode}
      />
      {spec.regionMode !== "constraints" ? spec.bounds.map((bound, index) => (
        <BoundRow
          key={`${bound.label}-${index}`}
          bound={bound}
          onChange={(nextBound) => {
            const bounds = spec.bounds.map((item, itemIndex) =>
              itemIndex === index ? nextBound : item,
            );
            onChange({ ...spec, bounds });
          }}
        />
      )) : (
        <div className="constraint-editor">
          {(spec.constraintRegion ?? defaultConstraintRegion()).constraints.map((constraint, index) => (
            <div className="constraint-row" key={`constraint-${index}`}>
              <ExpressionField
                label={`约束 ${index + 1}`}
                value={constraint}
                onChange={(value) => {
                  const region = structuredClone(spec.constraintRegion ?? defaultConstraintRegion());
                  region.constraints[index] = value;
                  updateConstraintRegion(region);
                }}
              />
              <button
                type="button"
                className="icon-button constraint-delete"
                aria-label={`删除约束 ${index + 1}`}
                disabled={(spec.constraintRegion ?? defaultConstraintRegion()).constraints.length <= 1}
                onClick={() => {
                  const region = structuredClone(spec.constraintRegion ?? defaultConstraintRegion());
                  region.constraints.splice(index, 1);
                  updateConstraintRegion(region);
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="add-constraint-button"
            onClick={() => {
              const region = structuredClone(spec.constraintRegion ?? defaultConstraintRegion());
              region.constraints.push(spec.type === "double" ? "x+y\\le 1" : "z\\ge 0");
              updateConstraintRegion(region);
            }}
          >
            <Plus size={14} aria-hidden="true" />
            添加约束
          </button>
          <div className="constraint-ranges">
            {(spec.constraintRegion ?? defaultConstraintRegion()).ranges.map((range, index) => (
              <div className="range-row" key={`${range.variable}-${index}`}>
                <span>{range.variable} 扫描范围</span>
                <ExpressionField
                  label="最小值"
                  value={range.lower}
                  onChange={(lower) => {
                    const region = structuredClone(spec.constraintRegion ?? defaultConstraintRegion());
                    region.ranges[index].lower = lower;
                    updateConstraintRegion(region);
                  }}
                />
                <ExpressionField
                  label="最大值"
                  value={range.upper}
                  onChange={(upper) => {
                    const region = structuredClone(spec.constraintRegion ?? defaultConstraintRegion());
                    region.ranges[index].upper = upper;
                    updateConstraintRegion(region);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LineBounds({
  spec,
  onChange,
}: {
  spec: LineIntegralSpec;
  onChange: (spec: LineIntegralSpec) => void;
}) {
  const updatePath = (axis: "x" | "y" | "z", value: string) =>
    onChange({ ...spec, path: { ...spec.path, [axis]: value } });
  return (
    <div className="bounds-stack">
      <SegmentedControl
        label="曲线积分类型"
        value={spec.mode}
        options={[
          { value: "scalar", label: "第一类" },
          { value: "work", label: "第二类" },
        ]}
        onChange={(mode) => onChange({ ...spec, mode })}
      />
      {spec.mode === "scalar" ? (
        <ExpressionField
          label="被积函数"
          value={spec.integrand}
          onChange={(integrand) => onChange({ ...spec, integrand })}
        />
      ) : (
        <div className="coordinate-grid">
          {(["p", "q", "r"] as const).map((component) => (
            <ExpressionField
              key={component}
              label={component.toUpperCase()}
              value={spec.vectorField[component]}
              onChange={(value) =>
                onChange({ ...spec, vectorField: { ...spec.vectorField, [component]: value } })
              }
            />
          ))}
        </div>
      )}
      <div className="coordinate-grid">
        {(["x", "y", "z"] as const).map((axis) => (
          <ExpressionField
            key={axis}
            label={`${axis}(${spec.parameter.variable})`}
            value={spec.path[axis]}
            onChange={(value) => updatePath(axis, value)}
          />
        ))}
      </div>
      <BoundRow
        bound={spec.parameter}
        onChange={(parameter) => onChange({ ...spec, parameter })}
      />
    </div>
  );
}

function SurfaceBounds({
  spec,
  onChange,
}: {
  spec: SurfaceIntegralSpec;
  onChange: (spec: SurfaceIntegralSpec) => void;
}) {
  return (
    <div className="bounds-stack">
      <SegmentedControl
        label="曲面积分类型"
        value={spec.mode}
        options={[
          { value: "scalar", label: "第一类" },
          { value: "flux", label: "第二类" },
        ]}
        onChange={(mode) => onChange({ ...spec, mode })}
      />
      {spec.mode === "scalar" ? (
        <ExpressionField
          label="被积函数"
          value={spec.integrand}
          onChange={(integrand) => onChange({ ...spec, integrand })}
        />
      ) : (
        <div className="coordinate-grid">
          {(["p", "q", "r"] as const).map((component) => (
            <ExpressionField
              key={component}
              label={component.toUpperCase()}
              value={spec.vectorField[component]}
              onChange={(value) =>
                onChange({ ...spec, vectorField: { ...spec.vectorField, [component]: value } })
              }
            />
          ))}
        </div>
      )}
      <div className="coordinate-grid">
        {(["x", "y", "z"] as const).map((axis) => (
          <ExpressionField
            key={axis}
            label={`${axis}(${spec.parameters[0].variable},${spec.parameters[1].variable})`}
            value={spec.surface[axis]}
            onChange={(value) =>
              onChange({ ...spec, surface: { ...spec.surface, [axis]: value } })
            }
          />
        ))}
      </div>
      {spec.parameters.map((parameter, index) => (
        <BoundRow
          key={parameter.label}
          bound={parameter}
          onChange={(next) => {
            const parameters = [...spec.parameters] as [VariableBound, VariableBound];
            parameters[index] = next;
            onChange({ ...spec, parameters });
          }}
        />
      ))}
      <SegmentedControl
        label="曲面方向"
        value={spec.orientation === 1 ? "positive" : "negative"}
        options={[
          { value: "positive", label: "正向" },
          { value: "negative", label: "反向" },
        ]}
        onChange={(value) => onChange({ ...spec, orientation: value === "positive" ? 1 : -1 })}
      />
    </div>
  );
}

export function BoundsEditor({ spec, onChange }: BoundsEditorProps) {
  if (spec.type === "ordinary") return <OrdinaryBounds spec={spec} onChange={onChange} />;
  if (spec.type === "double" || spec.type === "triple") {
    return <MultipleBounds spec={spec} onChange={onChange} />;
  }
  if (spec.type === "line") return <LineBounds spec={spec} onChange={onChange} />;
  return <SurfaceBounds spec={spec} onChange={onChange} />;
}
