"""
Massing Optimizer - Space optimization algorithms for real estate development.

Author: Henry Liang (henryliang35-create)
"""

import math
import re
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


class OptimizationObjective(Enum):
    """Optimization objectives for massing."""
    MAXIMIZE_AREA = "maximize_area"
    MAXIMIZE_UNITS = "maximize_units"
    MAXIMIZE_VALUE = "maximize_value"
    MINIMIZE_COST = "minimize_cost"


@dataclass
class SiteConstraints:
    """Site constraints for optimization."""
    total_area: float  # in square feet
    max_height: float  # in feet
    max_far: float  # Floor Area Ratio
    setbacks: Dict[str, float]  # front, rear, side setbacks
    zoning_code: str
    parking_ratio: float  # parking spaces per unit
    lot_coverage: float  # maximum lot coverage percentage


@dataclass
class UnitType:
    """Definition of a unit type."""
    name: str
    area: float  # square feet
    value: float  # estimated value
    cost: float  # construction cost per square foot
    count: int = 0


@dataclass
class BuildingMassing:
    """Resulting building massing solution."""
    total_units: int
    total_area: float
    total_value: float
    total_cost: float
    building_height: float
    floor_count: int
    unit_mix: Dict[str, int]  # unit type -> count
    efficiency: float  # utilization percentage
    constraints_met: bool


