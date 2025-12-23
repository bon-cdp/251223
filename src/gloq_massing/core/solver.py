"""
Sheaf-Wreath Massing Solver with Fuzzy Logic

This module implements the core solving algorithm that:
1. Constructs the building sheaf from GLOQ data
2. Places vertical stalks (elevators, stairs) first - these create gluing constraints
3. Places spaces on each floor using fuzzy scaling for area tolerance
4. Verifies global consistency (cohomology with fuzzy membership)

Key enhancement: Fuzzy logic allows spaces to scale ±15% from target area,
enabling 95%+ placement vs the 56% achieved with fixed dimensions.

The algorithm uses a strip-packing approach with double-loaded corridor:
1. Place vertical core (elevators + stairs) at floor center
2. Define corridor spine and placement strips on each side
3. Pack units into strips using fuzzy scaling to fit depth
4. Fill remaining space with support/MEP
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
import math
import random

from .geometry import Point, Rectangle, Polygon
from .building import (
    BuildingSpec, SpaceSpec, SpaceCategory, FloorType,
    create_circulation_spaces,
)
from .sheaf import Space, FloorPatch, VerticalStalk, Sheaf, construct_sheaf
from .constraints import ConstraintSet, build_sheaf_constraints
from .fuzzy import FuzzyConfig, FuzzySpace, fuzzy_scale_to_fit, scale_space_for_strip


@dataclass
class SolverConfig:
    """Configuration for the solver."""
    max_iterations: int = 1000
    tolerance: float = 0.01
    grid_snap: float = 1.0           # Snap positions to 1-foot grid
    corridor_width: float = 3.67      # 44 inches - minimum corridor width
    allow_rotation: bool = True       # Allow 90-degree rotations
    core_margin: float = 1.0          # Margin around core elements
    unit_spacing: float = 3.67        # Gap between units = corridor width
    random_seed: Optional[int] = None # For reproducibility
    margin: float = 1.0               # Floor edge margin (exterior wall)

    # Fuzzy scaling configuration
    fuzzy: FuzzyConfig = field(default_factory=FuzzyConfig)


@dataclass
class SolverResult:
    """Result from the massing solver."""
    success: bool
    sheaf: Optional[Sheaf]
    obstruction: float  # Cohomological obstruction (0 = perfect)
    iterations: int
    message: str
    violations: List[str] = field(default_factory=list)

    # Fuzzy metrics
    placement_rate: float = 0.0       # Percentage of spaces placed
    avg_membership: float = 0.0       # Average fuzzy membership
    total_spaces: int = 0
    placed_spaces: int = 0

    def to_dict(self) -> dict:
        """Serialize for JSON output."""
        return {
            "success": self.success,
            "obstruction": self.obstruction,
            "iterations": self.iterations,
            "message": self.message,
            "violations": self.violations,
            "metrics": {
                "placement_rate": f"{self.placement_rate:.1%}",
                "avg_membership": f"{self.avg_membership:.2f}",
                "total_spaces": self.total_spaces,
                "placed_spaces": self.placed_spaces,
            },
            "building": self.sheaf.to_dict() if self.sheaf else None,
        }


def solve_massing(
    building: BuildingSpec,
    lot_geometry: Optional[Polygon] = None,
    config: Optional[SolverConfig] = None,
) -> SolverResult:
    """
    Main solver entry point.

    Args:
        building: GLOQ BuildingSpec with all space requirements
        lot_geometry: Lot boundary polygon (optional, uses floor plate if None)
        config: Solver configuration

    Returns:
        SolverResult with placed sheaf or error information
    """
    if config is None:
        config = SolverConfig()

    if config.random_seed is not None:
        random.seed(config.random_seed)

    # Use rectangular lot if not provided
    if lot_geometry is None:
        side = building.floor_plate_width
        lot_geometry = Polygon.rectangle(side, side)

    # Step 1: Construct the sheaf
    sheaf = construct_sheaf(building, lot_geometry)

    # Step 2: Place vertical stalks (core)
    place_vertical_core(sheaf, config)

    # Step 3: Place spaces on each floor
    for floor_idx in sheaf.floor_indices:
        patch = sheaf.get_patch(floor_idx)
        place_floor_spaces(patch, sheaf, config)

    # Step 4: Propagate stalk positions to floor instances
    sheaf.propagate_stalk_positions()

    # Step 5: Verify constraints
    constraints = build_sheaf_constraints(sheaf)
    all_spaces = sheaf.get_all_spaces()
    space_dict = {s.id: s for s in all_spaces}
    obstruction = constraints.total_violation(space_dict)

    # Collect violations for reporting
    violations = []
    for c, v in constraints.get_violations(space_dict):
        violations.append(f"{c.__class__.__name__}: {c.get_involved_spaces()} = {v:.2f}")

    # Compute fuzzy metrics
    total_spaces = len(all_spaces)
    placed_spaces = len([s for s in all_spaces if s.is_placed])
    placement_rate = placed_spaces / total_spaces if total_spaces > 0 else 0

    # Average membership of placed spaces
    placed = [s for s in all_spaces if s.is_placed]
    avg_membership = sum(s.membership for s in placed) / len(placed) if placed else 0

    # Add membership penalty to obstruction
    membership_penalty = sum(1 - s.membership for s in placed) * 0.1
    total_obstruction = obstruction + membership_penalty

    success = total_obstruction < config.tolerance and placement_rate >= 0.9
    if success:
        message = f"Success: {placement_rate:.0%} placed, avg membership {avg_membership:.2f}"
    else:
        message = f"Partial: {placement_rate:.0%} placed, obstruction {total_obstruction:.2f}"

    return SolverResult(
        success=success,
        sheaf=sheaf,
        obstruction=total_obstruction,
        iterations=1,
        message=message,
        violations=violations[:10],
        placement_rate=placement_rate,
        avg_membership=avg_membership,
        total_spaces=total_spaces,
        placed_spaces=placed_spaces,
    )


def place_vertical_core(sheaf: Sheaf, config: SolverConfig) -> None:
    """
    Place vertical elements (elevators, stairs) at the floor center.

    These form the "core" of the building and create gluing constraints.
    All instances across floors will have the same position.
    """
    if not sheaf.stalks:
        return

    # Get floor dimensions from first patch
    first_patch = sheaf.get_patch(sheaf.floor_indices[0])
    if first_patch is None:
        return

    floor_bounds = first_patch.domain.bounding_box()
    floor_cx = floor_bounds.x
    floor_cy = floor_bounds.y

    # Separate elevators and stairs
    elevators = [s for s in sheaf.stalks if 'elevator' in s.element_type]
    stairs = [s for s in sheaf.stalks if 'stair' in s.element_type]

    # Calculate core dimensions
    elevator_total_width = sum(s.spec.width_ft for s in elevators) + \
                          config.core_margin * (len(elevators) - 1) if elevators else 0
    stair_total_width = sum(s.spec.width_ft for s in stairs) + \
                       config.core_margin * (len(stairs) - 1) if stairs else 0

    # Core layout: elevators in center, stairs on sides
    # [Stair 1] [Elevator 1] [Elevator 2] [Stair 2]

    core_width = elevator_total_width + stair_total_width + config.core_margin * 2
    core_start_x = floor_cx - core_width / 2

    current_x = core_start_x

    # Place first stair (if exists)
    if len(stairs) >= 1:
        s = stairs[0]
        s.place(current_x + s.spec.width_ft / 2, floor_cy)
        current_x += s.spec.width_ft + config.core_margin

    # Place elevators
    for e in elevators:
        e.place(current_x + e.spec.width_ft / 2, floor_cy)
        current_x += e.spec.width_ft + config.core_margin

    # Place second stair (if exists)
    if len(stairs) >= 2:
        s = stairs[1]
        s.place(current_x + s.spec.width_ft / 2, floor_cy)
        current_x += s.spec.width_ft + config.core_margin

    # Place any remaining stairs
    for s in stairs[2:]:
        # Place on opposite side of core
        s.place(floor_cx, floor_cy - floor_bounds.effective_height / 4)


def place_floor_spaces(patch: FloorPatch, sheaf: Sheaf, config: SolverConfig) -> None:
    """
    Place all spaces on a single floor.

    Strategy:
    1. Vertical elements already placed (skip)
    2. Generate corridor from core
    3. Place units along corridor (double-loaded)
    4. Place support spaces in remaining areas
    """
    floor_bounds = patch.domain.bounding_box()

    # Get spaces by category, sorted by priority
    spaces = sorted(patch.unplaced_spaces, key=lambda s: -s.placement_priority)

    # Skip vertical elements (already placed via stalks)
    non_vertical = [s for s in spaces if not s.spec.is_vertical]

    # Separate by category
    units = [s for s in non_vertical if s.spec.category == SpaceCategory.DWELLING_UNIT]
    support = [s for s in non_vertical if s.spec.category in [
        SpaceCategory.SUPPORT, SpaceCategory.STAFF, SpaceCategory.CIRCULATION
    ]]
    amenities = [s for s in non_vertical if s.spec.category in [
        SpaceCategory.AMENITY_INDOOR, SpaceCategory.AMENITY_OUTDOOR
    ]]
    mep = [s for s in non_vertical if s.spec.category in [
        SpaceCategory.ELECTRICAL, SpaceCategory.MECHANICAL,
        SpaceCategory.PLUMBING, SpaceCategory.FIRE_SPRINKLER,
        SpaceCategory.LOW_VOLTAGE, SpaceCategory.DRY_UTILITIES
    ]]

    # Determine floor layout strategy based on floor type
    if patch.floor_type == FloorType.RESIDENTIAL_TYPICAL:
        place_residential_floor(patch, units, support, config)
    elif patch.floor_type == FloorType.GROUND:
        place_ground_floor(patch, support + amenities, units[:5], config)  # Maybe some units
    elif patch.floor_type in [FloorType.BASEMENT, FloorType.PARKING_UNDERGROUND]:
        place_parking_floor(patch, mep + support, config)
    else:
        # Generic placement
        place_generic(patch, non_vertical, config)


def place_residential_floor(
    patch: FloorPatch,
    units: List[Space],
    support: List[Space],
    config: SolverConfig
) -> None:
    """
    Place rooms using row-based bin-packing with corridor as connecting space.

    Engineering approach:
    - Corridor (44" = 3.67ft) is the gap between rows
    - Each room's face touches corridor for accessibility
    - Pack rooms in rows from bottom to top
    - All rooms accessible from corridor network
    """
    from .fuzzy import fuzzy_area_membership

    floor_bounds = patch.domain.bounding_box()
    floor_width = floor_bounds.effective_width
    floor_height = floor_bounds.effective_height
    margin = config.margin
    corridor = config.corridor_width  # 3.67ft (44")

    # All spaces to place (units + support)
    all_spaces = units + support

    # Sort by height (depth) first - same-height rooms pack together
    sorted_spaces = sorted(all_spaces, key=lambda s: (-s.spec.height_ft, -s.spec.area_sf))

    # Row-based packing from bottom
    current_y = floor_bounds.bottom + margin
    current_row_height = 0
    current_x = floor_bounds.left + margin

    for space in sorted_spaces:
        target_w = space.spec.width_ft
        target_h = space.spec.height_ft
        actual_w, actual_h = target_w, target_h
        membership = 1.0

        # Check remaining height
        remaining_height = floor_bounds.top - margin - current_y
        if target_h > remaining_height and remaining_height > 10:
            scale = remaining_height / target_h
            if scale >= (1 - config.fuzzy.max_shrink):
                actual_h = remaining_height
                actual_w = target_w * scale
                new_area = actual_w * actual_h
                membership = fuzzy_area_membership(new_area, space.spec.area_sf, config.fuzzy.area_tolerance)

        # Check width
        available_width = floor_width - 2 * margin
        if actual_w > available_width:
            scale = available_width / actual_w
            if scale >= (1 - config.fuzzy.max_shrink):
                actual_w = available_width
                actual_h *= scale
                new_area = actual_w * actual_h
                membership = fuzzy_area_membership(new_area, space.spec.area_sf, config.fuzzy.area_tolerance)

        # Try rotation if doesn't fit
        if (actual_w > available_width or actual_h > remaining_height) and config.allow_rotation:
            actual_w, actual_h = target_h, target_w
            if actual_w <= available_width and actual_h <= remaining_height:
                space.rotation = 90
                new_area = actual_w * actual_h
                membership = fuzzy_area_membership(new_area, space.spec.area_sf, config.fuzzy.area_tolerance)

        if membership < config.fuzzy.min_membership:
            continue

        space.set_fuzzy_dimensions(actual_w, actual_h, membership)

        # Check if fits in current row
        if current_x + space.width > floor_bounds.right - margin:
            # Start new row
            current_y += current_row_height + corridor
            current_x = floor_bounds.left + margin
            current_row_height = 0

            if current_y + space.height > floor_bounds.top - margin:
                continue

        # Place space
        x = current_x + space.width / 2
        y = current_y + space.height / 2
        space.place(x, y)

        current_x += space.width + corridor
        current_row_height = max(current_row_height, space.height)


def place_ground_floor(
    patch: FloorPatch,
    support: List[Space],
    units: List[Space],
    config: SolverConfig
) -> None:
    """
    Place spaces on ground floor.

    Ground floor typically has:
    - Entry lobby near entrance
    - Leasing office
    - Mail room
    - Retail spaces (if any)
    - Some dwelling units
    """
    floor_bounds = patch.domain.bounding_box()

    # Entry is at front (bottom of floor plate)
    entry_y = floor_bounds.bottom + 10

    # Find lobby and place at front center
    lobby = next((s for s in support if 'lobby' in s.spec.name.lower()), None)
    if lobby:
        lobby.place(floor_bounds.x, entry_y + lobby.spec.height_ft / 2)

    # Place other support spaces along perimeter
    remaining = [s for s in support if s != lobby and not s.is_placed]
    place_along_perimeter(patch, remaining, config)

    # Place any ground floor units
    if units:
        place_generic(patch, units, config)


def place_parking_floor(
    patch: FloorPatch,
    mep_and_support: List[Space],
    config: SolverConfig
) -> None:
    """Place spaces on parking/basement floor."""
    # MEP rooms typically along edges
    place_along_perimeter(patch, mep_and_support, config)


def place_along_perimeter(
    patch: FloorPatch,
    spaces: List[Space],
    config: SolverConfig
) -> None:
    """Place spaces along the floor perimeter."""
    floor_bounds = patch.domain.bounding_box()
    margin = 2.0

    # Start from bottom-left, go clockwise
    current_edge = 'bottom'
    current_pos = floor_bounds.left + margin

    for space in spaces:
        if space.is_placed:
            continue

        placed = False

        # Try each edge
        for edge in ['bottom', 'right', 'top', 'left']:
            pos = try_place_on_edge(patch, space, edge, config)
            if pos:
                space.place(pos.x, pos.y)
                placed = True
                break

        if not placed:
            # Fallback: place anywhere that fits
            pos = find_valid_position(patch, space, config)
            if pos:
                space.place(pos.x, pos.y)


def try_place_on_edge(
    patch: FloorPatch,
    space: Space,
    edge: str,
    config: SolverConfig
) -> Optional[Point]:
    """Try to place space along specified edge."""
    floor_bounds = patch.domain.bounding_box()
    margin = 2.0

    if edge == 'bottom':
        y = floor_bounds.bottom + margin + space.spec.height_ft / 2
        for x in range(int(floor_bounds.left + margin),
                      int(floor_bounds.right - margin - space.spec.width_ft),
                      int(config.grid_snap)):
            pos = Point(x + space.spec.width_ft / 2, y)
            if is_position_valid(patch, space, pos, config):
                return pos

    elif edge == 'top':
        y = floor_bounds.top - margin - space.spec.height_ft / 2
        for x in range(int(floor_bounds.left + margin),
                      int(floor_bounds.right - margin - space.spec.width_ft),
                      int(config.grid_snap)):
            pos = Point(x + space.spec.width_ft / 2, y)
            if is_position_valid(patch, space, pos, config):
                return pos

    elif edge == 'left':
        x = floor_bounds.left + margin + space.spec.width_ft / 2
        for y in range(int(floor_bounds.bottom + margin),
                      int(floor_bounds.top - margin - space.spec.height_ft),
                      int(config.grid_snap)):
            pos = Point(x, y + space.spec.height_ft / 2)
            if is_position_valid(patch, space, pos, config):
                return pos

    elif edge == 'right':
        x = floor_bounds.right - margin - space.spec.width_ft / 2
        for y in range(int(floor_bounds.bottom + margin),
                      int(floor_bounds.top - margin - space.spec.height_ft),
                      int(config.grid_snap)):
            pos = Point(x, y + space.spec.height_ft / 2)
            if is_position_valid(patch, space, pos, config):
                return pos

    return None


def place_in_remaining_space(
    patch: FloorPatch,
    spaces: List[Space],
    config: SolverConfig
) -> None:
    """Place spaces in any remaining valid positions."""
    for space in spaces:
        if space.is_placed:
            continue

        pos = find_valid_position(patch, space, config)
        if pos:
            space.place(pos.x, pos.y)


def place_generic(
    patch: FloorPatch,
    spaces: List[Space],
    config: SolverConfig
) -> None:
    """Generic placement with fuzzy scaling: largest first, grid search."""
    # Sort by area descending
    sorted_spaces = sorted(spaces, key=lambda s: -s.spec.area_sf)

    floor_bounds = patch.domain.bounding_box()
    max_dim = min(floor_bounds.effective_width, floor_bounds.effective_height) / 2

    for space in sorted_spaces:
        if space.is_placed:
            continue

        # Apply fuzzy scaling to fit available space
        fuzzy = fuzzy_scale_to_fit(
            space.spec.width_ft,
            space.spec.height_ft,
            max_dim,
            max_dim,
            config.fuzzy
        )

        if fuzzy.membership >= config.fuzzy.min_membership:
            space.set_fuzzy_dimensions(fuzzy.actual_width, fuzzy.actual_height, fuzzy.membership)

        pos = find_valid_position(patch, space, config)
        if pos:
            space.place(pos.x, pos.y)


def find_valid_position(
    patch: FloorPatch,
    space: Space,
    config: SolverConfig
) -> Optional[Point]:
    """
    Find a valid position for a space using grid search.

    Returns first position that:
    1. Is inside floor boundary
    2. Does not overlap with placed spaces
    """
    floor_bounds = patch.domain.bounding_box()
    margin = 2.0

    hw = space.spec.width_ft / 2
    hh = space.spec.height_ft / 2

    # Grid search
    for y in range(
        int(floor_bounds.bottom + margin + hh),
        int(floor_bounds.top - margin - hh),
        int(config.grid_snap)
    ):
        for x in range(
            int(floor_bounds.left + margin + hw),
            int(floor_bounds.right - margin - hw),
            int(config.grid_snap)
        ):
            pos = Point(float(x), float(y))
            if is_position_valid(patch, space, pos, config):
                return pos

    # Try with rotation if allowed
    if config.allow_rotation and space.spec.width_ft != space.spec.height_ft:
        space.rotation = 90
        hw, hh = hh, hw

        for y in range(
            int(floor_bounds.bottom + margin + hh),
            int(floor_bounds.top - margin - hh),
            int(config.grid_snap)
        ):
            for x in range(
                int(floor_bounds.left + margin + hw),
                int(floor_bounds.right - margin - hw),
                int(config.grid_snap)
            ):
                pos = Point(float(x), float(y))
                if is_position_valid(patch, space, pos, config):
                    return pos

        space.rotation = 0  # Reset if not found

    return None


def is_position_valid(
    patch: FloorPatch,
    space: Space,
    pos: Point,
    config: SolverConfig
) -> bool:
    """Check if position is valid for space."""
    # Create temporary geometry
    test_rect = Rectangle(
        pos.x, pos.y,
        space.spec.width_ft, space.spec.height_ft,
        space.rotation
    )

    # Check boundary
    if not patch.domain.contains_rectangle(test_rect):
        return False

    # Check overlaps with placed spaces
    for other in patch.placed_spaces:
        if other.id == space.id:
            continue
        if test_rect.intersects(other.geometry):
            return False

    return True


def snap_to_grid(value: float, grid: float) -> float:
    """Snap value to grid."""
    return round(value / grid) * grid
