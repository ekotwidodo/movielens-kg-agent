"""SPARQL HTTP client for Apache Jena Fuseki."""

import logging
from typing import Any

import httpx

from backend.models import QueryResult, ValidatedQuery

logger = logging.getLogger(__name__)

SPARQL_JSON_HEADER = {"Accept": "application/sparql-results+json"}


class FusekiClient:
    """Communicates with Apache Jena Fuseki over the SPARQL 1.1 Protocol."""

    def __init__(self, endpoint_url: str, timeout_seconds: float = 15.0) -> None:
        self.endpoint_url = str(endpoint_url).rstrip("/")
        self.timeout = timeout_seconds

    def execute(self, query: ValidatedQuery, max_rows: int = 100) -> QueryResult:
        """Executes a validated SPARQL SELECT query and returns tabular records."""
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    self.endpoint_url,
                    data={"query": query.text},
                    headers=SPARQL_JSON_HEADER,
                )

            if response.status_code != 200:
                logger.error(
                    "Fuseki query failed with status %d: %s",
                    response.status_code,
                    response.text[:200],
                )
                err_msg = (
                    f"Knowledge graph query failed ({response.status_code}): {response.text[:200]}"
                )
                raise RuntimeError(err_msg)

            data = response.json()
            variables = tuple(data.get("head", {}).get("vars", []))
            bindings = data.get("results", {}).get("bindings", [])

            # Convert SPARQL JSON binding representation to clean Python dicts
            records: list[dict[str, Any]] = []
            for b in bindings[:max_rows]:
                record: dict[str, Any] = {}
                for var in variables:
                    val_obj = b.get(var)
                    if val_obj is None:
                        record[var] = None
                    else:
                        val = val_obj.get("value", "")
                        datatype = val_obj.get("datatype", "")
                        if "integer" in datatype or "int" in datatype:
                            try:
                                record[var] = int(val)
                            except ValueError:
                                record[var] = val
                        elif "boolean" in datatype:
                            record[var] = val.lower() in ("true", "1")
                        else:
                            record[var] = val
                records.append(record)

            is_truncated = len(bindings) > max_rows
            return QueryResult(variables=variables, records=tuple(records), truncated=is_truncated)

        except httpx.TimeoutException as err:
            logger.warning("Fuseki query timed out after %s seconds", self.timeout)
            raise TimeoutError("The knowledge graph query timed out.") from err
        except httpx.RequestError as err:
            logger.error("Fuseki connection error: %s", err)
            raise ConnectionError("Unable to reach the Apache Jena Fuseki endpoint.") from err

    def is_available(self) -> bool:
        """Checks if the Fuseki SPARQL endpoint is ready and responsive."""
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.post(
                    self.endpoint_url,
                    data={"query": "ASK {}"},
                    headers=SPARQL_JSON_HEADER,
                )
            return res.status_code == 200
        except (httpx.HTTPError, OSError):
            return False
