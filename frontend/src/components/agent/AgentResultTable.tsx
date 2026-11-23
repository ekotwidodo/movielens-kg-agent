import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Table as TableIcon, Share2, Code2, Copy, Check, ExternalLink } from "lucide-react";
import { AgentQueryResponse } from "../../api/client";
import { AgentGraphView } from "../AgentGraphView";

interface AgentResultTableProps {
  result: AgentQueryResponse;
  formatSparql: (sparql: string) => string;
}

/**
 * Tabbed panel presenting the agent's structured results, knowledge graph topology, and SPARQL query.
 */
export const AgentResultTable: React.FC<AgentResultTableProps> = ({ result, formatSparql }) => {
  const [activeTab, setActiveTab] = useState<"table" | "graph" | "sparql">("table");
  const [copied, setCopied] = useState(false);

  const copySparql = () => {
    if (!result.generated_sparql) return;
    navigator.clipboard.writeText(formatSparql(result.generated_sparql));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns = result.results?.length ? Object.keys(result.results[0]) : [];

  return (
    <div className="neo-box overflow-hidden">
      {/* Tab Navigation */}
      <div className="px-4 py-3 bg-[#FAF8F5] border-b-2 border-black flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-2 border-black ${
              activeTab === "table"
                ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                : "bg-white text-black hover:bg-slate-100 shadow-[1px_1px_0px_0px_#000]"
            }`}
          >
            <TableIcon className="w-4 h-4 stroke-[2.5]" />
            <span>Structured Results</span>
            <span className="px-1.5 py-0.2 border border-black bg-white text-black font-mono text-xs font-bold">
              {result.result_count}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-2 border-black ${
              activeTab === "graph"
                ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                : "bg-white text-black hover:bg-slate-100 shadow-[1px_1px_0px_0px_#000]"
            }`}
          >
            <Share2 className="w-4 h-4 stroke-[2.5]" />
            <span>Graph View</span>
            {result.results?.length > 0 && (
              <span className="px-1.5 py-0.2 border border-black bg-white text-black font-mono text-xs font-bold">
                Interactive
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sparql")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-2 border-black ${
              activeTab === "sparql"
                ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                : "bg-white text-black hover:bg-slate-100 shadow-[1px_1px_0px_0px_#000]"
            }`}
          >
            <Code2 className="w-4 h-4 stroke-[2.5]" />
            <span>SPARQL Query</span>
          </button>
        </div>

        {/* Action Buttons for SPARQL Tab */}
        {activeTab === "sparql" && result.generated_sparql && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copySparql}
              className="neo-btn-white py-1 px-3 text-xs uppercase tracking-wider"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-green-700" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <Link
              to={`/sparql?query=${encodeURIComponent(formatSparql(result.generated_sparql))}`}
              className="neo-btn-lime py-1 px-3 text-xs uppercase tracking-wider flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Open in Console</span>
            </Link>
          </div>
        )}
      </div>

      {/* Tab 1: Table Content */}
      {activeTab === "table" && (
        <div>
          {result.results?.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b-2 border-black text-black uppercase text-xs font-black tracking-wider">
                    <th className="py-3 px-4 border-r-2 border-black">#</th>
                    {columns.map((col) => (
                      <th key={col} className="py-3 px-4 border-r-2 border-black last:border-r-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-semibold text-black">
                  {result.results.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-4 text-black/60 font-mono text-xs border-r-2 border-black">
                        {rowIdx + 1}
                      </td>
                      {columns.map((col) => {
                        const val = row[col];
                        const strVal = String(val ?? "");
                        const isUri =
                          strVal.startsWith("http://") || strVal.startsWith("https://");
                        return (
                          <td key={col} className="py-3 px-4 border-r-2 border-black last:border-r-0">
                            {isUri ? (
                              <span className="font-mono text-xs text-black bg-white px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] break-all">
                                {strVal}
                              </span>
                            ) : (
                              <span>{strVal}</span>
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
              No individual structured rows returned for this query.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Interactive Graph View */}
      {activeTab === "graph" && (
        <AgentGraphView results={result.results} active={activeTab === "graph"} />
      )}

      {/* Tab 3: SPARQL Query */}
      {activeTab === "sparql" && (
        <div className="bg-black p-5 overflow-x-auto text-xs font-mono text-[#ccff00] font-bold leading-relaxed whitespace-pre selection:bg-[#ccff00] selection:text-black">
          <code>{formatSparql(result.generated_sparql || "")}</code>
        </div>
      )}
    </div>
  );
};
