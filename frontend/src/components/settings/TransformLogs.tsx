import React from "react";
import { CheckCircle2, AlertCircle, Clock, Database } from "lucide-react";
import { TransformValidationIssue } from "../../api/client";

interface TransformLogsProps {
  uploadStep: "idle" | "uploading" | "transforming" | "complete" | "error";
  progressPercent: number;
  statusMessage: string;
  elapsedSeconds: number;
  transformError: string | null;
  validationIssues: TransformValidationIssue[];
  completionReport: Record<string, unknown> | null;
}

export const TransformLogs: React.FC<TransformLogsProps> = ({
  uploadStep,
  progressPercent,
  statusMessage,
  elapsedSeconds,
  transformError,
  validationIssues,
  completionReport,
}) => {
  if (uploadStep === "idle") {
    return null;
  }

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="neo-box p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b-2 border-black">
        <h3 className="font-black text-black text-base uppercase tracking-tight flex items-center gap-2">
          <Database className="w-5 h-5 stroke-[2.5]" />
          <span>Pipeline Ingestion Status & Logs</span>
        </h3>
        <span className="text-xs font-mono font-bold text-black border-2 border-black bg-white px-2.5 py-1 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
          {formatTimer(elapsedSeconds)}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-black font-extrabold uppercase mb-1.5">
          <span className="truncate pr-2">{statusMessage || "Processing..."}</span>
          <span className="font-mono">{progressPercent}%</span>
        </div>
        <div className="h-4 w-full bg-white border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_#000]">
          <div
            className={`h-full transition-all duration-300 border-r-2 border-black ${
              uploadStep === "error"
                ? "bg-red-500"
                : uploadStep === "complete"
                ? "bg-[#ccff00]"
                : "bg-[#ccff00]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error Report */}
      {transformError && (
        <div className="p-4 border-2 border-black bg-red-100 text-xs text-red-950 space-y-2 shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-700 stroke-[2.5] shrink-0 mt-0.5" />
            <div>
              <p className="font-black uppercase text-red-900">Pipeline Execution Failed</p>
              <p className="text-red-800 font-medium mt-0.5">{transformError}</p>
            </div>
          </div>

          {validationIssues.length > 0 && (
            <div className="mt-2 border-t-2 border-black/30 pt-2">
              <p className="font-bold text-xs mb-1 uppercase">Validation Issues Found:</p>
              <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-xs">
                {validationIssues.map((issue, idx) => (
                  <div key={idx} className="bg-white p-1.5 border border-black">
                    [{issue.file || "data"}] Line {issue.line || "N/A"}: {issue.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Report */}
      {uploadStep === "complete" && completionReport && (
        <div className="p-5 border-2 border-black bg-[#ccff00] text-xs text-black space-y-3 shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-tight">
            <CheckCircle2 className="w-5 h-5 stroke-[2.5] text-black" />
            <span>Knowledge Graph Successfully Built & Loaded into Fuseki!</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white p-3 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-xs font-bold uppercase text-slate-600 block">Total Triples</span>
              <span className="font-black text-base text-black font-mono">
                {typeof completionReport.triple_count === "number"
                  ? completionReport.triple_count.toLocaleString()
                  : String(completionReport.triple_count ?? "N/A")}
              </span>
            </div>
            <div className="bg-white p-3 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-xs font-bold uppercase text-slate-600 block">Movies Created</span>
              <span className="font-black text-base text-black font-mono">
                {(() => {
                  const val =
                    (completionReport.created_resources as Record<string, unknown>)?.movies ??
                    completionReport.movies;
                  return typeof val === "number" ? val.toLocaleString() : String(val ?? "N/A");
                })()}
              </span>
            </div>
            <div className="bg-white p-3 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-xs font-bold uppercase text-slate-600 block">Ratings Processed</span>
              <span className="font-black text-base text-black font-mono">
                {(() => {
                  const val =
                    (completionReport.created_resources as Record<string, unknown>)?.rating_events ??
                    completionReport.ratings;
                  return typeof val === "number" ? val.toLocaleString() : String(val ?? "N/A");
                })()}
              </span>
            </div>
            <div className="bg-white p-3 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-xs font-bold uppercase text-slate-600 block">Execution Time</span>
              <span className="font-black text-base text-black font-mono">
                {String(completionReport.duration_seconds ?? elapsedSeconds)}s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
