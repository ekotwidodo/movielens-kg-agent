import React, { useRef } from "react";
import { UploadCloud, FileText, Sparkles, Loader2 } from "lucide-react";

export interface SelectedFiles {
  movies: File | null;
  ratings: File | null;
  tags: File | null;
  links: File | null;
}

interface DatasetUploaderProps {
  files: SelectedFiles;
  strictMode: boolean;
  isProcessing: boolean;
  onFileSelect: (key: keyof SelectedFiles, file: File | null) => void;
  onBatchFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleStrictMode: (val: boolean) => void;
  onStartIngestion: () => void;
  onDownloadSample?: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DatasetUploader: React.FC<DatasetUploaderProps> = ({
  files,
  strictMode,
  isProcessing,
  onFileSelect,
  onBatchFiles,
  onToggleStrictMode,
  onStartIngestion,
  onDownloadSample,
}) => {
  const batchInputRef = useRef<HTMLInputElement | null>(null);

  const fileConfig: Array<{ key: keyof SelectedFiles; label: string; req: boolean }> = [
    { key: "movies", label: "movies.csv", req: true },
    { key: "ratings", label: "ratings.csv", req: true },
    { key: "tags", label: "tags.csv", req: false },
    { key: "links", label: "links.csv", req: false },
  ];

  return (
    <div className="neo-box p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b-2 border-black">
        <div>
          <span className="text-xs font-black uppercase text-black/60 tracking-wider">01 / DATA INGESTION</span>
          <h2 className="font-black text-black text-lg uppercase tracking-tight">Dataset Setup & Knowledge Graph Build</h2>
        </div>
      </div>

      {/* Quick Setup 1-Click Banner */}
      <div className="p-4 border-2 border-black bg-[#ccff00] shadow-[3px_3px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="font-black text-sm uppercase tracking-tight text-black block">
            One-Click Setup: Auto-Load MovieLens Sample
          </span>
          <p className="text-xs text-black/85 font-medium leading-relaxed">
            Downloads official GroupLens ml-latest-small (100,000 ratings), builds the RDF graph, and loads it straight into Fuseki.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadSample}
          disabled={isProcessing}
          className="neo-btn-white px-4 py-2 text-xs font-black uppercase tracking-wider shrink-0 cursor-pointer"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" /> : <Sparkles className="w-4 h-4 stroke-[2.5]" />}
          <span>Auto-Load Sample Dataset</span>
        </button>
      </div>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t-2 border-black"></div>
        <span className="flex-shrink mx-4 text-xs font-black uppercase tracking-widest text-black bg-white px-2 border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000]">
          OR Upload Your Own CSVs
        </span>
        <div className="flex-grow border-t-2 border-black"></div>
      </div>

      {/* Batch Upload Dropzone */}
      <div
        onClick={() => batchInputRef.current?.click()}
        className="border-2 border-dashed border-black hover:bg-[#ccff00]/10 bg-slate-50 p-5 text-center cursor-pointer transition-colors"
      >
        <input
          ref={batchInputRef}
          type="file"
          multiple
          accept=".csv"
          onChange={onBatchFiles}
          className="hidden"
        />
        <div className="w-10 h-10 mx-auto border-2 border-black bg-[#ccff00] flex items-center justify-center text-black mb-2 shadow-[2px_2px_0px_0px_#000]">
          <UploadCloud className="w-5 h-5 stroke-[2.5]" />
        </div>
        <p className="text-xs font-extrabold text-black uppercase tracking-wide mb-0.5">
          Select or drag multiple MovieLens CSV files
        </p>
        <p className="text-xs text-slate-600 font-medium">
          Auto-assigns movies.csv, ratings.csv, tags.csv, and links.csv by filename
        </p>
      </div>

      {/* Individual File Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fileConfig.map(({ key, label, req }) => {
          const file = files[key];
          return (
            <div
              key={key}
              className={`p-3 border-2 border-black text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000] ${
                file ? "bg-[#ccff00]/20" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="w-4 h-4 shrink-0 text-black stroke-[2.5]" />
                <div className="truncate">
                  <div className="font-extrabold flex items-center gap-1 text-black">
                    <span>{label}</span>
                    {req ? (
                      <span className="text-xs text-red-600 font-black">*</span>
                    ) : (
                      <span className="text-xs text-slate-500 font-normal">(optional)</span>
                    )}
                  </div>
                  {file && (
                    <div className="text-xs text-slate-700 font-mono truncate">
                      {formatFileSize(file.size)}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="cursor-pointer text-xs font-black text-black bg-white hover:bg-[#ccff00] px-2.5 py-1 border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] transition-colors">
                  {file ? "Change" : "Browse"}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => onFileSelect(key, e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Options & Action */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t-2 border-black">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-black select-none">
          <input
            type="checkbox"
            checked={strictMode}
            onChange={(e) => onToggleStrictMode(e.target.checked)}
            className="w-4 h-4 border-2 border-black rounded-none text-black focus:ring-0"
          />
          <span>Strict validation (fail on first CSV row anomaly)</span>
        </label>

        <button
          onClick={onStartIngestion}
          disabled={isProcessing || !files.movies || !files.ratings}
          className="neo-btn-lime py-2.5 px-5 text-xs uppercase tracking-wider"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
              <span>Building Knowledge Graph...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>Build Knowledge Graph</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
