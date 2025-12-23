"""
JSON loader for GLOQ data.

This module loads the JSON format and converts to BuildingSpec.
This is the interface Henry will implement for his parsing module.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..core.building import (
    BuildingSpec, SpaceSpec, DwellingUnit, DwellingType,
    CirculationSpec, ParkingSpec, StoryDistribution,
    SpaceCategory, FloorAssignment,
)


def load_gloq_json(path: str | Path) -> BuildingSpec:
    """Load GLOQ JSON file and convert to BuildingSpec."""
    with open(path) as f:
        data = json.load(f)
    return parse_gloq_data(data)


def parse_gloq_data(data: Dict[str, Any]) -> BuildingSpec:
    """
    Parse GLOQ JSON data into BuildingSpec.

    This is the main conversion function that Henry will implement
    to transform parsed PDF data into the solver's input format.
    """
    building_data = data.get("building", {})
    story_dist = building_data.get("story_distribution", {})

    # Parse dwelling units
    dwelling_units = []
    for unit_data in data.get("dwelling_units", []):
        dtype = {
            "studio": DwellingType.STUDIO,
            "1br": DwellingType.ONE_BR,
            "2br": DwellingType.TWO_BR,
            "3br": DwellingType.THREE_BR,
        }.get(unit_data.get("type", "studio"), DwellingType.STUDIO)

        unit = DwellingUnit(
            id=f"unit_{unit_data.get('type', 'unknown')}",
            category=SpaceCategory.DWELLING_UNIT,
            name=unit_data.get("name", "Unit"),
            area_sf=unit_data.get("area_sf", 0),
            width_ft=unit_data.get("width_ft"),
            height_ft=unit_data.get("depth_ft"),  # depth = height in our coords
            count=unit_data.get("count", 1),
            dwelling_type=dtype,
            bedrooms=unit_data.get("bedrooms", 0),
            bathrooms=unit_data.get("bathrooms", 1.0),
        )
        dwelling_units.append(unit)

    # Parse circulation
    circ_data = data.get("circulation", {})
    elev_data = circ_data.get("elevators", {})
    stair_data = circ_data.get("stairs", {})

    circulation = CirculationSpec(
        corridor_width_ft=circ_data.get("corridor_width_ft", 6.0),
        corridor_length_ft=circ_data.get("corridor_length_ft", 0),
        elevator_passenger_count=elev_data.get("passenger", {}).get("count", 2),
        elevator_passenger_sf=elev_data.get("passenger", {}).get("sf_per_floor", 136),
        elevator_freight_count=elev_data.get("freight", {}).get("count", 0),
        elevator_freight_sf=elev_data.get("freight", {}).get("sf_per_floor", 0),
        stair_count=stair_data.get("count", 2),
        stair_sf=stair_data.get("sf_per_floor", 188),
        vestibule_lobby_sf=circ_data.get("vestibule_elevator_lobby_sf", 0),
        shaft_elevator_sf=circ_data.get("shaft_elevator_sf", 0),
        shaft_stair_sf=circ_data.get("shaft_stair_sf", 0),
    )

    # Parse support spaces
    support_spaces = parse_space_list(
        data.get("support", []),
        SpaceCategory.SUPPORT,
        "support"
    )

    # Parse staff spaces
    staff_spaces = parse_space_list(
        data.get("staff", []),
        SpaceCategory.STAFF,
        "staff"
    )

    # Parse amenities
    amenity_indoor = parse_space_list(
        data.get("amenities_indoor", []),
        SpaceCategory.AMENITY_INDOOR,
        "amenity_indoor"
    )
    amenity_outdoor = parse_space_list(
        data.get("amenities_outdoor", []),
        SpaceCategory.AMENITY_OUTDOOR,
        "amenity_outdoor"
    )

    # Parse parking
    parking_data = data.get("parking", {})
    parking = ParkingSpec(
        surface_stalls=parking_data.get("surface_stalls", 0),
        podium_stalls=parking_data.get("podium_stalls", 0),
        underground_stalls=parking_data.get("underground_stalls", 0),
        indoor_parking_sf=parking_data.get("indoor_parking_sf", 0),
        surface_lot_sf=parking_data.get("surface_lot_sf", 0),
        loading_dock_sf=parking_data.get("loading_dock_sf", 0),
        rideshare_zone_sf=parking_data.get("rideshare_zone_sf", 0),
    )

    # Parse MEP spaces
    mep_spaces = []
    mep_data = data.get("mep", {})

    for category_name, category_enum in [
        ("low_voltage", SpaceCategory.LOW_VOLTAGE),
        ("electrical", SpaceCategory.ELECTRICAL),
        ("mechanical", SpaceCategory.MECHANICAL),
        ("plumbing", SpaceCategory.PLUMBING),
        ("fire", SpaceCategory.FIRE_SPRINKLER),
    ]:
        mep_spaces.extend(parse_space_list(
            mep_data.get(category_name, []),
            category_enum,
            f"mep_{category_name}"
        ))

    # Build the spec
    return BuildingSpec(
        project_name=data.get("project_name", "Unknown Project"),
        property_type=building_data.get("property_type", "apartment"),
        construction_type=building_data.get("construction_type", ""),
        lot_size_sf=building_data.get("lot_size_sf", 0),
        floor_plate_sf=building_data.get("floor_plate_sf", 0),
        stories_total=building_data.get("stories_total", 0),
        stories_above_grade=building_data.get("stories_above_grade", 0),
        stories_below_grade=building_data.get("stories_below_grade", 0),
        far=building_data.get("far", 0),
        gba_sf=building_data.get("gba_sf", 0),
        gfa_sf=building_data.get("gfa_sf", 0),
        rentable_sf=building_data.get("rentable_sf", 0),
        net_to_gross=building_data.get("net_to_gross", 0),
        height_above_grade_ft=building_data.get("height_above_grade_ft", 0),
        height_below_grade_ft=building_data.get("height_below_grade_ft", 0),
        story_distribution=StoryDistribution(
            dwelling=story_dist.get("dwelling", 0),
            mixed_use=story_dist.get("mixed_use", 0),
            parking=story_dist.get("parking", 0),
        ),
        dwelling_units=dwelling_units,
        circulation=circulation,
        support_spaces=support_spaces,
        staff_spaces=staff_spaces,
        amenity_indoor=amenity_indoor,
        amenity_outdoor=amenity_outdoor,
        parking=parking,
        mep_spaces=mep_spaces,
    )


def parse_space_list(
    items: List[Dict[str, Any]],
    category: SpaceCategory,
    prefix: str
) -> List[SpaceSpec]:
    """Parse a list of space items into SpaceSpecs."""
    spaces = []
    for i, item in enumerate(items):
        floor_str = item.get("floor", "typical")
        floor_assignment = {
            "ground": FloorAssignment.GROUND,
            "basement": FloorAssignment.BASEMENT,
            "typical": FloorAssignment.TYPICAL,
            "roof": FloorAssignment.ROOF,
            "all": FloorAssignment.ALL,
            "podium": FloorAssignment.PODIUM,
        }.get(floor_str, FloorAssignment.TYPICAL)

        space = SpaceSpec(
            id=f"{prefix}_{i+1}",
            category=category,
            name=item.get("name", f"Space {i+1}"),
            area_sf=item.get("area_sf", 0),
            width_ft=item.get("width_ft"),
            height_ft=item.get("depth_ft"),
            count=item.get("count", 1),
            floor_assignment=floor_assignment,
        )
        spaces.append(space)

    return spaces
