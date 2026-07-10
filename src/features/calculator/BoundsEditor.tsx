import { ExpressionField } from "./ExpressionField";
import type {
  IntegralSpec,
  LineIntegralSpec,
  MultipleIntegralSpec,
  OrdinaryIntegralSpec,
  SurfaceIntegralSpec,
  VariableBound,
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
  return (
    <div className="bounds-stack">
      <ExpressionField
        label="被积函数"
        value={spec.integrand}
        onChange={(integrand) => onChange({ ...spec, integrand })}
      />
      {spec.bounds.map((bound, index) => (
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
      ))}
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
