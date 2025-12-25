## Visualization Module

The visualization module provides a modular, extensible architecture for rendering floor plans:

### Features

- ✅ **Type-safe**: Pydantic models for all data
- ✅ **Configurable**: Output formats (PNG, SVG, PDF), colors, scale, DPI
- ✅ **Extensible**: Protocol-based design (easy to add HTML, Canvas renderers)
- ✅ **SOLID principles**: High cohesion, loose coupling

### Quick Example

```python
from gloq_massing.visualization import (
    MatplotlibFloorRenderer,
    RenderConfig,
    OutputFormat,
    load_solver_result,
)

# Load solver output
result = load_solver_result("examples/p1_output.json")

# Configure renderer
config = RenderConfig(
    output_format=OutputFormat.PNG,
    scale=3.0,
    show_labels=True,
    dpi=150,
)

# Render a floor
floor = result.building.get_floor(-1)
renderer = MatplotlibFloorRenderer(config)
renderer.render_floor(floor)
renderer.save("output/floor_-1.png")
```

