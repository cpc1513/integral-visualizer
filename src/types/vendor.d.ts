declare module "plotly.js-dist-min" {
  import type * as Plotly from "plotly.js";
  export = Plotly;
}

declare module "*.worker.ts" {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
