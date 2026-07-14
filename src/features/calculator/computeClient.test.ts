import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntegralExample } from "./examples";

class FakeWorker {
  static current: FakeWorker | null = null;
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  lastMessage: { id: number } | null = null;

  constructor() {
    FakeWorker.current = this;
    FakeWorker.instances.push(this);
  }

  postMessage(message: { id: number }) {
    this.lastMessage = message;
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("Python compute lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    FakeWorker.current = null;
    FakeWorker.instances = [];
  });

  it("does not terminate a symbolic calculation after 20 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const client = await import("./computeClient");
    const promise = client.computeIntegral(getIntegralExample("ordinary"), () => undefined);
    const worker = FakeWorker.current;
    expect(worker?.lastMessage).not.toBeNull();
    worker?.emit({ type: "status", id: worker.lastMessage!.id, status: "computing" });

    let settled = false;
    void promise.finally(() => {
      settled = true;
    }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(25_000);
    expect(settled).toBe(false);
    expect(worker?.terminated).toBe(false);

    client.cancelActiveComputation();
    await expect(promise).rejects.toBeInstanceOf(client.ComputationCancelledError);
    expect(worker?.terminated).toBe(true);
  });

  it("terminates and recreates the worker after the computation watchdog expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const client = await import("./computeClient");
    const promise = client.computeIntegral(getIntegralExample("ordinary"), () => undefined);
    const worker = FakeWorker.current!;
    worker.emit({ type: "status", id: worker.lastMessage!.id, status: "computing" });

    const rejection = expect(promise).rejects.toBeInstanceOf(client.ComputationTimeoutError);
    await vi.advanceTimersByTimeAsync(client.COMPUTATION_TIMEOUT_MS);
    await rejection;
    expect(worker.terminated).toBe(true);

    const retry = client.computeIntegral(getIntegralExample("ordinary"), () => undefined);
    expect(FakeWorker.current).not.toBe(worker);
    expect(FakeWorker.instances).toHaveLength(2);
    client.cancelActiveComputation();
    await expect(retry).rejects.toBeInstanceOf(client.ComputationCancelledError);
  });

  it("clears the computation watchdog after a successful result", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const client = await import("./computeClient");
    const promise = client.computeIntegral(getIntegralExample("ordinary"), () => undefined);
    const worker = FakeWorker.current!;
    const id = worker.lastMessage!.id;
    worker.emit({ type: "status", id, status: "computing" });
    worker.emit({
      type: "result",
      id,
      result: {
        status: "exact",
        exactLatex: "1",
        numericValue: "1",
        steps: [],
        elapsedMs: 1,
      },
    });

    await expect(promise).resolves.toMatchObject({ exactLatex: "1" });
    await vi.advanceTimersByTimeAsync(client.COMPUTATION_TIMEOUT_MS);
    expect(worker.terminated).toBe(false);
  });

  it("recreates the worker after a fatal Python runtime initialization error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const client = await import("./computeClient");
    const promise = client.computeIntegral(getIntegralExample("ordinary"), () => undefined);
    const worker = FakeWorker.current!;

    worker.emit({
      type: "error",
      id: worker.lastMessage!.id,
      error: "Pyodide CDN unavailable",
      fatal: true,
    });
    await expect(promise).rejects.toThrow("Pyodide CDN unavailable");
    expect(worker.terminated).toBe(true);

    const retry = client.computeIntegral(getIntegralExample("ordinary"), () => undefined);
    expect(FakeWorker.current).not.toBe(worker);
    client.cancelActiveComputation();
    await expect(retry).rejects.toBeInstanceOf(client.ComputationCancelledError);
  });
});
