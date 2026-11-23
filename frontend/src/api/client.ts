/**
 * API client for interacting with the MovieLens KG Agent API and SPARQL endpoint.
 */

export interface ReadinessResponse {
  status: "ready" | "not_ready" | "unknown";
  checks: {
    knowledge_graph: "ok" | "unavailable" | string;
  };
}

export interface AgentQueryResponse {
  question: string;
  answer: string;
  answer_source: string;
  generated_sparql: string | null;
  query_rationale: string;
  result_count: number;
  results: Array<Record<string, unknown>>;
  request_id?: string;
}

export interface AgentProgressDetail {
  answerable?: boolean;
  rationale?: string;
  status?: string;
  limit?: number;
  reason?: string;
  result_count?: number;
  variables?: string[];
  answer_source?: string;
}

export interface AgentErrorBody {
  code: string;
  message: string;
  request_id?: string;
  details?: Record<string, string>;
}

export type AgentStreamEvent =
  | { type: "progress"; stage: string; state: "start" | "done"; detail?: AgentProgressDetail }
  | { type: "result"; data: AgentQueryResponse }
  | { type: "error"; error: AgentErrorBody }
  | { type: "done" };

export interface SparqlBindingValue {
  type: "uri" | "literal" | "bnode";
  value: string;
  datatype?: string;
  "xml:lang"?: string;
}

export interface SparqlResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Array<Record<string, SparqlBindingValue>>;
  };
}

export interface MovieItem {
  id: string;
  uri: string;
  title: string;
  genres: string[];
  avgRating?: number;
  ratingCount?: number;
}

export async function checkHealth(): Promise<ReadinessResponse> {
  try {
    const res = await fetch("/health/ready", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { status: "not_ready", checks: { knowledge_graph: "unavailable" } };
    }
    return await res.json();
  } catch (error) {
    console.error("Health check error:", error);
    return { status: "not_ready", checks: { knowledge_graph: "unavailable" } };
  }
}

/**
 * Run the agent and report its pipeline steps as they happen (Server-Sent Events).
 * Every ``progress`` event is forwarded to ``onEvent``; the stream ends with a
 * single ``result`` or ``error`` event, followed by ``done``.
 */
export async function streamAgent(
  question: string,
  onEvent: (event: AgentStreamEvent) => void
): Promise<void> {
  const res = await fetch("/api/v1/agent/query/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok || !res.body) {
    let errorMessage = `API request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.error?.message) {
        errorMessage = errData.error.message;
      } else if (errData.detail) {
        errorMessage =
          typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);

      const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
      const payload = dataLine?.slice(5).trim();
      if (payload) {
        onEvent(JSON.parse(payload) as AgentStreamEvent);
      }

      separator = buffer.indexOf("\n\n");
    }
  }
}

export async function executeSparql(sparqlQuery: string): Promise<SparqlResult> {
  const params = new URLSearchParams({ credentials: "omit" });
  params.set("query", sparqlQuery);

  const res = await fetch(`/sparql?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/sparql-results+json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `SPARQL query failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Fetch descriptive metadata: entity counts from graph.
 *
 * Uses the cached /api/v1/stats backend endpoint instead of a raw SPARQL
 * COUNT query.  The backend runs 4 lightweight per-type COUNT queries and
 * caches them for 10 minutes, so this returns near-instantly even on a
 * 170M+ triple graph.
 */
export async function fetchGraphStats(): Promise<{
  movieCount: number;
  ratingCount: number;
  tagCount: number;
  userCount: number;
  tripleCount?: number;
}> {
  try {
    const res = await fetch("/api/v1/stats", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("Stats endpoint returned", res.status);
      return { movieCount: 0, ratingCount: 0, tagCount: 0, userCount: 0, tripleCount: 0 };
    }
    const data = await res.json();
    return {
      movieCount: data.movies ?? 0,
      ratingCount: data.ratings ?? 0,
      tagCount: data.tags ?? 0,
      userCount: data.users ?? 0,
      tripleCount: data.triple_count ?? 0,
    };
  } catch (error) {
    console.warn("Could not fetch graph stats:", error);
    return { movieCount: 0, ratingCount: 0, tagCount: 0, userCount: 0, tripleCount: 0 };
  }
}

// --- Settings & Data Ingestion API ---

export interface LlmSettingsData {
  provider: string;
  base_url: string;
  model: string;
  has_api_key: boolean;
  masked_api_key: string | null;
}

export interface LlmTestResult {
  status: "ok" | "error";
  latency_ms: number;
  model_response?: string;
  detail?: string;
}

export interface UploadCsvResponse {
  upload_id: string;
  files: Record<string, { size: number; path: string }>;
  ready_to_transform: boolean;
  missing_required: string[];
}

export interface TransformValidationIssue {
  file: string;
  line: number;
  column?: string;
  message: string;
}

export interface TransformProgressEvent {
  type: "progress" | "complete" | "error";
  stage?: string;
  percent: number;
  message: string;
  report?: {
    status: string;
    triple_count?: number;
    created_resources?: Record<string, number>;
    skipped_rows?: Record<string, number>;
    validation_issues?: TransformValidationIssue[];
  };
  issues?: TransformValidationIssue[];
}

export async function verifySettingsPin(pin: string): Promise<boolean> {
  const res = await fetch("/api/v1/settings/verify-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    return false;
  }
  const data = await res.json();
  return data.valid === true;
}

export async function fetchLlmSettings(pin: string): Promise<LlmSettingsData> {
  const res = await fetch("/api/v1/settings/llm", {
    headers: { "X-Settings-Pin": pin },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch LLM settings (${res.status})`);
  }
  return await res.json();
}

export async function saveLlmSettings(
  data: { base_url: string; model: string; api_key?: string },
  pin: string
): Promise<void> {
  const res = await fetch("/api/v1/settings/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Settings-Pin": pin,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to save LLM settings");
  }
}

export async function testLlmConnection(
  data: { base_url?: string; model?: string; api_key?: string },
  pin: string
): Promise<LlmTestResult> {
  const res = await fetch("/api/v1/settings/llm/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Settings-Pin": pin,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to test LLM connection");
  }
  return await res.json();
}

export async function downloadSampleDataset(
  pin: string
): Promise<{ upload_id: string; status: string; source: string }> {
  const res = await fetch("/api/v1/settings/dataset/sample", {
    method: "POST",
    headers: { "X-Settings-Pin": pin },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Failed to fetch sample dataset (${res.status})`);
  }
  return await res.json();
}

export async function uploadDatasetFiles(
  formData: FormData,
  pin: string
): Promise<UploadCsvResponse> {
  const res = await fetch("/api/v1/settings/upload", {
    method: "POST",
    headers: { "X-Settings-Pin": pin },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Failed to upload file (${res.status})`);
  }
  return await res.json();
}

export async function streamTransformation(
  uploadId: string,
  strict: boolean,
  pin: string,
  onEvent: (event: TransformProgressEvent) => void
): Promise<void> {
  const res = await fetch("/api/v1/settings/transform/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Settings-Pin": pin,
    },
    body: JSON.stringify({ upload_id: uploadId, strict }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Failed to start transformation (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Browser does not support response streaming.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const chunk of lines) {
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      try {
        const payload: TransformProgressEvent = JSON.parse(dataLine.replace(/^data:\s*/, ""));
        onEvent(payload);
      } catch (e) {
        console.warn("Failed to parse SSE event:", e, dataLine);
      }
    }
  }
}


