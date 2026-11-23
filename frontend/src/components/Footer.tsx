import React from "react";
import { Link } from "react-router-dom";
import { Database } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#042f2e] border-t-2 border-black text-white py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-black text-white text-base uppercase tracking-tight">
            <div className="w-8 h-8 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
              <Database className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span>MovieLens Knowledge Graph Agent</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-extrabold uppercase">
            <Link to="/about" className="text-white hover:text-[#ccff00] underline decoration-2 underline-offset-4 transition-colors">
              Attribution & Ontology
            </Link>
            <Link to="/sparql" className="text-white hover:text-[#ccff00] underline decoration-2 underline-offset-4 transition-colors">
              SPARQL Console
            </Link>
            <a
              href="https://github.com/ekotwidodo/movielens-kg-agent"
              target="_blank"
              rel="noreferrer"
              className="text-white hover:text-[#ccff00] underline decoration-2 underline-offset-4 transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-black/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-teal-200/90 font-medium">
          <p>
            Dataset provided by GroupLens Research. User identifiers are dataset-local pseudonyms, not real identities.
          </p>
          <p>
            RDF triplestore powered by Apache Jena Fuseki TDB2.
          </p>
        </div>
      </div>
    </footer>
  );
};
