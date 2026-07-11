import { ExpressionField } from "./ExpressionField";
import { ConstraintRegionEditor } from "./ConstraintRegionEditor";
import type {
  IntegralSpec,
  LineIntegralSpec,
  MultipleIntegralSpec,
  OrdinaryIntegralSpec,
  SurfaceIntegralSpec,
  VariableBound,
  ConstraintRegion,
} from "./types";

const emptyCartesianRegion = (variables: string[]): ConstraintRegion => ({
  constraints: [],
  ranges: variables.map((variable) => ({ variable, lower: "-5", upper: "5" })),
});

const boundsToConstraintRegion = (bounds: VariableBound[]): ConstraintRegion => ({
  constraints: bounds.flatMap((bound) => [
    `${bound.variable}\\ge ${bound.lower}`,
    `${bound.variable}\\le ${bound.upper}`,
  ]),
  ranges: [...bounds].reverse().map((bound, index) => ({
    variable: bound.variable,
    lower: index === 0 ? bound.lower : "-5",
    upper: index === 0 ? bound.upper : "5",
  })),
});

const compactLatex = (value: string) => value.replace(/\s+/g, "").replace(/[{}]/g, "");

export function convertLineParameter(spec: LineIntegralSpec): ConstraintRegion | null {
  const parameter = compactLatex(spec.parameter.variable);
  const x = compactLatex(spec.path.x);
  const y = compactLatex(spec.path.y);
  const z = compactLatex(spec.path.z);
  const isUnitCircle =
    (x === `\\cos${parameter}` && y === `\\sin${parameter}`)
    || (x === `cos${parameter}` && y === `sin${parameter}`);
  if (!isUnitCircle || z.includes(parameter)) return null;
  return {
    constraints: ["x^2+y^2=1", `z=${spec.path.z}`],
    ranges: [
      { variable: "x", lower: "-1.2", upper: "1.2" },
      { variable: "y", lower: "-1.2", upper: "1.2" },
      { variable: "z", lower: "-1", upper: "1" },
    ],
  };
}

export function convertSurfaceParameter(spec: SurfaceIntegralSpec): ConstraintRegion | null {
  const [radial, angular] = spec.parameters;
  const u = compactLatex(radial.variable);
  const v = compactLatex(angular.variable);
  const x = compactLatex(spec.surface.x);
  const y = compactLatex(spec.surface.y);
  const radialForm =
    (x === `${u}\\cos${v}` && y === `${u}\\sin${v}`)
    || (x === `${u}cos${v}` && y === `${u}sin${v}`);
  const z = compactLatex(spec.surface.z);
  if (!radialForm || !z.includes(`${u}^2`)) return null;
  const implicitZ = z.replaceAll(`${u}^2`, "(x^2+y^2)");
  return {
    constraints: [`z=${implicitZ}`, `x^2+y^2\\le(${radial.upper})^2`],
    ranges: [
      { variable: "x", lower: `-${radial.upper}`, upper: radial.upper },
      { variable: "y", lower: `-${radial.upper}`, upper: radial.upper },
      { variable: "z", lower: "-5", upper: "5" },
    ],
  };
}

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
  const emptyRegion = () =>
    emptyCartesianRegion([...spec.bounds].reverse().map((bound) => bound.variable));

  const setRegionMode = (regionMode: "bounds" | "constraints") =>
    onChange({
      ...spec,
      regionMode,
      constraintRegion:
        regionMode === "constraints" ? spec.constraintRegion ?? emptyRegion() : spec.constraintRegion,
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
        <ConstraintRegionEditor
          region={spec.constraintRegion ?? emptyRegion()}
          onChange={updateConstraintRegion}
          hint={spec.type === "double" ? "添加如 x^2+y^2\\le1 的区域条件。" : "添加定义立体区域的等式或不等式。"}
          convertLabel="从当前上下界转换"
          onConvert={() => updateConstraintRegion(boundsToConstraintRegion(spec.bounds))}
        />
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
  const emptyRegion = () => emptyCartesianRegion(["x", "y", "z"]);
  const regionMode = spec.regionMode === "constraints" ? "constraints" : "parameter";
  const convertedRegion = convertLineParameter(spec);
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
      <SegmentedControl
        label="曲线输入方式"
        value={regionMode}
        options={[
          { value: "parameter", label: "参数方程" },
          { value: "constraints", label: "隐式条件" },
        ]}
        onChange={(nextMode) => onChange({
          ...spec,
          regionMode: nextMode,
          constraintRegion: nextMode === "constraints" ? spec.constraintRegion ?? emptyRegion() : spec.constraintRegion,
        })}
      />
      {regionMode === "parameter" ? (
        <>
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
        </>
      ) : (
        <ConstraintRegionEditor
          region={spec.constraintRegion ?? emptyRegion()}
          onChange={(constraintRegion) => onChange({ ...spec, regionMode: "constraints", constraintRegion })}
          hint="通常输入两个独立等式确定交线，再用不等式截取曲线。"
          convertLabel="从当前参数方程转换"
          onConvert={convertedRegion ? () => onChange({ ...spec, regionMode: "constraints", constraintRegion: convertedRegion }) : undefined}
        />
      )}
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
  const emptyRegion = () => emptyCartesianRegion(["x", "y", "z"]);
  const regionMode = spec.regionMode === "constraints" ? "constraints" : "parameter";
  const convertedRegion = convertSurfaceParameter(spec);
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
      <SegmentedControl
        label="曲面输入方式"
        value={regionMode}
        options={[
          { value: "parameter", label: "参数曲面" },
          { value: "constraints", label: "隐式条件" },
        ]}
        onChange={(nextMode) => onChange({
          ...spec,
          regionMode: nextMode,
          constraintRegion: nextMode === "constraints" ? spec.constraintRegion ?? emptyRegion() : spec.constraintRegion,
        })}
      />
      {regionMode === "parameter" ? (
        <>
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
        </>
      ) : (
        <ConstraintRegionEditor
          region={spec.constraintRegion ?? emptyRegion()}
          onChange={(constraintRegion) => onChange({ ...spec, regionMode: "constraints", constraintRegion })}
          hint="至少输入一个等式定义曲面，再用不等式截取所需部分。"
          convertLabel="从当前参数曲面转换"
          onConvert={convertedRegion ? () => onChange({ ...spec, regionMode: "constraints", constraintRegion: convertedRegion }) : undefined}
        />
      )}
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
