import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createComputePayload } from "./computePayload";
import { getIntegralExample } from "./examples";

const pyodideMocks = vi.hoisted(() => ({
  loadPyodide: vi.fn(),
}));

vi.mock("pyodide", () => ({
  loadPyodide: pyodideMocks.loadPyodide,
}));

interface WorkerScope {
  onmessage?: (event: MessageEvent) => Promise<void> | void;
  postMessage: ReturnType<typeof vi.fn>;
}

function makeRuntime(symbolicResponse: unknown) {
  return {
    globals: { set: vi.fn() },
    loadPackage: vi.fn(async () => undefined),
    runPythonAsync: vi.fn(async (command: string) => {
      if (command === "compute_integral(payload_json)") return JSON.stringify(symbolicResponse);
      return undefined;
    }),
  };
}

async function loadWorkerModule() {
  const scope: WorkerScope = { postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
  await import("./pythonWorker");
  if (!scope.onmessage) throw new Error("worker message handler was not registered");
  return scope;
}

function request(id: number) {
  return {
    data: {
      type: "compute",
      id,
      payload: createComputePayload(getIntegralExample("ordinary")),
      method: "exact",
    },
  } as MessageEvent;
}

describe("Python worker result safety", () => {
  beforeEach(() => {
    vi.resetModules();
    pyodideMocks.loadPyodide.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not route divergent or non-real symbolic outcomes to SciPy", async () => {
    const runtime = makeRuntime({
      outcome: "invalid",
      error: "积分发散或未定义，不能转为数值积分。",
    });
    pyodideMocks.loadPyodide.mockResolvedValue(runtime);
    const scope = await loadWorkerModule();

    await scope.onmessage!(request(1));

    expect(runtime.loadPackage).toHaveBeenCalledWith("sympy");
    expect(runtime.loadPackage).not.toHaveBeenCalledWith("scipy");
    expect(runtime.runPythonAsync).not.toHaveBeenCalledWith("compute_numeric_integral(payload_json)");
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: "error",
      id: 1,
      error: "积分发散或未定义，不能转为数值积分。",
    });
  });

  it("clears a rejected Pyodide initialization so a later request can retry", async () => {
    const result = {
      status: "exact",
      exactLatex: "1",
      numericValue: "1",
      steps: [],
      elapsedMs: 1,
    };
    const runtime = makeRuntime({ outcome: "exact", result });
    pyodideMocks.loadPyodide
      .mockRejectedValueOnce(new Error("temporary CDN failure"))
      .mockRejectedValueOnce(new Error("temporary backup CDN failure"))
      .mockResolvedValueOnce(runtime);
    const scope = await loadWorkerModule();

    await scope.onmessage!(request(1));
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: "error",
      id: 1,
      error: "temporary backup CDN failure",
      fatal: true,
    });

    await scope.onmessage!(request(2));
    expect(pyodideMocks.loadPyodide).toHaveBeenCalledTimes(3);
    expect(scope.postMessage).toHaveBeenCalledWith({ type: "result", id: 2, result });
  });
});
