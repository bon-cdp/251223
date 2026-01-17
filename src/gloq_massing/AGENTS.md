# GLOQ Massing Solver - Python Package

A sheaf-theoretic building massing solver that places architectural spaces onto floor plates using algebraic topology concepts.

## Package Structure

```
src/gloq_massing/
├── core/                    # Solver and domain logic
│   ├── building.py          # Domain types: BuildingSpec, SpaceSpec, enums
│   ├── sheaf.py             # Sheaf structures: Space, FloorPatch, VerticalStalk
│   ├── solver.py            # Main solver: solve_massing(), placement algorithms
│   ├── constraints.py       # Constraint system: boundary, overlap, adjacency
│   ├── geometry.py          # Primitives: Point, Rectangle, Polygon
│   └── fuzzy.py             # Fuzzy scaling: area tolerance (±25%)
├── parsing/
│   └── json_loader.py       # GLOQ JSON → BuildingSpec conversion
├── schemas/
│   └── solver_output.py     # Pydantic v2 models for JSON serialization
├── visualization/
│   ├── config.py            # Rendering configuration (colors, DPI, formats)
│   ├── renderer.py          # SVG rendering utilities
│   ├── matplotlib_renderer.py  # Matplotlib-based renderer (PNG/SVG/PDF)
│   ├── protocols.py         # Abstract renderer interfaces
│   └── utils.py             # Visualization helpers
├── pipeline/                # Optional PDF→solver pipeline
│   ├── pdf_extractor.py     # PDF text extraction
│   ├── llm_integrator.py    # LLM-based data extraction
│   ├── massing_optimizer.py # Optimization loops
│   ├── solver_parser.py     # Parse solver results
│   └── run_pipeline.py      # Pipeline orchestration
└── api/                     # API interfaces (placeholder)
```

## Key Files Reference

### Core Domain (`core/`)

| File | Purpose | Key Classes/Functions |
|------|---------|----------------------|
| `building.py` | Domain types and enums | `BuildingSpec`, `SpaceSpec`, `DwellingUnit`, `FloorType`, `SpaceCategory`, `FloorAssignment` |
| `sheaf.py` | Sheaf data structures | `Space`, `FloorPatch`, `VerticalStalk`, `Sheaf` |
| `solver.py` | Main solver algorithm | `solve_massing()`, `SolverConfig`, `SolverResult`, `place_floor_spaces()` |
| `constraints.py` | Constraint validation | `check_boundary()`, `check_overlap()`, `check_adjacency()`, `ConstraintViolation` |
| `geometry.py` | Geometric primitives | `Point`, `Rectangle`, `Polygon`, coordinate transforms |
| `fuzzy.py` | Fuzzy scaling logic | `fuzzy_scale()`, `compute_membership()`, area tolerance functions |

### Data Flow

```
┌────────────────────────────────────────────────────────────────────┐
│  INPUT: GLOQ JSON (examples/p1_building.json)                      │
└────────────────────────┬───────────────────────────────────────────┘
                         ↓
┌────────────────────────┴───────────────────────────────────────────┐
│  parsing/json_loader.py                                             │
│  - load_gloq_json(path) → dict                                      │
│  - parse_gloq_data(data) → BuildingSpec                            │
└────────────────────────┬───────────────────────────────────────────┘
                         ↓
┌────────────────────────┴───────────────────────────────────────────┐
│  core/solver.py                                                     │
│  - construct_sheaf(BuildingSpec) → Sheaf                           │
│  - solve_massing(Sheaf, SolverConfig) → SolverResult               │
│    1. Place vertical core (elevators, stairs)                       │
│    2. Place floor spaces (strip-packing algorithm)                  │
│    3. Propagate stalk positions                                     │
│    4. Verify constraints & compute cohomology                       │
└────────────────────────┬───────────────────────────────────────────┘
                         ↓
┌────────────────────────┴───────────────────────────────────────────┐
│  schemas/solver_output.py                                           │
│  - SolverResult.to_dict() → JSON-serializable dict                 │
│  - Pydantic v2 models: FloorData, SpaceData, Geometry, Metrics     │
└────────────────────────┬───────────────────────────────────────────┘
                         ↓
┌────────────────────────┴───────────────────────────────────────────┐
│  visualization/                                                     │
│  - render_floor_svg(floor, config) → SVG string                    │
│  - MatplotlibRenderer.render() → PNG/SVG/PDF files                 │
└────────────────────────────────────────────────────────────────────┘
```

## Enums Reference

