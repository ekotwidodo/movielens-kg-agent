"""AI Agent: Translates natural language questions to SPARQL and synthesizes answers."""

import json
import logging
from collections.abc import Callable

import httpx

from backend.config import Settings
from backend.models import AgentQueryResponse, ProgressEvent, SparqlProposal
from backend.sparql_client import FusekiClient
from backend.sparql_validator import SparqlValidator

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a SPARQL expert agent for a MovieLens RDF Knowledge Graph.
Translate user questions into SPARQL SELECT queries.

Graph Schema:
- Base Namespace: PREFIX ml: <{namespace}>
- Classes:
  - ml:Movie (instances: ml:movie/1, ml:movie/2)
  - ml:Genre (instances: ml:genre/action, ml:genre/comedy)
  - ml:User (instances: ml:user/1)
  - ml:RatingEvent
  - ml:TagAssignment
- Predicates on ml:Movie:
  - ml:title (xsd:string, e.g. "Toy Story (1995)")
  - ml:movieId (xsd:integer)
  - ml:averageRating (xsd:decimal, e.g. 3.92)
  - ml:ratingCount (xsd:integer, e.g. 215)
  - ml:hasGenre (links Movie to ml:Genre)
- Predicates on ml:Genre:
  - ml:genreLabel (xsd:string, e.g. "Action", "Comedy", "Sci-Fi")
- Predicates on ml:RatingEvent:
  - ml:ratedBy (links to ml:User)
  - ml:ratedMovie (links to ml:Movie)
  - ml:ratingValue (xsd:decimal, e.g. 4.0)
- Predicates on ml:TagAssignment:
  - ml:taggedBy (links to ml:User)
  - ml:taggedMovie (links to ml:Movie)
  - ml:tagText (xsd:string)

Instructions:
1. Always output a valid JSON object with keys:
   - "answerable": boolean (true if question can be answered from this graph)
   - "rationale": brief explanation of query strategy
   - "sparql": the complete SPARQL SELECT query string (null if answerable is false)
