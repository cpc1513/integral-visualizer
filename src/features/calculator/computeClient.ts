import { createComputePayload } from "./computePayload";
import type { ComputeResult, ComputeStatus, IntegralSpec } from "./types";

type PendingRequest = {
  resolve: (value: ComputeResult) => void;
  reject: (reason: Error) => void;
  onStatus: (status: ComputeStatus) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type WorkerMessage =
  | { type: "status"; id: number; status: ComputeStatus }
  | { type: "result"; id: number; result: ComputeResult }
  | { type: "error"; id: number; error: string };

let worker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function resetWorker(reason?: Error) {
  worker?.terminate();
  worker = null;
  if (reason) {
    for (const request of pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(reason);
    }
    pendingRequests.clear();
  }
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./pythonWorker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    const pending = pendingRequests.get(message.id);
    if (!pending) return;
    if (message.type === "status") {
      pending.onStatus(message.status);
      if (message.status === "computing") {
        clearTimeout(pending.timeout);
        pending.timeout = setTimeout(() => {
          resetWorker(new Error("符号计算超过 20 秒，已安全停止。请简化表达式或改用更明确的边界。"));
        }, 20_000);
      }
      return;
    }
    clearTimeout(pending.timeout);
    pendingRequests.delete(message.id);
    if (message.type === "result") pending.resolve(message.result);
    else pending.reject(new Error(message.error || "Python 计算失败"));
  };
  worker.onerror = () => resetWorker(new Error("Python Worker 无法启动，请刷新页面后重试。"));
  return worker;
}

export function computeIntegral(
  spec: IntegralSpec,
  onStatus: (status: ComputeStatus) => void,
): Promise<ComputeResult> {
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resetWorker(new Error("Python 运行时加载超时，请检查网络后重试。"));
    }, 90_000);
    pendingRequests.set(id, { resolve, reject, onStatus, timeout });
    getWorker().postMessage({ type: "compute", id, payload: createComputePayload(spec) });
  });
}
