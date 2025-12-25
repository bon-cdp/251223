"""
Example: Render floor plans from solver output JSON using matplotlib.

Demonstrates:
1. Loading typed solver output
2. Configurable rendering
3. Multiple output formats
"""

from pathlib import Path

from gloq_massing.visualization import (
    MatplotlibFloorRenderer,
    MatplotlibBuildingRenderer,
    RenderConfig,
    OutputFormat,
    load_solver_result,
)


def main() -> None:
    """Render floor plans from p1_output.json."""

    # Load solver output into typed models
    print("Loading solver output...")
    result = load_solver_result("examples/p1_output.json")

    print(f"✓ Loaded {len(result.building.floors)} floors")
    print(f"  Total spaces: {result.metrics.total_spaces}")
    print(f"  Placed spaces: {result.metrics.placed_spaces}")
    print(f"  Placement rate: {result.metrics.placement_rate}")

    # Configuration for PNG output
    config_png = RenderConfig(
        output_format=OutputFormat.PNG,
        scale=3.0,
        show_labels=True,
        dpi=150,
    )

    # Configuration for SVG output (vector)
    config_svg = RenderConfig(
        output_format=OutputFormat.SVG,
        scale=3.0,
        show_labels=True,
    )

    # Render individual floors
    print("\nRendering individual floors...")
    output_dir = Path("examples/rendered_floors")
    output_dir.mkdir(exist_ok=True)

    for floor in result.building.floors:
        # PNG version
        renderer_png = MatplotlibFloorRenderer(config_png)
        renderer_png.render_floor(floor)
        png_path = output_dir / f"floor_{floor.floor_index:+d}.png"
        renderer_png.save(png_path)
        print(f"  ✓ {png_path.name}")

        # SVG version
        renderer_svg = MatplotlibFloorRenderer(config_svg)
        renderer_svg.render_floor(floor)
        svg_path = output_dir / f"floor_{floor.floor_index:+d}.svg"
        renderer_svg.save(svg_path)

    # Render all floors in a grid
    print("\nRendering building grid...")
    building_renderer = MatplotlibBuildingRenderer(config_png, cols=3)
    building_renderer.render_building(result.building)
    grid_path = output_dir / "building_grid.png"
    building_renderer.save(grid_path)
    print(f"  ✓ {grid_path.name}")

    print(f"\n✓ All renders complete! Check {output_dir}/")


if __name__ == "__main__":
    main()
