# GLOQ Massing Solver

## Project Overview

This is a **sheaf-theoretic building massing solver** that places building spaces (apartments, MEP, circulation, etc.) onto floor plates using algebraic topology concepts. The system ingests GLOQ Space Allocation Analysis data (JSON) and outputs placed floor plans with SVG visualization.

### Core Mathematical Model

The building is modeled as a **sheaf over discrete floor indices**:
- **Patches (FloorPatch)**: Local sections representing each floor with spaces to place
- **Stalks (VerticalStalk)**: Vertical elements (elevators, stairs, shafts) that pierce through floors
- **Gluing constraints**: Ensure vertical alignment across floors via stalk consistency
- **Cohomology**: Measures obstruction to valid placement (0 = perfect solution)

### Mathematical Theory

The solver implements a **sheaf-theoretic** approach to massing:

#### Sheaf Structure
- **Base Space ($X$)**: The set of discrete floors $\{F_{-1}, F_0, \dots, F_n\}$.
- **Sheaf ($F$)**: Assigns a set of valid space configurations to each floor.
- **Stalks**: Vertical elements (elevators, stairs) that exist across all floors in the stalk's support.
- **Sections**: A global section $s \in \Gamma(X, F)$ is a valid building massing.

#### Cohomology & Obstruction
We compute the **Čech cohomology** $H^1(X, F)$ to measure obstruction:
- **$C^0$ (0-cochains)**: Independent valid layouts for each floor.
- **$C^1$ (1-cochains)**: Differences in vertical element positions between adjacent floors.
- **Obstruction**: Non-zero $H^1$ indicates vertical misalignment (gluing failure).
- **Goal**: Minimize obstruction to 0 while maximizing placement rate.

#### Fuzzy Logic Integration
To handle real-world constraints, we use fuzzy set theory:
- **Membership $\mu(A)$**: Measures how well a space's area fits the target (1.0 = perfect, 0.0 = >25% deviation).
- **Soft Constraints**: Allows spaces to stretch/shrink within tolerance to resolve packing conflicts.

## Architecture

```
src/gloq_massing/
├── core/               # Solver and domain logic
│   ├── building.py     # Domain types: BuildingSpec, SpaceSpec, DwellingUnit
│   ├── sheaf.py        # Sheaf structures: Space, FloorPatch, VerticalStalk, Sheaf
│   ├── solver.py       # Main solver: solve_massing(), placement algorithms
│   ├── constraints.py  # Constraint system: boundary, overlap, adjacency
│   ├── geometry.py     # Primitives: Point, Rectangle, Polygon
│   └── fuzzy.py        # Fuzzy scaling: area tolerance (±25%) for flexible placement
├── parsing/
│   └── json_loader.py  # GLOQ JSON → BuildingSpec conversion
└── visualization/
    └── renderer.py     # Floor plan → SVG rendering
```

## Key Patterns

### Space Categories and Floor Assignment
Spaces use `SpaceCategory` enum and `FloorAssignment` to control placement:
```python
# From building.py - spaces are assigned to specific floor types
class FloorAssignment(Enum):
    GROUND = "ground"     # Ground floor only
    TYPICAL = "typical"   # Typical residential floors
    VERTICAL = "vertical" # Spans multiple floors (elevator, stair)
```

### The Solve Algorithm (solver.py)
1. **Construct sheaf** from BuildingSpec → creates patches and stalks
2. **Place vertical core** first (elevators, stairs at floor center)
3. **Place floor spaces** using strip-packing with double-loaded corridor
4. **Propagate stalk positions** to floor instances
5. **Verify constraints** and compute cohomological obstruction

### Fuzzy Scaling for Area Tolerance
Spaces can deviate ±25% from target area for better fit (see `fuzzy.py`):
```python
# Spaces track actual vs target dimensions
space.set_fuzzy_dimensions(width, height, membership)  # membership ∈ [0,1]
space.area_deviation  # Returns percentage deviation from target
```

### Data Flow
```
GLOQ JSON → json_loader.parse_gloq_data() → BuildingSpec
  → construct_sheaf() → Sheaf
  → solve_massing() → SolverResult (with placed Sheaf)
  → render_floor_svg() → SVG visualization
```

## Running the Solver

This project uses `uv` for dependency management.

```bash
# Run the basic solver
uv run examples/run_solver.py

# Run with visualization
uv run examples/run_with_viz.py
```

Example input: `examples/p1_building.json` (GLOQ schema)  
Example output: `examples/p1_output.json`, `examples/p1_floors.html`

## Conventions

- **Coordinate system**: Center-based rectangles, Y-up, units in feet
- **Rotation**: 0, 90, 180, 270 degrees only (90-degree snap)
- **Placement order**: Vertical stalks → dwelling units → support → MEP
- **Naming**: `space.id` format is `{category}_{type}_{index}_f{floor}` (e.g., `unit_studio_5_f3`)
- **Violations**: Tracked as constraint violations with magnitude (0 = satisfied)

## Adding New Space Types

1. Add to `SpaceCategory` enum in `src/gloq_massing/core/building.py`
2. Add color mapping in `CATEGORY_COLORS` in `src/gloq_massing/visualization/renderer.py`
3. Handle in `place_floor_spaces()` category routing in `src/gloq_massing/core/solver.py`

## Debugging Tips

- Check `SolverResult.violations` for constraint failures with magnitudes
- Use `sheaf.get_all_spaces()` to iterate all placed/unplaced spaces
- `space.is_placed` and `space.geometry` reveal placement state
- Cohomological obstruction > 0 indicates gluing failures
