"""
Solver output schema types.

Pydantic v2 models representing the solver output JSON structure.
Composed from basic building blocks following Single Responsibility Principle.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# =============================================================================
# Basic Geometry Types (Building Blocks)
# =============================================================================


class Position(BaseModel):
    """2D position coordinates."""

    x: float
    y: float

    model_config = {"frozen": True}


class Geometry(BaseModel):
    """Rectangle geometry with position, dimensions, and rotation."""

    x: float
    y: float
    width: float
    height: float
    rotation: int = 0

    model_config = {"frozen": True}

    @property
    def left(self) -> float:
        """Left edge x-coordinate (center-based)."""
        return self.x - self.width / 2

    @property
    def right(self) -> float:
        """Right edge x-coordinate (center-based)."""
        return self.x + self.width / 2

    @property
    def bottom(self) -> float:
        """Bottom edge y-coordinate (center-based)."""
        return self.y - self.height / 2

    @property
    def top(self) -> float:
        """Top edge y-coordinate (center-based)."""
        return self.y + self.height / 2

    @property
    def area(self) -> float:
        """Compute area from dimensions."""
        return self.width * self.height


# =============================================================================
# Space and Floor Models
# =============================================================================


class SpaceData(BaseModel):
    """Individual space placed on a floor."""

    id: str
    type: str
    name: str
    floor_index: int
    geometry: Geometry
    target_area_sf: float
    actual_area_sf: float
    membership: float
    area_deviation: str
    is_vertical: bool

    @property
    def has_area_match(self) -> bool:
        """Check if actual area matches target exactly."""
        return self.membership >= 1.0

    @property
    def truncated_name(self) -> str:
        """Return truncated name for labels (max 15 chars)."""
        return self.name[:15] if len(self.name) > 15 else self.name


class FloorData(BaseModel):
    """Single floor with boundary and placed spaces."""

    floor_index: int
    floor_type: str
    boundary: list[list[float]]
    area_sf: float
    spaces: list[SpaceData]

    @property
    def space_count(self) -> int:
        """Number of spaces on this floor."""
        return len(self.spaces)

    @property
    def vertical_spaces(self) -> list[SpaceData]:
        """Filter to only vertical (stalk) spaces."""
        return [s for s in self.spaces if s.is_vertical]

    @property
    def non_vertical_spaces(self) -> list[SpaceData]:
        """Filter to non-vertical spaces."""
        return [s for s in self.spaces if not s.is_vertical]

    def get_boundary_bounds(self) -> tuple[float, float, float, float]:
        """Get min_x, min_y, max_x, max_y from boundary polygon."""
        if not self.boundary:
            return 0.0, 0.0, 0.0, 0.0

        xs = [p[0] for p in self.boundary]
        ys = [p[1] for p in self.boundary]
        return min(xs), min(ys), max(xs), max(ys)


# =============================================================================
# Vertical Stalks
# =============================================================================


class StalkData(BaseModel):
    """Vertical element spanning multiple floors."""

    id: str
    type: str
    floor_range: list[int]
    position: Position

    @property
    def min_floor(self) -> int:
        """Lowest floor this stalk spans."""
        return min(self.floor_range) if self.floor_range else 0

    @property
    def max_floor(self) -> int:
        """Highest floor this stalk spans."""
        return max(self.floor_range) if self.floor_range else 0

    @property
    def floor_count(self) -> int:
        """Number of floors this stalk spans."""
        return len(self.floor_range)


# =============================================================================
# Metrics Models
# =============================================================================


class SolverMetrics(BaseModel):
    """Top-level solver placement metrics."""

    placement_rate: str
    avg_membership: str
    total_spaces: int
    placed_spaces: int

    @property
    def placement_percentage(self) -> float:
        """Parse placement rate string to float."""
        return float(self.placement_rate.rstrip("%"))


class BuildingMetrics(BaseModel):
    """Building-level metrics."""

    total_floors: int
    total_spaces: int
    cohomology_obstruction: float


# =============================================================================
# Aggregate Models
# =============================================================================


class BuildingData(BaseModel):
    """Complete building with floors, stalks, and metrics."""

    floors: list[FloorData]
    stalks: list[StalkData]
    metrics: BuildingMetrics

    def get_floor(self, index: int) -> FloorData | None:
        """Get floor by index."""
        for floor in self.floors:
            if floor.floor_index == index:
                return floor
        return None

    @property
    def floor_indices(self) -> list[int]:
        """Get sorted list of floor indices."""
        return sorted(f.floor_index for f in self.floors)


class SolverResult(BaseModel):
    """Root model for solver output JSON - matches output_schema.json."""

    success: bool
    obstruction: float
    iterations: int
    message: str
    violations: list[str]
    metrics: SolverMetrics
    building: BuildingData

    @property
    def has_violations(self) -> bool:
        """Check if result has any violations."""
        return len(self.violations) > 0

    @property
    def is_complete_success(self) -> bool:
        """Check if fully successful with no obstruction."""
        return self.success and self.obstruction == 0.0
