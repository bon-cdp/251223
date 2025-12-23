"""
Constraint system for the sheaf-wreath solver.

Constraints are categorized as:
1. Local constraints (within a single floor patch):
   - Boundary: spaces must be inside floor plate
   - Non-overlap: spaces cannot intersect
   - Adjacency: certain spaces must touch (e.g., units to corridors)

2. Global constraints (across floor patches):
   - Vertical alignment: stalks must have same position on all floors

Each constraint can be:
- Evaluated: returns violation amount (0 = satisfied)
- Linearized: converted to Ax <= b form for MILP solving
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Set
import numpy as np

from .geometry import Point, Rectangle, Polygon
from .sheaf import Space, FloorPatch, VerticalStalk, Sheaf


class Constraint(ABC):
    """Abstract base class for constraints."""

    @abstractmethod
    def evaluate(self, spaces: Dict[str, Space]) -> float:
        """
        Evaluate constraint violation.

        Returns:
            0.0 if satisfied, positive value indicating violation magnitude.
        """
        pass

    @abstractmethod
    def get_involved_spaces(self) -> Set[str]:
        """Return IDs of spaces involved in this constraint."""
        pass


@dataclass
class BoundaryConstraint(Constraint):
    """
    Constraint: space must be fully inside floor boundary.

    For space with center (x, y) and half-dimensions (hw, hh):
        x - hw >= boundary.left
        x + hw <= boundary.right
        y - hh >= boundary.bottom
        y + hh <= boundary.top
    """
    space_id: str
    boundary: Polygon

    def evaluate(self, spaces: Dict[str, Space]) -> float:
        space = spaces.get(self.space_id)
        if space is None or not space.is_placed:
            return 0.0  # Can't evaluate unplaced space

        geom = space.geometry
        bbox = self.boundary.bounding_box()
        violation = 0.0

        # Check each edge
        if geom.left < bbox.left:
            violation += bbox.left - geom.left
        if geom.right > bbox.right:
            violation += geom.right - bbox.right
        if geom.bottom < bbox.bottom:
            violation += bbox.bottom - geom.bottom
        if geom.top > bbox.top:
            violation += geom.top - bbox.top

        return violation

    def get_involved_spaces(self) -> Set[str]:
        return {self.space_id}

    def to_linear_inequalities(self, var_index: Dict[str, int]
                               ) -> List[Tuple[np.ndarray, float]]:
        """
        Convert to linear inequalities Ax <= b.

        Variables: [x, y, ...] indexed by var_index
        Returns list of (A_row, b_value) tuples.
        """
        bbox = self.boundary.bounding_box()
        idx_x = var_index.get(f"{self.space_id}_x")
        idx_y = var_index.get(f"{self.space_id}_y")

        if idx_x is None or idx_y is None:
            return []

        n_vars = max(var_index.values()) + 1
        constraints = []

        # Get space dimensions (need spec reference)
        # For now, assume dimensions are passed separately or retrieved from space

        # x - hw >= left  =>  -x <= -left + hw  =>  -x <= b1
        # x + hw <= right  =>  x <= right - hw  =>  x <= b2
        # Similar for y

        # These would need space dimensions passed in
        # For placeholder, return empty - actual implementation would need space specs

        return constraints


@dataclass
class NonOverlapConstraint(Constraint):
    """
    Constraint: two spaces must not overlap.

    For two rectangles A and B with centers (x_a, y_a), (x_b, y_b)
    and half-dimensions (hw_a, hh_a), (hw_b, hh_b), at least one of:
        x_a + hw_a <= x_b - hw_b  (A left of B)
        x_b + hw_b <= x_a - hw_a  (B left of A)
        y_a + hh_a <= y_b - hh_b  (A below B)
        y_b + hh_b <= y_a - hh_a  (B below A)
    """
    space_a_id: str
    space_b_id: str

    def evaluate(self, spaces: Dict[str, Space]) -> float:
        space_a = spaces.get(self.space_a_id)
        space_b = spaces.get(self.space_b_id)

        if space_a is None or space_b is None:
            return 0.0
        if not space_a.is_placed or not space_b.is_placed:
            return 0.0

        geom_a = space_a.geometry
        geom_b = space_b.geometry

        # Calculate overlap
        overlap = geom_a.intersection_area(geom_b)
        return overlap

    def get_involved_spaces(self) -> Set[str]:
        return {self.space_a_id, self.space_b_id}


@dataclass
class AlignmentConstraint(Constraint):
    """
    Constraint: vertical stalk must have same position on all floors.

    For stalk with instances s_1, s_2, ..., s_n on floors:
        x_1 = x_2 = ... = x_n
        y_1 = y_2 = ... = y_n
    """
    stalk_id: str
    space_ids: List[str]  # Space IDs on each floor

    def evaluate(self, spaces: Dict[str, Space]) -> float:
        positions = []
        for space_id in self.space_ids:
            space = spaces.get(space_id)
            if space is not None and space.is_placed:
                positions.append(space.position)

        if len(positions) < 2:
            return 0.0

        # All positions should match the first
        ref = positions[0]
        violation = 0.0
        for pos in positions[1:]:
            violation += abs(pos.x - ref.x) + abs(pos.y - ref.y)

        return violation

    def get_involved_spaces(self) -> Set[str]:
        return set(self.space_ids)


@dataclass
class AdjacencyConstraint(Constraint):
    """
    Constraint: two spaces must share an edge (be adjacent).

    Used for:
    - Dwelling units must be adjacent to corridors (door access)
    - Elevators must be adjacent to lobbies

    Requires shared edge length >= min_contact (e.g., door width = 3 ft)
    """
    space_a_id: str
    space_b_id: str
    min_contact_ft: float = 3.0  # Minimum shared edge length (door width)

    def evaluate(self, spaces: Dict[str, Space]) -> float:
        space_a = spaces.get(self.space_a_id)
        space_b = spaces.get(self.space_b_id)

        if space_a is None or space_b is None:
            return self.min_contact_ft  # Full violation if space not found
        if not space_a.is_placed or not space_b.is_placed:
            return 0.0  # Can't evaluate unplaced spaces

        geom_a = space_a.geometry
        geom_b = space_b.geometry

        shared_length = geom_a.shared_edge_length(geom_b)
        if shared_length >= self.min_contact_ft:
            return 0.0

        # Violation is how much more contact is needed
        return self.min_contact_ft - shared_length

    def get_involved_spaces(self) -> Set[str]:
        return {self.space_a_id, self.space_b_id}


@dataclass
class MinimumDistanceConstraint(Constraint):
    """
    Constraint: two spaces must be at least min_distance apart.

    Used for:
    - Fire egress (stairs must be sufficiently separated)
    - Utility clearances
    """
    space_a_id: str
    space_b_id: str
    min_distance_ft: float

    def evaluate(self, spaces: Dict[str, Space]) -> float:
        space_a = spaces.get(self.space_a_id)
        space_b = spaces.get(self.space_b_id)

        if space_a is None or space_b is None:
            return 0.0
        if not space_a.is_placed or not space_b.is_placed:
            return 0.0

        # Distance between centers
        dist = space_a.position.distance_to(space_b.position)
        if dist >= self.min_distance_ft:
            return 0.0

        return self.min_distance_ft - dist

    def get_involved_spaces(self) -> Set[str]:
        return {self.space_a_id, self.space_b_id}


@dataclass
class ConstraintSet:
    """Collection of constraints with evaluation methods."""
    constraints: List[Constraint] = field(default_factory=list)

    def add(self, constraint: Constraint) -> None:
        self.constraints.append(constraint)

    def evaluate_all(self, spaces: Dict[str, Space]) -> Dict[str, float]:
        """
        Evaluate all constraints.

        Returns dict mapping constraint description to violation amount.
        """
        results = {}
        for i, c in enumerate(self.constraints):
            key = f"{c.__class__.__name__}_{i}"
            results[key] = c.evaluate(spaces)
        return results

    def total_violation(self, spaces: Dict[str, Space]) -> float:
        """Sum of all constraint violations."""
        return sum(c.evaluate(spaces) for c in self.constraints)

    def is_satisfied(self, spaces: Dict[str, Space], tolerance: float = 0.01) -> bool:
        """Check if all constraints are satisfied within tolerance."""
        return self.total_violation(spaces) < tolerance

    def get_violations(self, spaces: Dict[str, Space],
                       tolerance: float = 0.01) -> List[Tuple[Constraint, float]]:
        """Return list of violated constraints with their violation amounts."""
        violations = []
        for c in self.constraints:
            v = c.evaluate(spaces)
            if v > tolerance:
                violations.append((c, v))
        return violations


def build_floor_constraints(patch: FloorPatch) -> ConstraintSet:
    """Build all constraints for a single floor."""
    cs = ConstraintSet()

    # Boundary constraints for each space
    for space in patch.spaces:
        cs.add(BoundaryConstraint(
            space_id=space.id,
            boundary=patch.domain,
        ))

    # Non-overlap constraints for each pair of spaces
    for i, s1 in enumerate(patch.spaces):
        for s2 in patch.spaces[i+1:]:
            cs.add(NonOverlapConstraint(
                space_a_id=s1.id,
                space_b_id=s2.id,
            ))

    # Adjacency constraints: units need corridor access
    corridors = [s for s in patch.spaces
                 if s.spec.name.lower().startswith('corridor')]
    units = [s for s in patch.spaces
             if s.spec.category.name == 'DWELLING_UNIT']

    # For simplicity, each unit should be adjacent to at least one corridor
    # In practice, we'd create corridor segments first
    # For now, skip explicit adjacency constraints

    return cs


def build_sheaf_constraints(sheaf: Sheaf) -> ConstraintSet:
    """Build all constraints for the entire building sheaf."""
    cs = ConstraintSet()

    # Local constraints per floor
    for patch in sheaf.patches.values():
        floor_cs = build_floor_constraints(patch)
        for c in floor_cs.constraints:
            cs.add(c)

    # Global constraints: vertical alignment
    for stalk in sheaf.stalks:
        space_ids = []
        for floor_idx in stalk.floors:
            patch = sheaf.get_patch(floor_idx)
            if patch is None:
                continue
            for space in patch.spaces:
                if space.id.startswith(stalk.id):
                    space_ids.append(space.id)

        if len(space_ids) > 1:
            cs.add(AlignmentConstraint(
                stalk_id=stalk.id,
                space_ids=space_ids,
            ))

    # Stair separation constraint (fire egress)
    stair_stalks = [s for s in sheaf.stalks if 'stair' in s.element_type]
    if len(stair_stalks) >= 2:
        # Stairs should be at least 1/3 of floor diagonal apart
        # This is a building code requirement for egress
        if sheaf.building:
            floor_diag = sheaf.building.floor_plate_width * 1.414
            min_stair_dist = floor_diag / 3

            for i, s1 in enumerate(stair_stalks):
                for s2 in stair_stalks[i+1:]:
                    # Get any floor's spaces for these stalks
                    for patch in sheaf.patches.values():
                        s1_space = None
                        s2_space = None
                        for space in patch.spaces:
                            if space.id.startswith(s1.id):
                                s1_space = space
                            if space.id.startswith(s2.id):
                                s2_space = space
                        if s1_space and s2_space:
                            cs.add(MinimumDistanceConstraint(
                                space_a_id=s1_space.id,
                                space_b_id=s2_space.id,
                                min_distance_ft=min_stair_dist,
                            ))
                            break  # Only need one floor's constraint

    return cs
