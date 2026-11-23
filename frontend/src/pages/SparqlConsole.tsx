import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { executeSparql, SparqlResult } from "../api/client";
import { PREFIXES } from "../api/vocabulary";
import {
  Play, Copy, Check, Download, AlertCircle, Clock, Table as TableIcon, Loader2, Share2
} from "lucide-react";
import { AgentGraphView } from "../components/AgentGraphView";

const EXAMPLE_QUERIES = [
  {
    title: "1. Top Rated Movies (Fast Materialized Aggregates)",
    sparql: `${PREFIXES}\nSELECT ?title ?avgRating ?ratingCount\nWHERE {\n  ?movie a ml:Movie ; ml:title ?title ; ml:averageRating ?avgRating ; ml:ratingCount ?ratingCount .\n  FILTER(?ratingCount >= 1000)\n}\nORDER BY DESC(?avgRating)\nLIMIT 10`,
  },
  {
    title: "2. Top 10 Animation Movies (Genre + Ratings)",
    sparql: `${PREFIXES}\nSELECT ?title ?avgRating ?ratingCount\nWHERE {\n  ?genre a ml:Genre ; ml:genreLabel "Animation" .\n  ?movie a ml:Movie ; ml:hasGenre ?genre ; ml:title ?title ; ml:averageRating ?avgRating ; ml:ratingCount ?ratingCount .\n  FILTER(?ratingCount >= 100)\n}\nORDER BY DESC(?avgRating)\nLIMIT 10`,
  },
  {
    title: "3. Genre Distribution across 87,000+ Movies",
    sparql: `${PREFIXES}\nSELECT ?genreLabel (COUNT(?movie) AS ?movieCount)\nWHERE {\n  ?genre a ml:Genre ; ml:genreLabel ?genreLabel .\n  ?movie ml:hasGenre ?genre .\n}\nGROUP BY ?genreLabel\nORDER BY DESC(?movieCount)`,
  },
  {
    title: "4. User Rating History (User 1 Activity & Ratings)",
    sparql: `${PREFIXES}\nSELECT ?movieId ?title ?value ?time\nWHERE {\n  ?user a ml:User ; ml:userId 1 ; ml:ratingEvent ?rating .\n  ?rating ml:ratedMovie ?movie ; ml:ratingValue ?value ; ml:ratingTimestamp ?time .\n  ?movie ml:movieId ?movieId ; ml:title ?title .\n}\nORDER BY DESC(?time)\nLIMIT 20`,
  },
  {
    title: "5. Rating Counts for Blockbuster Classics",
    sparql: `${PREFIXES}\nSELECT ?movieId ?title (COUNT(?rating) AS ?ratingCount)\nWHERE {\n  {\n    SELECT ?movie ?movieId ?title\n    WHERE {\n      VALUES ?title { "Matrix, The (1999)" "Star Wars: Episode IV - A New Hope (1977)" "Jurassic Park (1993)" }\n      ?movie a ml:Movie ; ml:movieId ?movieId ; ml:title ?title .\n    }\n  }\n  ?rating ml:ratedMovie ?movie .\n}\nGROUP BY ?movieId ?title\nORDER BY DESC(?ratingCount)`,
  },
];

