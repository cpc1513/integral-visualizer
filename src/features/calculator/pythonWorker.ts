/// <reference lib="webworker" />

import { loadPyodide, type PyodideAPI } from "pyodide";
import type { ComputePayload } from "./computePayload";
import type { ComputeResult, ComputeStatus } from "./types";

declare const self: DedicatedWorkerGlobalScope;

const PYODIDE_VERSION = "314.0.2";
const PYODIDE_INDEX_URLS = [
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  `https://unpkg.com/pyodide@${PYODIDE_VERSION}/`,
] as const;

const PYTHON_SETUP = String.raw`
import json
import math
import re
import time
from sympy import (
    Abs, Add, E, Float, I, Integer, Integral, Matrix, Mul, Pow, Rational, Symbol,
    acos, asin, atan, cos, cosh, cot, exp, latex, log, nan, oo, pi, sin, sinh,
    sqrt, tan, zoo, integrate, lambdify, N
)
from sympy.parsing.sympy_parser import (
    convert_xor, implicit_multiplication_application, parse_expr,
    standard_transformations
)

TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
SYMBOL_NAMES = "abcdefghijklmnopqrstuvwxyz"
SYMBOLS = {name: Symbol(name, real=True) for name in SYMBOL_NAMES}
LOCALS = {
    **SYMBOLS,
    "pi": pi, "E": E, "e": E, "sqrt": sqrt, "sin": sin, "cos": cos,
    "tan": tan, "cot": cot, "asin": asin, "acos": acos, "atan": atan,
    "sinh": sinh, "cosh": cosh, "exp": exp, "log": log, "Abs": Abs, "abs": Abs,
}
SAFE_GLOBALS = {
    "__builtins__": {},
    "Integer": Integer,
    "Float": Float,
    "Rational": Rational,
    "Add": Add,
    "Mul": Mul,
    "Pow": Pow,
}
KNOWN_IDENTIFIERS = frozenset(LOCALS)
IDENTIFIER_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
NUMBER_PATTERN = re.compile(r"(?<![A-Za-z_])(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")
ALLOWED_EXPRESSION_PATTERN = re.compile(r"[A-Za-z0-9_+\-*/^(),.\s]+")

def normalize_safe_expression(value):
    text = str(value).strip()
    if not text:
        return "0"
    if not ALLOWED_EXPRESSION_PATTERN.fullmatch(text):
        raise ValueError("表达式包含不受支持的字符")
    # Decimal points are allowed only inside numeric literals; this blocks
    # attribute access while retaining inputs such as 1.25 and 2e-3.
    if "." in NUMBER_PATTERN.sub("0", text):
        raise ValueError("表达式不允许属性访问")

    def expand_identifier(match):
        name = match.group(0)
        if name in KNOWN_IDENTIFIERS:
            return name
        # Preserve the calculator's existing implicit multiplication syntax:
        # xy and abc mean x*y and a*b*c, not new Python names.
        if name.islower() and all(character in SYMBOLS for character in name):
            return "*".join(name)
        raise ValueError(f"不支持的符号或函数：{name}")

    return IDENTIFIER_PATTERN.sub(expand_identifier, text)

def parse_math(value):
    normalized = normalize_safe_expression(value)
    return parse_expr(
        normalized,
        local_dict=LOCALS,
        global_dict=SAFE_GLOBALS,
        transformations=TRANSFORMS,
        evaluate=False,
    )

def prepare_problem(payload):
    kind = payload["type"]
    expr = parse_math(payload.get("integrand", "1"))
    bounds = payload.get("bounds", [])
    step_label = "原积分"

    if kind == "ordinary":
        variable = SYMBOLS[bounds[0]["variable"]]
        if not payload.get("definite", True):
            return expr, [], integrate(expr, variable), "不定积分"
        return expr, bounds, None, step_label

    if kind in ("double", "triple"):
        return expr, bounds, None, step_label

    if kind == "line":
        parameter_bound = bounds[0]
        parameter = SYMBOLS[parameter_bound["variable"]]
        path = payload["path"]
        coordinates = Matrix([parse_math(path[axis]) for axis in ("x", "y", "z")])
        substitutions = {SYMBOLS[axis]: coordinates[index] for index, axis in enumerate(("x", "y", "z"))}
        tangent = coordinates.diff(parameter) * payload.get("orientation", 1)
        if payload.get("mode") == "work":
            field = payload["vectorField"]
            vector = Matrix([parse_math(field[key]).subs(substitutions) for key in ("p", "q", "r")])
            transformed = vector.dot(tangent)
            step_label = "参数化后的功积分"
        else:
            speed = sqrt(tangent.dot(tangent))
            transformed = expr.subs(substitutions) * speed
            step_label = "参数化后的弧长积分"
        return transformed, bounds, None, step_label

    if kind == "surface":
        parameter_bounds = bounds
        u = SYMBOLS[parameter_bounds[0]["variable"]]
        v = SYMBOLS[parameter_bounds[1]["variable"]]
        surface = payload["surface"]
        coordinates = Matrix([parse_math(surface[axis]) for axis in ("x", "y", "z")])
        substitutions = {SYMBOLS[axis]: coordinates[index] for index, axis in enumerate(("x", "y", "z"))}
        normal = coordinates.diff(u).cross(coordinates.diff(v)) * payload.get("orientation", 1)
        if payload.get("mode") == "flux":
            field = payload["vectorField"]
            vector = Matrix([parse_math(field[key]).subs(substitutions) for key in ("p", "q", "r")])
            transformed = vector.dot(normal)
            step_label = "参数化后的通量积分"
        else:
            transformed = expr.subs(substitutions) * sqrt(normal.dot(normal))
            step_label = "参数化后的曲面面积分"
        return transformed, bounds, None, step_label

    raise ValueError(f"Unsupported integral type: {kind}")

def integrate_prepared(expr, bounds):
    result = expr
    for bound in bounds:
        variable = SYMBOLS[bound["variable"]]
        lower = parse_math(bound["lower"])
        upper = parse_math(bound["upper"])
        result = integrate(result, (variable, lower, upper))
    return result

def compute_integral(payload_json):
    started = time.perf_counter()
    payload = json.loads(payload_json)
    expr, bounds, immediate_result, step_label = prepare_problem(payload)
    result = immediate_result if immediate_result is not None else integrate_prepared(expr, bounds)
    if result.has(nan, zoo, oo, -oo):
        return json.dumps({
            "outcome": "invalid",
            "error": "积分发散或未定义，不能转为数值积分。",
        }, ensure_ascii=False)
    if result.has(I) or result.is_real is False:
        return json.dumps({
            "outcome": "invalid",
            "error": "积分结果不是有限实数，不能转为数值积分。",
        }, ensure_ascii=False)
    unresolved = bool(result.atoms(Integral))
    if bounds and result.free_symbols:
        unresolved = True
    if unresolved and not bounds:
        return json.dumps({
            "outcome": "invalid",
            "error": "未找到闭式原函数；不定积分不能用定区间数值积分替代。",
        }, ensure_ascii=False)
    steps = [
        {"label": step_label, "latex": latex(expr)},
        {"label": "依次代入积分限", "latex": latex(result)},
    ]
    numeric_value = "—" if not bounds else str(N(result, 12))
    return json.dumps({
        "outcome": "numeric" if unresolved else "exact",
        "result": {
            "status": "exact",
            "exactLatex": latex(result),
            "numericValue": numeric_value,
            "steps": steps,
            "elapsedMs": round((time.perf_counter() - started) * 1000),
        },
    }, ensure_ascii=False)

def compute_numeric_integral(payload_json):
    import warnings
    from scipy.integrate import IntegrationWarning, nquad

    started = time.perf_counter()
    payload = json.loads(payload_json)
    expr, bounds, _, step_label = prepare_problem(payload)
    variables = [SYMBOLS[bound["variable"]] for bound in bounds]
    function = lambdify(tuple(variables), expr, modules=["numpy"])
    ranges = []
    for index, bound in enumerate(bounds):
        outer_variables = tuple(variables[index + 1:])
        lower_expr = parse_math(bound["lower"])
        upper_expr = parse_math(bound["upper"])
        lower_fn = lambdify(outer_variables, lower_expr, modules=["numpy"])
        upper_fn = lambdify(outer_variables, upper_expr, modules=["numpy"])
        if outer_variables:
            def range_fn(*args, _lower=lower_fn, _upper=upper_fn):
                return [float(_lower(*args)), float(_upper(*args))]
            ranges.append(range_fn)
        else:
            ranges.append([float(lower_fn()), float(upper_fn())])

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", IntegrationWarning)
            value, error = nquad(function, ranges, opts={"epsabs": 1e-8, "epsrel": 1e-8, "limit": 80})
    except IntegrationWarning as warning:
        raise ValueError("数值积分未收敛，请检查积分是否发散或在奇点处分段") from warning
    if not math.isfinite(value) or not math.isfinite(error):
        raise ValueError("数值积分未得到有限实数，请检查定义域、奇点或积分是否收敛")
    return json.dumps({
        "status": "numeric",
        "exactLatex": None,
        "numericValue": f"{value:.12g}",
        "errorEstimate": f"{error:.3g}",
        "steps": [
            {"label": step_label, "latex": latex(expr)},
            {"label": "数值积分", "latex": f"{value:.12g}"},
        ],
        "elapsedMs": round((time.perf_counter() - started) * 1000),
    }, ensure_ascii=False)

def compute_constraint_integral(payload_json):
    import numpy as np
    from scipy.stats import qmc

    started = time.perf_counter()
    payload = json.loads(payload_json)
    region = payload["constraintRegion"]
    ranges = region["ranges"]
    variables = [SYMBOLS[item["variable"]] for item in ranges]
    lower = np.array([float(N(parse_math(item["lower"]))) for item in ranges])
    upper = np.array([float(N(parse_math(item["upper"]))) for item in ranges])
    if np.any(lower >= upper):
        raise ValueError("扫描范围下限必须小于上限")

    constraint_functions = [(
        lambdify(tuple(variables), parse_math(item["left"]), modules=["numpy"]),
        lambdify(tuple(variables), parse_math(item["right"]), modules=["numpy"]),
        item["operator"],
    ) for item in region["constraints"]]
    expr = parse_math(payload.get("integrand", "1"))
    function = lambdify(tuple(variables), expr, modules=["numpy"])
    volume = float(np.prod(upper - lower))
    estimates = []
    region_sample_count = 0
    for replicate in range(8):
        samples = qmc.Sobol(d=len(variables), scramble=True, seed=20260710 + replicate).random_base2(m=13)
        points = qmc.scale(samples, lower, upper)
        arguments = tuple(points[:, index] for index in range(len(variables)))
        mask = np.ones(points.shape[0], dtype=bool)
        for left_fn, right_fn, operator in constraint_functions:
            left = np.broadcast_to(np.asarray(left_fn(*arguments)), mask.shape)
            right = np.broadcast_to(np.asarray(right_fn(*arguments)), mask.shape)
            finite = np.isfinite(left) & np.isfinite(right)
            if operator in ("<=", "<"):
                mask &= finite & (left <= right)
            elif operator in (">=", ">"):
                mask &= finite & (left >= right)
            else:
                tolerance = max(upper - lower) * 0.006
                mask &= finite & (np.abs(left - right) <= tolerance)

        region_sample_count += int(np.count_nonzero(mask))
        values = np.broadcast_to(np.asarray(function(*arguments)), mask.shape)
        if np.iscomplexobj(values):
            if np.any(mask & (np.abs(np.imag(values)) > 1e-12)):
                raise ValueError("被积函数在积分区域内出现非实数值，请检查定义域")
            values = np.real(values)
        values = np.asarray(values, dtype=float)
        if np.any(mask & ~np.isfinite(values)):
            raise ValueError("被积函数在积分区域内出现 NaN 或无穷值，请检查定义域或奇点")
        estimates.append(volume * float(np.mean(np.where(mask, values, 0.0))))

    if region_sample_count == 0:
        raise ValueError("当前扫描范围内没有满足全部约束的采样点")
    estimate = float(np.mean(estimates))
    error = float(np.std(estimates, ddof=1) / np.sqrt(len(estimates)))
    return json.dumps({
        "status": "numeric",
        "exactLatex": None,
        "numericValue": f"{estimate:.12g}",
        "errorEstimate": f"{error:.3g}",
        "steps": [
            {"label": "条件区域被积函数", "latex": latex(expr)},
            {"label": "8 组随机化 Sobol 数值积分", "latex": f"{estimate:.12g}"},
        ],
        "elapsedMs": round((time.perf_counter() - started) * 1000),
    }, ensure_ascii=False)
`;

