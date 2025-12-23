"""
2D Floor Plan Renderer

Renders floor layouts as SVG or matplotlib figures.
This is the starter code for Dev's visualization module.
"""

from __future__ import annotations
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import json

from ..core.geometry import Point, Rectangle, Polygon
from ..core.sheaf import FloorPatch, Space, Sheaf
from ..core.building import SpaceCategory


# Color scheme for space categories
CATEGORY_COLORS = {
    SpaceCategory.DWELLING_UNIT: "#4CAF50",      # Green
    SpaceCategory.RETAIL: "#9C27B0",              # Purple
    SpaceCategory.CIRCULATION: "#FFC107",         # Amber
    SpaceCategory.SUPPORT: "#2196F3",             # Blue
    SpaceCategory.STAFF: "#00BCD4",               # Cyan
    SpaceCategory.AMENITY_INDOOR: "#E91E63",      # Pink
    SpaceCategory.AMENITY_OUTDOOR: "#8BC34A",     # Light green
    SpaceCategory.PARKING: "#607D8B",             # Blue grey
    SpaceCategory.LOW_VOLTAGE: "#FF5722",         # Deep orange
    SpaceCategory.DRY_UTILITIES: "#795548",       # Brown
    SpaceCategory.ELECTRICAL: "#FF9800",          # Orange
    SpaceCategory.MECHANICAL: "#9E9E9E",          # Grey
    SpaceCategory.PLUMBING: "#03A9F4",            # Light blue
    SpaceCategory.FIRE_SPRINKLER: "#F44336",      # Red
}


def render_floor_svg(
    patch: FloorPatch,
    scale: float = 3.0,
    show_labels: bool = True,
    margin: float = 20
) -> str:
    """
    Render a floor layout as SVG string.

    Args:
        patch: FloorPatch with placed spaces
        scale: Pixels per foot
        show_labels: Whether to show space labels
        margin: Margin around the floor in pixels

    Returns:
        SVG string
    """
    bounds = patch.domain.bounding_box()
    width = bounds.effective_width * scale + margin * 2
    height = bounds.effective_height * scale + margin * 2

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}">',
        '<style>',
        '  .floor-boundary { fill: #f5f5f5; stroke: #333; stroke-width: 2; }',
        '  .space { stroke: #333; stroke-width: 1; opacity: 0.9; }',
        '  .space-label { font-family: Arial, sans-serif; font-size: 8px; fill: #333; }',
        '  .vertical { stroke-dasharray: 4,2; }',
        '</style>',
    ]

    # Transform function: floor coords to SVG coords
    def to_svg(x: float, y: float) -> Tuple[float, float]:
        sx = (x - bounds.left) * scale + margin
        sy = height - ((y - bounds.bottom) * scale + margin)  # Flip Y
        return sx, sy

    # Draw floor boundary
    boundary_points = []
    for v in patch.domain.vertices:
        sx, sy = to_svg(v.x, v.y)
        boundary_points.append(f"{sx:.1f},{sy:.1f}")
    svg_parts.append(f'<polygon class="floor-boundary" points="{" ".join(boundary_points)}" />')

    # Draw spaces
    for space in patch.placed_spaces:
        geom = space.geometry
        color = CATEGORY_COLORS.get(space.spec.category, "#999999")

        # Rectangle corners
        sx, sy = to_svg(geom.left, geom.top)
        w = geom.effective_width * scale
        h = geom.effective_height * scale

        extra_class = "vertical" if space.spec.is_vertical else ""
        svg_parts.append(
            f'<rect class="space {extra_class}" '
            f'x="{sx:.1f}" y="{sy:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'fill="{color}" />'
        )

        # Label
        if show_labels:
            label = space.spec.name[:15]  # Truncate long names
            cx, cy = to_svg(geom.x, geom.y)
            svg_parts.append(
                f'<text class="space-label" x="{cx:.1f}" y="{cy:.1f}" '
                f'text-anchor="middle" dominant-baseline="middle">{label}</text>'
            )

    # Floor label
    svg_parts.append(
        f'<text x="{margin}" y="{margin - 5}" font-family="Arial" font-size="14" font-weight="bold">'
        f'Floor {patch.index:+d} - {patch.floor_type.name}</text>'
    )

    svg_parts.append('</svg>')
    return '\n'.join(svg_parts)