2. Use PREFIX ml: <{namespace}>
3. Only use SELECT queries. Do not use INSERT, DELETE, or SERVICE.
4. Always specify a LIMIT (e.g. LIMIT 10 or LIMIT 25).
"""


class KnowledgeGraphAgent:
    """Orchestrates natural language interpretation, SPARQL execution, and answer groundedness."""

    def __init__(
        self,
        config: Settings,
        fuseki_client: FusekiClient | None = None,
        validator: SparqlValidator | None = None,
    ) -> None:
        self.config = config
        self.fuseki = fuseki_client or FusekiClient(
            str(config.fuseki_query_endpoint),
            timeout_seconds=config.sparql_query_timeout_seconds,
        )
        self.validator = validator or SparqlValidator(
            default_limit=config.default_query_limit,
            max_limit=config.max_query_limit,
        )

    def _call_llm(self, messages: list[dict[str, str]]) -> str:
        """Invokes the configured OpenAI-compatible LLM endpoint."""
        base_url = str(self.config.llm_base_url).rstrip("/")
        url = f"{base_url}/chat/completions"

        headers = {"Content-Type": "application/json"}
        if self.config.llm_api_key:
            headers["Authorization"] = f"Bearer {self.config.llm_api_key.get_secret_value()}"

        payload = {
            "model": self.config.llm_model,
            "messages": messages,
            "temperature": 0.0,
        }

        with httpx.Client(timeout=30.0) as client:
            res = client.post(url, json=payload, headers=headers)
            if res.status_code != 200:
                raise RuntimeError(f"LLM API error {res.status_code}: {res.text[:200]}")
            data = res.json()
            return str(data["choices"][0]["message"]["content"])

    def generate_sparql_proposal(self, question: str) -> SparqlProposal:
        """Uses LLM to interpret natural language question and construct SPARQL."""
        system_text = SYSTEM_PROMPT.format(namespace=self.config.movielens_namespace)
        messages = [
            {"role": "system", "content": system_text},
            {"role": "user", "content": f"User question: {question}\nRespond strictly with JSON."},
        ]

        raw_output = self._call_llm(messages)

        # Extract JSON from possible markdown formatting
        cleaned = raw_output.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(cleaned)
            return SparqlProposal(
                answerable=bool(data.get("answerable", True)),
                rationale=str(data.get("rationale", "")),
                sparql=data.get("sparql"),
            )
        except json.JSONDecodeError:
            # Fallback if LLM returned raw SPARQL directly instead of JSON
            if "SELECT" in raw_output.upper():
                return SparqlProposal(
                    answerable=True,
                    rationale="Direct query generation",
                    sparql=raw_output.strip(),
                )
            return SparqlProposal(
                answerable=False,
                rationale="Unable to parse LLM proposal",
                sparql=None,
            )

    def answer_question(
        self,
        question: str,
        on_progress: Callable[[ProgressEvent], None] | None = None,
    ) -> AgentQueryResponse:
        """Executes the full pipeline: question -> SPARQL -> validation -> execution -> answer."""
        notify = on_progress or (lambda _: None)

        # Stage 1: Analyze question
        notify(ProgressEvent(stage="analyzing", state="start"))
        cleaned_question = question.strip()
        notify(ProgressEvent(stage="analyzing", state="done"))

        # Stage 2: Generate SPARQL query
        notify(ProgressEvent(stage="generating_sparql", state="start"))
        proposal = self.generate_sparql_proposal(cleaned_question)
        notify(
            ProgressEvent(
                stage="generating_sparql",
                state="done",
                detail={"answerable": proposal.answerable, "rationale": proposal.rationale},
            )
        )

        if not proposal.answerable or not proposal.sparql:
            return AgentQueryResponse(
                question=cleaned_question,
                answer="I could not answer this question using the MovieLens knowledge graph.",
                answer_source="unanswerable",
                query_rationale=proposal.rationale,
            )

        # Stage 3: Validate query safety & limits
        notify(ProgressEvent(stage="validating", state="start"))
        validated_query = self.validator.validate(proposal.sparql)
        notify(
            ProgressEvent(
                stage="validating",
                state="done",
                detail={"status": "accepted", "limit": validated_query.limit},
            )
        )

        # Stage 4: Execute query against Jena Fuseki
        notify(ProgressEvent(stage="executing", state="start"))
        query_result = self.fuseki.execute(validated_query, max_rows=self.config.max_result_rows)
        notify(
            ProgressEvent(
                stage="executing",
                state="done",
                detail={"result_count": len(query_result.records)},
            )
        )

        # Stage 5: Grounded Answer Synthesis
        notify(ProgressEvent(stage="answering", state="start"))
        records_list = list(query_result.records)

        if not records_list:
            final_answer = "No matching records found in the knowledge graph for this query."
            source = "empty_result"
        else:
            # Format concise grounded answer
            preview_rows = records_list[:10]
            summary_prompt = (
                f"Question: {cleaned_question}\n"
                f"Query Results ({len(records_list)} total rows, showing up to 10):\n"
                f"{json.dumps(preview_rows, indent=2)}\n\n"
                "Synthesize a clear, direct, and factual 1-3 sentence answer in natural English "
                "based strictly on these results."
            )
            try:
                final_answer = self._call_llm(
                    [
                        {"role": "system", "content": "You are a factual movie assistant."},
                        {"role": "user", "content": summary_prompt},
                    ]
                ).strip()
                source = "llm_synthesized"
            except (httpx.HTTPError, RuntimeError):
                # Fallback to tabular summary if LLM call fails
                final_answer = f"Found {len(records_list)} records matching your query."
                source = "template"

        notify(ProgressEvent(stage="answering", state="done", detail={"answer_source": source}))

        return AgentQueryResponse(
            question=cleaned_question,
            answer=final_answer,
            answer_source=source,
            generated_sparql=validated_query.text,
            query_rationale=proposal.rationale,
            result_count=len(records_list),
            results=records_list,
        )
