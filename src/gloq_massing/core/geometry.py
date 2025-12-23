"""
Geometry primitives for building massing.

Provides Point, Rectangle, and Polygon classes with intersection,
containment, and transformation methods.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
import math


@dataclass(frozen=True)
class Point:
    """2D point."""
    x: float
    y: float

    def __add__(self, other: Point) -> Point:
        return Point(self.x + other.x, self.y + other.y)

    def __sub__(self, other: Point) -> Point:
        return Point(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar: float) -> Point:
        return Point(self.x * scalar, self.y * scalar)

    def distance_to(self, other: Point) -> float:
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)

    def rotate(self, angle_deg: float, origin: Point = None) -> Point:
        """Rotate point around origin (default: coordinate origin)."""
        if origin is None:
            origin = Point(0, 0)

        rad = math.radians(angle_deg)
        cos_a, sin_a = math.cos(rad), math.sin(rad)

        # Translate to origin
        dx = self.x - origin.x
        dy = self.y - origin.y

        # Rotate
        new_x = dx * cos_a - dy * sin_a
        new_y = dx * sin_a + dy * cos_a

        # Translate back
        return Point(new_x + origin.x, new_y + origin.y)


@dataclass
class Rectangle:
    """
    Axis-aligned rectangle defined by center point and dimensions.

    Supports rotation in 90-degree increments for room orientation.
    """
    x: float           # center x
    y: float           # center y
    width: float       # dimension along x-axis (before rotation)
    height: float      # dimension along y-axis (before rotation)
    rotation: int = 0  # degrees: 0, 90, 180, 270

    def __post_init__(self):
        # Normalize rotation to 0, 90, 180, 270
        self.rotation = self.rotation % 360
        if self.rotation not in [0, 90, 180, 270]:
            # Snap to nearest 90 degrees
            self.rotation = round(self.rotation / 90) * 90 % 360

    @property
    def center(self) -> Point:
        return Point(self.x, self.y)

    @property
    def effective_width(self) -> float:
        """Width after rotation."""
        if self.rotation in [90, 270]:
            return self.height
        return self.width

    @property
    def effective_height(self) -> float:
        """Height after rotation."""
        if self.rotation in [90, 270]:
            return self.width
        return self.height

    @property
    def left(self) -> float:
        return self.x - self.effective_width / 2

    @property
    def right(self) -> float:
        return self.x + self.effective_width / 2

    @property
    def bottom(self) -> float:
        return self.y - self.effective_height / 2

    @property
    def top(self) -> float:
        return self.y + self.effective_height / 2

    @property
    def bounds(self) -> Tuple[float, float, float, float]:
        """Return (x_min, y_min, x_max, y_max)."""
        return (self.left, self.bottom, self.right, self.top)

    @property
    def area(self) -> float:
        return self.width * self.height

    def corners(self) -> List[Point]:
        """Return 4 corners in counter-clockwise order from bottom-left."""
        hw = self.effective_width / 2
        hh = self.effective_height / 2
        return [
            Point(self.x - hw, self.y - hh),  # bottom-left
            Point(self.x + hw, self.y - hh),  # bottom-right
            Point(self.x + hw, self.y + hh),  # top-right
            Point(self.x - hw, self.y + hh),  # top-left
        ]

    def intersects(self, other: Rectangle) -> bool:
        """Check if this rectangle overlaps with another (excluding edges)."""
        # Separating axis theorem for axis-aligned rectangles
        if self.right <= other.left or other.right <= self.left:
            return False
        if self.top <= other.bottom or other.top <= self.bottom:
            return False
        return True

    def intersection_area(self, other: Rectangle) -> float:
        """Calculate overlapping area with another rectangle."""
        x_overlap = max(0, min(self.right, other.right) - max(self.left, other.left))
        y_overlap = max(0, min(self.top, other.top) - max(self.bottom, other.bottom))
        return x_overlap * y_overlap

    def contains_point(self, p: Point) -> bool:
        """Check if point is inside rectangle."""
        return (self.left <= p.x <= self.right and
                self.bottom <= p.y <= self.top)

    def contains_rectangle(self, other: Rectangle) -> bool:
        """Check if this rectangle fully contains another."""
        return (self.left <= other.left and other.right <= self.right and
                self.bottom <= other.bottom and other.top <= self.top)

    def translate(self, dx: float, dy: float) -> Rectangle:
        """Return new rectangle shifted by (dx, dy)."""
        return Rectangle(self.x + dx, self.y + dy,
                        self.width, self.height, self.rotation)

    def with_rotation(self, rotation: int) -> Rectangle:
        """Return new rectangle with different rotation."""
        return Rectangle(self.x, self.y, self.width, self.height, rotation)

    def move_to(self, x: float, y: float) -> Rectangle:
        """Return new rectangle centered at (x, y)."""
        return Rectangle(x, y, self.width, self.height, self.rotation)

    def touches(self, other: Rectangle, tolerance: float = 0.1) -> bool:
        """Check if rectangles share an edge (within tolerance)."""
        # Check if they share a vertical edge
        if abs(self.right - other.left) < tolerance or abs(self.left - other.right) < tolerance:
            # Check y overlap
            y_overlap = min(self.top, other.top) - max(self.bottom, other.bottom)
            if y_overlap > tolerance:
                return True

        # Check if they share a horizontal edge
        if abs(self.top - other.bottom) < tolerance or abs(self.bottom - other.top) < tolerance:
            # Check x overlap
            x_overlap = min(self.right, other.right) - max(self.left, other.left)
            if x_overlap > tolerance:
                return True

        return False

    def shared_edge_length(self, other: Rectangle, tolerance: float = 0.1) -> float:
        """Calculate length of shared edge between two rectangles."""
        # Vertical edge (left-right adjacency)
        if abs(self.right - other.left) < tolerance or abs(self.left - other.right) < tolerance:
            y_overlap = min(self.top, other.top) - max(self.bottom, other.bottom)
            if y_overlap > 0:
                return y_overlap

        # Horizontal edge (top-bottom adjacency)
        if abs(self.top - other.bottom) < tolerance or abs(self.bottom - other.top) < tolerance:
            x_overlap = min(self.right, other.right) - max(self.left, other.left)
            if x_overlap > 0:
                return x_overlap

        return 0.0

    def to_dict(self) -> dict:
        """Serialize for JSON output."""
        return {
            "x": self.x,
            "y": self.y,
            "width": self.effective_width,
            "height": self.effective_height,
            "rotation": self.rotation
        }

    @classmethod
    def from_bounds(cls, x_min: float, y_min: float,
                    x_max: float, y_max: float) -> Rectangle:
        """Create rectangle from bounding box coordinates."""
        width = x_max - x_min
        height = y_max - y_min
        cx = (x_min + x_max) / 2
        cy = (y_min + y_max) / 2
        return cls(cx, cy, width, height)


@dataclass
class Polygon:
    """
    General polygon defined by vertices.

    Used for lot boundaries and non-rectangular floor plates.
    """
    vertices: List[Point]

    def __post_init__(self):
        if len(self.vertices) < 3:
            raise ValueError("Polygon must have at least 3 vertices")

    @property
    def num_vertices(self) -> int:
        return len(self.vertices)

    def area(self) -> float:
        """Calculate area using shoelace formula."""
        n = len(self.vertices)
        area = 0.0
        for i in range(n):
            j = (i + 1) % n
            area += self.vertices[i].x * self.vertices[j].y
            area -= self.vertices[j].x * self.vertices[i].y
        return abs(area) / 2.0

    def centroid(self) -> Point:
        """Calculate centroid of polygon."""
        n = len(self.vertices)
        cx, cy = 0.0, 0.0
        signed_area = 0.0

        for i in range(n):
            j = (i + 1) % n
            cross = (self.vertices[i].x * self.vertices[j].y -
                    self.vertices[j].x * self.vertices[i].y)
            signed_area += cross
            cx += (self.vertices[i].x + self.vertices[j].x) * cross
            cy += (self.vertices[i].y + self.vertices[j].y) * cross

        signed_area /= 2.0
        cx /= (6.0 * signed_area)
        cy /= (6.0 * signed_area)
        return Point(cx, cy)

    def bounding_box(self) -> Rectangle:
        """Return axis-aligned bounding box."""
        xs = [v.x for v in self.vertices]
        ys = [v.y for v in self.vertices]
        return Rectangle.from_bounds(min(xs), min(ys), max(xs), max(ys))

    def contains_point(self, p: Point) -> bool:
        """Check if point is inside polygon using ray casting."""
        n = len(self.vertices)
        inside = False

        j = n - 1
        for i in range(n):
            vi, vj = self.vertices[i], self.vertices[j]

            if ((vi.y > p.y) != (vj.y > p.y) and
                p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x):
                inside = not inside
            j = i

        return inside

    def contains_rectangle(self, rect: Rectangle) -> bool:
        """Check if polygon fully contains a rectangle."""
        # All corners must be inside
        for corner in rect.corners():
            if not self.contains_point(corner):
                return False
        return True

    def edges(self) -> List[Tuple[Point, Point]]:
        """Return list of edges as (start, end) point pairs."""
        n = len(self.vertices)
        return [(self.vertices[i], self.vertices[(i + 1) % n])
                for i in range(n)]

    def perimeter(self) -> float:
        """Calculate polygon perimeter."""
        return sum(e[0].distance_to(e[1]) for e in self.edges())

    def to_list(self) -> List[List[float]]:
        """Serialize vertices for JSON output."""
        return [[v.x, v.y] for v in self.vertices]

    @classmethod
    def rectangle(cls, width: float, height: float,
                  center: Point = None) -> Polygon:
        """Create rectangular polygon."""
        if center is None:
            center = Point(0, 0)
        hw, hh = width / 2, height / 2
        return cls([
            Point(center.x - hw, center.y - hh),
            Point(center.x + hw, center.y - hh),
            Point(center.x + hw, center.y + hh),
            Point(center.x - hw, center.y + hh),
        ])

    @classmethod
    def from_bounds(cls, x_min: float, y_min: float,
                    x_max: float, y_max: float) -> Polygon:
        """Create rectangular polygon from bounds."""
        return cls([
            Point(x_min, y_min),
            Point(x_max, y_min),
            Point(x_max, y_max),
            Point(x_min, y_max),
        ])


def rectangles_separated(r1: Rectangle, r2: Rectangle) -> Tuple[bool, bool, bool, bool]:
    """
    Check separation conditions between two rectangles.

    Returns (left, right, below, above) indicating which separations hold:
    - left: r1 is entirely left of r2
    - right: r1 is entirely right of r2
    - below: r1 is entirely below r2
    - above: r1 is entirely above r2
    """
    left = r1.right <= r2.left
    right = r1.left >= r2.right
    below = r1.top <= r2.bottom
    above = r1.bottom >= r2.top
    return (left, right, below, above)
