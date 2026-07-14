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

const compactLatex = (value: string) => value.replace(/\s+/g, "").replace(/[{}]/g, "");

const usesVariable = (expression: string, variable: string) => {
  if (!/^[A-Za-z]$/.test(variable)) return true;
  const withoutCommands = expression
    .replace(/\\[A-Za-z]+/g, "")
    .replace(/\b(?:sqrt|sin|cos|tan|cot|log|ln|exp|abs)\b/gi, "");
  return withoutCommands.includes(variable);
};

export function convertBoundsToConstraintRegion(bounds: VariableBound[]): ConstraintRegion | null {
  const variables = bounds.map((bound) => compactLatex(bound.variable));
  if (
    variables.some((variable) => !/^[A-Za-z]$/.test(variable))
    || bounds.some((bound) =>
      variables.some((variable) => usesVariable(bound.lower, variable) || usesVariable(bound.upper, variable)),
    )
  ) {
    return null;
  }
  return {
    constraints: bounds.flatMap((bound) => [
      `${bound.variable}\\ge ${bound.lower}`,
      `${bound.variable}\\le ${bound.upper}`,
    ]),
    ranges: [...bounds].reverse().map((bound) => ({
      variable: bound.variable,
      lower: bound.lower,
      upper: bound.upper,
    })),
  };
}

const isFullTurn = (bound: VariableBound) => {
  const lower = compactLatex(bound.lower);
  const upper = compactLatex(bound.upper);
  return (lower === "0" && (upper === "2\\pi" || upper === "2pi"))
    || ((lower === "-\\pi" || lower === "-pi") && (upper === "\\pi" || upper === "pi"));
};

const parseFiniteDecimal = (value: string) => {
  const parsed = Number(compactLatex(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value: number) => {
  const rounded = Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
  return String(rounded);
};

function parseAffineRadialSquare(expression: string, radial: string, angular: string) {
  const replaced = compactLatex(expression).replaceAll(`${radial}^2`, "q");
  if (usesVariable(replaced, radial) || usesVariable(replaced, angular)) return null;
  const terms = replaced.replace(/-/g, "+-").split("+").filter(Boolean);
  let constant = 0;
  let coefficient = 0;
  for (const term of terms) {
    if (!term.includes("q")) {
      const value = Number(term);
      if (!Number.isFinite(value)) return null;
      constant += value;
      continue;
    }
    const match = term.match(/^([+-]?)(\d*\.?\d*)\*?q$/);
    if (!match) return null;
    const magnitude = match[2] === "" ? 1 : Number(match[2]);
    if (!Number.isFinite(magnitude)) return null;
    coefficient += match[1] === "-" ? -magnitude : magnitude;
  }
  return { constant, coefficient };
}

export function convertLineParameter(spec: LineIntegralSpec): ConstraintRegion | null {
  const parameter = compactLatex(spec.parameter.variable);
  const x = compactLatex(spec.path.x);
  const y = compactLatex(spec.path.y);
  const z = compactLatex(spec.path.z);
  const isUnitCircle =
    (x === `\\cos${parameter}` && y === `\\sin${parameter}`)
    || (x === `cos${parameter}` && y === `sin${parameter}`);
  const zValue = parseFiniteDecimal(spec.path.z);
  if (!isUnitCircle || z.includes(parameter) || !isFullTurn(spec.parameter) || zValue === null) return null;
  const zPadding = Math.max(1, Math.abs(zValue) * 0.1);
  return {
    constraints: ["x^2+y^2=1", `z=${spec.path.z}`],
    ranges: [
      { variable: "x", lower: "-1.2", upper: "1.2" },
      { variable: "y", lower: "-1.2", upper: "1.2" },
      { variable: "z", lower: formatNumber(zValue - zPadding), upper: formatNumber(zValue + zPadding) },
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
  const radialLower = parseFiniteDecimal(radial.lower);
  const radialUpper = parseFiniteDecimal(radial.upper);
  const affineZ = parseAffineRadialSquare(spec.surface.z, u, v);
  if (
    !radialForm
    || !isFullTurn(angular)
    || radialLower === null
    || radialUpper === null
    || radialLower < 0
    || radialLower >= radialUpper
    || !affineZ
  ) return null;
  const implicitZ = z.replaceAll(`${u}^2`, "(x^2+y^2)");
  const endpointValues = [radialLower, radialUpper].map((value) =>
    affineZ.constant + affineZ.coefficient * value ** 2,
  );
  const zMinimum = Math.min(...endpointValues);
  const zMaximum = Math.max(...endpointValues);
  const zPadding = Math.max(0.5, (zMaximum - zMinimum) * 0.1);
  const radialConstraints = [`x^2+y^2\\le(${radial.upper})^2`];
  if (radialLower > 0) radialConstraints.push(`x^2+y^2\\ge(${radial.lower})^2`);
  return {
    constraints: [`z=${implicitZ}`, ...radialConstraints],
    ranges: [
      { variable: "x", lower: formatNumber(-radialUpper), upper: formatNumber(radialUpper) },
      { variable: "y", lower: formatNumber(-radialUpper), upper: formatNumber(radialUpper) },
      { variable: "z", lower: formatNumber(zMinimum - zPadding), upper: formatNumber(zMaximum + zPadding) },
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
  const convertedRegion = convertBoundsToConstraintRegion(spec.bounds);

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
          hint={spec.type === "double" ? "添加如 x^2+y^2\\le1 的区域条件。" : "使用不等式围成立体区域；单独等式没有体积。"}
          convertLabel="从当前上下界转换"
          onConvert={convertedRegion ? () => updateConstraintRegion(convertedRegion) : undefined}
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
      <SegmentedControl
        label="曲线方向"
        value={(spec.orientation ?? 1) === 1 ? "positive" : "negative"}
        options={[
          { value: "positive", label: "正向" },
          { value: "negative", label: "反向" },
        ]}
        onChange={(value) => onChange({ ...spec, orientation: value === "positive" ? 1 : -1 })}
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
