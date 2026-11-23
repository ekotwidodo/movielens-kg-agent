import React, { useEffect, useRef, useState } from "react";
import { streamAgent, AgentProgressDetail, AgentQueryResponse } from "../api/client";
import { Bot, Send, AlertCircle } from "lucide-react";
import { PipelineProgress, StepState } from "../components/agent/PipelineProgress";
import { AgentResultTable } from "../components/agent/AgentResultTable";

const EXAMPLE_PROMPTS = [
  "Find science fiction movies with an average rating of at least 4.0 and at least 50 ratings.",
  "Which movies are tagged as 'thought-provoking' or 'atmospheric'?",
  "List 5 comedy movies released in the 1990s with their average ratings.",
  "What genres are associated with the movie 'Toy Story'?",
  "Find the top 5 movies with the highest number of ratings.",
];

const PIPELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: "analyzing", label: "Interpreting the question" },
  { key: "generating_sparql", label: "Generating a SPARQL query" },
  { key: "validating", label: "Validating the query against the policy" },
  { key: "executing", label: "Executing against the knowledge graph" },
  { key: "answering", label: "Composing the grounded answer" },
];

const createSteps = (): StepState[] =>
  PIPELINE_STEPS.map((step) => ({ ...step, status: "pending" }));

const summariseDetail = (
  stage: string,
  state: "start" | "done",
  detail: AgentProgressDetail = {}
): string | undefined => {
  if (state !== "done") return undefined;
  switch (stage) {
    case "generating_sparql":
      return detail.rationale;
    case "validating":
      return detail.status === "rejected"
        ? `Rejected: ${detail.reason ?? "policy violation"}`
        : detail.limit !== undefined
          ? `Accepted with LIMIT ${detail.limit}`
          : "Accepted";
    case "executing":
      return detail.result_count !== undefined
        ? `${detail.result_count} row(s) returned`
        : undefined;
    case "answering":
      return detail.answer_source ? `Source: ${detail.answer_source}` : undefined;
    default:
      return undefined;
  }
};

/**
 * Format raw SPARQL queries with clean line breaks and indentations.
 */
export function formatSparql(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  clean = clean.replace(/PREFIX\s+(\w+:)\s+(<[^>]+>)/gi, "PREFIX $1 $2\n");
  clean = clean.replace(/\n\s*(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/gi, "\n\n$1");
  clean = clean.replace(/\bWHERE\s*\{/gi, "WHERE {\n  ");
  clean = clean.replace(/\}\s*(ORDER BY|LIMIT|GROUP BY|HAVING)\b/gi, "}\n$1");
  clean = clean.replace(/\bLIMIT\s+(\d+)/gi, "LIMIT $1");
  return clean.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Interactive natural-language AI agent demo page.
 */
export const AgentDemo: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState[]>(createSteps);
  const [pipelineStartedAt, setPipelineStartedAt] = useState<number | null>(null);
  const [pipelineFinishedAt, setPipelineFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => performance.now());

  const activeStageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = window.setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (e?: React.FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = (overridePrompt ?? question).trim();
    if (!promptToSend || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setSteps(createSteps());
    const startTime = performance.now();
    setPipelineStartedAt(startTime);
    setPipelineFinishedAt(null);
    setNow(startTime);
    activeStageRef.current = null;

    try {
      await streamAgent(promptToSend, (event) => {
        const timestamp = performance.now();
        if (event.type === "progress") {
          const detail = summariseDetail(event.stage, event.state, event.detail);
          setSteps((prev) =>
            prev.map((step) => {
              if (step.key !== event.stage) return step;
              if (event.state === "start") {
                activeStageRef.current = event.stage;
                return {
                  ...step,
                  status: "active",
                  startedAt: timestamp,
                  durationMs: undefined,
                  detail: undefined,
                };
              }
              const durationMs =
                step.startedAt !== undefined
                  ? Math.max(0, timestamp - step.startedAt)
                  : undefined;
              return { ...step, status: "done", durationMs, detail: detail ?? step.detail };
            })
          );
        } else if (event.type === "result") {
          setResult(event.data);
        } else if (event.type === "error") {
          setError(event.error?.message || "Agent execution failed.");
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run agent query.");
    } finally {
      const finished = performance.now();
      setPipelineFinishedAt(finished);
      setLoading(false);
      setSteps((prev) =>
        prev.map((step) =>
          step.status === "active"
            ? {
              ...step,
              status: "done",
              durationMs:
                step.startedAt !== undefined ? finished - step.startedAt : step.durationMs,
            }
            : step.status === "pending"
              ? { ...step, status: "skipped" }
              : step
        )
      );
    }
  };

  const elapsedMs =
    pipelineStartedAt === null
      ? null
      : pipelineFinishedAt !== null
        ? Math.max(0, pipelineFinishedAt - pipelineStartedAt)
        : Math.max(0, now - pipelineStartedAt);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 font-black text-xs uppercase tracking-wider bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span>02 / NATURAL LANGUAGE INTERFACE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight leading-none">
          AI Agent Natural Language Query
        </h1>
        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
          Ask questions in plain English. The agent translates your question into a validated SPARQL query and executes it against the MovieLens Knowledge Graph.
        </p>
      </div>

      {/* Query Form */}
      <div className="neo-box p-6 space-y-4">
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-3">
          <label htmlFor="question" className="block text-xs font-black uppercase text-black tracking-wide">
            Your Question
          </label>
          <div className="relative">
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Find science fiction movies with an average rating of at least 4.0 and at least 50 ratings..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-black bg-[#FAF8F5] focus:bg-white text-sm font-bold text-black placeholder:text-slate-400 outline-none shadow-[2px_2px_0px_0px_#000] resize-none"
              disabled={loading}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="neo-btn-lime py-2.5 px-6 text-xs uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Processing Query...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>Ask Agent</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Example Prompts */}
        <div className="pt-3 border-t-2 border-black space-y-2">
          <span className="text-xs font-black uppercase tracking-wide text-black/70 block">
            Quick Example Queries:
          </span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(prompt);
                  handleSubmit(undefined, prompt);
                }}
                className="text-xs font-bold px-3 py-1.5 border-2 border-black bg-white hover:bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000] transition-colors text-left cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Progress Pipeline */}
      <PipelineProgress steps={steps} loading={loading} elapsedMs={elapsedMs} now={now} />

      {/* Error Message */}
      {error && (
        <div className="p-4 border-2 border-black bg-red-100 text-red-950 font-medium text-xs space-y-1 shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-center gap-2 font-black uppercase text-red-800">
            <AlertCircle className="w-4 h-4 stroke-[2.5]" />
            <span>Query Execution Failed</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="space-y-6">
          {/* Grounded Answer Card */}
          <div className="neo-box p-6 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2 text-black font-black text-sm uppercase tracking-tight">
                <div className="w-7 h-7 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black">
                  <Bot className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span>Grounded Agent Answer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 border border-black bg-white text-black font-mono shadow-[1px_1px_0px_0px_#000]">
                  {result.answer_source === "template" ? "Direct Match" : "LLM Synthesized"}
                </span>
                <span className="neo-badge">
                  {result.result_count} {result.result_count === 1 ? "Fact Found" : "Facts Found"}
                </span>
              </div>
            </div>
            <div className="text-black text-sm leading-relaxed whitespace-pre-line font-bold">
              {result.answer}
            </div>
          </div>

          {/* Results Table & SPARQL Views */}
          <AgentResultTable result={result} formatSparql={formatSparql} />
        </div>
      )}
    </div>
  );
};

export default AgentDemo;
