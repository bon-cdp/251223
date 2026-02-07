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



---

```
251223/
├── web-viewer/                # Floorplan Viewer (React/Vite)
│   ├── src/                   # Source code
│   │   ├── utils/             # Massing logic & geometry
│   │   └── components/        # UI components
│   └── public/data/           # Input/Output JSONs
├── data/                      # Additional data files
└── .github/                   # Configuration
```

---

## Running the Project

### Web Viewer

The web viewer serves as both the interface and the solver execution environment.

```bash
cd web-viewer
npm install
npm run dev
```

### Regenerating Outputs

To run the solver logic (TypeScript) and regenerate output files in `public/data`:

```bash
cd web-viewer
npx tsx scripts/regenerate-outputs.ts
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

1. Add to configuration in `web-viewer/src/constants` or relevant config.
2. Handle in `web-viewer/src/utils/massingGenerator.ts` (or equivalent).



---

## Debugging Tips

- Check `SolverResult.violations` for constraint failures with magnitudes
- Use `sheaf.get_all_spaces()` to iterate all placed/unplaced spaces
- `space.is_placed` and `space.geometry` reveal placement state
- Cohomological obstruction > 0 indicates gluing failures (vertical misalignment)
