import React from "react";
import { Link } from "react-router-dom";
import { X, Film, Share2 } from "lucide-react";

export interface SelectedNodeInfo {
  id: string;
  label: string;
  type: string;
  color: string;
  uri?: string;
  movieId?: string;
  properties: Array<{ key: string; value: string }>;
}

interface GraphInspectorDrawerProps {
  selectedNode: SelectedNodeInfo | null;
  onClose: () => void;
}

/**
 * Floating inspector card displaying details and quick links for a selected graph node.
 */
export const GraphInspectorDrawer: React.FC<GraphInspectorDrawerProps> = ({
  selectedNode,
  onClose,
}) => {
  if (!selectedNode) return null;

  return (
    <div className="absolute bottom-3 right-3 z-20 w-80 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between pb-2 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 border border-black shadow-[1px_1px_0px_0px_#000] shrink-0"
            style={{ backgroundColor: selectedNode.color }}
          />
          <span className="font-black text-black truncate max-w-[170px] uppercase">
            {selectedNode.label}
          </span>
          <span className="px-2 py-0.5 border border-black text-xs font-black uppercase bg-[#ccff00] text-black">
            {selectedNode.type}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 border border-black bg-white hover:bg-black hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Attributes List */}
      <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {selectedNode.properties.length > 0 ? (
          selectedNode.properties.map((prop, idx) => (
            <div key={idx} className="flex items-start justify-between text-xs py-0.5 gap-2 font-mono">
              <span className="text-slate-600 font-bold shrink-0">{prop.key}:</span>
              <span className="text-black text-right truncate font-bold">{prop.value}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500 font-semibold italic">No extra attributes</p>
        )}
      </div>

      {/* Quick Action Navigation */}
      <div className="mt-3 pt-3 border-t-2 border-black flex items-center gap-2">
        {selectedNode.movieId && (
          <Link
            to={`/movies/${selectedNode.movieId}`}
            className="neo-btn-lime py-1 px-3 text-xs uppercase tracking-wider flex items-center gap-1.5"
          >
            <Film className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Movie Page</span>
          </Link>
        )}
        {selectedNode.uri && (
          <Link
            to={`/explore?startUri=${encodeURIComponent(selectedNode.uri)}`}
            className="neo-btn-white py-1 px-3 text-xs uppercase tracking-wider flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Explorer</span>
          </Link>
        )}
      </div>
    </div>
  );
};