type WorkerRequest = {
  type: "compute";
  id: number;
  payload: ComputePayload;
  method: "exact" | "numeric";
};
type WorkerResponse =
  | { type: "status"; id: number; status: ComputeStatus }
  | { type: "result"; id: number; result: ComputeResult }
  | { type: "error"; id: number; error: string; fatal?: boolean };

let pyodidePromise: Promise<PyodideAPI> | null = null;
let scipyLoaded = false;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

async function ensurePyodide(id: number) {
  if (!pyodidePromise) {
    post({ type: "status", id, status: "loading-python" });
    const loadingPromise = (async () => {
      let lastError: unknown;
      for (const indexURL of PYODIDE_INDEX_URLS) {
        try {
          return await loadPyodide({ indexURL });
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Python 运行时下载失败");
    })().then(async (pyodide) => {
      post({ type: "status", id, status: "loading-symbolics" });
      await pyodide.loadPackage("sympy");
      await pyodide.runPythonAsync(PYTHON_SETUP);
      return pyodide;
    });
    pyodidePromise = loadingPromise;
    void loadingPromise.catch(() => {
      if (pyodidePromise === loadingPromise) pyodidePromise = null;
      scipyLoaded = false;
    });
  }
  return pyodidePromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "compute") return;
  const { id, payload, method } = event.data;
  let pyodide: PyodideAPI;
  try {
    pyodide = await ensurePyodide(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ type: "error", id, error: message.slice(0, 500), fatal: true });
    return;
  }
  try {
    const payloadJson = JSON.stringify(payload);
    pyodide.globals.set("payload_json", payloadJson);
    if (method === "numeric" || payload.constraintRegion) {
      post({ type: "status", id, status: "loading-numerics" });
      if (!scipyLoaded) {
        await pyodide.loadPackage("scipy");
        scipyLoaded = true;
      }
      post({ type: "status", id, status: "computing" });
      const numericCommand = payload.constraintRegion
        ? "compute_constraint_integral(payload_json)"
        : "compute_numeric_integral(payload_json)";
      const numericRaw = await pyodide.runPythonAsync(numericCommand);
      post({ type: "result", id, result: JSON.parse(String(numericRaw)) as ComputeResult });
      return;
    }

    post({ type: "status", id, status: "computing" });
    const raw = await pyodide.runPythonAsync("compute_integral(payload_json)");
    const response = JSON.parse(String(raw)) as
      | { outcome: "exact" | "numeric"; result: ComputeResult }
      | { outcome: "invalid"; error: string };
    if (response.outcome === "invalid") throw new Error(response.error);
    if (response.outcome === "exact") {
      post({ type: "result", id, result: response.result });
      return;
    }

    post({ type: "status", id, status: "loading-numerics" });
    if (!scipyLoaded) {
      await pyodide.loadPackage("scipy");
      scipyLoaded = true;
    }
    const numericRaw = await pyodide.runPythonAsync("compute_numeric_integral(payload_json)");
    post({ type: "result", id, result: JSON.parse(String(numericRaw)) as ComputeResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ type: "error", id, error: message.slice(0, 500) });
  }
};

export {};