def render_building_svg(
    sheaf: Sheaf,
    scale: float = 2.0,
    cols: int = 3
) -> str:
    """
    Render all floors as a grid of SVGs.

    Args:
        sheaf: Building sheaf with placed spaces
        scale: Pixels per foot
        cols: Number of columns in grid

    Returns:
        HTML string with SVGs
    """
    floors = [sheaf.get_patch(i) for i in sheaf.floor_indices]
    rows = (len(floors) + cols - 1) // cols

    # Estimate dimensions
    bounds = floors[0].domain.bounding_box() if floors else None
    if bounds:
        floor_width = bounds.effective_width * scale + 40
        floor_height = bounds.effective_height * scale + 60
    else:
        floor_width, floor_height = 400, 400

    html_parts = [
        '<!DOCTYPE html>',
        '<html><head><title>Building Massing</title>',
        '<style>',
        '  body { font-family: Arial, sans-serif; background: #eee; padding: 20px; }',
        '  .container { display: flex; flex-wrap: wrap; gap: 20px; }',
        '  .floor-card { background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }',
        '  .legend { margin-top: 20px; padding: 15px; background: white; border-radius: 8px; }',
        '  .legend-item { display: inline-block; margin-right: 15px; }',
        '  .legend-color { display: inline-block; width: 16px; height: 16px; margin-right: 5px; vertical-align: middle; }',
        '</style>',
        '</head><body>',
        '<h1>Building Massing - Floor Plans</h1>',
        '<div class="container">',
    ]

    for patch in reversed(floors):  # Top floor first
        svg = render_floor_svg(patch, scale=scale)
        html_parts.append(f'<div class="floor-card">{svg}</div>')

    html_parts.append('</div>')

    # Legend
    html_parts.append('<div class="legend"><strong>Legend:</strong>')
    for cat, color in CATEGORY_COLORS.items():
        html_parts.append(
            f'<div class="legend-item">'
            f'<span class="legend-color" style="background:{color}"></span>'
            f'{cat.name.replace("_", " ").title()}</div>'
        )
    html_parts.append('</div>')

    html_parts.append('</body></html>')
    return '\n'.join(html_parts)


def save_floor_svg(patch: FloorPatch, path: str | Path, **kwargs) -> None:
    """Save floor SVG to file."""
    svg = render_floor_svg(patch, **kwargs)
    Path(path).write_text(svg)


def save_building_html(sheaf: Sheaf, path: str | Path, **kwargs) -> None:
    """Save building HTML to file."""
    html = render_building_svg(sheaf, **kwargs)
    Path(path).write_text(html)


def render_to_matplotlib(patch: FloorPatch, ax=None, show_labels: bool = True):
    """
    Render floor to matplotlib axes.

    Requires matplotlib to be installed.
    """
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
    except ImportError:
        raise ImportError("matplotlib is required for this function")

    if ax is None:
        fig, ax = plt.subplots(figsize=(10, 10))
    else:
        fig = ax.figure

    bounds = patch.domain.bounding_box()

    # Draw boundary
    boundary_coords = [(v.x, v.y) for v in patch.domain.vertices]
    boundary_patch = mpatches.Polygon(boundary_coords, fill=True,
                                      facecolor='#f5f5f5', edgecolor='#333',
                                      linewidth=2)
    ax.add_patch(boundary_patch)

    # Draw spaces
    for space in patch.placed_spaces:
        geom = space.geometry
        color = CATEGORY_COLORS.get(space.spec.category, "#999999")

        rect = mpatches.Rectangle(
            (geom.left, geom.bottom),
            geom.effective_width, geom.effective_height,
            fill=True, facecolor=color, edgecolor='#333',
            linewidth=1, alpha=0.9,
            linestyle='--' if space.spec.is_vertical else '-'
        )
        ax.add_patch(rect)

        if show_labels:
            ax.text(geom.x, geom.y, space.spec.name[:12],
                   ha='center', va='center', fontsize=6)

    ax.set_xlim(bounds.left - 5, bounds.right + 5)
    ax.set_ylim(bounds.bottom - 5, bounds.top + 5)
    ax.set_aspect('equal')
    ax.set_title(f'Floor {patch.index:+d} - {patch.floor_type.name}')
    ax.grid(True, alpha=0.3)

    return fig, ax
