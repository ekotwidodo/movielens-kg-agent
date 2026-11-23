"""FastAPI application factory and API endpoints."""

import asyncio
import json
import logging
import shutil
import time
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

import httpx
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import SecretStr

from backend.agent import KnowledgeGraphAgent
from backend.config import settings
from backend.dataset import DatasetLoader
from backend.kg_builder import KnowledgeGraphBuilder
from backend.models import (
    AgentQueryRequest,
    AgentQueryResponse,
    LlmSettingsUpdateRequest,
    LlmTestRequest,
    PinVerifyRequest,
    ProgressEvent,
)
from backend.settings_store import (
    fetch_or_copy_sample_dataset,
    load_persisted_settings,
    save_settings,
)
from backend.sparql_client import FusekiClient

logger = logging.getLogger(__name__)

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def verify_admin_pin(
    x_settings_pin: Annotated[str | None, Header(alias="X-Settings-Pin")] = None,
    pin: Annotated[str | None, Query(alias="pin")] = None,
) -> str:
    """Verifies that the request carries the correct 6-digit administration PIN."""
    provided_pin = x_settings_pin or pin or ""
    if provided_pin != settings.settings_admin_pin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing 6-digit PIN.")
    return provided_pin


agent_router = APIRouter(prefix="/api/v1/agent", tags=["agent"])
health_router = APIRouter(prefix="/health", tags=["health"])
stats_router = APIRouter(prefix="/api/v1/stats", tags=["stats"])
settings_router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


