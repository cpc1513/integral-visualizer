import Plotly from "plotly.js/lib/core";
import contour from "plotly.js/lib/contour";
import isosurface from "plotly.js/lib/isosurface";
import scatter from "plotly.js/lib/scatter";
import scatter3d from "plotly.js/lib/scatter3d";
import surface from "plotly.js/lib/surface";

Plotly.register([scatter, contour, scatter3d, surface, isosurface]);

export default Plotly;
