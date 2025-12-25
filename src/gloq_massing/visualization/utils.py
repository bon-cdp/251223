"""
Utility functions for visualization module.

Single Responsibility: I/O operations for loading solver results.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..schemas import SolverResult


def load_solver_result(path: Path | str) -> SolverResult:
    """
    Load solver output JSON into typed SolverResult model.

    Args:
        path: Path to solver output JSON file

    Returns:
        Parsed and validated SolverResult

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If JSON is malformed
        pydantic.ValidationError: If data doesn't match schema
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Solver output file not found: {path}")

    data = json.loads(path.read_text())
    return SolverResult.model_validate(data)
