declare module "plotly.js/lib/core" {
  import type * as Plotly from "plotly.js";
  const core: typeof Plotly;
  export default core;
}

declare module "plotly.js/lib/contour" {
  import type { PlotlyModule } from "plotly.js";
  const trace: PlotlyModule;
  export default trace;
}

declare module "plotly.js/lib/isosurface" {
  import type { PlotlyModule } from "plotly.js";
  const trace: PlotlyModule;
  export default trace;
}

declare module "plotly.js/lib/scatter" {
  import type { PlotlyModule } from "plotly.js";
  const trace: PlotlyModule;
  export default trace;
}

declare module "plotly.js/lib/scatter3d" {
  import type { PlotlyModule } from "plotly.js";
  const trace: PlotlyModule;
  export default trace;
}

declare module "plotly.js/lib/surface" {
  import type { PlotlyModule } from "plotly.js";
  const trace: PlotlyModule;
  export default trace;
}
