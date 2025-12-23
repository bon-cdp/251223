#!/usr/bin/env python3
"""
Test script for the GLOQ Massing Solver.

Loads P1 building data and runs the sheaf-wreath solver.
"""

import sys
import json
from pathlib import Path

# Add src to path for development
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from gloq_massing.parsing.json_loader import load_gloq_json
from gloq_massing.core.solver import solve_massing, SolverConfig
from gloq_massing.core.geometry import Polygon


def main():
    print("=" * 60)
    print("GLOQ Massing Solver - Test Run")
    print("=" * 60)

    # Load P1 building data
    data_path = Path(__file__).parent / "p1_building.json"
    print(f"\nLoading building data from: {data_path}")

    building = load_gloq_json(data_path)

    print(f"\nBuilding: {building.project_name}")
    print(f"  Stories: {building.stories_total} ({building.stories_above_grade} above, {building.stories_below_grade} below)")
    print(f"  Floor plate: {building.floor_plate_sf:,.0f} SF")
    print(f"  Total units: {building.total_dwelling_units}")
    print(f"  Unit breakdown:")
    for unit in building.dwelling_units:
        print(f"    - {unit.name}: {unit.count} units @ {unit.area_sf} SF ({unit.width_ft}'x{unit.height_ft}')")

    # Configure solver
    config = SolverConfig(
        grid_snap=1.0,
        corridor_width=6.0,
        allow_rotation=True,
        random_seed=42,
    )

    # Create lot geometry (placeholder square)
    lot_side = building.floor_plate_width
    lot = Polygon.rectangle(lot_side, lot_side)

    print(f"\nLot geometry: {lot_side:.1f}' x {lot_side:.1f}' ({lot.area():,.0f} SF)")

    # Run solver
    print("\n" + "-" * 60)
    print("Running sheaf-wreath solver...")
    print("-" * 60)

    result = solve_massing(building, lot, config)

    # Output results
    print(f"\n{'SUCCESS' if result.success else 'FAILED'}: {result.message}")
    print(f"Cohomological obstruction: {result.obstruction:.4f}")

    if result.violations:
        print(f"\nConstraint violations ({len(result.violations)} shown):")
        for v in result.violations[:5]:
            print(f"  - {v}")

    if result.sheaf:
        print("\n" + "-" * 60)
        print("Floor Summary")
        print("-" * 60)

        for floor_idx in result.sheaf.floor_indices:
            patch = result.sheaf.get_patch(floor_idx)
            placed = len(patch.placed_spaces)
            total = len(patch.spaces)
            units_on_floor = len([s for s in patch.placed_spaces
                                 if s.spec.category.name == 'DWELLING_UNIT'])

            print(f"\nFloor {floor_idx:+d} ({patch.floor_type.name}):")
            print(f"  Spaces: {placed}/{total} placed")
            print(f"  Units: {units_on_floor}")
            print(f"  Fill ratio: {patch.fill_ratio:.1%}")

            # Show some placed spaces
            for space in patch.placed_spaces[:3]:
                if space.position:
                    print(f"    - {space.spec.name}: ({space.position.x:.1f}, {space.position.y:.1f})")

        print("\n" + "-" * 60)
        print("Vertical Stalks (Core)")
        print("-" * 60)

        for stalk in result.sheaf.stalks:
            pos = f"({stalk.position.x:.1f}, {stalk.position.y:.1f})" if stalk.position else "not placed"
            print(f"  {stalk.id}: {pos} (floors {stalk.floor_range[0]} to {stalk.floor_range[1]})")

        # Save output
        output_path = Path(__file__).parent / "p1_output.json"
        with open(output_path, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)
        print(f"\n\nFull output saved to: {output_path}")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
