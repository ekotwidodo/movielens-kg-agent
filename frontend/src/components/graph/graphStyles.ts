import cytoscape from "cytoscape";

/**
 * Cytoscape stylesheet configuration for Knowledge Graph visualization.
 */
export const getCytoscapeStyles = (): cytoscape.StylesheetStyle[] => [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "font-size": "11px",
      "font-weight": 600,
      "text-valign": "bottom",
      "text-margin-y": 6,
      color: "#334155",
      "background-color": "data(color)",
      width: "data(size)",
      height: "data(size)",
      "border-width": 2,
      "border-color": "#ffffff",
      "text-wrap": "ellipsis",
      "text-max-width": "110px",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#0D9488",
      "border-opacity": 0.9,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#CBD5E1",
      "target-arrow-color": "#94A3B8",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 0.8,
      label: "data(label)",
      "font-size": "9px",
      color: "#64748B",
      "text-rotation": "autorotate",
      "text-margin-y": -6,
      "text-background-opacity": 0.8,
      "text-background-color": "#F8FAFC",
      "text-background-padding": "2px",
    },
  },
  {
    selector: "edge:selected",
    style: {
      width: 2.5,
      "line-color": "#0D9488",
      "target-arrow-color": "#0D9488",
    },
  },
];
