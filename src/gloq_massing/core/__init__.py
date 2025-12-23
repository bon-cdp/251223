"""Core solver modules - sheaf-wreath algebraic massing."""

from .geometry import Point, Rectangle, Polygon
from .building import SpaceCategory, FloorType, SpaceSpec, BuildingSpec
from .sheaf import Space, FloorPatch, VerticalStalk, Sheaf
from .solver import solve_massing, SolverResult

__all__ = [
    "Point", "Rectangle", "Polygon",
    "SpaceCategory", "FloorType", "SpaceSpec", "BuildingSpec",
    "Space", "FloorPatch", "VerticalStalk", "Sheaf",
    "solve_massing", "SolverResult",
]
