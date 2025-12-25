# GLOQ Massing Solver

A **sheaf-theoretic building massing solver** that places building spaces (apartments, MEP, circulation, etc.) onto floor plates using algebraic topology concepts. The system ingests GLOQ Space Allocation Analysis data (JSON) and outputs placed floor plans with configurable visualization.

## Overview

The solver models buildings as a **sheaf over discrete floor indices**:
- **Patches**: Local sections representing each floor with spaces to place
- **Stalks**: Vertical elements (elevators, stairs, shafts) that pierce through floors
- **Gluing constraints**: Ensure vertical alignment across floors via stalk consistency
- **Cohomology**: Measures obstruction to valid placement (0 = perfect solution)

For detailed mathematical background, see [Mathematical Exploration](./Deep%20Mathematical%20Exploration_%20Sheaf%20Cohomology%20for%20Building%20Massing.md), [AGENTS.md](./AGENTS.md).

---

## Project Setup

### Prerequisites

- **Python**: ≥ 3.13 (see [.python-version](./.python-version))
- **uv**: Package manager ([install guide](https://github.com/astral-sh/uv))

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd 251223

# Install dependencies with uv
uv sync

## Optionally activate the virtual environment
## in your current terminal shell
# On Mac or Linux
source .venv/bin/activate

# On Windows
.venv\Scripts\activate
```

### Dependencies

Core dependencies (see [pyproject.toml](./pyproject.toml)):

---

## Project Structure

```
251223/
├── src/gloq_massing/          # Main package
│   ├── core/                  # Solver and domain logic
│   │   ├── solver.py          # solve_massing(), placement algorithms
│   ├── parsing/
│   │   └── json_loader.py     # GLOQ JSON → BuildingSpec conversion
│   ├── schemas/               # Pydantic models for data interchange
│   │   └── solver_output.py   # SolverResult, FloorData, SpaceData types
│   └── visualization/         # Rendering and visualization
│       └── protocols.py       # Abstract renderer interfaces
├── examples/                  # Example scripts and data
│   ├── p1_building.json       # Input: GLOQ building specification
│   ├── p1_output.json         # Output: Solver result
│   ├── run_solver.py          # Run the solver
│   ├── run_with_viz.py        # Run solver + SVG visualization
│   └── render_from_json.py    # Render from output JSON
└── data/                      # Additional data files
```

---

## Running the Project

### 1. Run the Solver

Process a building specification and generate a placement solution:

```bash
uv run examples/run_solver.py
```

**Output**:
- Console output with placement statistics
- `examples/p1_output.json` - Full solver result in JSON format

### 2. Run with Visualization (SVG)

```bash
uv run examples/run_with_viz.py
```

**Output**:
- `examples/p1_floors.html` - Interactive HTML with all floor SVGs
- Individual SVG files for each floor

### 3. Render from JSON (New Visualization Module)

Use the new configurable matplotlib renderer:

```bash
PYTHONPATH=src uv run python examples/render_from_json.py
```

**Output** (in `examples/rendered_floors/`):
- PNG files for each floor: `floor_-1.png`, `floor_+0.png`, etc.
- SVG files for each floor (vector format)
- `building_grid.png` - All floors in a grid layout

**Configurable options with sane defaults**: See [visualization/config.py](./src/gloq_massing/visualization/config.py) for:
- Output formats: PNG, SVG, PDF
- Color schemes
- DPI, scale, labels, margins

---

## Running Tests (TODO)

> **Note**: No formal test suite currently exists. 

To verify the installation and run basic validation:

```bash
# Test schema parsing
uv run python -c "
import json
from pathlib import Path
from gloq_massing.schemas import SolverResult

data = json.loads(Path('examples/p1_output.json').read_text())
result = SolverResult.model_validate(data)
print(f'✓ Parsed {len(result.building.floors)} floors, {result.metrics.total_spaces} spaces')
"

# Test visualization
PYTHONPATH=src uv run python examples/render_from_json.py
```

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

---

## Conventions

- **Coordinate system**: Center-based rectangles, Y-up, units in feet
- **Rotation**: 0, 90, 180, 270 degrees only (90-degree snap)
- **Placement order**: Vertical stalks → dwelling units → support → MEP
- **Naming**: Space IDs follow `{category}_{type}_{index}_f{floor}` format
- **Violations**: Tracked as constraint violations with magnitude (0 = satisfied)

---

## Adding New Features

### Add a New Space Type

1. Add to `SpaceCategory` enum in [src/gloq_massing/core/building.py](./src/gloq_massing/core/building.py)
2. Add color mapping in [src/gloq_massing/visualization/config.py](./src/gloq_massing/visualization/config.py)
3. Handle in `place_floor_spaces()` in [src/gloq_massing/core/solver.py](./src/gloq_massing/core/solver.py)

### Add a New Renderer (e.g., HTML)

Implement the protocol interfaces:

```python
from gloq_massing.visualization.protocols import FloorRenderer
from gloq_massing.visualization.config import RenderConfig

class HTMLFloorRenderer:
    def __init__(self, config: RenderConfig): ...
    def render_floor(self, floor: FloorData): ...
    def save(self, path: Path): ...
```

No modifications needed to existing code!

---

## Debugging Tips

- Check `SolverResult.violations` for constraint failures with magnitudes
- Use `sheaf.get_all_spaces()` to iterate all placed/unplaced spaces
- `space.is_placed` and `space.geometry` reveal placement state
- Cohomological obstruction > 0 indicates gluing failures (vertical misalignment)