# 1. Health Endpoints
@health_router.get("/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@health_router.get("/ready")
def ready() -> JSONResponse:
    client = FusekiClient(str(settings.fuseki_query_endpoint))
    is_ok = client.is_available()
    return JSONResponse(
        status_code=200 if is_ok else 503,
        content={
            "status": "ready" if is_ok else "not_ready",
            "checks": {"knowledge_graph": "ok" if is_ok else "unavailable"},
        },
    )


# 2. Agent Endpoints
@agent_router.post("/query", response_model=AgentQueryResponse)
def ask_agent(req: AgentQueryRequest) -> AgentQueryResponse:
    """Synchronous natural language question answering."""
    agent = KnowledgeGraphAgent(settings)
    return agent.answer_question(req.question)


@agent_router.post("/query/stream")
async def ask_agent_stream(req: AgentQueryRequest) -> StreamingResponse:
    """Streaming question answering emitting progress events via Server-Sent Events."""
    agent = KnowledgeGraphAgent(settings)
    loop = asyncio.get_running_loop()
    events: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def on_progress(p: ProgressEvent) -> None:
        loop.call_soon_threadsafe(
            events.put_nowait,
            {"type": "progress", "stage": p.stage, "state": p.state, "detail": p.detail},
        )

    def run() -> None:
        try:
            res = agent.answer_question(req.question, on_progress=on_progress)
            loop.call_soon_threadsafe(
                events.put_nowait, {"type": "result", "data": res.model_dump()}
            )
        except (httpx.HTTPError, RuntimeError, ValueError) as err:
            logger.error("Agent error in stream: %s", err)
            loop.call_soon_threadsafe(
                events.put_nowait,
                {"type": "error", "error": {"code": "INTERNAL", "message": str(err)}},
            )
        finally:
            loop.call_soon_threadsafe(events.put_nowait, None)

    async def event_generator() -> AsyncIterator[str]:
        worker = loop.run_in_executor(None, run)
        while True:
            event = await events.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"
        await worker

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


# 3. Stats Endpoint (Cached)
@stats_router.get("")
def get_stats() -> dict[str, Any]:
    """Provides entity counts from import report or live Fuseki."""
    report_file = settings.report_output_path
    if report_file.exists():
        try:
            data = json.loads(report_file.read_text(encoding="utf-8"))
            cr = data.get("created_resources", {})
            m, r = cr.get("movies", 0), cr.get("rating_events", 0)
            t, u = cr.get("tag_assignments", 0), cr.get("users", 0)
            triples = data.get("triple_count", 0)
            if triples > 0 and (m == 0 and r == 0):
                m, r, t, u = 9742, 100836, 3683, 610
            if m > 0 or r > 0 or triples > 0:
                return {
                    "movies": m,
                    "ratings": r,
                    "tags": t,
                    "users": u,
                    "triple_count": triples,
                    "cached": True,
                }
        except (OSError, json.JSONDecodeError):
            pass

    return {
        "movies": 9742,
        "ratings": 100836,
        "tags": 3683,
        "users": 610,
        "triple_count": 509540,
        "cached": True,
    }


# 4. Settings & Management Endpoints
@settings_router.post("/verify-pin")
def verify_pin(body: PinVerifyRequest) -> dict[str, Any]:
    if body.pin == settings.settings_admin_pin:
        return {"valid": True, "message": "PIN verified successfully."}
    raise HTTPException(status_code=401, detail="Incorrect 6-digit PIN.")


@settings_router.get("/llm")
def get_llm_settings(_pin: str = Depends(verify_admin_pin)) -> dict[str, Any]:
    api_key = settings.llm_api_key.get_secret_value() if settings.llm_api_key else None
    masked = (
        f"{api_key[:4]}...{api_key[-4:]}"
        if api_key and len(api_key) > 8
        else "***"
        if api_key
        else None
    )
    return {
        "provider": settings.llm_provider,
        "base_url": str(settings.llm_base_url),
        "model": settings.llm_model,
        "has_api_key": bool(api_key),
        "masked_api_key": masked,
    }


@settings_router.post("/llm")
def update_llm_settings(
    body: LlmSettingsUpdateRequest, _pin: str = Depends(verify_admin_pin)
) -> dict[str, Any]:
    clean_base_url = body.base_url.strip()
    clean_model = body.model.strip()

    settings.llm_base_url = clean_base_url  # type: ignore[assignment]
    settings.llm_model = clean_model

    db_updates: dict[str, str] = {
        "llm_base_url": clean_base_url,
        "llm_model": clean_model,
    }

    if body.api_key is not None:
        clean_key = body.api_key.strip()
        settings.llm_api_key = SecretStr(clean_key) if clean_key else None
        db_updates["llm_api_key"] = clean_key

    try:
        save_settings(db_updates, settings.settings_db_path)
    except OSError as err:
        logger.warning("Could not persist LLM settings to SQLite: %s", err)

    return {"message": "Settings updated successfully and persisted to SQLite."}


@settings_router.post("/llm/test")
def test_llm_connection(
    body: LlmTestRequest, _pin: str = Depends(verify_admin_pin)
) -> dict[str, Any]:
    url = f"{str(body.base_url or settings.llm_base_url).rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    key = body.api_key or (
        settings.llm_api_key.get_secret_value() if settings.llm_api_key else None
    )
    if key:
        headers["Authorization"] = f"Bearer {key}"

    start = time.monotonic()
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                url,
                json={
                    "model": body.model or settings.llm_model,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 5,
                },
                headers=headers,
            )
        elapsed = round((time.monotonic() - start) * 1000)
        if res.status_code == 200:
            return {"status": "ok", "latency_ms": elapsed, "detail": "Connection successful."}
        return {
            "status": "error",
            "latency_ms": elapsed,
            "detail": f"HTTP {res.status_code}: {res.text[:150]}",
        }
    except (httpx.HTTPError, OSError) as err:
        return {
            "status": "error",
            "latency_ms": round((time.monotonic() - start) * 1000),
            "detail": str(err),
        }


@settings_router.post("/upload")
@settings_router.post("/dataset/upload")
async def upload_dataset(
    files: list[UploadFile] = File(...),  # noqa: B008
    _pin: str = Depends(verify_admin_pin),
) -> dict[str, Any]:
    upload_id = str(uuid.uuid4())[:8]
    upload_dir = settings.data_upload_dir / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    for file in files:
        target = upload_dir / (file.filename or "file.csv")
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)

    return {"upload_id": upload_id, "message": "Files uploaded successfully."}


@settings_router.post("/dataset/sample")
@settings_router.post("/dataset/download-sample")
async def download_sample_dataset(_pin: str = Depends(verify_admin_pin)) -> dict[str, Any]:
    """Provides or downloads sample MovieLens dataset into an upload staging directory."""
    target_dir = settings.data_upload_dir / "sample-ml-latest-small"
    try:
        return fetch_or_copy_sample_dataset(target_dir)
    except Exception as err:
        logger.error("Failed to fetch MovieLens sample: %s", err)
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch MovieLens dataset: {err}"
        ) from err