export const SparqlConsole: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("query") || EXAMPLE_QUERIES[0].sparql;

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SparqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "graph">("table");
  const timerRef = useRef<number | null>(null);

  const mappedRows = React.useMemo(() => {
    if (!results?.results?.bindings) return [];
    return results.results.bindings.map((b) => {
      const row: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b)) {
        row[k] = v?.value;
      }
      return row;
    });
  }, [results]);

  useEffect(() => {
    const urlQuery = searchParams.get("query");
    if (urlQuery) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  // Live timer effect while query execution is active
  useEffect(() => {
    if (loading) {
      setElapsedMs(0);
      const start = performance.now();
      const interval = window.setInterval(() => {
        setElapsedMs(Math.round(performance.now() - start));
      }, 100);
      timerRef.current = interval;
      return () => clearInterval(interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [loading]);

  const handleRun = async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setExecTime(null);
    const start = performance.now();

    try {
      const data = await executeSparql(query.trim());
      const duration = Math.round(performance.now() - start);
      setResults(data);
      setExecTime(duration);
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - start);
      setExecTime(duration);
      setError(err instanceof Error ? err.message : "SPARQL query execution failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparql_result_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const vars = results?.head?.vars || [];
  const bindings = results?.results?.bindings || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 font-black text-xs uppercase tracking-wider bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span>05 / RDF QUERY INTERFACE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight leading-none mt-1">
          SPARQL Query Console
        </h1>
        <p className="text-xs sm:text-sm text-slate-800 font-medium">
          Execute read-only SELECT queries directly against Apache Jena Fuseki. SPARQL Update mutation requests are blocked.
        </p>
      </div>

      {/* Editor & Presets */}
      <div className="neo-box overflow-hidden flex flex-col">
        {/* Editor Toolbar */}
        <div className="px-4 py-3 bg-white border-b-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-black uppercase tracking-wider">Preset:</span>
            <select
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                if (EXAMPLE_QUERIES[idx]) {
                  setQuery(EXAMPLE_QUERIES[idx].sparql);
                }
              }}
              className="border-2 border-black bg-[#FAF8F5] text-black font-extrabold px-3 py-1.5 shadow-[2px_2px_0px_0px_#000] text-xs outline-none"
            >
              {EXAMPLE_QUERIES.map((eq, idx) => (
                <option key={idx} value={idx}>
                  {eq.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-black bg-[#ccff00] text-black font-mono font-bold text-xs shadow-[2px_2px_0px_0px_#000]">
                <Clock className="w-3.5 h-3.5 stroke-[2.5] animate-spin" />
                <span>Elapsed: {(elapsedMs / 1000).toFixed(1)}s</span>
              </div>
            )}
            <button
              type="button"
              onClick={copyQuery}
              className="neo-btn-white px-3 py-1.5 text-xs font-black uppercase tracking-wider"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading || !query.trim()}
              className="neo-btn-lime px-4 py-1.5 text-xs uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
                  <span>Running ({(elapsedMs / 1000).toFixed(1)}s)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black stroke-[2.5]" />
                  <span>Run Query</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="p-4 bg-slate-950 font-mono text-xs sm:text-sm text-[#ccff00]">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={10}
            className="w-full bg-transparent text-[#ccff00] outline-none resize-y font-mono leading-relaxed placeholder:text-slate-600 font-bold"
            placeholder="Type your SPARQL SELECT query here..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 border-2 border-black bg-red-100 text-red-950 font-medium text-xs space-y-1 shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-center gap-2 font-black uppercase text-red-800">
            <AlertCircle className="w-4 h-4 stroke-[2.5]" />
            <span>Query Execution Failed</span>
          </div>
          <p className="font-mono text-xs">{error}</p>
        </div>
      )}

      {/* Results View */}
      {results && (
        <div className="neo-box overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-black bg-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("table")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === "table"
                    ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                    : "text-black border-2 border-transparent hover:border-black"
                  }`}
              >
                <TableIcon className="w-4 h-4 stroke-[2.5]" />
                <span>Table View</span>
                <span className="neo-badge ml-1">{bindings.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("graph")}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === "graph"
                    ? "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]"
                    : "text-black border-2 border-transparent hover:border-black"
                  }`}
              >
                <Share2 className="w-4 h-4 stroke-[2.5]" />
                <span>Graph View</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {execTime !== null && (
                <div className="flex items-center gap-1.5 text-xs text-black border-2 border-black bg-white px-2.5 py-1 font-mono font-bold shadow-[2px_2px_0px_0px_#000]">
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>
                    {execTime >= 1000
                      ? `${(execTime / 1000).toFixed(2)}s`
                      : `${execTime} ms`}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={downloadJson}
                className="neo-btn-white px-3 py-1.5 text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Table View */}
          {activeTab === "table" && (
            <div>
              {bindings.length > 0 ? (
                <div className="overflow-x-auto max-h-[480px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF8F5] border-b-2 border-black text-black uppercase text-xs font-black">
                        <th className="py-2.5 px-3 border-r-2 border-black">#</th>
                        {vars.map((v) => (
                          <th key={v} className="py-2.5 px-3 border-r-2 border-black last:border-r-0">{v}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black font-semibold text-black">
                      {bindings.map((b, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF8F5]">
                          <td className="py-2 px-3 font-mono text-black/60 text-xs border-r-2 border-black">{idx + 1}</td>
                          {vars.map((v) => {
                            const cell = b[v];
                            if (!cell) {
                              return <td key={v} className="py-2 px-3 text-black/40 border-r-2 border-black last:border-r-0">-</td>;
                            }
                            const isUri = cell.type === "uri";
                            return (
                              <td key={v} className="py-2 px-3 border-r-2 border-black last:border-r-0">
                                {isUri ? (
                                  <span className="font-mono text-xs text-black break-all bg-white px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
                                    {cell.value}
                                  </span>
                                ) : (
                                  <span>{cell.value}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-black font-bold text-xs uppercase tracking-wider">
                  Query succeeded but returned 0 bindings.
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Graph View */}
          {activeTab === "graph" && (
            <AgentGraphView results={mappedRows} active={activeTab === "graph"} />
          )}
        </div>
      )}
    </div>
  );
};
