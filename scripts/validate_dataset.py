"""Validate the MovieLens CSV files. Same as the `mlkg-validate-dataset` command."""

import sys

from backend.cli import validate_dataset_cli

if __name__ == "__main__":
    sys.exit(validate_dataset_cli())
