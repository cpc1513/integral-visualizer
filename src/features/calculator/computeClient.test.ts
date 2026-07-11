import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntegralExample } from "./examples";

class FakeWorker {
  static current: FakeWorker | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  lastMessage: { id: number } | null = null;

  constructor() {
    FakeWorker.current = this;
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
});