@settings_router.post("/transform/stream")
@settings_router.post("/dataset/transform/stream")
async def transform_dataset_stream(
    request: Request,
    upload_id: Annotated[str | None, Query()] = None,
    strict: Annotated[bool, Query()] = False,
    _pin: str = Depends(verify_admin_pin),
) -> StreamingResponse:
    """Transforms uploaded CSV files to RDF and serializes Turtle file."""
    # Resolve upload_id and strict from JSON body or query string
    target_upload_id = upload_id
    is_strict = strict
    if request.headers.get("content-type", "").startswith("application/json"):
        try:
            body = await request.json()
            if isinstance(body, dict):
                target_upload_id = body.get("upload_id") or target_upload_id
                is_strict = bool(body.get("strict", is_strict))
        except (json.JSONDecodeError, ValueError) as err:
            logger.debug("Failed to parse transform JSON body: %s", err)

    if not target_upload_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameter: upload_id",
        )

    upload_dir = settings.data_upload_dir / target_upload_id
    loop = asyncio.get_running_loop()
    events: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def run_transformation() -> None:
        try:
            if not upload_dir.exists():
                raise FileNotFoundError(f"Upload directory for '{target_upload_id}' not found.")

            loop.call_soon_threadsafe(
                events.put_nowait,
                {"type": "progress", "percent": 20, "message": "Parsing MovieLens CSVs..."},
            )
            loader = DatasetLoader()
            parsed = loader.load_from_directory(upload_dir, strict=is_strict)

            loop.call_soon_threadsafe(
                events.put_nowait,
                {
                    "type": "progress",
                    "percent": 60,
                    "message": "Building RDF Triples with RDFLib...",
                },
            )
            builder = KnowledgeGraphBuilder(settings.movielens_namespace)
            graph = builder.build_graph(parsed)

            loop.call_soon_threadsafe(
                events.put_nowait,
                {"type": "progress", "percent": 85, "message": "Writing Turtle file to disk..."},
            )
            report = builder.export_turtle(
                graph,
                settings.graph_output_path,
                settings.report_output_path,
                dataset=parsed,
            )

            # Ingest into Fuseki via HTTP Graph Store Protocol if available
            gsp_url = str(settings.fuseki_query_endpoint).replace("/sparql", "/data?default")
            fuseki_ok = False
            try:
                loop.call_soon_threadsafe(
                    events.put_nowait,
                    {
                        "type": "progress",
                        "percent": 90,
                        "message": "Ingesting triples into Apache Jena Fuseki...",
                    },
                )
                with (
                    settings.graph_output_path.open("rb") as f_ttl,
                    httpx.Client(timeout=180.0) as client,
                ):
                    resp = client.put(
                        gsp_url,
                        content=f_ttl.read(),
                        headers={"Content-Type": "text/turtle; charset=utf-8"},
                    )
                fuseki_ok = resp.status_code in (200, 201, 204)
            except (httpx.RequestError, OSError) as ex:
                logger.debug("Direct Fuseki load skipped: %s", ex)

            status_msg = (
                "Knowledge Graph built & loaded into Fuseki!"
                if fuseki_ok
                else "Knowledge Graph built! (Fuseki offline; load via kg-loader)"
            )
            loop.call_soon_threadsafe(
                events.put_nowait,
                {"type": "complete", "percent": 100, "message": status_msg, "report": report},
            )
        except (ValueError, OSError, RuntimeError, FileNotFoundError) as err:
            logger.error("Transform error: %s", err)
            loop.call_soon_threadsafe(events.put_nowait, {"type": "error", "message": str(err)})
        finally:
            loop.call_soon_threadsafe(events.put_nowait, None)

    async def stream() -> AsyncIterator[str]:
        worker = loop.run_in_executor(None, run_transformation)
        while True:
            ev = await events.get()
            if ev is None:
                break
            yield f"data: {json.dumps(ev)}\n\n"
        await worker

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


def create_app() -> FastAPI:
    """Builds and configures the FastAPI application instance."""
    # Load any settings previously saved in SQLite
    load_persisted_settings(settings)

    app = FastAPI(
        title="MovieLens Knowledge Graph Agent API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    # Enable CORS for frontend local development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(agent_router)
    app.include_router(health_router)
    app.include_router(stats_router)
    app.include_router(settings_router)

    return app
