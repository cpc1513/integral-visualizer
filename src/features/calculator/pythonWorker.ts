/// <reference lib="webworker" />

import { loadPyodide, type PyodideAPI } from "pyodide";
import type { ComputePayload } from "./computePayload";
import type { ComputeResult, ComputeStatus } from "./types";

declare const self: DedicatedWorkerGlobalScope;

const PYODIDE_VERSION = "314.0.2";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PYTHON_SETUP = String.raw`
import json
import time
from sympy import (
    Abs, E, Integral, Matrix, Symbol, acos, asin, atan, cos, cosh, cot, exp,
    latex, log, nan, oo, pi, sin, sinh, sqrt, tan, zoo, integrate, lambdify, N
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

def parse_math(value):
    if value is None or str(value).strip() == "":
        return 0
    return parse_expr(str(value), local_dict=LOCALS, transformations=TRANSFORMS, evaluate=False)

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
        tangent = coordinates.diff(parameter)
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
    unresolved = bool(result.atoms(Integral)) or result.has(nan, zoo, oo, -oo)
    if bounds and result.free_symbols:
        unresolved = True
    steps = [
        {"label": step_label, "latex": latex(expr)},
        {"label": "依次代入积分限", "latex": latex(result)},
    ]
    numeric_value = "—" if not bounds else str(N(result, 12))
    return json.dumps({
        "needsNumeric": unresolved,
        "result": {
            "status": "exact",
            "exactLatex": latex(result),
            "numericValue": numeric_value,
            "steps": steps,
            "elapsedMs": round((time.perf_counter() - started) * 1000),
        },
    }, ensure_ascii=False)

def compute_numeric_integral(payload_json):
    from scipy.integrate import nquad

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

    value, error = nquad(function, ranges, opts={"epsabs": 1e-8, "epsrel": 1e-8, "limit": 80})
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
`;

type WorkerRequest = { type: "compute"; id: number; payload: ComputePayload };
type WorkerResponse =
  | { type: "status"; id: number; status: ComputeStatus }
  | { type: "result"; id: number; result: ComputeResult }
  | { type: "error"; id: number; error: string };

let pyodidePromise: Promise<PyodideAPI> | null = null;
let scipyLoaded = false;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

async function ensurePyodide(id: number) {
  if (!pyodidePromise) {
    post({ type: "status", id, status: "loading-python" });
    pyodidePromise = loadPyodide({ indexURL: PYODIDE_INDEX_URL }).then(async (pyodide) => {
      post({ type: "status", id, status: "loading-symbolics" });
      await pyodide.loadPackage("sympy");
      await pyodide.runPythonAsync(PYTHON_SETUP);
      return pyodide;
    });
  }
  return pyodidePromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "compute") return;
  const { id, payload } = event.data;
  try {
    const pyodide = await ensurePyodide(id);
    post({ type: "status", id, status: "computing" });
    const payloadJson = JSON.stringify(payload);
    pyodide.globals.set("payload_json", payloadJson);
    const raw = await pyodide.runPythonAsync("compute_integral(payload_json)");
    const response = JSON.parse(String(raw)) as { needsNumeric: boolean; result: ComputeResult };
    if (!response.needsNumeric) {
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
