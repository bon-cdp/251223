"""
Test rotation feature: Create minimal floor plan with rotated spaces.

Tests various rotation angles (0°, 45°, 90°, 180°, 270°) to verify:
1. Rectangles rotate around their center point
2. Labels stay aligned with rotated spaces
3. 90°/270° rotations correctly swap width/height
"""

from pathlib import Path

from gloq_massing.schemas import (
    FloorData,
    SpaceData,
    Geometry,
)
from gloq_massing.visualization import (
    MatplotlibFloorRenderer,
    RenderConfig,
    OutputFormat,
)


def create_test_floor() -> FloorData:
    """Create a minimal floor with spaces at different rotations."""

    # Define a simple rectangular boundary
    boundary = [
        [0.0, 0.0],
        [100.0, 0.0],
        [100.0, 80.0],
        [0.0, 80.0],
        [0.0, 0.0],
    ]

    # Create spaces with different rotations
    # All spaces have same dimensions (20x10) but different rotations
    spaces = [
        SpaceData(
            id="space_0",
            type="office",
            name="0° Rotation",
            floor_index=0,
            geometry=Geometry(x=20, y=40, width=20, height=10, rotation=0),
            target_area_sf=200,
            actual_area_sf=200,
            membership=1.0,
            area_deviation="0%",
            is_vertical=False,
        ),
        SpaceData(
            id="space_45",
            type="office",
            name="45° Rotation",
            floor_index=0,
            geometry=Geometry(x=40, y=60, width=20, height=10, rotation=45),
            target_area_sf=200,
            actual_area_sf=200,
            membership=1.0,
            area_deviation="0%",
            is_vertical=False,
        ),
        SpaceData(
            id="space_330",
            type="office",
            name="330° Rotation",
            floor_index=0,
            geometry=Geometry(x=20, y=20, width=20, height=10, rotation=330),
            target_area_sf=200,
            actual_area_sf=200,
            membership=1.0,
            area_deviation="0%",
            is_vertical=False,
        ),
        SpaceData(
            id="space_90",
            type="office",
            name="90° Rotation",
            floor_index=0,
            geometry=Geometry(x=50, y=40, width=20, height=10, rotation=90),
            target_area_sf=200,
            actual_area_sf=200,
            membership=1.0,
            area_deviation="0%",
            is_vertical=False,
        ),
        SpaceData(
            id="space_180",
            type="office",
            name="180° Rotation",
            floor_index=0,
            geometry=Geometry(x=70, y=20, width=20, height=10, rotation=180),
            target_area_sf=200,
            actual_area_sf=200,
            membership=1.0,
            area_deviation="0%",
            is_vertical=False,
        ),
        SpaceData(
            id="space_270",
            type="elevator",
            name="270° Rotation",
            floor_index=0,
            geometry=Geometry(x=80, y=60, width=20, height=10, rotation=270),
            target_area_sf=200,
            actual_area_sf=200,
            membership=1.0,
            area_deviation="0%",
            is_vertical=True,
        ),
    ]

    return FloorData(
        floor_index=0,
        floor_type="test",
        boundary=boundary,
        area_sf=8000,
        spaces=spaces,
    )


def main() -> None:
    """Generate test images for rotated spaces."""

    print("Creating test floor with rotated spaces...")
    floor = create_test_floor()

    print(f"✓ Created floor with {len(floor.spaces)} spaces")
    for space in floor.spaces:
        print(f"  - {space.name}: rotation={space.geometry.rotation}°")

    # Create output directory
    output_dir = Path("examples/rendered_floors/test_rotation")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Render with labels (PNG)
    print("\nRendering with labels (PNG)...")
    config_png = RenderConfig(
        output_format=OutputFormat.PNG,
        scale=3.0,
        show_labels=True,
        dpi=150,
    )
    renderer_png = MatplotlibFloorRenderer(config_png)
    renderer_png.render_floor(floor)
    png_path = output_dir / "rotation_test_labeled.png"
    renderer_png.save(png_path)
    print(f"  ✓ Saved: {png_path}")

    # Render without labels (SVG)
    print("\nRendering without labels (SVG)...")
    config_svg = RenderConfig(
        output_format=OutputFormat.SVG,
        scale=3.0,
        show_labels=False,
    )
    renderer_svg = MatplotlibFloorRenderer(config_svg)
    renderer_svg.render_floor(floor)
    svg_path = output_dir / "rotation_test_unlabeled.svg"
    renderer_svg.save(svg_path)
    print(f"  ✓ Saved: {svg_path}")

    print(f"\n✓ Test complete! Check {output_dir}/ for rendered images")
    print("\nExpected behavior:")
    print("  - All rectangles should rotate around their center point")
    print("  - Labels should remain centered on each space")
    print("  - 90° and 270° spaces should appear taller than wide")
    print("  - Elevator space (270°) should have dashed border")


if __name__ == "__main__":
    main()