class MassingOptimizer:
    """Optimizes building massing based on constraints."""

    def __init__(self):
        self.unit_types = [
            UnitType("studio", 500, 250000, 300),
            UnitType("1br", 750, 400000, 320),
            UnitType("2br", 1000, 550000, 340),
            UnitType("3br", 1300, 700000, 360)
        ]

    def optimize(
        self,
        constraints: SiteConstraints,
        objective: OptimizationObjective = OptimizationObjective.MAXIMIZE_VALUE,
        time_limit: int = 60
    ) -> BuildingMassing:
        """
        Optimize building massing based on constraints and objective.

        Uses a greedy algorithm with backtracking for optimization.
        """
        # Calculate maximum buildable area
        max_buildable_area = self._calculate_buildable_area(constraints)

        # Calculate maximum FAR area
        max_far_area = constraints.total_area * constraints.max_far

        # Actual limit is minimum of buildable and FAR area
        available_area = min(max_buildable_area, max_far_area)

        # Apply lot coverage constraint
        max_coverage_area = constraints.total_area * constraints.lot_coverage
        available_area = min(available_area, max_coverage_area)

        # Initialize best solution
        best_solution = BuildingMassing(
            total_units=0,
            total_area=0,
            total_value=0,
            total_cost=0,
            building_height=0,
            floor_count=0,
            unit_mix={},
            efficiency=0,
            constraints_met=True
        )

        # Try different floor counts
        max_floors = int(constraints.max_height / 10)  # Assuming 10ft per floor
        max_floors = max(1, min(max_floors, 50))  # Reasonable limits

        for floors in range(1, max_floors + 1):
            # Calculate area per floor
            area_per_floor = available_area / floors if floors > 1 else available_area

            # Skip if floor area is too small for any unit
            if area_per_floor < min(ut.area for ut in self.unit_types):
                continue

            # Optimize unit mix for this floor configuration
            floor_solution = self._optimize_unit_mix(
                area_per_floor * floors,  # Total area for all floors
                objective
            )

            if not floor_solution:
                continue

            # Calculate building height (10ft per floor + mechanical)
            building_height = floors * 10 + 15  # 15ft for ground floor/mechanical

            # Check height constraint
            if building_height > constraints.max_height:
                continue

            # Create building massing
            massing = BuildingMassing(
                total_units=floor_solution.total_units,
                total_area=floor_solution.total_area,
                total_value=floor_solution.total_value,
                total_cost=floor_solution.total_cost,
                building_height=building_height,
                floor_count=floors,
                unit_mix=floor_solution.unit_mix,
                efficiency=floor_solution.total_area / available_area,
                constraints_met=True
            )

            # Update best solution based on objective
            if self._is_better_solution(massing, best_solution, objective):
                best_solution = massing

        return best_solution

    def _calculate_buildable_area(self, constraints: SiteConstraints) -> float:
        """Calculate buildable area considering setbacks."""
        total_area = constraints.total_area

        # Reduce area by setbacks (simplified)
        setback_reduction = sum(constraints.setbacks.values()) * 100  # Approximation

        buildable_area = max(0, total_area - setback_reduction)
        return buildable_area

    def _optimize_unit_mix(
        self,
        available_area: float,
        objective: OptimizationObjective
    ) -> Optional[BuildingMassing]:
        """Optimize unit mix for given area using knapsack-like algorithm."""
        # Sort unit types based on objective
        if objective == OptimizationObjective.MAXIMIZE_VALUE:
            sorted_units = sorted(self.unit_types, key=lambda x: x.value / x.area, reverse=True)
        elif objective == OptimizationObjective.MAXIMIZE_UNITS:
            sorted_units = sorted(self.unit_types, key=lambda x: 1 / x.area)
        elif objective == OptimizationObjective.MINIMIZE_COST:
            sorted_units = sorted(self.unit_types, key=lambda x: x.cost)
        else:  # MAXIMIZE_AREA
            sorted_units = self.unit_types

        remaining_area = available_area
        unit_mix = {}
        total_units = 0
        total_value = 0
        total_cost = 0

        # Greedy allocation
        for unit_type in sorted_units:
            if remaining_area <= 0:
                break

            # Maximum units of this type that fit
            max_units = int(remaining_area / unit_type.area)
            if max_units > 0:
                # For value maximization, take all units
                if objective == OptimizationObjective.MAXIMIZE_VALUE:
                    units_to_take = max_units
                else:
                    units_to_take = min(max_units, 10)

                unit_mix[unit_type.name] = units_to_take
                total_units += units_to_take
                total_value += units_to_take * unit_type.value
                total_cost += units_to_take * unit_type.area * unit_type.cost
                remaining_area -= units_to_take * unit_type.area

        # If we didn't use reasonable amount of area, return None
        utilization = (available_area - remaining_area) / available_area
        if utilization < 0.6:
            return None

        return BuildingMassing(
            total_units=total_units,
            total_area=available_area - remaining_area,
            total_value=total_value,
            total_cost=total_cost,
            building_height=0,
            floor_count=0,
            unit_mix=unit_mix,
            efficiency=utilization,
            constraints_met=True
        )

    def _is_better_solution(
        self,
        new: BuildingMassing,
        current: BuildingMassing,
        objective: OptimizationObjective
    ) -> bool:
        """Compare two solutions based on optimization objective."""
        if not current.total_units:
            return True

        if objective == OptimizationObjective.MAXIMIZE_VALUE:
            return new.total_value > current.total_value
        elif objective == OptimizationObjective.MAXIMIZE_UNITS:
            return new.total_units > current.total_units
        elif objective == OptimizationObjective.MAXIMIZE_AREA:
            return new.total_area > current.total_area
        elif objective == OptimizationObjective.MINIMIZE_COST:
            return new.total_cost < current.total_cost

        return False

    def generate_3d_massing_parameters(
        self,
        massing: BuildingMassing,
        constraints: SiteConstraints
    ) -> Dict:
        """Generate parameters for 3D visualization."""
        building_length = math.sqrt(constraints.total_area) * 0.7
        building_width = (massing.total_area / massing.floor_count) / building_length if massing.floor_count else 0

        return {
            "type": "rectangular_massing",
            "dimensions": {
                "length": round(building_length, 2),
                "width": round(building_width, 2),
                "height": round(massing.building_height, 2)
            },
            "floors": massing.floor_count,
            "units_per_floor": math.ceil(massing.total_units / massing.floor_count) if massing.floor_count else 0,
            "floor_height": 10,
            "setbacks": constraints.setbacks,
            "total_area": round(massing.total_area, 2),
            "far_used": round(massing.total_area / constraints.total_area, 3) if constraints.total_area else 0
        }


