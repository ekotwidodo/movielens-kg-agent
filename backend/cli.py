"""CLI commands for MovieLens dataset validation and Knowledge Graph construction."""

import argparse
import sys
from pathlib import Path

from backend.dataset import DatasetLoader
from backend.kg_builder import KnowledgeGraphBuilder


def validate_dataset_cli() -> int:
    """CLI tool: mlkg-validate-dataset --source datasets/ml-latest-small"""
    parser = argparse.ArgumentParser(description="Validate MovieLens CSV dataset files.")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("datasets/ml-latest-small"),
        help="Path to dataset directory",
    )
    parser.add_argument(
        "--strict", action="store_true", help="Fail immediately on any malformed record"
    )

    args = parser.parse_args()

    if not args.source.exists() or not args.source.is_dir():
        print(f"Error: Directory '{args.source}' does not exist.", file=sys.stderr)
        return 1

    print(f"Validating MovieLens dataset at '{args.source}'...")
    try:
        loader = DatasetLoader()
        dataset = loader.load_from_directory(args.source, strict=args.strict)
        print("Validation Successful:")
        print(f"  - Movies:  {len(dataset.movies):,}")
        print(f"  - Ratings: {len(dataset.ratings):,}")
        print(f"  - Tags:    {len(dataset.tags):,}")
        print(f"  - Genres:  {len(dataset.genre_names):,}")
        print(f"  - Users:   {len(dataset.user_ids):,}")
        return 0
    except (ValueError, FileNotFoundError, OSError) as err:
        print(f"Validation Failed: {err}", file=sys.stderr)
        return 1


def build_graph_cli() -> int:
    """CLI tool: mlkg-build-graph --source ... --output ..."""
    parser = argparse.ArgumentParser(
        description="Build MovieLens RDF Knowledge Graph from CSV files."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("datasets/ml-latest-small"),
        help="Path to CSV dataset directory",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/movielens.ttl"),
        help="Target Turtle output file",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("data/reports/import-report.json"),
        help="Target report JSON file",
    )
    parser.add_argument(
        "--namespace",
        type=str,
        default="https://example.org/movielens/",
        help="Base RDF namespace",
    )

    args = parser.parse_args()

    try:
        print(f"Step 1/3: Loading dataset from '{args.source}'...")
        loader = DatasetLoader()
        dataset = loader.load_from_directory(args.source)

        print(
            "Step 2/3: Transforming into RDF Knowledge Graph triples "
            f"(namespace: {args.namespace})..."
        )
        builder = KnowledgeGraphBuilder(args.namespace)
        graph = builder.build_graph(dataset)

        print(f"Step 3/3: Serializing Turtle format to '{args.output}'...")
        stats = builder.export_turtle(graph, args.output, args.report, dataset=dataset)

        print(f"Done! Built knowledge graph with {stats['triple_count']:,} triples.")
        return 0
    except (ValueError, FileNotFoundError, OSError) as err:
        print(f"Build Failed: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(validate_dataset_cli())
