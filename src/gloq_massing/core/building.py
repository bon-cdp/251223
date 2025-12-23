"""
Building domain types for GLOQ data.

Maps GLOQ Space Allocation Analysis data to structured Python objects.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Dict, Optional
import math


class SpaceCategory(Enum):
    """Major space categories from GLOQ reports."""
    DWELLING_UNIT = auto()
    RETAIL = auto()
    CIRCULATION = auto()
    SUPPORT = auto()
    STAFF = auto()
    AMENITY_INDOOR = auto()
    AMENITY_OUTDOOR = auto()
    PARKING = auto()
    LOW_VOLTAGE = auto()
    DRY_UTILITIES = auto()
    ELECTRICAL = auto()
    MECHANICAL = auto()
    PLUMBING = auto()
    FIRE_SPRINKLER = auto()


class DwellingType(Enum):
    """Dwelling unit types."""
    STUDIO = "studio"
    ONE_BR = "1br"
    TWO_BR = "2br"
    THREE_BR = "3br"


class FloorType(Enum):
    """Types of floors in a building."""
    BASEMENT = auto()        # Below grade, typically parking/MEP
    PARKING_UNDERGROUND = auto()
    PARKING_PODIUM = auto()  # Above grade parking
    GROUND = auto()          # Ground floor - lobby, retail, support
    PODIUM = auto()          # Podium level (above parking, below residential)
    RESIDENTIAL_TYPICAL = auto()  # Typical residential floor
    AMENITY = auto()         # Dedicated amenity floor
    ROOF = auto()            # Roof level (outdoor amenities, MEP)
    MIXED_USE = auto()       # Combined uses


class FloorAssignment(Enum):
    """Where a space type should be placed."""
    GROUND = "ground"           # Ground floor only
    BASEMENT = "basement"       # Basement only
    TYPICAL = "typical"         # Typical residential floors
    PODIUM = "podium"           # Podium level
    ROOF = "roof"               # Roof level
    ALL = "all"                 # Every floor
    ALL_RESIDENTIAL = "all_res" # All residential floors
    VERTICAL = "vertical"       # Spans multiple floors (elevator, stair)


@dataclass
class SpaceSpec:
    """
    Specification for a space type from GLOQ data.

    This is the template - actual Space instances are created from this.
    """
    id: str
    category: SpaceCategory
    name: str
    area_sf: float
    width_ft: Optional[float] = None
    height_ft: Optional[float] = None
    count: int = 1
    floor_assignment: FloorAssignment = FloorAssignment.TYPICAL
    must_be_exterior: bool = False
    adjacency_requirements: List[str] = field(default_factory=list)
    is_vertical: bool = False  # True for elevators, stairs, shafts

    def __post_init__(self):
        # Derive dimensions if not provided (assume square-ish)
        if self.width_ft is None and self.height_ft is None:
            side = math.sqrt(self.area_sf)
            self.width_ft = side
            self.height_ft = side
        elif self.width_ft is None:
            self.width_ft = self.area_sf / self.height_ft
        elif self.height_ft is None:
            self.height_ft = self.area_sf / self.width_ft

    @property
    def aspect_ratio(self) -> float:
        """Width / height ratio."""
        return self.width_ft / self.height_ft if self.height_ft else 1.0


@dataclass
class DwellingUnit(SpaceSpec):
    """Dwelling unit specification with residential-specific data."""
    dwelling_type: DwellingType = DwellingType.STUDIO
    bedrooms: int = 0
    bathrooms: float = 1.0
    has_powder_room: bool = False

    def __post_init__(self):
        super().__post_init__()
        self.category = SpaceCategory.DWELLING_UNIT
        self.floor_assignment = FloorAssignment.TYPICAL
        # Units need corridor access
        if "corridor" not in [a.lower() for a in self.adjacency_requirements]:
            self.adjacency_requirements.append("corridor")


@dataclass
class CirculationSpec:
    """Circulation infrastructure specification."""
    corridor_width_ft: float = 6.0
    corridor_length_ft: float = 0.0  # Total corridor length
    elevator_passenger_count: int = 2
    elevator_passenger_sf: float = 136.0  # SF per floor
    elevator_freight_count: int = 0
    elevator_freight_sf: float = 0.0
    stair_count: int = 2
    stair_sf: float = 188.0  # SF per floor
    vestibule_lobby_sf: float = 0.0
    shaft_elevator_sf: float = 0.0
    shaft_stair_sf: float = 0.0

    @property
    def elevator_width(self) -> float:
        """Typical elevator cab width."""
        return 8.0  # feet

    @property
    def elevator_depth(self) -> float:
        """Typical elevator cab depth."""
        return self.elevator_passenger_sf / self.elevator_width if self.elevator_passenger_sf else 7.0

    @property
    def stair_width(self) -> float:
        """Derive stair width from area (assuming ~2:1 aspect ratio)."""
        return math.sqrt(self.stair_sf / 2) if self.stair_sf else 8.0

    @property
    def stair_depth(self) -> float:
        return self.stair_sf / self.stair_width if self.stair_width else 12.0


@dataclass
class ParkingSpec:
    """Parking configuration."""
    surface_stalls: int = 0
    podium_stalls: int = 0
    underground_stalls: int = 0
    leased_stalls: int = 0
    indoor_parking_sf: float = 0.0
    surface_lot_sf: float = 0.0
    loading_dock_sf: float = 0.0
    rideshare_zone_sf: float = 0.0

    @property
    def total_stalls(self) -> int:
        return self.surface_stalls + self.podium_stalls + self.underground_stalls

    @property
    def has_underground(self) -> bool:
        return self.underground_stalls > 0

    @property
    def has_podium(self) -> bool:
        return self.podium_stalls > 0


@dataclass
class StoryDistribution:
    """Distribution of floors by use type."""
    dwelling: float = 0.0      # Floors for dwelling units
    mixed_use: float = 0.0     # Floors for mixed use (support, amenity, etc.)
    parking: float = 0.0       # Floors for parking

    @property
    def total(self) -> float:
        return self.dwelling + self.mixed_use + self.parking


@dataclass
class BuildingSpec:
    """
    Complete building specification from GLOQ Space Allocation Analysis.

    This is the main input to the solver.
    """
    # Project identification
    project_name: str = "Proposed Apartment Project"
    property_type: str = "apartment"
    construction_type: str = "Type III/I"

    # Site
    lot_size_sf: float = 0.0

    # Building envelope
    floor_plate_sf: float = 0.0
    stories_total: int = 0
    stories_above_grade: int = 0
    stories_below_grade: int = 0
    far: float = 0.0
    gba_sf: float = 0.0
    gfa_sf: float = 0.0
    rentable_sf: float = 0.0
    net_to_gross: float = 0.0
    height_above_grade_ft: float = 0.0
    height_below_grade_ft: float = 0.0

    # Story distribution
    story_distribution: StoryDistribution = field(default_factory=StoryDistribution)

    # Spaces by category
    dwelling_units: List[DwellingUnit] = field(default_factory=list)
    circulation: CirculationSpec = field(default_factory=CirculationSpec)
    support_spaces: List[SpaceSpec] = field(default_factory=list)
    staff_spaces: List[SpaceSpec] = field(default_factory=list)
    amenity_indoor: List[SpaceSpec] = field(default_factory=list)
    amenity_outdoor: List[SpaceSpec] = field(default_factory=list)
    parking: ParkingSpec = field(default_factory=ParkingSpec)
    mep_spaces: List[SpaceSpec] = field(default_factory=list)  # All MEP combined

    @property
    def total_dwelling_units(self) -> int:
        return sum(u.count for u in self.dwelling_units)

    @property
    def total_bedrooms(self) -> int:
        return sum(u.bedrooms * u.count for u in self.dwelling_units)

    @property
    def floor_to_floor_height(self) -> float:
        """Estimate floor-to-floor height."""
        if self.stories_above_grade and self.height_above_grade_ft:
            return self.height_above_grade_ft / self.stories_above_grade
        return 10.0  # Default assumption

    @property
    def floor_plate_width(self) -> float:
        """Estimate floor plate width (assuming roughly square)."""
        return math.sqrt(self.floor_plate_sf)

    @property
    def units_per_floor(self) -> float:
        """Average dwelling units per residential floor."""
        if self.story_distribution.dwelling > 0:
            return self.total_dwelling_units / self.story_distribution.dwelling
        return 0

    def get_all_space_specs(self) -> List[SpaceSpec]:
        """Return all space specifications."""
        specs = []
        specs.extend(self.dwelling_units)
        specs.extend(self.support_spaces)
        specs.extend(self.staff_spaces)
        specs.extend(self.amenity_indoor)
        specs.extend(self.amenity_outdoor)
        specs.extend(self.mep_spaces)
        return specs

    def get_floor_type(self, floor_index: int) -> FloorType:
        """Determine floor type based on index and story distribution."""
        # Below grade floors
        if floor_index < 0:
            if self.parking.has_underground:
                return FloorType.PARKING_UNDERGROUND
            return FloorType.BASEMENT

        # Ground floor
        if floor_index == 0:
            return FloorType.GROUND

        # Calculate boundaries
        parking_floors = int(math.ceil(self.story_distribution.parking))
        residential_start = max(1, parking_floors)

        # Podium parking (above ground)
        if floor_index < residential_start and self.parking.has_podium:
            return FloorType.PARKING_PODIUM

        # Top floor might be amenity
        if floor_index == self.stories_above_grade - 1 and self.amenity_outdoor:
            return FloorType.AMENITY

        # Typical residential
        return FloorType.RESIDENTIAL_TYPICAL


def create_circulation_spaces(circulation: CirculationSpec) -> List[SpaceSpec]:
    """Generate space specs for circulation elements."""
    spaces = []

    # Passenger elevators (vertical elements)
    for i in range(circulation.elevator_passenger_count):
        spaces.append(SpaceSpec(
            id=f"elevator_passenger_{i+1}",
            category=SpaceCategory.CIRCULATION,
            name=f"Passenger Elevator {i+1}",
            area_sf=circulation.elevator_passenger_sf,
            width_ft=circulation.elevator_width,
            height_ft=circulation.elevator_depth,
            count=1,
            floor_assignment=FloorAssignment.VERTICAL,
            is_vertical=True,
        ))

    # Freight elevators (vertical elements)
    for i in range(circulation.elevator_freight_count):
        spaces.append(SpaceSpec(
            id=f"elevator_freight_{i+1}",
            category=SpaceCategory.CIRCULATION,
            name=f"Freight Elevator {i+1}",
            area_sf=circulation.elevator_freight_sf,
            width_ft=10.0,  # Freight elevators are larger
            height_ft=circulation.elevator_freight_sf / 10.0,
            count=1,
            floor_assignment=FloorAssignment.VERTICAL,
            is_vertical=True,
        ))

    # Stairs (vertical elements)
    for i in range(circulation.stair_count):
        spaces.append(SpaceSpec(
            id=f"stair_{i+1}",
            category=SpaceCategory.CIRCULATION,
            name=f"Stair {i+1}",
            area_sf=circulation.stair_sf,
            width_ft=circulation.stair_width,
            height_ft=circulation.stair_depth,
            count=1,
            floor_assignment=FloorAssignment.VERTICAL,
            is_vertical=True,
        ))

    # Elevator lobby (per floor)
    if circulation.vestibule_lobby_sf > 0:
        spaces.append(SpaceSpec(
            id="elevator_lobby",
            category=SpaceCategory.CIRCULATION,
            name="Elevator Lobby",
            area_sf=circulation.vestibule_lobby_sf,
            count=1,
            floor_assignment=FloorAssignment.ALL_RESIDENTIAL,
        ))

    return spaces
