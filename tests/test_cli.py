"""Tests for command-line interface tools."""

from pathlib import Path
from unittest.mock import patch

from backend.cli import build_graph_cli, validate_dataset_cli

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "movielens"


def test_validate_dataset_cli_success():
    with patch("sys.argv", ["mlkg-validate-dataset", "--source", str(FIXTURE_DIR)]):
        exit_code = validate_dataset_cli()
        assert exit_code == 0


def test_validate_dataset_cli_missing_source():
    with patch("sys.argv", ["mlkg-validate-dataset", "--source", "non_existent_folder"]):
        exit_code = validate_dataset_cli()
        assert exit_code == 1


def test_build_graph_cli_success(tmp_path: Path):
    output_file = tmp_path / "movielens.ttl"
    report_file = tmp_path / "report.json"
    args = [
        "mlkg-build-graph",
        "--source",
        str(FIXTURE_DIR),
        "--output",
        str(output_file),
        "--report",
        str(report_file),
    ]
    with patch("sys.argv", args):
        exit_code = build_graph_cli()
        assert exit_code == 0
        assert output_file.exists()
        assert report_file.exists()
