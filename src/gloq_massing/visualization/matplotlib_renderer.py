"""
Matplotlib-based renderer implementation.

Implements FloorRenderer and BuildingRenderer protocols using matplotlib.
Single Responsibility: only concerns matplotlib rendering logic.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.figure import Figure
from matplotlib.axes import Axes

from ..schemas import FloorData, BuildingData, SpaceData
from .config import RenderConfig


class MatplotlibFloorRenderer:
    """Renders a single floor plan using matplotlib.

    Implements FloorRenderer protocol.
    """

    def __init__(self, config: RenderConfig) -> None:
        """
        Initialize renderer with configuration.

        Args:
            config: Rendering configuration
        """
        self.config = config
        self._fig: Figure | None = None
        self._ax: Axes | None = None

    def render_floor(self, floor: FloorData) -> None:
        """Render floor plan to internal matplotlib figure."""
        self._fig, self._ax = plt.subplots(
            figsize=self.config.figsize, dpi=self.config.dpi
        )

        # Draw floor boundary
        self._draw_boundary(floor)

        # Draw spaces (non-vertical first, then vertical on top)
        for space in floor.non_vertical_spaces:
            self._draw_space(space, is_vertical=False)
        for space in floor.vertical_spaces:
            self._draw_space(space, is_vertical=True)

        # Configure axes
        self._configure_axes(floor)

    def save(self, path: Path) -> None:
        """Save rendered floor to file."""
        if self._fig is None:
            raise RuntimeError("No floor rendered yet. Call render_floor() first.")

        path.parent.mkdir(parents=True, exist_ok=True)
        self._fig.savefig(
            path,
            dpi=self.config.dpi,
            bbox_inches="tight",
            format=self.config.output_format.value,
        )
        plt.close(self._fig)

    def _draw_boundary(self, floor: FloorData) -> None:
        """Draw floor boundary polygon."""
        if not self._ax or not floor.boundary:
            return

        boundary_coords = [(p[0], p[1]) for p in floor.boundary]
        boundary_patch = mpatches.Polygon(
            boundary_coords,
            fill=True,
            facecolor="#f5f5f5",
            edgecolor=self.config.boundary_color,
            linewidth=self.config.boundary_linewidth,
        )
        self._ax.add_patch(boundary_patch)

    def _draw_space(self, space: SpaceData, is_vertical: bool) -> None:
        """Draw a single space rectangle."""
        if not self._ax:
            return

        geom = space.geometry
        color = self.config.color_scheme.get_color(space.type)

        # Determine linestyle based on vertical flag
        linestyle = self.config.vertical_linestyle if is_vertical else "solid"

        rect = mpatches.Rectangle(
            (geom.left, geom.bottom),
            geom.width,
            geom.height,
            fill=True,
            facecolor=color,
            edgecolor=self.config.boundary_color,
            linewidth=self.config.space_linewidth,
            alpha=self.config.space_alpha,
            linestyle=linestyle,
        )
        self._ax.add_patch(rect)

        # Add label if enabled
        if self.config.show_labels:
            self._ax.text(
                geom.x,
                geom.y,
                space.truncated_name,
                ha="center",
                va="center",
                fontsize=self.config.label_fontsize,
                color=self.config.label_color,
            )

    def _configure_axes(self, floor: FloorData) -> None:
        """Configure axes limits, aspect ratio, and title."""
        if not self._ax:
            return

        # Get bounds and add margin
        min_x, min_y, max_x, max_y = floor.get_boundary_bounds()
        margin_ft = self.config.margin / self.config.scale  # Convert px to feet

        self._ax.set_xlim(min_x - margin_ft, max_x + margin_ft)
        self._ax.set_ylim(min_y - margin_ft, max_y + margin_ft)
        self._ax.set_aspect("equal")

        # Title
        title = f"Floor {floor.floor_index:+d} - {floor.floor_type}"
        self._ax.set_title(
            title, fontsize=self.config.title_fontsize, fontweight="bold"
        )

        # Grid
        self._ax.grid(True, alpha=0.3)


class MatplotlibBuildingRenderer:
    """Renders all floors of a building as a grid using matplotlib.

    Implements BuildingRenderer protocol.
    """

    def __init__(self, config: RenderConfig, cols: int = 3) -> None:
        """
        Initialize building renderer.

        Args:
            config: Rendering configuration
            cols: Number of columns in grid layout
        """
        self.config = config
        self.cols = cols
        self._fig: Figure | None = None
        self._axes: list[Axes] = []

    def render_building(self, building: BuildingData) -> None:
        """Render all floors in a grid layout."""
        floors = sorted(building.floors, key=lambda f: f.floor_index, reverse=True)

        if not floors:
            return

        # Calculate grid dimensions
        rows = (len(floors) + self.cols - 1) // self.cols

        # Create figure with subplots
        self._fig, axes_array = plt.subplots(
            rows,
            self.cols,
            figsize=(self.config.figsize[0] * self.cols, self.config.figsize[1] * rows),
            dpi=self.config.dpi,
        )

        # Flatten axes array for easy iteration
        if rows == 1 and self.cols == 1:
            self._axes = [axes_array]
        elif rows == 1 or self.cols == 1:
            self._axes = list(axes_array)
        else:
            self._axes = [ax for row in axes_array for ax in row]

        # Render each floor
        for idx, floor in enumerate(floors):
            if idx < len(self._axes):
                self._render_floor_to_ax(floor, self._axes[idx])

        # Hide unused axes
        for idx in range(len(floors), len(self._axes)):
            self._axes[idx].axis("off")

        self._fig.tight_layout()

    def save(self, path: Path) -> None:
        """Save rendered building to file."""
        if self._fig is None:
            raise RuntimeError(
                "No building rendered yet. Call render_building() first."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        self._fig.savefig(
            path,
            dpi=self.config.dpi,
            bbox_inches="tight",
            format=self.config.output_format.value,
        )
        plt.close(self._fig)

    def _render_floor_to_ax(self, floor: FloorData, ax: Axes) -> None:
        """Render a single floor to a specific axes."""
        # Create a temporary floor renderer with shared config
        temp_renderer = MatplotlibFloorRenderer(self.config)
        temp_renderer._fig = self._fig
        temp_renderer._ax = ax

        # Draw floor components
        temp_renderer._draw_boundary(floor)
        for space in floor.non_vertical_spaces:
            temp_renderer._draw_space(space, is_vertical=False)
        for space in floor.vertical_spaces:
            temp_renderer._draw_space(space, is_vertical=True)
        temp_renderer._configure_axes(floor)
