"""Build the MovieLens RDF graph. Same as the `mlkg-build-graph` command."""

import sys

from backend.cli import build_graph_cli

if __name__ == "__main__":
    sys.exit(build_graph_cli())
