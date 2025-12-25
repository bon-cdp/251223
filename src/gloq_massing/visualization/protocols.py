"""
Renderer protocols - Abstract interfaces for extensibility.

Following Interface Segregation Principle: separate protocols for different
rendering responsibilities. New renderer types (HTML, PDF, Canvas) can implement
these protocols without modifying existing code (Open/Closed Principle).
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..schemas import FloorData, BuildingData


class FloorRenderer(Protocol):
    """Protocol for rendering a single floor plan.

    Implementations: MatplotlibFloorRenderer, HTMLFloorRenderer, etc.
    """

    def render_floor(self, floor: FloorData) -> None:
        """
        Render a single floor to the renderer's internal buffer.

        Args:
            floor: Floor data to render
        """
        ...

    def save(self, path: Path) -> None:
        """
        Save rendered output to file.

        Args:
            path: Output file path
        """
        ...


class BuildingRenderer(Protocol):
    """Protocol for rendering all floors of a building.

    Implementations: MatplotlibBuildingRenderer, HTMLBuildingRenderer, etc.
    """

    def render_building(self, building: BuildingData) -> None:
        """
        Render all floors of a building.

        Args:
            building: Complete building data
        """
        ...

    def save(self, path: Path) -> None:
        """
        Save rendered output to file.

        Args:
            path: Output file path
        """
        ...