class ConstraintParser:
    """Parses constraints from LLM output."""

    @staticmethod
    def parse_from_llm_output(llm_data: Dict) -> SiteConstraints:
        """Parse site constraints from LLM structured output."""
        properties = llm_data.get("properties", {})
        constraints_data = llm_data.get("constraints", {})

        area = ConstraintParser._extract_area(properties)
        max_height = ConstraintParser._extract_height(constraints_data)
        max_far = ConstraintParser._extract_far(constraints_data)
        setbacks = ConstraintParser._extract_setbacks(constraints_data)
        zoning_code = properties.get("zoning", "R-3")
        parking_ratio = constraints_data.get("parking_ratio", 1.5)
        lot_coverage = constraints_data.get("lot_coverage", 0.6)

        return SiteConstraints(
            total_area=area,
            max_height=max_height,
            max_far=max_far,
            setbacks=setbacks,
            zoning_code=zoning_code,
            parking_ratio=parking_ratio,
            lot_coverage=lot_coverage
        )

    @staticmethod
    def _extract_area(properties: Dict) -> float:
        """Extract area from properties."""
        area_str = str(properties.get("area", "10000"))
        area_str = area_str.replace(",", "")

        if "acre" in area_str.lower():
            numbers = re.findall(r'\d+\.?\d*', area_str)
            if numbers:
                return float(numbers[0]) * 43560

        numbers = re.findall(r'\d+\.?\d*', area_str)
        return float(numbers[0]) if numbers else 10000.0

    @staticmethod
    def _extract_height(constraints: Dict) -> float:
        """Extract maximum height."""
        height_str = str(constraints.get("max_height", "35"))
        numbers = re.findall(r'\d+\.?\d*', height_str)
        if numbers:
            height = float(numbers[0])
            return height * 3.28084 if height > 50 else height
        return 35.0

    @staticmethod
    def _extract_far(constraints: Dict) -> float:
        """Extract Floor Area Ratio."""
        far_str = str(constraints.get("far", "2.0"))
        numbers = re.findall(r'\d+\.?\d*', far_str)
        return float(numbers[0]) if numbers else 2.0

    @staticmethod
    def _extract_setbacks(constraints: Dict) -> Dict[str, float]:
        """Extract setback requirements."""
        setbacks = {}

        if "setbacks" in constraints and isinstance(constraints["setbacks"], dict):
            for key, value in constraints["setbacks"].items():
                if isinstance(value, (int, float)):
                    setbacks[key] = float(value)
                elif isinstance(value, str):
                    numbers = re.findall(r'\d+\.?\d*', value)
                    if numbers:
                        setbacks[key] = float(numbers[0])

        default_setbacks = {"front": 20, "rear": 20, "side": 10}
        for key, default in default_setbacks.items():
            if key not in setbacks:
                setbacks[key] = default

        return setbacks


if __name__ == "__main__":
    # Demo usage
    optimizer = MassingOptimizer()

    constraints = SiteConstraints(
        total_area=10000,
        max_height=45,
        max_far=3.0,
        setbacks={"front": 20, "rear": 20, "side": 10},
        zoning_code="R-4",
        parking_ratio=1.5,
        lot_coverage=0.7
    )

    solution = optimizer.optimize(constraints, OptimizationObjective.MAXIMIZE_VALUE)

    print("Optimization Results:")
    print(f"Total Units: {solution.total_units}")
    print(f"Total Area: {solution.total_area:.0f} SF")
    print(f"Total Value: ${solution.total_value:,.0f}")
    print(f"Building Height: {solution.building_height:.0f} ft")
    print(f"Floors: {solution.floor_count}")
    print(f"Unit Mix: {solution.unit_mix}")
    print(f"Efficiency: {solution.efficiency:.1%}")
