"""SPARQL query validator ensuring read-only safety, syntax, and LIMIT policy."""

import re

from pyparsing import ParseException
from rdflib.plugins.sparql.parser import parseQuery

from backend.models import ValidatedQuery

# Disallowed SPARQL keywords that modify data or escape sandbox boundaries
_FORBIDDEN_KEYWORDS = (
    "INSERT",
    "DELETE",
    "LOAD",
    "CLEAR",
    "CREATE",
    "DROP",
    "COPY",
    "MOVE",
    "ADD",
    "SERVICE",  # Prevent external network calls / federation attacks
    "FROM NAMED",  # Prevent arbitrary dataset targeting
)

_LIMIT_REGEX = re.compile(r"\bLIMIT\s+(\d+)\b", re.IGNORECASE)


class QueryValidationError(ValueError):
    """Raised when a generated SPARQL query violates security or safety policy."""

    pass


class SparqlValidator:
    """Validates and enforces limits on SPARQL queries before execution."""

    def __init__(self, default_limit: int = 50, max_limit: int = 500) -> None:
        self.default_limit = default_limit
        self.max_limit = max_limit

    def validate(self, sparql: str) -> ValidatedQuery:
        """Sanitizes, checks syntax, and enforces LIMIT policies."""
        clean_text = sparql.strip()
        if not clean_text:
            raise QueryValidationError("Empty SPARQL query cannot be executed.")

        # 1. Enforce read-only constraint and block forbidden keywords
        upper = clean_text.upper()
        for keyword in _FORBIDDEN_KEYWORDS:
            pattern = rf"\b{keyword}\b"
            if re.search(pattern, upper):
                raise QueryValidationError(f"Forbidden SPARQL keyword '{keyword}' detected.")

        # Ensure query is a SELECT query (or ASK)
        is_select = upper.startswith("SELECT") or upper.startswith("PREFIX")
        if not (is_select or upper.startswith("ASK")):
            raise QueryValidationError("Only SELECT or ASK queries are permitted.")

        # 2. Check and enforce LIMIT
        match = _LIMIT_REGEX.search(clean_text)
        if match:
            requested_limit = int(match.group(1))
            if requested_limit <= 0:
                raise QueryValidationError("Query LIMIT must be greater than zero.")
            if requested_limit > self.max_limit:
                clean_text = _LIMIT_REGEX.sub(f"LIMIT {self.max_limit}", clean_text)
                final_limit = self.max_limit
            else:
                final_limit = requested_limit
        else:
            clean_text = f"{clean_text}\nLIMIT {self.default_limit}"
            final_limit = self.default_limit

        # 3. Validate syntax using rdflib SPARQL parser
        try:
            parseQuery(clean_text)
        except ParseException as err:
            raise QueryValidationError(f"SPARQL syntax error: {err}") from err

        return ValidatedQuery(text=clean_text, limit=final_limit)
