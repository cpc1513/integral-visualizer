import { MousePointer2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Data } from "plotly.js";
import type { IntegralSpec } from "../calculator/types";
import { buildPlotSpec } from "./plotSpec";

interface VisualizationCanvasProps {
  spec: IntegralSpec;
}

export function VisualizationCanvas({ spec }: VisualizationCanvasProps) {
  const plotHostRef = useRef<HTMLDivElement>(null);
  const plotlyRef = useRef<typeof import("plotly.js-dist-min") | null>(null);
  const dimensionRef = useRef<"2d" | "3d">("3d");
  const [state, setState] = useState<"empty" | "loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("正在建立积分区域模型。");

  useEffect(() => {
    let cancelled = false;
    const host = plotHostRef.current;
    if (!host) return;
    const isEmptyConstraintRegion =
      "regionMode" in spec
      && spec.regionMode === "constraints"
      && (!spec.constraintRegion || spec.constraintRegion.constraints.every((constraint) => !constraint.trim()));
    if (isEmptyConstraintRegion) {
      plotlyRef.current?.purge(host);
      setSummary("添加条件后将在这里显示积分区域。");
      setError("");
      setState("empty");
      return;
    }
    setState("loading");
    setError("");
    plotlyRef.current?.purge(host);

    Promise.all([import("plotly.js-dist-min"), buildPlotSpec(spec)])
      .then(async ([plotlyModule, plotSpec]) => {
        if (cancelled) return;
        const Plotly = plotlyModule.default ?? plotlyModule;
        plotlyRef.current = Plotly;
        dimensionRef.current = plotSpec.dimension;
        setSummary(plotSpec.summary);
        await Plotly.react(host, plotSpec.data as Data[], plotSpec.layout, plotSpec.config);
        if (!cancelled) setState("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [spec]);

  useEffect(() => {
    const host = plotHostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      const Plotly = plotlyRef.current;
      if (!Plotly || !host.isConnected || !host.classList.contains("js-plotly-plot")) return;
      try {
        void Promise.resolve(Plotly.Plots.resize(host)).catch(() => undefined);
      } catch {
        // Plotly may be purged between a ResizeObserver notification and this callback.
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (plotHostRef.current && plotlyRef.current) plotlyRef.current.purge(plotHostRef.current);
    },
    [],
  );

  const resetView = () => {
    const host = plotHostRef.current;
    const Plotly = plotlyRef.current;
    if (!host || !Plotly) return;
    if (dimensionRef.current === "3d") {
      void Plotly.relayout(
        host,
        { "scene.camera": { eye: { x: 1.55, y: 1.55, z: 1.15 } } } as never,
      );
    } else {
      void Plotly.relayout(host, { "xaxis.autorange": true, "yaxis.autorange": true });
    }
  };

  return (
    <section className="visualization-panel" aria-labelledby="visualization-title">
      <div className="visualization-header">
        <h1 id="visualization-title">积分区域</h1>
        <button type="button" className="secondary-button" onClick={resetView} disabled={state !== "ready"}>
          <RefreshCw aria-hidden="true" size={16} />
          重置视角
        </button>
      </div>
      <div className="plot-stage" data-state={state}>
        <div ref={plotHostRef} className="plot-host" aria-label={summary} />
        {state === "empty" ? (
          <div className="plot-status">添加条件后，将在这里显示积分区域</div>
        ) : null}
        {state === "loading" ? <div className="plot-status">正在生成区域…</div> : null}
        {state === "error" ? (
          <div className="plot-error" role="alert">
            <strong>暂时无法绘制这个区域</strong>
            <span>{error}</span>
          </div>
        ) : null}
        {state === "ready" && dimensionRef.current === "3d" ? (
          <div className="rotate-hint" aria-hidden="true">
            <MousePointer2 size={19} />
            按住并拖动以旋转视图
          </div>
        ) : null}
      </div>
      <p className="sr-only">{summary}</p>
    </section>
  );
}
