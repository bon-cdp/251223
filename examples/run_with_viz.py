#!/usr/bin/env python3
"""
Test script with visualization output.
"""

import sys
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from gloq_massing.parsing.json_loader import load_gloq_json
from gloq_massing.core.solver import solve_massing, SolverConfig
from gloq_massing.core.geometry import Polygon
from gloq_massing.visualization.renderer import save_building_html, save_floor_svg
from gloq_massing.visualization import (
    MatplotlibFloorRenderer,
    MatplotlibBuildingRenderer,
    RenderConfig,
    OutputFormat,
    load_solver_result,
)


def main():
    print("GLOQ Massing Solver - Test with Visualization")
    print("=" * 50)

    # Load building
    data_path = Path(__file__).parent / "p1_building.json"
    building = load_gloq_json(data_path)

    print(f"\nBuilding: {building.project_name}")
    print(f"Units: {building.total_dwelling_units} | Stories: {building.stories_total}")

    # Run solver
    config = SolverConfig(grid_snap=1.0, random_seed=42)
    lot = Polygon.rectangle(building.floor_plate_width, building.floor_plate_width)

    print("\nSolving...")
    result = solve_massing(building, lot, config)

    print(f"\nResult: {'SUCCESS' if result.success else 'FAILED'}")
    print(f"Obstruction: {result.obstruction:.4f}")

    if result.sheaf:
        # Save outputs
        output_dir = Path(__file__).parent

        # JSON output
        json_path = output_dir / "p1_output.json"
        with open(json_path, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)
        print(f"\nJSON saved: {json_path}")

        # HTML visualization
        html_path = output_dir / "p1_floors.html"
        save_building_html(result.sheaf, html_path, scale=2.5)
        print(f"HTML saved: {html_path}")

        # Individual floor SVGs
        for floor_idx in result.sheaf.floor_indices:
            patch = result.sheaf.get_patch(floor_idx)
            svg_path = output_dir / f"p1_floor_{floor_idx:+d}.svg"
            save_floor_svg(patch, svg_path, scale=3.0)

        print(f"Floor SVGs saved: p1_floor_*.svg")

        # Dev's matplotlib renderer (PNG output)
        print("\nRendering with matplotlib...")
        typed_result = load_solver_result(str(json_path))

        config_png = RenderConfig(
            output_format=OutputFormat.PNG,
            scale=3.0,
            show_labels=True,
            dpi=150,
        )

        # Render building grid
        building_renderer = MatplotlibBuildingRenderer(config_png, cols=3)
        building_renderer.render_building(typed_result.building)
        grid_path = output_dir / "p1_building_grid.png"
        building_renderer.save(grid_path)
        print(f"Building grid PNG saved: {grid_path}")

        # Summary stats
        total_placed = sum(len(p.placed_spaces) for p in result.sheaf.patches.values())
        total_spaces = sum(len(p.spaces) for p in result.sheaf.patches.values())
        print(f"\nPlaced {total_placed}/{total_spaces} spaces ({100*total_placed/total_spaces:.1f}%)")

    print("\nDone! Open p1_floors.html in a browser to view.")


if __name__ == "__main__":
    main()
