import React from "react";
import { Bot, Loader2, Clock, Check, Sparkles } from "lucide-react";

export type StepStatus = "pending" | "active" | "done" | "skipped";

export interface StepState {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
  startedAt?: number;
  durationMs?: number;
}

interface PipelineProgressProps {
  steps: StepState[];
  loading: boolean;
  elapsedMs: number | null;
  now: number;
}

const formatStepDuration = (ms: number, live = false): string => {
  const safe = Math.max(0, ms);
  if (live) return `${(safe / 1000).toFixed(1)}s`;
  if (safe < 1) return "<1 ms";
  if (safe < 1000) return `${Math.round(safe)} ms`;
  return `${(safe / 1000).toFixed(2)}s`;
};

const formatTotalDuration = (ms: number, live: boolean): string => {
  const safe = Math.max(0, ms);
  return `${(safe / 1000).toFixed(live ? 1 : 2)}s`;
};

/**
 * Renders the live multi-stage reasoning pipeline of the agent (progress events).
 */
export const PipelineProgress: React.FC<PipelineProgressProps> = ({
  steps,
  loading,
  elapsedMs,
  now,
}) => {
  if (!loading && !steps.some((step) => step.status !== "pending")) {
    return null;
  }

  return (
    <div className="neo-box p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b-2 border-black">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black">
            <Bot className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-black">Agent Reasoning Trace</span>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-black bg-[#FAF8F5] px-2 py-0.5 border border-black">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              working…
            </span>
          )}
        </div>
        {elapsedMs !== null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-black border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_#000]">
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{formatTotalDuration(elapsedMs, loading)}</span>
          </span>
        )}
      </div>

      <ol className="space-y-4">
        {steps.map((step) => {
          const stepTime =
            step.status === "active" && step.startedAt !== undefined
              ? formatStepDuration(now - step.startedAt, true)
              : step.status === "done" && step.durationMs !== undefined
              ? formatStepDuration(step.durationMs, false)
              : null;

          return (
            <li key={step.key} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center shrink-0">
                {step.status === "done" ? (
                  <span className="flex h-5 w-5 items-center justify-center border-2 border-black bg-[#ccff00] text-black">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : step.status === "active" ? (
                  <span className="flex h-5 w-5 items-center justify-center border-2 border-black bg-white">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black stroke-[3]" />
                  </span>
                ) : step.status === "skipped" ? (
                  <span className="h-1 w-3 bg-black/40" />
                ) : (
                  <span className="h-2 w-2 border border-black bg-slate-300" />
                )}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`text-xs sm:text-sm ${
                      step.status === "pending" || step.status === "skipped"
                        ? "text-slate-400 font-medium"
                        : "text-black font-black uppercase tracking-tight"
                    }`}
                  >
                    {step.label}
                  </p>
                  {stepTime && (
                    <span
                      className={`font-mono text-xs tabular-nums shrink-0 font-bold px-2 py-0.5 border border-black bg-white text-black shadow-[1px_1px_0px_0px_#000]`}
                    >
                      {stepTime}
                    </span>
                  )}
                </div>

                {step.detail && step.key === "generating_sparql" ? (
                  <div className="mt-2 p-3.5 border-2 border-black bg-[#FAF8F5] text-black text-xs font-semibold leading-relaxed shadow-[2px_2px_0px_0px_#000]">
                    <div className="flex items-center gap-1.5 font-black uppercase text-black text-xs mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Query Interpretation & Reasoning</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed">{step.detail}</p>
                  </div>
                ) : step.detail ? (
                  <p className="text-xs font-medium text-slate-700 leading-relaxed break-words mt-1">
                    {step.detail}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
