import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import cytoscape from "cytoscape";
import { executeSparql } from "../api/client";
import { PREFIXES, genreUri, movieUri, userUri } from "../api/vocabulary";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  X,
  Loader2
} from "lucide-react";

interface NodeDetail {
  id: string;
  label: string;
  type: string;
  uri: string;
  properties: Array<{ p: string; o: string }>;
}

const PRESET_SEEDS = [
  { label: "Toy Story (Movie)", uri: movieUri("1") },
  { label: "The Matrix (Movie)", uri: movieUri("2571") },
  { label: "Sci-Fi (Genre)", uri: genreUri("sci-fi") },
  { label: "Action (Genre)", uri: genreUri("action") },
  { label: "User 1 (Pseudonym)", uri: userUri("1") },
];

export const GraphExplorer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialUri = searchParams.get("startUri") || PRESET_SEEDS[0].uri;

  const [currentUri, setCurrentUri] = useState(initialUri);
  const [nodeBudget, setNodeBudget] = useState(35);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const loadNeighborhood = async (centerUri: string, budget: number) => {
    setLoading(true);
    setSelectedNode(null);

    const query = `
      ${PREFIXES}

      SELECT DISTINCT ?s ?p ?o ?sLabel ?oLabel ?sType ?oType
      WHERE {
        {
          BIND(<${centerUri}> AS ?s)
          ?s ?p ?o .
          OPTIONAL { ?s rdfs:label ?sLabel }
          OPTIONAL { ?s ml:title ?sLabel }
          OPTIONAL { ?s ml:genreLabel ?sLabel }
          OPTIONAL { ?o rdfs:label ?oLabel }
          OPTIONAL { ?o ml:title ?oLabel }
          OPTIONAL { ?o ml:genreLabel ?oLabel }
          OPTIONAL { ?s a ?sType }
          OPTIONAL { ?o a ?oType }
        }
        UNION
        {
          BIND(<${centerUri}> AS ?o)
          ?s ?p ?o .
          OPTIONAL { ?s rdfs:label ?sLabel }
          OPTIONAL { ?s ml:title ?sLabel }
          OPTIONAL { ?s ml:genreLabel ?sLabel }
          OPTIONAL { ?o rdfs:label ?oLabel }
          OPTIONAL { ?o ml:title ?oLabel }
          OPTIONAL { ?o ml:genreLabel ?oLabel }
          OPTIONAL { ?s a ?sType }
          OPTIONAL { ?o a ?oType }
        }
      }
      LIMIT ${budget}
    `;

    try {
      const res = await executeSparql(query);
      renderCytoscape(centerUri, res.results.bindings);
    } catch (err) {
      console.error("Neighborhood query error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getNodeColor = (uri: string) => {
    if (uri.includes("/movie/")) return "#0D9488"; // Teal
    if (uri.includes("/genre/")) return "#10B981"; // Emerald
    if (uri.includes("/user/")) return "#06B6D4";  // Cyan
    if (uri.includes("/rating/")) return "#F59E0B"; // Amber
    if (uri.includes("/tag/")) return "#14B8A6";   // Mint
    return "#64748B"; // Slate
  };

  const getEntityTypeName = (uri: string) => {
    if (uri.includes("/movie/")) return "Movie";
    if (uri.includes("/genre/")) return "Genre";
    if (uri.includes("/user/")) return "User (Pseudonym)";
    if (uri.includes("/rating/")) return "Rating Event";
    if (uri.includes("/tag/")) return "Tag Assignment";
    return "Entity";
  };

  const renderCytoscape = (
    center: string,
    bindings: Array<Record<string, { value: string }>>
  ) => {
    if (!containerRef.current) return;

    const elementsMap = new Map<string, cytoscape.ElementDefinition>();

    // Resolve a human-readable label for the center node from the result rows,
    // so a movie shows its title instead of its numeric identifier.
    const centerLabel =
      bindings.find((b) => b.s?.value === center && b.sLabel?.value)?.sLabel?.value ||
      bindings.find((b) => b.o?.value === center && b.oLabel?.value)?.oLabel?.value;

    // Add Center Node
    elementsMap.set(center, {
      data: {
        id: center,
        label: centerLabel || center.split("/").pop() || "Center",
        uri: center,
        type: getEntityTypeName(center),
        color: getNodeColor(center),
        size: 50,
      },
    });

    bindings.forEach((b, idx) => {
      const sUri = b.s?.value;
      const pUri = b.p?.value;
      const oVal = b.o?.value;

      if (!sUri || !pUri || !oVal) return;
      if (pUri.endsWith("#type")) return;

      if (!elementsMap.has(sUri)) {
        elementsMap.set(sUri, {
          data: {
            id: sUri,
            label: b.sLabel?.value || sUri.split("/").pop() || sUri,
            uri: sUri,
            type: getEntityTypeName(sUri),
            color: getNodeColor(sUri),
            size: 38,
          },
        });
      }

      const isObjectUri = oVal.startsWith("http://") || oVal.startsWith("https://");
      const targetId = isObjectUri ? oVal : `literal_${idx}`;

      if (!elementsMap.has(targetId)) {
        elementsMap.set(targetId, {
          data: {
            id: targetId,
            label: b.oLabel?.value || (isObjectUri ? oVal.split("/").pop() || oVal : `"${oVal}"`),
            uri: isObjectUri ? oVal : "",
            type: isObjectUri ? getEntityTypeName(oVal) : "Literal",
            color: isObjectUri ? getNodeColor(oVal) : "#94A3B8",
            size: isObjectUri ? 34 : 26,
          },
        });
      }

      const edgeId = `edge_${idx}`;
      const predicateLabel = pUri.split(/[\/#]/).pop() || "rel";
      elementsMap.set(edgeId, {
        data: {
          id: edgeId,
          source: sUri,
          target: targetId,
          label: predicateLabel,
        },
      });
    });

    const elements = Array.from(elementsMap.values());

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            color: "#0f172a",
            "font-size": "10px",
            "font-weight": 500,
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: "data(size)",
            height: "data(size)",
            "border-width": 2,
            "border-color": "#ffffff",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#0d9488",
            "border-width": 3,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#cbd5e1",
            "target-arrow-color": "#0d9488",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "8px",
            color: "#64748b",
            "text-rotation": "autorotate",
            "text-margin-y": -4,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        padding: 40,
      },
    });

    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const data = node.data();
      setSelectedNode({
        id: data.id,
        label: data.label,
        type: data.type,
        uri: data.uri || data.id,
        properties: [],
      });
    });

    cyRef.current = cy;
  };

  useEffect(() => {
    loadNeighborhood(currentUri, nodeBudget);
  }, [currentUri, nodeBudget]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 font-black text-xs uppercase tracking-wider bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span>04 / INTERACTIVE TOPOLOGY EXPLORATION</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight leading-none">
            Graph Topology Explorer
          </h1>
          <p className="text-sm sm:text-base text-slate-800 font-medium">
            Visually navigate relationships between movies, genres, users, and tags.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-black">Seed Entity:</span>
          <select
            value={currentUri}
            onChange={(e) => setCurrentUri(e.target.value)}
            className="text-xs sm:text-sm font-bold bg-white border-2 border-black px-3 py-2 text-black outline-none shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            {PRESET_SEEDS.map((s) => (
              <option key={s.uri} value={s.uri}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Canvas & Controls Area */}
      <div className="relative neo-box overflow-hidden flex flex-col h-[640px]">
        {/* Top Control Bar */}
        <div className="px-5 py-3 border-b-2 border-black bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-black">Node Limit:</span>
              <select
                value={nodeBudget}
                onChange={(e) => setNodeBudget(parseInt(e.target.value, 10))}
                className="bg-white border-2 border-black px-2.5 py-1 text-xs font-bold text-black outline-none shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                <option value={20}>20 nodes</option>
                <option value={35}>35 nodes</option>
                <option value={50}>50 nodes</option>
              </select>
            </div>
            <span className="text-black font-black">|</span>
            <span className="font-mono font-bold text-black bg-[#FAF8F5] border border-black px-2 py-0.5 truncate max-w-xs text-xs" title={currentUri}>
              {currentUri}
            </span>
          </div>

          {/* Canvas Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
              className="p-1.5 border-2 border-black bg-white hover:bg-[#FAF8F5] text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
              className="p-1.5 border-2 border-black bg-white hover:bg-[#FAF8F5] text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => cyRef.current?.fit(undefined, 30)}
              className="p-1.5 border-2 border-black bg-white hover:bg-[#FAF8F5] text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
              title="Fit to Screen"
            >
              <Maximize2 className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => loadNeighborhood(currentUri, nodeBudget)}
              className="neo-btn-lime py-1.5 px-3 text-xs uppercase tracking-wider flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 w-full bg-[#FAF8F5] relative">
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="p-4 border-2 border-black bg-white text-black font-black uppercase text-xs flex items-center gap-2 shadow-[3px_3px_0px_0px_#000]">
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                <span>Loading subgraph...</span>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Node Inspector Drawer */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-80 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 z-20 space-y-3">
              <div className="flex items-start justify-between pb-2 border-b-2 border-black">
                <div>
                  <span className="text-xs uppercase font-black px-2 py-0.5 border border-black bg-[#ccff00] text-black inline-block mb-1">
                    {selectedNode.type}
                  </span>
                  <h4 className="text-base font-black text-black leading-snug">
                    {selectedNode.label}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 border border-black bg-white hover:bg-black hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-black uppercase text-xs text-black/70">Resource URI:</span>
                <p className="font-mono text-xs bg-[#FAF8F5] p-2 border-2 border-black text-black font-bold break-all shadow-[1px_1px_0px_0px_#000]">
                  {selectedNode.uri}
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUri(selectedNode.uri);
                  }}
                  className="neo-btn-lime w-full py-2 text-xs uppercase tracking-wider"
                >
                  Re-center on this Node
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend Footer */}
        <div className="px-5 py-3 bg-white border-t-2 border-black flex flex-wrap items-center gap-4 text-xs font-black text-black uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-black bg-teal-600 shadow-[1px_1px_0px_0px_#000]" />
            <span>Movie</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-black bg-emerald-500 shadow-[1px_1px_0px_0px_#000]" />
            <span>Genre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-black bg-cyan-500 shadow-[1px_1px_0px_0px_#000]" />
            <span>User</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-black bg-amber-500 shadow-[1px_1px_0px_0px_#000]" />
            <span>Rating</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-black bg-teal-400 shadow-[1px_1px_0px_0px_#000]" />
            <span>Tag</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 border border-black bg-slate-400 shadow-[1px_1px_0px_0px_#000]" />
            <span>Literal Value</span>
          </div>
        </div>
      </div>
    </div>
  );
};
