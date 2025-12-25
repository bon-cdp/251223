"""
Rendering configuration models.

Defines output formats, color schemes, and render settings.
Configuration is independent of renderer implementation (Dependency Inversion).
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class OutputFormat(str, Enum):
    """Supported output formats for rendering."""

    PNG = "png"
    SVG = "svg"
    PDF = "pdf"


class ColorScheme(BaseModel):
    """Color mapping for space types.

    Maps space type strings to hex color codes.
    Extensible: add new space types without code changes.
    """

    # Core space types
    dwelling_unit: str = "#4CAF50"  # Green
    retail: str = "#9C27B0"  # Purple
    circulation: str = "#FFC107"  # Amber
    support: str = "#2196F3"  # Blue
    staff: str = "#00BCD4"  # Cyan
    amenity_indoor: str = "#E91E63"  # Pink
    amenity_outdoor: str = "#8BC34A"  # Light green
    parking: str = "#607D8B"  # Blue grey

    # MEP types
    low_voltage: str = "#FF5722"  # Deep orange
    dry_utilities: str = "#795548"  # Brown
    electrical: str = "#FF9800"  # Orange
    mechanical: str = "#9E9E9E"  # Grey
    plumbing: str = "#03A9F4"  # Light blue
    fire_sprinkler: str = "#F44336"  # Red

    # Default fallback
    default: str = "#999999"  # Grey

    def get_color(self, space_type: str) -> str:
        """
        Get color for a space type.

        Args:
            space_type: Space type string from schema

        Returns:
            Hex color code
        """
        # Normalize to lowercase and replace spaces with underscores
        normalized = space_type.lower().replace(" ", "_")
        return getattr(self, normalized, self.default)


class RenderConfig(BaseModel):
    """Complete rendering configuration.

    Single Responsibility: only concerns rendering parameters.
    Reusable across different renderer implementations.
    """

    output_format: OutputFormat = OutputFormat.PNG
    scale: float = Field(default=3.0, gt=0, description="Pixels per foot")
    show_labels: bool = Field(default=True, description="Show space name labels")
    margin: float = Field(
        default=20.0, ge=0, description="Margin around plot in pixels"
    )
    dpi: int = Field(default=150, gt=0, description="Output DPI for raster formats")
    figsize: tuple[float, float] = Field(
        default=(10.0, 10.0), description="Figure size in inches (width, height)"
    )
    color_scheme: ColorScheme = Field(default_factory=ColorScheme)

    # Visual styling
    boundary_color: str = "#333333"
    boundary_linewidth: float = 2.0
    space_linewidth: float = 1.0
    space_alpha: float = 0.9
    vertical_linestyle: Literal["solid", "dashed", "dotted"] = "dashed"

    # Label styling
    label_fontsize: int = Field(default=8, gt=0)
    label_color: str = "#333333"
    title_fontsize: int = Field(default=14, gt=0)
