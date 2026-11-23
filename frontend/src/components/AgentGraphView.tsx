import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { getCytoscapeStyles } from "./graph/graphStyles";
import { GraphInspectorDrawer, SelectedNodeInfo } from "./graph/GraphInspectorDrawer";

interface AgentGraphViewProps {
  results: Array<Record<string, unknown>>;
  active: boolean;
}

/**
 * Interactive Cytoscape.js topology view for MovieLens KG agent query results.
 */
export const AgentGraphView: React.FC<AgentGraphViewProps> = ({ results, active }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const initGraph = () => {
    if (!containerRef.current || !results || results.length === 0) return;

    const elementsMap = new Map<string, cytoscape.ElementDefinition>();
    const nodePropsMap = new Map<string, Array<{ key: string; value: string }>>();
    const nodeMetaMap = new Map<string, { uri?: string; movieId?: string; type: string }>();

    // Limit to top 25 rows for smooth visualization
    const displayRows = results.slice(0, 25);

    displayRows.forEach((row, rowIdx) => {
      const keys = Object.keys(row);
      const titleKey = keys.find((k) => k.toLowerCase() === "title");
      const movieUriKey = keys.find(
        (k) =>
          (typeof row[k] === "string" && (row[k] as string).includes("/movie/")) ||
          k.toLowerCase() === "movie" ||
          k.toLowerCase() === "movieuri"
      );
      const movieIdKey = keys.find((k) => k.toLowerCase() === "movieid");
      const userKey = keys.find(
        (k) =>
          (typeof row[k] === "string" && (row[k] as string).includes("/user/")) ||
          k.toLowerCase() === "user" ||
          k.toLowerCase() === "userid"
      );
      const genreKey = keys.find(
        (k) =>
          (typeof row[k] === "string" && (row[k] as string).includes("/genre/")) ||
          k.toLowerCase() === "genre" ||
          k.toLowerCase() === "genrelabel"
      );

      let subjectId = "";
      let subjectLabel = "";
      let subjectType = "Entity";
      let subjectColor = "#0D9488";
      let subjectSize = 44;
      let subjectUri = "";
      let subjectMovieId = "";

      if (titleKey && row[titleKey]) {
        subjectType = "Movie";
        subjectLabel = String(row[titleKey]);
        subjectId = movieUriKey && row[movieUriKey] ? String(row[movieUriKey]) : `movie_${subjectLabel}`;
        subjectColor = "#0D9488";
        subjectSize = 46;
        if (movieUriKey) subjectUri = String(row[movieUriKey]);
        if (movieIdKey) subjectMovieId = String(row[movieIdKey]);
        else if (subjectUri.includes("/movie/")) subjectMovieId = subjectUri.split("/movie/").pop() || "";
      } else if (movieUriKey && row[movieUriKey]) {
        subjectType = "Movie";
        subjectUri = String(row[movieUriKey]);
        subjectId = subjectUri;
        subjectLabel = subjectUri.split("/").pop() || `Movie ${rowIdx + 1}`;
        subjectColor = "#0D9488";
        subjectSize = 46;
        if (subjectUri.includes("/movie/")) subjectMovieId = subjectUri.split("/movie/").pop() || "";
      } else if (userKey && row[userKey]) {
        subjectType = "User";
        const userVal = String(row[userKey]);
        subjectUri = userVal.startsWith("http") ? userVal : "";
        subjectId = userVal.startsWith("http") ? userVal : `user_${userVal}`;
        subjectLabel = userVal.startsWith("http") ? `User ${userVal.split("/").pop()}` : `User ${userVal}`;
        subjectColor = "#06B6D4";
        subjectSize = 40;
      } else if (genreKey && row[genreKey] && !keys.includes("title")) {
        subjectType = "Genre";
        const genreVal = String(row[genreKey]);
        subjectUri = genreVal.startsWith("http") ? genreVal : "";
        subjectId = `genre_${genreVal.split("/").pop() || genreVal}`;
        subjectLabel = genreVal.split("/").pop() || genreVal;
        subjectColor = "#10B981";
        subjectSize = 42;
      } else {
        const firstKey = keys[0] || "item";
        const firstVal = String(row[firstKey] ?? `Item ${rowIdx + 1}`);
        subjectType = "Entity";
        subjectId = firstVal.startsWith("http") ? firstVal : `ent_${rowIdx}_${firstVal}`;
        subjectLabel = firstVal.startsWith("http") ? firstVal.split("/").pop() || firstVal : firstVal;
        subjectColor = "#6366F1";
        subjectSize = 38;
      }

      if (!elementsMap.has(subjectId)) {
        elementsMap.set(subjectId, {
          data: {
            id: subjectId,
            label: subjectLabel,
            type: subjectType,
            color: subjectColor,
            size: subjectSize,
            uri: subjectUri,
            movieId: subjectMovieId,
          },
        });
        nodeMetaMap.set(subjectId, { uri: subjectUri, movieId: subjectMovieId, type: subjectType });
      }

      if (!nodePropsMap.has(subjectId)) {
        nodePropsMap.set(subjectId, []);
      }
      const subjectProps = nodePropsMap.get(subjectId)!;

      keys.forEach((col) => {
        const val = row[col];
        if (val === undefined || val === null || val === "") return;
        const strVal = String(val);

        if (
          col === titleKey ||
          col === movieUriKey ||
          col === movieIdKey ||
          (col === userKey && subjectType === "User") ||
          (col === genreKey && subjectType === "Genre")
        ) {
          subjectProps.push({ key: col, value: strVal });
          return;
        }

        subjectProps.push({ key: col, value: strVal });

        if (strVal.includes("|") || col.toLowerCase().includes("genre")) {
          const items = strVal.includes("|") ? strVal.split("|") : [strVal];
          items.forEach((item) => {
            const clean = item.trim();
            if (!clean) return;
            const genreNodeId = `genre_${clean.toLowerCase()}`;
            if (!elementsMap.has(genreNodeId)) {
              elementsMap.set(genreNodeId, {
                data: {
                  id: genreNodeId,
                  label: clean,
                  type: "Genre",
                  color: "#10B981",
                  size: 32,
                },
              });
              nodeMetaMap.set(genreNodeId, { type: "Genre" });
            }
            const edgeId = `edge_${subjectId}_hasGenre_${genreNodeId}`;
            if (!elementsMap.has(edgeId)) {
              elementsMap.set(edgeId, {
                data: { id: edgeId, source: subjectId, target: genreNodeId, label: "hasGenre" },
              });
            }
          });
        } else if (
          col.toLowerCase().includes("rating") ||
          col.toLowerCase().includes("count") ||
          col.toLowerCase().includes("avg") ||
          col.toLowerCase().includes("year")
        ) {
          const propNodeId = `prop_${col}_${rowIdx}`;
          if (!elementsMap.has(propNodeId)) {
            elementsMap.set(propNodeId, {
              data: {
                id: propNodeId,
                label: strVal,
                type: "Metric",
                color: "#F59E0B",
                size: 26,
              },
            });
            nodeMetaMap.set(propNodeId, { type: "Metric" });
          }
          const edgeId = `edge_${subjectId}_${col}_${propNodeId}`;
          if (!elementsMap.has(edgeId)) {
            elementsMap.set(edgeId, {
              data: { id: edgeId, source: subjectId, target: propNodeId, label: col },
            });
          }
        }
      });
    });

    const elements = Array.from(elementsMap.values());
    const nodes = elements.filter((el) => !("source" in el.data));
    const edges = elements.filter((el) => "source" in el.data);
    setNodeCount(nodes.length);
    setEdgeCount(edges.length);

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: getCytoscapeStyles(),
      layout: {
        name: "cose",
        animate: false,
        padding: 35,
        nodeRepulsion: () => 6000,
        idealEdgeLength: () => 70,
      },
    });

    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const data = node.data();
      const meta = nodeMetaMap.get(data.id);
      const props = nodePropsMap.get(data.id) || [];

      setSelectedNode({
        id: data.id,
        label: data.label,
        type: data.type || meta?.type || "Entity",
        color: data.color || "#0D9488",
        uri: meta?.uri,
        movieId: meta?.movieId,
        properties: props,
      });
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;
  };

  useEffect(() => {
    if (active && results && results.length > 0) {
      const timer = setTimeout(() => {
        if (cyRef.current) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 30);
        } else {
          initGraph();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [active, results]);

  const handleZoomIn = () => {
    if (!cyRef.current) return;
    cyRef.current.zoom(cyRef.current.zoom() * 1.3);
    cyRef.current.center();
  };

  const handleZoomOut = () => {
    if (!cyRef.current) return;
    cyRef.current.zoom(cyRef.current.zoom() * 0.77);
    cyRef.current.center();
  };

  const handleFit = () => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 30);
  };

  const handleResetLayout = () => {
    if (!cyRef.current) return;
    cyRef.current
      .layout({
        name: "cose",
        animate: true,
        animationDuration: 500,
        padding: 35,
      })
      .run();
  };

  if (!results || results.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        No graph elements to display for this query result.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[460px] bg-slate-50/70 overflow-hidden flex flex-col">
      {/* Control Buttons */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white px-3 py-2 border-2 border-black shadow-[2px_2px_0px_0px_#000] text-xs">
        <span className="text-xs text-black font-mono font-bold mr-1">
          {nodeCount} nodes · {edgeCount} edges
        </span>
        <div className="h-4 w-[2px] bg-black mx-1" />
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1 border border-black hover:bg-[#ccff00] text-black cursor-pointer transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1 border border-black hover:bg-[#ccff00] text-black cursor-pointer transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleFit}
          title="Fit to Screen"
          className="p-1 border border-black hover:bg-[#ccff00] text-black cursor-pointer transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={handleResetLayout}
          title="Reset Layout"
          className="p-1 border border-black hover:bg-[#ccff00] text-black cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Cytoscape Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 bg-white px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_#000] text-xs font-black uppercase text-black">
        <span className="mr-1">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-black bg-[#0D9488] shadow-[1px_1px_0px_0px_#000]" />
          <span>Movie</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-black bg-[#10B981] shadow-[1px_1px_0px_0px_#000]" />
          <span>Genre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-black bg-[#06B6D4] shadow-[1px_1px_0px_0px_#000]" />
          <span>User</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 border border-black bg-[#F59E0B] shadow-[1px_1px_0px_0px_#000]" />
          <span>Metric</span>
        </div>
      </div>

      {/* Floating Selected Node Drawer */}
      <GraphInspectorDrawer selectedNode={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
};
