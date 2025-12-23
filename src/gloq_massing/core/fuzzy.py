"""
Fuzzy Logic for Building Massing

Provides fuzzy membership functions and scaling algorithms that allow
spaces to deviate from GLOQ target dimensions within acceptable tolerance.

Key concepts:
- Membership function: μ(A) returns how "good" an area A is (0 to 1)
- Bi-directional scaling: units can shrink OR grow to fit
- Tolerance: acceptable deviation from target (default ±15%)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Tuple, Optional
import math


@dataclass
class FuzzyConfig:
    """Configuration for fuzzy space scaling."""

    # Area tolerance - how much deviation from target area is acceptable
    area_tolerance: float = 0.25      # ±25% area deviation allowed
    min_membership: float = 0.3       # Minimum acceptable membership (more lenient)

    # Aspect ratio bounds
    aspect_ratio_min: float = 0.3     # Minimum w/h ratio (tall/narrow)
    aspect_ratio_max: float = 3.0     # Maximum w/h ratio (wide/short)

    # Scaling mode
    scale_mode: str = "proportional"  # "proportional", "width_priority", "height_priority"

    # Growth limits (for bi-directional scaling)
    max_growth: float = 0.20          # Max growth beyond target (20%)
    max_shrink: float = 0.40          # Max shrink below target (40%)


@dataclass
class FuzzySpace:
    """
    A space with fuzzy-scaled dimensions.

    Stores both the original target and the actual (scaled) dimensions.
    """
    target_width: float       # Original GLOQ width
    target_height: float      # Original GLOQ height
    target_area: float        # Original GLOQ area

    actual_width: float       # Scaled width
    actual_height: float      # Scaled height
    actual_area: float        # Scaled area

    membership: float         # Area membership score [0, 1]
    scale_factor: float       # Applied scale factor

    @property
    def area_deviation(self) -> float:
        """Percentage deviation from target area."""
        return (self.actual_area - self.target_area) / self.target_area

    @property
    def aspect_ratio(self) -> float:
        """Current aspect ratio (width / height)."""
        return self.actual_width / self.actual_height if self.actual_height > 0 else 1.0


def fuzzy_area_membership(
    actual: float,
    target: float,
    tolerance: float = 0.15
) -> float:
    """
    Triangular membership function for area.

    Returns:
        1.0 if actual == target
        Linear decay to 0 at ±tolerance bounds
        0.0 if outside tolerance

    Example:
        target=100, tolerance=0.15
        actual=100 → 1.0
        actual=92.5 (7.5% off) → 0.5
        actual=85 (15% off) → 0.0
        actual=115 (15% off) → 0.0
    """
    if target <= 0:
        return 0.0

    if actual == target:
        return 1.0

    deviation = abs(actual - target) / target

    if deviation <= tolerance:
        return 1.0 - (deviation / tolerance)
    else:
        return 0.0


def fuzzy_area_membership_gaussian(
    actual: float,
    target: float,
    sigma: float = 0.1
) -> float:
    """
    Gaussian membership function for area.

    More forgiving than triangular - gradual falloff.

    Args:
        sigma: Standard deviation (default 10% = 0.1)
    """
    if target <= 0:
        return 0.0

    deviation = (actual - target) / target
    return math.exp(-(deviation ** 2) / (2 * sigma ** 2))


def compute_optimal_scale(
    target_area: float,
    available_area: float,
    config: FuzzyConfig
) -> Tuple[float, float]:
    """
    Compute optimal scale factor and resulting membership.

    Args:
        target_area: Desired area from GLOQ
        available_area: Maximum area that can fit
        config: Fuzzy configuration

    Returns:
        (scale_factor, membership)
    """
    if target_area <= 0:
        return 1.0, 0.0

    # If target fits, no scaling needed
    if available_area >= target_area:
        # But we might want to grow slightly to fill space
        max_grow_area = target_area * (1 + config.max_growth)
        if available_area <= max_grow_area:
            # Grow to fill available space
            scale = math.sqrt(available_area / target_area)
            membership = fuzzy_area_membership(available_area, target_area, config.area_tolerance)
            return scale, membership
        else:
            # Don't grow beyond limit, stay at target
            return 1.0, 1.0

    # Need to shrink
    min_area = target_area * (1 - config.max_shrink)

    if available_area < min_area:
        # Can't shrink enough
        scale = math.sqrt(min_area / target_area)
        membership = 0.0  # Outside tolerance
    else:
        # Shrink to fit
        scale = math.sqrt(available_area / target_area)
        membership = fuzzy_area_membership(available_area, target_area, config.area_tolerance)

    return scale, membership


def fuzzy_scale_to_fit(
    target_width: float,
    target_height: float,
    max_width: float,
    max_height: float,
    config: FuzzyConfig
) -> FuzzySpace:
    """
    Scale a space to fit within constraints while maximizing membership.

    Strategy:
    1. If space fits at target size, return target (membership=1.0)
    2. If constrained by height, scale proportionally
    3. If constrained by width, scale proportionally
    4. Check resulting membership

    Args:
        target_width, target_height: GLOQ dimensions
        max_width, max_height: Available space constraints
        config: Fuzzy configuration

    Returns:
        FuzzySpace with actual dimensions and membership
    """
    target_area = target_width * target_height

    # Check if fits without scaling
    if target_width <= max_width and target_height <= max_height:
        # Can we grow to fill space?
        scale_w = max_width / target_width
        scale_h = max_height / target_height

        if config.scale_mode == "proportional":
            # Uniform scaling - use smaller scale to maintain aspect
            max_scale = min(scale_w, scale_h, 1 + config.max_growth)

            if max_scale > 1.0:
                # Grow to fill available space
                actual_width = target_width * max_scale
                actual_height = target_height * max_scale
            else:
                # Keep target size
                actual_width = target_width
                actual_height = target_height
        else:
            actual_width = target_width
            actual_height = target_height

        actual_area = actual_width * actual_height
        membership = fuzzy_area_membership(actual_area, target_area, config.area_tolerance)

        return FuzzySpace(
            target_width=target_width,
            target_height=target_height,
            target_area=target_area,
            actual_width=actual_width,
            actual_height=actual_height,
            actual_area=actual_area,
            membership=membership,
            scale_factor=actual_width / target_width if target_width > 0 else 1.0,
        )

    # Need to scale down
    if config.scale_mode == "proportional":
        scale_w = max_width / target_width if target_width > 0 else 1.0
        scale_h = max_height / target_height if target_height > 0 else 1.0
        scale = min(scale_w, scale_h)

        # Don't shrink beyond limit
        min_scale = math.sqrt(1 - config.max_shrink)
        scale = max(scale, min_scale)

        actual_width = target_width * scale
        actual_height = target_height * scale

    elif config.scale_mode == "height_priority":
        # Fit height first, then adjust width
        if target_height > max_height:
            scale_h = max_height / target_height
            actual_height = max_height
            # Compensate with width
            area_needed = target_area * (1 - config.area_tolerance * 0.5)
            actual_width = min(area_needed / actual_height, max_width)
        else:
            actual_height = target_height
            actual_width = min(target_width, max_width)

    elif config.scale_mode == "width_priority":
        # Fit width first, then adjust height
        if target_width > max_width:
            scale_w = max_width / target_width
            actual_width = max_width
            area_needed = target_area * (1 - config.area_tolerance * 0.5)
            actual_height = min(area_needed / actual_width, max_height)
        else:
            actual_width = target_width
            actual_height = min(target_height, max_height)

    else:
        # Default to proportional
        scale = min(max_width / target_width, max_height / target_height)
        actual_width = target_width * scale
        actual_height = target_height * scale

    # Check aspect ratio bounds
    ratio = actual_width / actual_height if actual_height > 0 else 1.0
    if ratio < config.aspect_ratio_min:
        # Too tall/narrow - widen
        actual_width = actual_height * config.aspect_ratio_min
        if actual_width > max_width:
            actual_width = max_width
    elif ratio > config.aspect_ratio_max:
        # Too wide/short - heighten
        actual_height = actual_width / config.aspect_ratio_max
        if actual_height > max_height:
            actual_height = max_height

    actual_area = actual_width * actual_height
    membership = fuzzy_area_membership(actual_area, target_area, config.area_tolerance)

    return FuzzySpace(
        target_width=target_width,
        target_height=target_height,
        target_area=target_area,
        actual_width=actual_width,
        actual_height=actual_height,
        actual_area=actual_area,
        membership=membership,
        scale_factor=actual_width / target_width if target_width > 0 else 1.0,
    )


def scale_space_for_strip(
    target_width: float,
    target_height: float,
    strip_depth: float,
    strip_remaining_width: float,
    config: FuzzyConfig
) -> Optional[FuzzySpace]:
    """
    Scale a space to fit in a strip (row) of the floor.

    A strip has fixed depth (height constraint) and remaining width.

    Args:
        target_width, target_height: GLOQ dimensions
        strip_depth: Height of the strip (fixed)
        strip_remaining_width: Remaining width in strip
        config: Fuzzy configuration

    Returns:
        FuzzySpace if it fits with acceptable membership, None otherwise
    """
    # Primary constraint is strip depth
    if target_height <= strip_depth:
        # Height fits - check width
        if target_width <= strip_remaining_width:
            # Fits perfectly - maybe grow height to fill strip
            fuzzy = fuzzy_scale_to_fit(
                target_width, target_height,
                strip_remaining_width, strip_depth,
                config
            )
        else:
            # Width doesn't fit - can we shrink proportionally?
            fuzzy = fuzzy_scale_to_fit(
                target_width, target_height,
                strip_remaining_width, strip_depth,
                config
            )
    else:
        # Height too tall - must shrink
        fuzzy = fuzzy_scale_to_fit(
            target_width, target_height,
            strip_remaining_width, strip_depth,
            config
        )

    if fuzzy.membership >= config.min_membership:
        return fuzzy
    else:
        return None


def compute_membership_color(membership: float) -> str:
    """
    Get color for membership score visualization.

    Returns:
        Hex color string
    """
    if membership >= 0.9:
        return "#4CAF50"  # Green - excellent
    elif membership >= 0.7:
        return "#8BC34A"  # Light green - good
    elif membership >= 0.5:
        return "#FFC107"  # Amber - acceptable
    elif membership >= 0.3:
        return "#FF9800"  # Orange - poor
    else:
        return "#F44336"  # Red - bad