### SpaceCategory (core/building.py)
```python
class SpaceCategory(Enum):
    DWELLING = "dwelling"       # Residential units
    MEP = "mep"                 # Mechanical/Electrical/Plumbing
    CIRCULATION = "circulation" # Corridors, lobbies
    VERTICAL = "vertical"       # Elevators, stairs, shafts
    RETAIL = "retail"          # Ground floor retail
    AMENITY = "amenity"        # Shared amenities
    PARKING = "parking"        # Parking spaces
    STORAGE = "storage"        # Storage units
    OFFICE = "office"          # Office spaces
    COMMON = "common"          # Common areas
    SERVICE = "service"        # Service rooms
    EXTERIOR = "exterior"      # Exterior spaces
    CORE = "core"              # Building core
    OTHER = "other"            # Miscellaneous
```

### FloorType (core/building.py)
```python
class FloorType(Enum):
    BASEMENT = "basement"
    GROUND = "ground"
    TYPICAL = "typical"
    PODIUM = "podium"
    ROOF = "roof"
```

### FloorAssignment (core/building.py)
```python
class FloorAssignment(Enum):
    GROUND = "ground"      # Ground floor only
    TYPICAL = "typical"    # Typical residential floors
    VERTICAL = "vertical"  # Spans multiple floors
    ALL = "all"           # All floors
```

## Solver Algorithm

### Placement Order
1. **Vertical stalks/core** (elevators, stairs) - placed first at floor center
2. **Dwelling units** - strip-packing with double-loaded corridor
3. **Support spaces** - fit around dwelling units
4. **MEP** - placed last in remaining space

### Fuzzy Scaling
Spaces can deviate ±25% from target area to improve fit:
```python
# In solver.py
config = SolverConfig(
    fuzzy=FuzzyConfig(
        enabled=True,
        min_scale=0.75,  # -25%
        max_scale=1.25,  # +25%
    )
)

# Space tracks actual vs target
space.set_fuzzy_dimensions(width, height, membership)
space.area_deviation  # Returns % deviation from target
space.membership      # Returns membership score ∈ [0,1]
```

### Cohomological Obstruction
```python
# 0 = perfect placement (no vertical misalignment)
# > 0 = gluing failures between floors
result.metrics.obstruction  # float
```

## Running the Solver

```bash
# Install dependencies (Python >= 3.13)
uv sync

# Run basic solver
uv run examples/run_solver.py
# Output: examples/p1_output.json

# Run with visualization
uv run examples/run_with_viz.py
# Output: examples/p1_floors.html, examples/p1_floor_*.svg

# Render from existing JSON
PYTHONPATH=src uv run python examples/render_from_json.py
# Output: examples/rendered_floors/*
```

## Optional Pipeline (PDF → Solver)

```bash
# Install pipeline extras
uv sync --extra pipeline --extra llm

# Set API key
export OPENAI_API_KEY=your_key
# or
export DASHSCOPE_API_KEY=your_key

# Run pipeline
uv run python -m gloq_massing.pipeline.run_pipeline input.pdf
```

## Making Changes

### Adding a New Space Category
1. Add to `SpaceCategory` enum in `core/building.py`
2. Add color mapping in `CATEGORY_COLORS` in `visualization/config.py`
3. Handle in `place_floor_spaces()` routing in `core/solver.py`
4. Update TypeScript types in `web-viewer/src/types/solverOutput.ts`

### Modifying Placement Logic
- `core/solver.py`: Main placement algorithm
- `core/constraints.py`: Constraint validation rules

### Changing Output Schema
1. Update Pydantic models in `schemas/solver_output.py`
2. Update `SolverResult.to_dict()` in `core/solver.py`
3. **Sync with TypeScript**: Update `web-viewer/src/types/solverOutput.ts`

### Adding a New Renderer
1. Implement `RendererProtocol` from `visualization/protocols.py`
2. Add configuration options in `visualization/config.py`

## Conventions

- **Coordinate system**: Center-based, Y-up, units in feet
- **Rotations**: 0, 90, 180, 270 degrees only
- **Space IDs**: `{category}_{type}_{index}_f{floor}` (e.g., `unit_studio_5_f3`)
- **Violations**: Tracked as `ConstraintViolation` with magnitude (0 = satisfied)
- **Imports**: Prefer `PYTHONPATH=src` over `sys.path` hacks

## Debugging

```python
# Check constraint violations
for v in result.violations:
    print(f"{v.type}: {v.magnitude} at {v.location}")

# Iterate all spaces
for space in sheaf.get_all_spaces():
    print(f"{space.id}: placed={space.is_placed}, area={space.area}")

# Check fuzzy scaling
print(f"Membership: {space.membership}, Deviation: {space.area_deviation}%")

# Check cohomology
print(f"Obstruction: {result.metrics.obstruction}")
```

## Dependencies

### Core (pyproject.toml)
- `numpy>=2.4.0` - Numerical computations
- `matplotlib>=3.10.8` - Visualization rendering
- `pydantic>=2.12.5` - Data validation and schemas

### Optional
- `pdfplumber>=0.10.3` - PDF extraction (pipeline extra)
- `openai>=1.12.0` - OpenAI integration (llm extra)
- `dashscope>=1.14.0` - Alibaba DashScope (llm extra)
