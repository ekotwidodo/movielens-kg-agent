import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Film,
  Share2,
  Terminal,
  ShieldCheck,
  Database,
  BarChart3,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { fetchGraphStats } from "../api/client";

export const Overview: React.FC = () => {
  const [stats, setStats] = useState<{
    movieCount: number;
    ratingCount: number;
    tagCount: number;
    userCount: number;
  }>({
    movieCount: 0,
    ratingCount: 0,
    tagCount: 0,
    userCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGraphStats()
      .then((data) => {
        if (data) {
          setStats({
            movieCount: data.movieCount,
            ratingCount: data.ratingCount,
            tagCount: data.tagCount,
            userCount: data.userCount,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-12 pb-16">
      {/* Neo-Brutalist Hero Section */}
      <section className="bg-white border-b-2 border-black py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 font-black text-xs uppercase tracking-wider bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span>01 / SEMANTIC WEB & NATURAL LANGUAGE QUERYING</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight uppercase text-black leading-tight">
            MovieLens Knowledge Graph Agent
          </h1>

          <p className="text-sm sm:text-base text-slate-800 font-medium leading-relaxed max-w-2xl">
            A research application that translates natural-language questions into validated SPARQL queries and executes them against the MovieLens RDF Knowledge Graph with <strong>zero hallucinations</strong>.
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3.5 pt-2">
            <Link
              to="/agent"
              className="neo-btn-lime px-5 py-2.5 text-xs uppercase tracking-wider"
            >
              <Bot className="w-4 h-4 stroke-[2.5]" />
              <span>Ask AI Agent</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>

            <Link
              to="/explore"
              className="neo-btn-white px-5 py-2.5 text-xs uppercase tracking-wider"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Explore Graph</span>
            </Link>

            <Link
              to="/sparql"
              className="neo-btn-blue px-5 py-2.5 text-xs uppercase tracking-wider"
            >
              <Terminal className="w-4 h-4 stroke-[2.5]" />
              <span>SPARQL Console</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Neo-Brutalist Statistics Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <span className="text-xs font-black uppercase text-black/60 tracking-wider">TRIPLESTORE METRICS</span>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
            Knowledge Graph Entity Metadata
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="neo-box p-6">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black mb-3 shadow-[2px_2px_0px_0px_#000]">
              <Film className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-xs font-black uppercase text-slate-600 mb-1">Movies</div>
            <div className={`text-3xl font-black text-black font-mono ${loading ? "opacity-40 animate-pulse" : ""}`}>
              {stats.movieCount.toLocaleString()}
            </div>
            <p className="text-xs font-medium text-slate-600 mt-1">Titles & genre categories</p>
          </div>

          <div className="neo-box p-6">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black mb-3 shadow-[2px_2px_0px_0px_#000]">
              <BarChart3 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-xs font-black uppercase text-slate-600 mb-1">Ratings</div>
            <div className={`text-3xl font-black text-black font-mono ${loading ? "opacity-40 animate-pulse" : ""}`}>
              {stats.ratingCount.toLocaleString()}
            </div>
            <p className="text-xs font-medium text-slate-600 mt-1">Star ratings (0.5 to 5.0)</p>
          </div>

          <div className="neo-box p-6">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black mb-3 shadow-[2px_2px_0px_0px_#000]">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-xs font-black uppercase text-slate-600 mb-1">User Tags</div>
            <div className={`text-3xl font-black text-black font-mono ${loading ? "opacity-40 animate-pulse" : ""}`}>
              {stats.tagCount.toLocaleString()}
            </div>
            <p className="text-xs font-medium text-slate-600 mt-1">Community keywords</p>
          </div>

          <div className="neo-box p-6">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black mb-3 shadow-[2px_2px_0px_0px_#000]">
              <Users className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="text-xs font-black uppercase text-slate-600 mb-1">Anonymous Users</div>
            <div className={`text-3xl font-black text-black font-mono ${loading ? "opacity-40 animate-pulse" : ""}`}>
              {stats.userCount.toLocaleString()}
            </div>
            <p className="text-xs font-medium text-slate-600 mt-1">Dataset-local pseudonyms</p>
          </div>
        </div>
      </section>

      {/* Neo-Brutalist Feature Bento Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="space-y-0.5">
          <span className="text-xs font-black uppercase text-black/60 tracking-wider">CORE ARCHITECTURE</span>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
            Built for Precision & Zero Hallucinations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="neo-box p-6 space-y-3">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-black text-base uppercase tracking-tight">Grounded Querying (Zero Hallucinations)</h3>
            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              Every textual answer is constructed solely from SPARQL query results executed on the triplestore. When facts are absent from the graph, the agent states they are not found.
            </p>
          </div>

          <div className="neo-box p-6 space-y-3">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-black text-base uppercase tracking-tight">Apache Jena Fuseki TDB2</h3>
            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              W3C RDF 1.1 compliant triplestore persistently storing graph relationships between movies, users, ratings, and genres efficiently.
            </p>
          </div>

          <div className="neo-box p-6 space-y-3">
            <div className="w-10 h-10 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
              <Share2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-black text-base uppercase tracking-tight">Bounded Graph Exploration</h3>
            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              Cytoscape.js interactive graph visualizer with enforced hop and node limits to ensure the browser remains responsive and fast.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
