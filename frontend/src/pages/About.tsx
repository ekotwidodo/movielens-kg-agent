import React from "react";
import { Database, ShieldAlert, Layers, Terminal, Bot, ShieldCheck } from "lucide-react";
import { GRAPH_NAMESPACE } from "../api/vocabulary";

interface ArchitectureLayer {
  name: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}

const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  {
    name: "Frontend",
    path: "frontend/",
    description:
      "React 19 + TypeScript + Vite + Tailwind CSS, styled with a clean teal palette and responsive navigation.",
    icon: Layers,
    iconClass: "bg-teal-50 text-teal-700",
  },
  {
    name: "Backend API",
    path: "backend/",
    description:
      "FastAPI application handling request validation, SPARQL query generation, and LLM orchestration.",
    icon: Bot,
    iconClass: "bg-cyan-50 text-cyan-700",
  },
  {
    name: "Triplestore",
    path: "docker/fuseki",
    description:
      "Apache Jena Fuseki with persistent TDB2 storage holding the RDF knowledge graph.",
    icon: Database,
    iconClass: "bg-emerald-50 text-emerald-700",
  },
  {
    name: "Reverse Proxy",
    path: "docker/proxy",
    description:
      "Caddy proxy serving the frontend, routing API calls to FastAPI, and enforcing read-only access on /sparql (SELECT/CONSTRUCT/DESCRIBE/ASK only).",
    icon: ShieldCheck,
    iconClass: "bg-amber-50 text-amber-700",
  },
];


export const About: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 font-black text-xs uppercase tracking-wider bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span>06 / ATTRIBUTION & SPECIFICATION</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight leading-none">
          Documentation & Attribution
        </h1>
        <p className="text-sm sm:text-base text-slate-800 font-medium">
          Dataset provenance, official GroupLens citation, RDF ontology schema, and privacy guidelines.
        </p>
      </div>

      {/* Provenance Card */}
      <section className="neo-box p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black">
            <Database className="w-5 h-5 stroke-[2.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-black uppercase text-black tracking-tight">
            Dataset Provenance & Required Citation
          </h2>
        </div>
        <p className="text-sm text-slate-800 font-medium leading-relaxed">
          This research application utilizes the <strong>MovieLens Latest Small</strong> dataset released by the <strong>GroupLens Research</strong> team at the University of Minnesota.
        </p>

        <div className="bg-[#FAF8F5] border-2 border-black p-4 font-mono text-xs sm:text-sm text-slate-900 space-y-2 shadow-[2px_2px_0px_0px_#000]">
          <p className="font-black uppercase tracking-wide text-xs text-black">Official Citation Format:</p>
          <p className="leading-relaxed font-semibold">
            F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets: History and Context.
            <em> ACM Transactions on Interactive Intelligent Systems (TiiS)</em> 5, 4, Article 19 (December 2015), 19 pages.
            DOI: <a href="https://doi.org/10.1145/2827872" target="_blank" rel="noreferrer" className="text-blue-700 underline font-bold hover:text-black">https://doi.org/10.1145/2827872</a>
          </p>
        </div>
      </section>

      {/* Privacy Notice Card */}
      <section className="p-6 border-2 border-black bg-[#ccff00] shadow-[4px_4px_0px_0px_#000] space-y-2">
        <div className="flex items-center gap-2.5 text-black font-black text-base uppercase">
          <ShieldAlert className="w-5 h-5 stroke-[2.5] shrink-0" />
          <h3 className="tracking-tight">Ethics & Privacy Considerations</h3>
        </div>
        <p className="text-xs sm:text-sm text-black font-bold leading-relaxed">
          User identifiers stored in the Knowledge Graph (e.g., <code className="bg-white px-1.5 py-0.5 border border-black text-xs font-mono">ml:user/1</code>) are <strong>local pseudonymous dataset IDs</strong>. They do not represent real-world personal identities, and no Personally Identifiable Information (PII) is stored or processed.
        </p>
      </section>

      {/* Graph Ontology Summary */}
      <section className="neo-box p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black">
            <Layers className="w-5 h-5 stroke-[2.5]" />
          </div>
          <h2 className="text-lg sm:text-xl font-black uppercase text-black tracking-tight">
            RDF Ontology & Vocabulary Schema
          </h2>
        </div>

        <div className="text-xs sm:text-sm text-slate-800 font-semibold space-y-1">
          <p className="uppercase text-xs font-black tracking-wider text-black/70">Primary Namespace Prefix:</p>
          <code className="text-xs sm:text-sm font-mono font-bold text-black bg-white px-3 py-1.5 border-2 border-black inline-block shadow-[2px_2px_0px_0px_#000]">
            ml: &lt;{GRAPH_NAMESPACE}&gt;
          </code>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          <div className="bg-[#FAF8F5] border-2 border-black p-4 space-y-3 shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black">
              <span className="text-xs font-black text-black uppercase tracking-wider">Core Classes</span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 border border-black bg-[#ccff00] text-black">5 Classes</span>
            </div>
            <ul className="text-xs sm:text-sm text-slate-800 space-y-1.5 font-mono font-semibold">
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <strong className="text-black">ml:Movie</strong> — Movie titles and metadata</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <strong className="text-black">ml:Genre</strong> — Genre categories</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <strong className="text-black">ml:User</strong> — Pseudonymous reviewers</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <strong className="text-black">ml:RatingEvent</strong> — Star ratings (0.5 to 5.0)</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <strong className="text-black">ml:TagAssignment</strong> — Keyword tags</li>
            </ul>
          </div>

          <div className="bg-[#FAF8F5] border-2 border-black p-4 space-y-3 shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black">
              <span className="text-xs font-black text-black uppercase tracking-wider">Key Properties</span>
              <span className="text-xs font-bold font-mono px-2 py-0.5 border border-black bg-white text-black">RDF Triples</span>
            </div>
            <ul className="text-xs sm:text-sm text-slate-800 space-y-1.5 font-mono font-semibold">
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <span className="text-black font-bold">ml:hasGenre</span> &rarr; ml:Genre</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <span className="text-black font-bold">ml:genreLabel</span> &rarr; xsd:string</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <span className="text-black font-bold">ml:ratedMovie</span> &rarr; ml:Movie</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <span className="text-black font-bold">ml:ratingValue</span> &rarr; xsd:decimal</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 bg-black inline-block" /> <span className="text-black font-bold">ml:tagText</span> &rarr; xsd:string</li>
            </ul>
          </div>
        </div>
      </section>

      {/* System Architecture */}
      <section className="neo-box p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black">
            <Terminal className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black uppercase text-black tracking-tight">
              System Architecture & Infrastructure
            </h2>
            <p className="text-xs sm:text-sm text-slate-800 font-medium">
              Decoupled, modular multi-tier architecture designed for reproducible knowledge graph research.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ARCHITECTURE_LAYERS.map((layer) => (
            <div
              key={layer.name}
              className="border-2 border-black bg-white p-5 space-y-3 shadow-[3px_3px_0px_0px_#000] hover:bg-[#FAF8F5] transition-colors"
            >
              <div className="flex items-center gap-3 pb-2 border-b-2 border-black">
                <span className="flex items-center justify-center w-8 h-8 border-2 border-black bg-[#ccff00] text-black">
                  <layer.icon className="w-4 h-4 stroke-[2.5]" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-black uppercase text-black">{layer.name}</p>
                  <code className="text-xs font-mono font-bold text-slate-600">{layer.path}</code>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">{layer.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
