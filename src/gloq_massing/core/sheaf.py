"""
Sheaf-theoretic structures for building massing.

The building is modeled as a sheaf over discrete floor indices:
- Each floor is a "patch" (local section) with spaces to place
- Vertical elements (elevators, stairs) create "stalks" that pierce through floors
- Gluing constraints ensure vertical alignment across floors

Key concepts from sheaf theory:
- Sections: Assignments of data (room positions) to open sets (floors)
- Restriction maps: How data on one floor relates to adjacent floors
- Gluing: Combining local solutions into a global solution
- Cohomology: Obstruction to gluing (should be zero for valid solutions)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set
from enum import Enum, auto

from .geometry import Point, Rectangle, Polygon
from .building import (
    SpaceSpec, BuildingSpec, SpaceCategory, FloorType,
    FloorAssignment, CirculationSpec, create_circulation_spaces
)


@dataclass
class Space:
    """
    A concrete space instance to be placed on a floor.

    Created from SpaceSpec template with assigned floor and solution variables.
    Supports fuzzy scaling where actual dimensions may differ from spec.
    """
    id: str
    spec: SpaceSpec
    floor_index: int

    # Solution variables (solved by the algorithm)
    position: Optional[Point] = None
    rotation: int = 0  # 0, 90, 180, 270

    # Fuzzy scaling - actual vs target dimensions
    actual_width: Optional[float] = None   # Scaled width (None = use spec)
    actual_height: Optional[float] = None  # Scaled height (None = use spec)
    membership: float = 1.0                # Area membership score [0, 1]

    # Placement metadata
    is_fixed: bool = False  # True if position is predetermined
    placement_priority: int = 0  # Higher = place first

    def __post_init__(self):
        # Vertical elements have higher priority
        if self.spec.is_vertical:
            self.placement_priority = 100

    @property
    def is_placed(self) -> bool:
        return self.position is not None

    @property
    def target_width(self) -> float:
        """Original target width from spec."""
        return self.spec.width_ft

    @property
    def target_height(self) -> float:
        """Original target height from spec."""
        return self.spec.height_ft

    @property
    def width(self) -> float:
        """Effective width considering rotation and fuzzy scaling."""
        w = self.actual_width if self.actual_width is not None else self.spec.width_ft
        h = self.actual_height if self.actual_height is not None else self.spec.height_ft
        if self.rotation in [90, 270]:
            return h
        return w

    @property
    def height(self) -> float:
        """Effective height considering rotation and fuzzy scaling."""
        w = self.actual_width if self.actual_width is not None else self.spec.width_ft
        h = self.actual_height if self.actual_height is not None else self.spec.height_ft
        if self.rotation in [90, 270]:
            return w
        return h

    @property
    def actual_area(self) -> float:
        """Actual area after fuzzy scaling."""
        return self.width * self.height

    @property
    def area_deviation(self) -> float:
        """Percentage deviation from target area."""
        target = self.spec.area_sf
        if target <= 0:
            return 0.0
        return (self.actual_area - target) / target

    def set_fuzzy_dimensions(self, width: float, height: float, membership: float) -> None:
        """Set fuzzy-scaled dimensions."""
        self.actual_width = width
        self.actual_height = height
        self.membership = membership

    @property
    def geometry(self) -> Rectangle:
        """Get rectangle geometry (raises if not placed)."""
        if self.position is None:
            raise ValueError(f"Space {self.id} has no position assigned")
        # Use actual dimensions if set, otherwise spec dimensions
        w = self.actual_width if self.actual_width is not None else self.spec.width_ft
        h = self.actual_height if self.actual_height is not None else self.spec.height_ft
        return Rectangle(
            self.position.x, self.position.y,
            w, h,
            self.rotation
        )

    def try_geometry(self) -> Optional[Rectangle]:
        """Get rectangle geometry or None if not placed."""
        if self.position is None:
            return None
        return self.geometry

    def place(self, x: float, y: float, rotation: int = 0) -> Space:
        """Place this space at given position."""
        self.position = Point(x, y)
        self.rotation = rotation % 360
        return self

    def unplace(self) -> Space:
        """Remove placement."""
        self.position = None
        self.rotation = 0
        return self

    def to_dict(self) -> dict:
        """Serialize for JSON output."""
        return {
            "id": self.id,
            "type": self.spec.category.name,
            "name": self.spec.name,
            "floor_index": self.floor_index,
            "geometry": self.geometry.to_dict() if self.is_placed else None,
            "target_area_sf": self.spec.area_sf,
            "actual_area_sf": self.actual_area if self.is_placed else None,
            "membership": self.membership,
            "area_deviation": f"{self.area_deviation:+.1%}" if self.is_placed else None,
            "is_vertical": self.spec.is_vertical,
        }


@dataclass
class FloorPatch:
    """
    Local section of the sheaf - represents one floor.

    In sheaf terms, this is an open set U_i with assigned data (space positions).
    The "stalk" at each point contains the constraint information.
    """
    index: int
    floor_type: FloorType
    domain: Polygon  # Floor plate boundary

    # Spaces assigned to this floor
    spaces: List[Space] = field(default_factory=list)

    # Local constraints (within this floor only)
    # These are computed, not stored directly

    def __post_init__(self):
        self.spaces = list(self.spaces)

    @property
    def area(self) -> float:
        return self.domain.area()

    @property
    def placed_spaces(self) -> List[Space]:
        return [s for s in self.spaces if s.is_placed]

    @property
    def unplaced_spaces(self) -> List[Space]:
        return [s for s in self.spaces if not s.is_placed]

    @property
    def total_space_area(self) -> float:
        return sum(s.spec.area_sf for s in self.spaces)

    @property
    def placed_area(self) -> float:
        return sum(s.spec.area_sf for s in self.placed_spaces)

    @property
    def fill_ratio(self) -> float:
        """Ratio of placed space area to floor area."""
        return self.placed_area / self.area if self.area > 0 else 0

    def add_space(self, space: Space) -> None:
        """Add a space to this floor."""
        space.floor_index = self.index
        self.spaces.append(space)

    def remove_space(self, space_id: str) -> Optional[Space]:
        """Remove and return a space by ID."""
        for i, s in enumerate(self.spaces):
            if s.id == space_id:
                return self.spaces.pop(i)
        return None

    def get_space(self, space_id: str) -> Optional[Space]:
        """Get space by ID."""
        for s in self.spaces:
            if s.id == space_id:
                return s
        return None

    def get_spaces_by_category(self, category: SpaceCategory) -> List[Space]:
        """Get all spaces of a given category."""
        return [s for s in self.spaces if s.spec.category == category]

    def get_vertical_spaces(self) -> List[Space]:
        """Get spaces that are part of vertical elements."""
        return [s for s in self.spaces if s.spec.is_vertical]

    def check_overlap(self, space: Space) -> List[Space]:
        """Return list of placed spaces that overlap with given space."""
        if not space.is_placed:
            return []
        overlaps = []
        space_geom = space.geometry
        for other in self.placed_spaces:
            if other.id != space.id and other.geometry.intersects(space_geom):
                overlaps.append(other)
        return overlaps

    def check_boundary(self, space: Space) -> bool:
        """Check if space is fully within floor boundary."""
        if not space.is_placed:
            return False
        return self.domain.contains_rectangle(space.geometry)

    def to_dict(self) -> dict:
        """Serialize for JSON output."""
        return {
            "floor_index": self.index,
            "floor_type": self.floor_type.name,
            "boundary": self.domain.to_list(),
            "area_sf": self.area,
            "spaces": [s.to_dict() for s in self.spaces if s.is_placed],
        }


@dataclass
class VerticalStalk:
    """
    Vertical element spanning multiple floors.

    In sheaf terms, this creates a "stalk" that pierces through multiple patches,
    with restriction maps enforcing alignment.

    The position is shared across all floors - this is the "gluing" constraint.
    """
    id: str
    element_type: str  # 'elevator_passenger', 'elevator_freight', 'stair', 'shaft'
    spec: SpaceSpec
    floor_range: Tuple[int, int]  # (start_floor, end_floor) inclusive

    # Shared position across all floors (the gluing data)
    position: Optional[Point] = None
    rotation: int = 0

    @property
    def is_placed(self) -> bool:
        return self.position is not None

    @property
    def num_floors(self) -> int:
        return self.floor_range[1] - self.floor_range[0] + 1

    @property
    def floors(self) -> List[int]:
        """List of floor indices this stalk spans."""
        return list(range(self.floor_range[0], self.floor_range[1] + 1))

    def place(self, x: float, y: float, rotation: int = 0) -> VerticalStalk:
        """Place the stalk (sets position for all floors)."""
        self.position = Point(x, y)
        self.rotation = rotation
        return self

    def get_geometry(self) -> Optional[Rectangle]:
        """Get rectangle geometry."""
        if self.position is None:
            return None
        return Rectangle(
            self.position.x, self.position.y,
            self.spec.width_ft, self.spec.height_ft,
            self.rotation
        )


@dataclass
class Sheaf:
    """
    The building sheaf - collection of floor patches with gluing data.

    Mathematical structure:
    - Base space: X = {F_-k, ..., F_0, ..., F_n} (discrete set of floors)
    - Stalk at F_i: Space configurations for floor i
    - Sections: Consistent assignments of positions to all spaces
    - Restriction maps: Vertical stalks define how floors relate

    A valid solution is a "global section" - positions for all spaces
    such that all local constraints are satisfied AND gluing constraints
    (vertical alignment) are satisfied.
    """
    # Floor patches (indexed by floor number)
    patches: Dict[int, FloorPatch] = field(default_factory=dict)

    # Vertical stalks (create gluing constraints)
    stalks: List[VerticalStalk] = field(default_factory=list)

    # Building spec reference
    building: Optional[BuildingSpec] = None

    @property
    def floor_indices(self) -> List[int]:
        return sorted(self.patches.keys())

    @property
    def num_floors(self) -> int:
        return len(self.patches)

    @property
    def min_floor(self) -> int:
        return min(self.patches.keys()) if self.patches else 0

    @property
    def max_floor(self) -> int:
        return max(self.patches.keys()) if self.patches else 0

    def add_patch(self, patch: FloorPatch) -> None:
        """Add a floor patch."""
        self.patches[patch.index] = patch

    def get_patch(self, floor_index: int) -> Optional[FloorPatch]:
        """Get patch by floor index."""
        return self.patches.get(floor_index)

    def add_stalk(self, stalk: VerticalStalk) -> None:
        """Add a vertical stalk."""
        self.stalks.append(stalk)

    def get_all_spaces(self) -> List[Space]:
        """Return all spaces across all floors."""
        spaces = []
        for patch in self.patches.values():
            spaces.extend(patch.spaces)
        return spaces

    def get_stalk_spaces(self) -> List[Space]:
        """Get all spaces that belong to vertical stalks."""
        stalk_ids = {s.id for s in self.stalks}
        spaces = []
        for patch in self.patches.values():
            for space in patch.spaces:
                if any(space.id.startswith(sid) for sid in stalk_ids):
                    spaces.append(space)
        return spaces

    def propagate_stalk_positions(self) -> None:
        """
        Propagate stalk positions to their corresponding spaces on each floor.

        This implements the "restriction map" - when a stalk is placed,
        all its floor instances get the same position.
        """
        for stalk in self.stalks:
            if not stalk.is_placed:
                continue

            for floor_idx in stalk.floors:
                patch = self.get_patch(floor_idx)
                if patch is None:
                    continue

                # Find the space on this floor that corresponds to this stalk
                for space in patch.spaces:
                    if space.id == f"{stalk.id}_f{floor_idx}" or space.id == stalk.id:
                        space.place(stalk.position.x, stalk.position.y, stalk.rotation)

    def compute_cohomology(self) -> float:
        """
        Compute the cohomological obstruction.

        Returns 0 if all constraints are satisfied (valid global section).
        Returns > 0 indicating degree of constraint violation.

        In practice, this sums:
        1. Boundary violations (spaces outside floor plate)
        2. Overlap violations
        3. Vertical alignment violations (stalks not aligned)
        4. Adjacency violations (units not connected to corridors)
        """
        obstruction = 0.0

        for patch in self.patches.values():
            # Check boundary constraints
            for space in patch.placed_spaces:
                if not patch.check_boundary(space):
                    # Measure how much is outside
                    geom = space.geometry
                    bbox = patch.domain.bounding_box()
                    overflow = 0.0
                    if geom.left < bbox.left:
                        overflow += bbox.left - geom.left
                    if geom.right > bbox.right:
                        overflow += geom.right - bbox.right
                    if geom.bottom < bbox.bottom:
                        overflow += bbox.bottom - geom.bottom
                    if geom.top > bbox.top:
                        overflow += geom.top - bbox.top
                    obstruction += overflow

            # Check overlap constraints
            for i, s1 in enumerate(patch.placed_spaces):
                for s2 in patch.placed_spaces[i+1:]:
                    overlap_area = s1.geometry.intersection_area(s2.geometry)
                    if overlap_area > 0:
                        obstruction += overlap_area

        # Check vertical alignment (stalk consistency)
        for stalk in self.stalks:
            if not stalk.is_placed:
                continue

            positions = []
            for floor_idx in stalk.floors:
                patch = self.get_patch(floor_idx)
                if patch is None:
                    continue
                for space in patch.spaces:
                    if space.id.startswith(stalk.id) and space.is_placed:
                        positions.append(space.position)

            # All positions should be identical
            if len(positions) > 1:
                ref = positions[0]
                for pos in positions[1:]:
                    obstruction += abs(pos.x - ref.x) + abs(pos.y - ref.y)

        return obstruction

    def to_dict(self) -> dict:
        """Serialize for JSON output."""
        return {
            "floors": [self.patches[i].to_dict() for i in self.floor_indices],
            "stalks": [
                {
                    "id": s.id,
                    "type": s.element_type,
                    "floor_range": list(s.floor_range),
                    "position": {"x": s.position.x, "y": s.position.y} if s.position else None,
                }
                for s in self.stalks
            ],
            "metrics": {
                "total_floors": self.num_floors,
                "total_spaces": len(self.get_all_spaces()),
                "cohomology_obstruction": self.compute_cohomology(),
            }
        }


def construct_sheaf(building: BuildingSpec, lot_geometry: Polygon) -> Sheaf:
    """
    Construct the building sheaf from a BuildingSpec.

    This creates:
    1. Floor patches for each floor
    2. Space instances assigned to appropriate floors
    3. Vertical stalks for elevators, stairs, shafts
    """
    sheaf = Sheaf(building=building)

    # Determine floor range
    start_floor = -building.stories_below_grade
    end_floor = building.stories_above_grade - 1

    # Create floor patches
    for floor_idx in range(start_floor, end_floor + 1):
        floor_type = building.get_floor_type(floor_idx)

        # Floor plate (use lot geometry scaled to floor plate area)
        # For MVP, use rectangular floor plate
        fp_side = building.floor_plate_width
        floor_domain = Polygon.rectangle(fp_side, fp_side)

        patch = FloorPatch(
            index=floor_idx,
            floor_type=floor_type,
            domain=floor_domain,
        )
        sheaf.add_patch(patch)

    # Create circulation spaces (including vertical stalks)
    circ_spaces = create_circulation_spaces(building.circulation)

    for spec in circ_spaces:
        if spec.is_vertical:
            # Create a vertical stalk
            stalk = VerticalStalk(
                id=spec.id,
                element_type=spec.id.split('_')[0],  # elevator, stair, etc.
                spec=spec,
                floor_range=(start_floor, end_floor),
            )
            sheaf.add_stalk(stalk)

            # Also create space instances on each floor
            for floor_idx in range(start_floor, end_floor + 1):
                space = Space(
                    id=f"{spec.id}_f{floor_idx}",
                    spec=spec,
                    floor_index=floor_idx,
                    placement_priority=100,  # Place vertical elements first
                )
                sheaf.get_patch(floor_idx).add_space(space)
        else:
            # Non-vertical circulation (lobby, etc.) - assign to appropriate floors
            assign_space_to_floors(sheaf, spec, building)

    # Assign dwelling units to residential floors
    unit_counter = {}
    residential_floors = [
        i for i in sheaf.floor_indices
        if sheaf.get_patch(i).floor_type == FloorType.RESIDENTIAL_TYPICAL
    ]

    if residential_floors:
        units_per_floor = building.units_per_floor or 20

        for unit_spec in building.dwelling_units:
            unit_type = unit_spec.dwelling_type.value
            if unit_type not in unit_counter:
                unit_counter[unit_type] = 0

            # Distribute units across residential floors
            for _ in range(unit_spec.count):
                unit_counter[unit_type] += 1
                floor_idx = residential_floors[
                    (unit_counter[unit_type] - 1) % len(residential_floors)
                ]

                space = Space(
                    id=f"unit_{unit_type}_{unit_counter[unit_type]}",
                    spec=unit_spec,
                    floor_index=floor_idx,
                    placement_priority=10,
                )
                sheaf.get_patch(floor_idx).add_space(space)

    # Assign support spaces
    for spec in building.support_spaces:
        assign_space_to_floors(sheaf, spec, building)

    # Assign staff spaces (typically ground floor)
    for spec in building.staff_spaces:
        assign_space_to_floors(sheaf, spec, building)

    # Assign amenities
    for spec in building.amenity_indoor:
        assign_space_to_floors(sheaf, spec, building)

    # Assign MEP spaces
    for spec in building.mep_spaces:
        assign_space_to_floors(sheaf, spec, building)

    return sheaf


def assign_space_to_floors(sheaf: Sheaf, spec: SpaceSpec, building: BuildingSpec) -> None:
    """Assign a space spec to appropriate floor(s) based on floor_assignment."""
    floors = []

    if spec.floor_assignment == FloorAssignment.GROUND:
        floors = [0]
    elif spec.floor_assignment == FloorAssignment.BASEMENT:
        floors = [i for i in sheaf.floor_indices if i < 0]
    elif spec.floor_assignment == FloorAssignment.TYPICAL:
        floors = [
            i for i in sheaf.floor_indices
            if sheaf.get_patch(i).floor_type == FloorType.RESIDENTIAL_TYPICAL
        ]
    elif spec.floor_assignment == FloorAssignment.ALL:
        floors = sheaf.floor_indices
    elif spec.floor_assignment == FloorAssignment.ALL_RESIDENTIAL:
        floors = [
            i for i in sheaf.floor_indices
            if sheaf.get_patch(i).floor_type in [
                FloorType.RESIDENTIAL_TYPICAL, FloorType.GROUND, FloorType.PODIUM
            ]
        ]
    elif spec.floor_assignment == FloorAssignment.ROOF:
        floors = [sheaf.max_floor]
    elif spec.floor_assignment == FloorAssignment.PODIUM:
        floors = [
            i for i in sheaf.floor_indices
            if sheaf.get_patch(i).floor_type == FloorType.PODIUM
        ]

    if not floors:
        floors = [0]  # Default to ground

    # Create space instances
    for i, floor_idx in enumerate(floors):
        patch = sheaf.get_patch(floor_idx)
        if patch is None:
            continue

        space_id = f"{spec.id}_f{floor_idx}" if len(floors) > 1 else spec.id
        for j in range(spec.count):
            instance_id = f"{space_id}_{j+1}" if spec.count > 1 else space_id
            space = Space(
                id=instance_id,
                spec=spec,
                floor_index=floor_idx,
                placement_priority=5 if spec.category == SpaceCategory.SUPPORT else 1,
            )
            patch.add_space(space)
